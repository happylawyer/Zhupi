import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Support high limit for base64 images upload during box clipping
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize the GoogleGenAI client (lazy load if possible)
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// REST endpoint for Annotations powered by our backend API
app.post("/api/zhupi/ai", async (req: express.Request, res: express.Response) => {
  try {
    const { act, customQuestion, srcText, image, mode, provider, model } = req.body;

    // Check if client provided custom key
    const clientKey = (req.headers["x-custom-api-key"] as string) || "";

    // Default System Instruction from the ZhuPi platform - enforcing compact brevity for side gutter columns (Max 250-300 words)
    const SYS_INSTRUCTION = "你是一位严谨的中英法律文本批注助手，输出简洁、准确、地道的中文。为了完美配置侧边栏卡片的精巧布局，你的解释与翻译必须高度概括、点拨即止，最长限制绝对不能超过 250 到 300 字。";

    // Build the tailored prompt based on mode and activity type
    let prompt = "";
    if (mode === "box") {
      if (act === "translate") {
        prompt = "图中是文本截图。把其中文字翻译成最精炼、准确的中文，专业术语用「中文(English)」标注，只输出译文，控制在150字内。";
      } else if (act === "explain") {
        prompt = "图中是文本截图。面向法学生，用极其精炼的中文解释核心意义与法律机理，专业术语「中文(English)」，不要罗嗦，控制在200字内。";
      } else if (act === "summarize") {
        prompt = "图中是文本截图。用中文精析提炼出最多 2-3 条极简核心总结，每条以「· 」开头独占一行，字数尽量压缩。";
      } else if (act === "vocab") {
        prompt = "图中是文本截图。挑出1-2个最经典的关键法律术语，精炼解释其中文释义与法律语境含义，术语「中文(English)」。";
      } else {
        prompt = `先识读图中内容，再极简回答：${customQuestion || "请解释。"}。用中文，专业术语用「中文(English)」标注，最长限200字内。`;
      }
    } else {
      const t = srcText || "";
      if (act === "translate") {
        prompt = `把下面的文本翻译成极其精准、简练的中文。法律或专业术语用「中文(English)」格式标注。只输出译文，限150字内，不要任何说明：\n\n${t}`;
      } else if (act === "explain") {
        prompt = `面向一位法学生，用中文解释下面这段文本的核心法律意义与内在逻辑。专业术语用「中文(English)」标注。限200字以内，力求精炼：\n\n${t}`;
      } else if (act === "summarize") {
        prompt = `用中文把下面文本的核心重点提炼成最多 2-3 条极简总结，每条以「· 」开头独占一行，字数极力压缩，表达简洁：\n\n${t}`;
      } else if (act === "vocab") {
        prompt = `精析下面从英文法律文本中选中的词，选1-2个最关键法律术语，用中文给出：1) 释义；2) 专业语境层级（用「中文(English)」方式）；3) 简短英文例句与中译。极致凝练：\n\n${t}`;
      } else {
        prompt = `针对下面内容，用极简的中文回答指令问题，专业术语用「中文(English)」标注，控制在200字内：\n\n【问题】${customQuestion}\n\n【内容】\n${t}`;
      }
    }

    const cleanBase64 = image ? image.replace(/^data:image\/\w+;base64,/, "") : "";

    // 1. BUILTIN or GOOGLE (Gemini SDK)
    if (!provider || provider === "builtin" || provider === "google") {
      const activeKey = (provider === "google" && clientKey) ? clientKey : apiKey;
      if (!activeKey) {
        return res.status(400).json({
          error: provider === "builtin"
            ? "服务器未配置内置 GEMINI_API_KEY，且未检测到自定义密钥。"
            : "您选择了 Google API 供应商，但未在设置中输入您的自定义 API 密钥。"
        });
      }

      const activeModel = model || "gemini-3.5-flash";
      const executorAi = new GoogleGenAI({
        apiKey: activeKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      if (mode === "box") {
        if (!image) {
          return res.status(400).json({ error: "Missing image parameter for Box Selection mode." });
        }
        const imagePart = {
          inlineData: {
            mimeType: "image/png",
            data: cleanBase64,
          }
        };
        const textPart = { text: prompt };
        const geminiRes = await executorAi.models.generateContent({
          model: activeModel,
          contents: { parts: [imagePart, textPart] },
          config: { systemInstruction: SYS_INSTRUCTION }
        });
        return res.json({ result: geminiRes.text || "" });
      } else {
        const geminiRes = await executorAi.models.generateContent({
          model: activeModel,
          contents: prompt,
          config: { systemInstruction: SYS_INSTRUCTION }
        });
        return res.json({ result: geminiRes.text || "" });
      }
    }

    // 2. OPENAI
    if (provider === "openai") {
      if (!clientKey) {
        return res.status(400).json({ error: "您选择了 OpenAI API 供应商，但未在设置中填入 API 密钥。" });
      }
      const activeModel = model || "gpt-4o-mini";
      const messages: any[] = [
        { role: "system", content: SYS_INSTRUCTION }
      ];

      if (mode === "box") {
        if (!image) {
          return res.status(400).json({ error: "Missing image parameter for Box Selection mode." });
        }
        messages.push({
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/png;base64,${cleanBase64}` } }
          ]
        });
      } else {
        messages.push({ role: "user", content: prompt });
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${clientKey}`
        },
        body: JSON.stringify({
          model: activeModel,
          messages,
          max_tokens: 800
        })
      });

      if (!response.ok) {
        const errVal = await response.text();
        throw new Error(`OpenAI 接口请求失败 (${response.status}): ${errVal}`);
      }

      const oaiData = await response.json();
      return res.json({ result: oaiData.choices?.[0]?.message?.content || "" });
    }

    // 3. CLAUDE
    if (provider === "claude") {
      if (!clientKey) {
        return res.status(400).json({ error: "您选择了 Claude API 供应商，但未在设置中填入 API 密钥。" });
      }
      const activeModel = model || "claude-3-5-sonnet-latest";
      let contentVal: any = prompt;

      if (mode === "box") {
        if (!image) {
          return res.status(400).json({ error: "Missing image parameter for Box Selection mode." });
        }
        contentVal = [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: cleanBase64
            }
          },
          { type: "text", text: prompt }
        ];
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": clientKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: activeModel,
          max_tokens: 1024,
          system: SYS_INSTRUCTION,
          messages: [
            { role: "user", content: contentVal }
          ]
        })
      });

      if (!response.ok) {
        const errVal = await response.text();
        throw new Error(`Claude 接口请求失败 (${response.status}): ${errVal}`);
      }

      const claudeData = await response.json();
      return res.json({ result: claudeData.content?.[0]?.text || "" });
    }

    // 4. DEEPSEEK
    if (provider === "deepseek") {
      if (!clientKey) {
        return res.status(400).json({ error: "您选择了 DeepSeek API 供应商，但未在设置中填入 API 密钥。" });
      }
      if (mode === "box") {
        return res.json({ result: "⚠️ DeepSeek 暂不支持直接读取截图或墨迹。请使用划线功能获取可复选的法律文本进行解译，或者在右上角「设置」中切换为内建 Gemini/Claude 识图。" });
      }

      const activeModel = model || "deepseek-chat";
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${clientKey}`
        },
        body: JSON.stringify({
          model: activeModel,
          messages: [
            { role: "system", content: SYS_INSTRUCTION },
            { role: "user", content: prompt }
          ],
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errVal = await response.text();
        throw new Error(`DeepSeek 接口请求失败 (${response.status}): ${errVal}`);
      }

      const dsData = await response.json();
      return res.json({ result: dsData.choices?.[0]?.message?.content || "" });
    }

  } catch (error: any) {
    console.error("ZhuPi AI Router Engine Failure:", error);
    return res.status(500).json({ error: error?.message || "Failed to prompt selected API model." });
  }
});

// Configure Vite Development Server or Static Build Output Paths
async function init() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on http://0.0.0.0:${PORT}`);
  });
}

init();
