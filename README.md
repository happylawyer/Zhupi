<div align="right"><a href="#english">English</a> ｜ <b>中文</b></div>

# 朱批 · PDF 智能批注台

> 一支会翻译、会解释、会总结的「智能荧光笔」——把每一次查词、释义与要点，钉回原书对应位置，沉淀成可复习、可悬停、可导出的 AI 批注版教材。

朱批（ZhuPi）是一个面向**深度阅读与考试学习**的 AI 批注式 PDF 阅读器。它的核心不是「和 PDF 聊天」，而是把你在读书过程中产生的翻译、解释、总结、术语精析，全部**绑定回原文的划线位置**：书页居中，左右两翼即为批注栏，淡引线把朱批连回原句；所有批注静默保存在本机浏览器，下次打开同一本书自动恢复。

适合读英文法学教材、案例书、论文，准备 NCA / law school 考试，或任何需要把翻译与理解长期留痕在原 PDF 里的场景。

---

## ✨ 功能特性

- **划线 / 框选双模式**：可选中的文字用「划线」；扫描页、图、公式选不中时切「框选」，截图交由多模态模型识读。
- **五种 AI 动作**：翻译、解释、总结要点、术语精析、自定义提问。
- **批注绑定原文**：AI 结果作为结构化卡片落在页边，淡引线连回划线处。
- **本地持久化**：按「文件名 + 大小」自动保存到浏览器，重开同书自动恢复。
- **可编辑 / 可标记**：每条批注支持编辑、标「已掌握 / 未掌握」、删除，并可按类型筛选。
- **多供应商可切换**：内建 Gemini（免密钥）、Google、OpenAI、Claude、DeepSeek，各自填写自己的密钥与模型。
- **两种导出**：导出 Markdown 复习笔记；导出「所见即所得」批注版 PDF（含页边卡片与引线）。
- **隐私优先**：PDF 仅在本机浏览器解析，不上传服务器；外部密钥只存在本地缓存。

---

## 🚀 三种使用方式

### 方式一：在 Google AI Studio 体验（最简单，免密钥）

本项目是一个 AI Studio Applet，使用平台内建的 Gemini 服务（`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`）。在 AI Studio 中打开即可直接体验，无需任何密钥配置——平台会自动注入 `GEMINI_API_KEY`。

### 方式二：导入并本地运行（自托管）

```bash
# 1. 克隆仓库
git clone https://github.com/happylawyer/Zhupi.git
cd Zhupi

# 2. 安装依赖
npm install

# 3. 配置密钥（自托管时「内建 Gemini」需要此步）
cp .env.example .env
# 编辑 .env，把 GEMINI_API_KEY 换成你自己的 Google Gemini 密钥

# 4. 启动开发服务器
npm run dev
# 浏览器打开 http://localhost:3000

# 生产构建
npm run build && npm start
```

> 注意：**「内建 Gemini（免密钥）」在自托管时其实需要你在 `.env` 里配置 `GEMINI_API_KEY`**。若不想配置，也可以在右上角「设置」里改选 Google / OpenAI / Claude / DeepSeek，填入你自己的密钥即可，无需 `.env`。

### 方式三：用自己的 API 密钥（任意供应商）

打开右上角「⚙ 设置」→ 选择供应商 → 粘贴你自己的 API Key → 选择模型。密钥仅保存在你浏览器的本地缓存中，随时切换、互不影响。

| 供应商 | 是否需要密钥 | 截图识读（框选） |
| --- | --- | --- |
| 内建 Gemini | 否（自托管需配 .env） | 支持 |
| Google Gemini | 是（你的 Gemini Key） | 支持 |
| OpenAI | 是 | 支持 |
| Claude (Anthropic) | 是 | 支持 |
| DeepSeek | 是 | 不支持（请用划线选文字） |

---

## 🛠 技术栈

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Express（后端 AI 路由）· PDF.js（渲染）· pdf-lib / html2canvas（导出）· @google/genai。

后端 `server.ts` 提供统一的 `/api/zhupi/ai` 接口，根据 `provider` 把请求路由到对应模型；外部供应商的密钥由前端经请求头 `x-custom-api-key` 传入，服务端代为转发（因此浏览器只请求同源接口，天然规避跨域问题）。

