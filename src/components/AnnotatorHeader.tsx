/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Settings, HelpCircle, FileText, Download, Upload } from "lucide-react";

interface AnnotatorHeaderProps {
  tool: "underline" | "box";
  setTool: (t: "underline" | "box") => void;
  filter: string;
  setFilter: (f: any) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onLoadPDF: () => void;
  onExportMarkdown: () => void;
  onExportPDF: () => void;
  exportPdfLoading: boolean;
  hasPdfLoaded: boolean;
  provider: string;
  setProvider: (p: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  model: string;
  setModel: (m: string) => void;
  useProxy: boolean;
  setUseProxy: (px: boolean) => void;
  customPresetPrompt: string;
  setCustomPresetPrompt: (val: string) => void;
}

const MODELS_CONFIG: Record<string, { label: string; models: [string, string][] }> = {
  builtin: {
    label: "内建 Gemini (免密钥)",
    models: [
      ["gemini-3.5-flash", "Gemini 3.5 Flash (快速 & 多模态)"],
      ["gemini-3.1-pro-preview", "Gemini 3.1 Pro (深度推理)"]
    ]
  },
  google: {
    label: "Google Gemini 官方密钥",
    models: [
      ["gemini-2.5-flash", "Gemini 2.5 Flash (高能速捷)"],
      ["gemini-2.5-pro", "Gemini 2.5 Pro (旗舰版)"]
    ]
  },
  openai: {
    label: "OpenAI GPT API",
    models: [
      ["gpt-4o", "GPT-4o (全能旗舰)"],
      ["gpt-4o-mini", "GPT-4o-mini (轻巧极速)"],
      ["o1-mini", "o1-mini (逻辑推理分支)"]
    ]
  },
  claude: {
    label: "Claude (Anthropic)",
    models: [
      ["claude-3-5-sonnet-latest", "Claude 3.5 Sonnet (高画质识读)"],
      ["claude-3-5-haiku-latest", "Claude 3.5 Haiku (轻效速捷)"]
    ]
  },
  deepseek: {
    label: "DeepSeek (直连)",
    models: [
      ["deepseek-chat", "DeepSeek V3 (Chat)"],
      ["deepseek-reasoner", "DeepSeek R1 (推理模型)"]
    ]
  }
};

export const AnnotatorHeader: React.FC<AnnotatorHeaderProps> = ({
  tool,
  setTool,
  filter,
  setFilter,
  currentPage,
  totalPages,
  onPageChange,
  onLoadPDF,
  onExportMarkdown,
  onExportPDF,
  exportPdfLoading,
  hasPdfLoaded,
  provider,
  setProvider,
  apiKey,
  setApiKey,
  model,
  setModel,
  useProxy,
  setUseProxy,
  customPresetPrompt,
  setCustomPresetPrompt
}) => {
  const [showSettings, setShowSettings] = useState(false);

  const handleProviderChange = (newP: string) => {
    setProvider(newP);
    const defaults = MODELS_CONFIG[newP]?.models || [];
    if (defaults.length > 0) {
      setModel(defaults[0][0]);
    }
  };

  const currentModelsList = MODELS_CONFIG[provider]?.models || [];

  return (
    <div className="h-14 flex items-center bg-slab border-b border-black text-[#efece2] px-4 select-none z-50 shrink-0 select-none">
      {/* Brand logo & name */}
      <div className="flex items-baseline gap-2">
        <span className="font-song text-xl text-white bg-cinnabar px-2 py-0.5 rounded tracking-widest shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">
          朱批
        </span>
        <span className="text-[11.5px] text-ink-faint tracking-wider hidden sm:inline">
          智能 PDF 划线批注台 · 划线即解
        </span>
      </div>

      <div className="flex-1" />

      {/* Underlining / Boxing selection tools */}
      {hasPdfLoaded && (
        <div className="flex bg-[#15140f] border border-[#3c3931] p-0.5 rounded-lg mr-3">
          <button
            onClick={() => setTool("underline")}
            className={`cursor-pointer font-sans text-xs font-semibold py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors ${
              tool === "underline" 
                ? "bg-cinnabar text-white shadow" 
                : "text-[#cfcabb] hover:text-white"
            }`}
          >
            <span className="font-song text-sm font-bold text-gold">线</span>划线
          </button>
          
          <button
            onClick={() => setTool("box")}
            className={`cursor-pointer font-sans text-xs font-semibold py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors ${
              tool === "box" 
                ? "bg-cinnabar text-white shadow" 
                : "text-[#cfcabb] hover:text-white"
            }`}
            title="识读无法选中的图片、扫描页或复杂公式"
          >
            <span className="font-song text-sm font-bold text-gold">框</span>框选
          </button>
        </div>
      )}

      {/* Filter Annotations */}
      {hasPdfLoaded && (
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="cursor-pointer text-xs font-sans bg-[#15140f] text-[#efece2] border border-[#45423a] rounded-md py-1.5 px-2.5 mr-3 focus:outline-none focus:ring-1 focus:ring-cinnabar"
          title="筛选批注内容"
        >
          <option value="all">查看全部批注</option>
          <option value="translate">仅看翻译 [{ACT_LABEL.translate}]</option>
          <option value="explain">仅看解释 [{ACT_LABEL.explain}]</option>
          <option value="summarize">仅看总结</option>
          <option value="vocab">仅看术语词精析</option>
          <option value="unmastered">仅看未掌握 [✓]</option>
        </select>
      )}

      {/* Scrolling Sync / Navigation */}
      {hasPdfLoaded && (
        <div className="flex items-center gap-1 text-xs text-[#cfcabb] mr-4 select-none">
          <span>第</span>
          <input
            type="number"
            min={1}
            max={totalPages || 1}
            value={currentPage}
            onChange={(e) => {
              const val = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
              onPageChange(val);
            }}
            className="w-11 text-center font-semibold bg-[#15140f] text-[#efece2] border border-[#45423a] rounded py-1 px-1 focus:outline-none focus:ring-1 focus:ring-cinnabar [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span>/ {totalPages || 0} 页</span>
        </div>
      )}

      {/* Settings Panel Toggle */}
      <div className="relative mr-2">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`cursor-pointer border border-[#4a473f] bg-slab-soft text-[#efece2] hover:bg-[#36332c] hover:border-[#5d594f] py-1.5 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
            showSettings ? "bg-[#36332c] border-[#5d594f] text-cinnabar" : ""
          }`}
        >
          <Settings size={13} className={provider === "builtin" ? "text-cinnabar" : "text-[#efece2] animate-spin-hover"} />
          <span>{provider === "builtin" ? "内建 API (免密钥)" : MODELS_CONFIG[provider]?.label || "设置"}</span>
        </button>

        {showSettings && (
          <div className="absolute top-11 right-0 w-80 bg-slab border border-black rounded-lg p-4 shadow-[0_14px_36px_rgba(0,0,0,0.5)] z-50 text-left">
            <h3 className="font-song font-semibold text-sm text-[#efece2] border-b border-[#3c3931] pb-1.5 mb-3 flex items-center gap-1.5">
              <span>⚙️</span> 朱批 AI 配置
            </h3>

            <label className="block text-[10.5px] text-ink-faint uppercase font-bold tracking-wider mb-1">
              AI 供应商
            </label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full text-xs bg-[#15140f] text-[#efece2] border border-[#45423a] rounded px-2.5 py-2 mb-3 focus:outline-none focus:border-cinnabar"
            >
              <option value="builtin">🔒 内建 Gemini API (推荐 · 免密钥)</option>
              <option value="google">Google API (Gemini 官方 Key)</option>
              <option value="openai">OpenAI API (GPT 兼容 Key)</option>
              <option value="claude">Claude (Anthropic sk-ant-...)</option>
              <option value="deepseek">DeepSeek (外部 API Key)</option>
            </select>

            {provider !== "builtin" && (
              <>
                <label className="block text-[10.5px] text-ink-faint uppercase font-bold tracking-wider mb-1">
                  API 密钥
                </label>
                <input
                  type="password"
                  placeholder="请输入您的 sk-... 密钥"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full text-xs font-mono bg-[#15140f] text-[#efece2] border border-[#45423a] rounded px-3 py-2 mb-3 focus:outline-none focus:border-cinnabar"
                />
              </>
            )}

            <label className="block text-[10.5px] text-ink-faint uppercase font-bold tracking-wider mb-1">
              推理模型
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full text-xs font-mono bg-[#15140f] text-[#efece2] border border-[#45423a] rounded px-2.5 py-2 mb-3.5 focus:outline-none focus:border-cinnabar"
            >
              {currentModelsList.map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>

            {provider !== "builtin" && (
              <label className="flex items-center gap-2 mb-3.5 text-xs font-semibold text-[#cfcabb] cursor-pointer">
                <input
                  type="checkbox"
                  checked={useProxy}
                  onChange={(e) => setUseProxy(e.target.checked)}
                  className="rounded border-[#4a473f] text-cinnabar focus:ring-0"
                />
                <span>通过本地代理 (解决浏览器直连 CORS)</span>
              </label>
            )}

            <div className="border-t border-[#3c3931] my-2.5" />

            <label className="block text-[10.5px] text-ink-faint uppercase font-bold tracking-wider mb-1 flex items-center justify-between">
              <span>自定义快捷设定 [定]</span>
              <span className="text-[9px] text-[#efece2]/40 font-normal">点击浮动栏「定」立即触发</span>
            </label>
            <textarea
              rows={2}
              placeholder="例如：提炼合规和侵权风险、用英文法律术语润色等..."
              value={customPresetPrompt}
              onChange={(e) => setCustomPresetPrompt(e.target.value)}
              className="w-full text-xs font-sans bg-[#15140f] text-[#efece2] border border-[#45423a] rounded px-2 px-1.5 focus:outline-none focus:border-cinnabar resize-none mb-2"
            />

            <div className="text-[10px] text-ink-faint leading-relaxed border-t border-[#3c3931] pt-2 mt-1">
              {provider === "builtin" 
                ? "💡 推荐：采用平台自带的 Gemini 服务驱动，反应迅速且多模态图像/截图完美支持，无需任何外部密钥或配置，安全免心。"
                : "💡 提示：密钥保存在本地浏览器缓存中。划线选择文字可直连发送；如使用外部DeepSeek或Claude遇到跨域报错，勾选“通过本地代理”即可解决。"}
            </div>
          </div>
        )}
      </div>

      {/* LOAD PDF and EXPORTS ACTIONS */}
      <div className="flex gap-1.5">
        <button
          onClick={onLoadPDF}
          className="cursor-pointer border border-[#4a473f] bg-slab-soft text-[#efece2] hover:bg-[#36332c] hover:border-[#5d594f] py-1.5 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all select-none"
        >
          <Upload size={13} className="text-gold" />
          <span>载入 PDF</span>
        </button>

        {hasPdfLoaded && (
          <>
            <button
              onClick={onExportMarkdown}
              className="cursor-pointer border border-[#4a473f] bg-slab-soft text-[#efece2] hover:bg-[#36332c] hover:border-[#5d594f] py-1.5 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all select-none"
              title="导出批注汇总笔记本 (Markdown)"
            >
              <FileText size={13} className="text-[#a9d18e]" />
              <span>导出笔记</span>
            </button>

            <button
              onClick={onExportPDF}
              disabled={exportPdfLoading}
              className={`cursor-pointer bg-cinnabar border border-cinnabar-d text-white hover:bg-cinnabar-d py-1.5 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all select-none ${
                exportPdfLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title="将智能朱批渲染回PDF中并下载"
            >
              <Download size={13} />
              <span>{exportPdfLoading ? "合成批注中..." : "导出批注版"}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const ACT_LABEL: Record<string, string> = {
  translate: "译",
  explain: "释"
};
