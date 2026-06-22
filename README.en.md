<div align="right"><a href="./README.md">中文</a></div>

# ZhuPi · AI Margin Reader for PDF

> A smart highlighter that translates, explains, and summarizes — pinning every lookup and insight back to its exact spot in the book, so your notes become a reviewable, hover-able, exportable AI-annotated textbook.

ZhuPi is an AI annotation-style PDF reader built for **deep reading and exam study**. Instead of "chatting with a PDF," it **binds every translation, explanation, summary, and term analysis back to the highlighted source text**. The page sits centered with margin columns on both sides; faint leader lines connect each note to its sentence. All annotations are silently saved in your browser and restored automatically when you reopen the same file.

Ideal for English-language law textbooks, casebooks and papers, NCA / law-school prep, or any workflow where translations and understanding need to persist inside the original PDF.

---

## ✨ Features

- **Underline & Box modes** — underline selectable text; switch to Box to screenshot scanned pages, figures, or formulas for a multimodal model to read.
- **Five AI actions** — translate, explain, summarize, term analysis, custom question.
- **Notes bound to source** — AI results land as structured cards in the margin, linked back by leader lines.
- **Local persistence** — auto-saved per `filename + size`; reopened files restore their notes.
- **Editable & taggable** — edit any note, mark mastered/unmastered, delete, and filter by type.
- **Switchable providers** — built-in Gemini (key-free), Google, OpenAI, Claude, DeepSeek, each with its own key and model.
- **Two exports** — Markdown study notes, and a WYSIWYG annotated PDF (margin cards + leader lines).
- **Privacy first** — PDFs are parsed locally in the browser; external keys live only in local cache.

---

## 🚀 Three ways to use it

### Option 1: Try it in Google AI Studio (easiest, key-free)

This is an AI Studio applet using the platform's server-side Gemini (`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`). Just open it in AI Studio — the platform injects `GEMINI_API_KEY` automatically, no setup required.

### Option 2: Import & run locally (self-host)

```bash
# 1. Clone
git clone https://github.com/happylawyer/Zhupi.git
cd Zhupi

# 2. Install
npm install

# 3. Configure key (needed for "built-in Gemini" when self-hosting)
cp .env.example .env
# Edit .env and set GEMINI_API_KEY to your own Google Gemini key

# 4. Start the dev server
npm run dev
# Open http://localhost:3000

# Production build
npm run build && npm start
```

> Note: the **"built-in Gemini (key-free)" option still needs a `GEMINI_API_KEY` in `.env` when self-hosting**. Alternatively, open Settings and pick Google / OpenAI / Claude / DeepSeek with your own key — no `.env` required.

### Option 3: Bring your own API key (any provider)

Open ⚙ Settings → choose a provider → paste your key → pick a model. Keys are stored only in your browser's local cache and can be switched anytime.

| Provider | Key required | Box (image) reading |
| --- | --- | --- |
| Built-in Gemini | No (needs .env if self-hosted) | Yes |
| Google Gemini | Yes | Yes |
| OpenAI | Yes | Yes |
| Claude (Anthropic) | Yes | Yes |
| DeepSeek | Yes | No (use underline) |

---

## 🛠 Tech stack

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Express (AI router) · PDF.js · pdf-lib / html2canvas · @google/genai.

The backend `server.ts` exposes a single `/api/zhupi/ai` route and forwards to the selected model; external keys are passed via the `x-custom-api-key` header, so the browser only ever calls a same-origin endpoint (no CORS issues).

---

## 🔒 Privacy & security

- PDFs are parsed and rendered locally in the browser — **never uploaded to any server**.
- External provider keys stay in browser `localStorage`; nothing is committed or sent to third parties.
- `.env*` is git-ignored (only `.env.example` placeholders are committed).

---

## 📄 License

Source files are marked Apache-2.0 (see SPDX headers).