---

## 🔒 隐私与安全

- 原始 PDF 仅在浏览器本地解析渲染，**不上传任何服务器**。
- 外部供应商密钥仅存于浏览器 `localStorage`，不写入仓库、不经第三方。
- 仓库已通过 `.gitignore` 忽略 `.env*`（仅保留 `.env.example` 占位符）。

---

## 📄 许可证

源码文件标注为 Apache-2.0（见各文件 SPDX 头）。

---
<a name="english"></a>
<div align="right"><b>English</b> ｜ <a href="#朱批--pdf-智能批注台">中文</a></div>

# ZhuPi · AI Margin Reader for PDF

> A smart highlighter that translates, explains, and summarizes — pinning every lookup and insight back to its exact spot in the book, so your notes become a reviewable, hover-able, exportable AI-annotated textbook.

ZhuPi is an AI annotation-style PDF reader built for **deep reading and exam study**. Instead of "chatting with a PDF," it **binds every translation, explanation, summary, and term analysis back to the highlighted source text**. The page sits centered with margin columns on both sides; faint leader lines connect each note to its sentence. All annotations are silently saved in your browser and restored automatically when you reopen the same file.

Ideal for English-language law textbooks, casebooks and papers, NCA / law-school prep, or any workflow where translations and understanding need to persist inside the original PDF.

## ✨ Features

- **Underline & Box modes** — underline selectable text; switch to Box to screenshot scanned pages, figures, or formulas for a multimodal model to read.
- **Five AI actions** — translate, explain, summarize, term analysis, custom question.
- **Notes bound to source** — AI results land as structured cards in the margin, linked back by leader lines.
- **Local persistence** — auto-saved per `filename + size`; reopened files restore their notes.
- **Editable & taggable** — edit any note, mark mastered/unmastered, delete, and filter by type.
- **Switchable providers** — built-in Gemini (key-free), Google, OpenAI, Claude, DeepSeek, each with its own key and model.
- **Two exports** — Markdown study notes, and a WYSIWYG annotated PDF (margin cards + leader lines).
- **Privacy first** — PDFs are parsed locally in the browser; external keys live only in local cache.

## 🚀 Three ways to use it

**1. Try it in Google AI Studio (easiest, key-free).** This is an AI Studio applet using the platform's server-side Gemini; just open it — the platform injects `GEMINI_API_KEY` automatically.

**2. Import & run locally (self-host).**

```bash
git clone https://github.com/happylawyer/Zhupi.git
cd Zhupi
npm install
cp .env.example .env      # put your own GEMINI_API_KEY in .env
npm run dev               # http://localhost:3000
# production: npm run build && npm start
```

> Note: the **"built-in Gemini (key-free)" option still needs a `GEMINI_API_KEY` in `.env` when self-hosting**. Alternatively, open Settings and pick Google / OpenAI / Claude / DeepSeek with your own key — no `.env` required.

**3. Bring your own API key (any provider).** Open ⚙ Settings → choose a provider → paste your key → pick a model. Keys are stored only in your browser's local cache.

| Provider | Key required | Box (image) reading |
| --- | --- | --- |
| Built-in Gemini | No (needs .env if self-hosted) | Yes |
| Google Gemini | Yes | Yes |
| OpenAI | Yes | Yes |
| Claude (Anthropic) | Yes | Yes |
| DeepSeek | Yes | No (use underline) |

## 🛠 Tech stack

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Express (AI router) · PDF.js · pdf-lib / html2canvas · @google/genai. The backend `server.ts` exposes a single `/api/zhupi/ai` route and forwards to the selected model; external keys are passed via the `x-custom-api-key` header, so the browser only ever calls a same-origin endpoint (no CORS issues).

## 🔒 Privacy & security

PDFs are parsed locally and never uploaded. External keys stay in browser `localStorage`. `.env*` is git-ignored (only `.env.example` placeholders are committed).

## 📄 License

Source files are marked Apache-2.0 (see SPDX headers).
