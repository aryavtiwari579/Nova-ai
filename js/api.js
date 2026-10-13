const MAX_HISTORY = 24;
const TIMEOUT_MS = 45000;
export async function askNova(messages, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const response = await fetch('/.netlify/functions/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.slice(-MAX_HISTORY) }), signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Nova could not answer just now. Please try again.');
    if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('Nova returned an empty response. Please try again.');
    return data.answer;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(signal?.aborted ? 'Generation stopped.' : 'The request took too long. Please try again.');
    throw error;
  } finally { clearTimeout(timer); }
}
