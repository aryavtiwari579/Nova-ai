const LIMIT = 8000;
const MAX_MESSAGES = 24;
const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});
export default async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Please send a chat message using POST.' });
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return json(503, { error: 'Nova is not configured yet. Add GROQ_API_KEY to your Netlify environment variables.' });
  let payload;
  try { payload = await request.json(); } catch { return json(400, { error: 'The request was not valid JSON.' }); }
  const messages = payload?.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) return json(400, { error: `Send between 1 and ${MAX_MESSAGES} recent messages.` });
  for (const item of messages) {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || !item.content.trim() || item.content.length > LIMIT) return json(400, { error: 'A message is empty or exceeds the 8,000 character limit.' });
  }
  if (messages.at(-1).role !== 'user') return json(400, { error: 'The last message must be from you.' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b', messages: [{ role: 'system', content: 'You are Nova, a helpful, thoughtful AI assistant. Use clear Markdown formatting when it improves readability.' }, ...messages], temperature: 0.7, max_completion_tokens: 2048 })
    });
    if (!upstream.ok) {
      if ([401, 403].includes(upstream.status)) return json(502, { error: 'Nova could not authenticate with Groq. Check the configured API key.' });
      if (upstream.status === 429) return json(429, { error: 'Groq is receiving too many requests or your usage limit was reached. Wait a moment and try again.' });
      if (upstream.status === 400) return json(502, { error: 'The selected Groq model may be unavailable. Check GROQ_MODEL in your environment settings.' });
      return json(502, { error: 'Groq is temporarily unavailable. Please try again shortly.' });
    }
    const data = await upstream.json();
    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) return json(502, { error: 'Groq returned an empty response. Please try again.' });
    return json(200, { answer });
  } catch (error) {
    return json(502, { error: error.name === 'AbortError' ? 'Groq took too long to respond. Please try again.' : 'Could not reach Groq. Check your connection and try again.' });
  } finally { clearTimeout(timer); }
};
