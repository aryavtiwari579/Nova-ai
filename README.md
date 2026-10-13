# Nova AI

Nova AI is a responsive AI chatbot built with HTML, CSS, and vanilla JavaScript. It sends questions to Groq through a Netlify Function, keeping the API key on the server. Conversations are saved in the browser, and replies can include formatted text, code, and tables.

## Project screenshots

### Chat home

The landing screen offers a clean starting point, suggested prompts, searchable conversations, and a message composer.

![Nova AI landing page](images/LandingPage.png)

### Formatted AI response

Assistant replies are formatted for easier reading, including structured comparison tables.

![Nova AI formatted response](images/Response.png)

## Features

- Create, search, rename, delete, clear, switch, and export conversations
- Save conversations in this browser's `localStorage` (they do not sync between devices)
- Include recent messages as context for follow-up questions
- Format assistant replies as Markdown, including headings, lists, code blocks, links, and tables
- Copy replies or code blocks, regenerate the latest reply, and stop waiting for a response
- Light and dark themes, responsive layout, loading indicator, and friendly error messages
- Validate requests and handle Groq timeouts and API errors on the server

## Project flow: what happens when you send a message

1. **The browser displays the interface.** Netlify serves `public/index.html`, `public/css/style.css`, and the JavaScript modules in `public/js/`. The HTML defines the chat layout, CSS controls its appearance, and JavaScript makes the controls work.
2. **`js/app.js` handles your actions.** When you submit a message, it adds it to the current conversation, updates the title from the first message, and saves the chat list in browser `localStorage`. The same browser can restore the conversation after a refresh.
3. **The app prepares conversation context.** It passes recent user and assistant messages to `js/api.js`, so Groq can answer follow-up questions using the earlier chat.
4. **`js/api.js` calls the Netlify Function.** It uses `fetch()` to POST JSON to `/.netlify/functions/chat`. The browser sends the conversation text, but never sends the Groq API key.
5. **Netlify runs `netlify/functions/chat.mjs`.** The function validates the HTTP method, JSON body, message roles, message count, and message lengths. It accepts up to 24 recent messages, each up to 8,000 characters.
6. **The function reads server environment variables.** It reads the secret from `GROQ_API_KEY` and the model from `GROQ_MODEL`. If `GROQ_MODEL` is unset, the function uses `openai/gpt-oss-120b`. These values are not returned to the browser.
7. **The function calls Groq.** It sends the validated conversation to Groq's chat completions API with a server-side timeout.
8. **The function returns JSON.** On success, it returns the assistant text as `{ "answer": "..." }`. For configuration, validation, authentication, rate limit, model, timeout, or network errors, it returns a clear message without exposing the key or raw server details.
9. **The browser renders and saves the answer.** `js/app.js` formats Markdown such as headings, lists, code blocks, and tables, then stores the assistant message in localStorage. The renderer escapes text before adding markup so AI output is not treated as arbitrary HTML.

```text
You type a message
       |
       v
public page -> js/app.js -> save conversation in localStorage
                    |
                    v
                 js/api.js -- POST /.netlify/functions/chat
                                      |
                                      v
                         netlify/functions/chat.mjs
                         validate input + read server env vars
                                      |
                                      v
                              Groq chat API
                                      |
                                      v
answer JSON <- Netlify Function <- Groq response
       |
       v
render answer + save conversation in localStorage
```

### Run the full app locally

Use `npm run dev` and open the URL printed by Netlify CLI, usually `http://localhost:8888`. Keep the terminal running while you use the chat.

VS Code's **Go Live** extension only serves static files. It does not run the Netlify Function, so chat requests will fail if you open the project on a Go Live address such as port 5500.

## Technologies and folders

- HTML, CSS, and vanilla JavaScript modules
- Netlify CLI and Netlify Functions
- Groq chat completions API

```text
index.html                 Source copy of the page
css/style.css              Source copy of the styles
js/app.js                  Chat interface, storage, and response rendering
js/api.js                  Browser request to the Netlify Function
public/index.html           Netlify's published page
public/css/style.css        Netlify's published stylesheet
public/js/app.js            Netlify's published app module
public/js/api.js            Netlify's published API module
netlify/functions/chat.mjs  Server-side Groq proxy
netlify.toml                Netlify publish and function settings
images/                     Project screenshots used in this README
.env.example                Placeholder environment values
.gitignore                  Excludes .env, dependencies, and local Netlify files
README.md                   Setup and project guide
```

Netlify publishes only the `public` folder, which keeps local files such as `.env` outside the static website. The function is in `netlify/functions/` and does not need an external package to run.

## Prerequisites

Install a current Node.js LTS release and npm. Create a Groq account and an API key in its developer console. Keep the key private.

## Local setup

1. Open a terminal in this project folder.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env`.
4. Open `.env` and replace `your_groq_api_key_here` with your Groq key. Keep `.env` private; it is ignored by Git.
5. Leave `GROQ_MODEL=openai/gpt-oss-120b`, or change it to a model available to your Groq account.
6. Run `npm run dev` and open the local URL printed by Netlify CLI (usually `http://localhost:8888`). Netlify CLI loads `.env` for local function development.
7. Send a short message such as `Hello`, then ask a follow-up question.

Do not put the API key in frontend JavaScript, HTML, `netlify.toml`, or a public GitHub repository.

## GitHub

Create an empty repository on GitHub. In this project folder, run `git init`, `git add .`, and `git commit -m "Create Nova AI"`, then add your repository as `origin` and push your chosen branch. Check that `.env` is not included before pushing; `.gitignore` excludes it. Do not publish the API key.

## Deploy to Netlify

1. Push the project to GitHub and import that repository in Netlify, or deploy the folder using Netlify CLI.
2. Netlify reads `netlify.toml`: it publishes the `public` folder and locates functions in `netlify/functions`.
3. In the Netlify site dashboard, open **Site configuration > Environment variables**. Add `GROQ_API_KEY` with your secret key and `GROQ_MODEL` with a model available to your account. You can leave the model unset to use the default.
4. Trigger a new deploy after changing environment variables. The production frontend calls `/.netlify/functions/chat` on the deployed site.
5. Visit the deployed site and send a test question. Never paste your key into the browser console or frontend files.

## Common errors

- **Nova is not configured:** add `GROQ_API_KEY` locally in `.env`, or in Netlify's environment variable settings, then restart local development or redeploy.
- **Authentication error:** check that the key is active and copied correctly. Rotate it if it was exposed.
- **Rate limit or usage limit:** wait, review your Groq account limits, then retry.
- **Model unavailable:** choose a model available to your account in `GROQ_MODEL`.
- **Function not found locally:** start with `npm run dev` and open its URL (usually port 8888), not a plain static server such as Go Live (often port 5500).
- **Slow or failed request:** check your connection and Groq account status, then retry.
- **Old error still visible:** create a new chat or refresh after starting Netlify Dev. Previous conversations are saved in localStorage.

## Completion checklist

- [ ] Start with `npm run dev` and load the Netlify local URL.
- [ ] Send a message and a follow-up; confirm both display.
- [ ] Try Enter, Shift+Enter, stop, regenerate, copy, search, rename, delete, clear, and export.
- [ ] Switch theme, resize to a mobile width, and reload to check saved chats.
- [ ] Check that missing or invalid keys produce a useful error.
- [ ] Configure Netlify environment variables and confirm the deployed function responds.

Live site: (fill in after deployment)
GitHub repository: (fill in after creating it)