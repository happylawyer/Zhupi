/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Annotation, AnnotationAct } from "../types";
import { Edit2, Check, Trash2, CheckCircle2 } from "lucide-react";

interface AnnotationCardProps {
  annotation: Annotation;
  width: number;
  onDelete: (id: number) => void;
  onUpdate: (id: number, updated: Partial<Annotation>) => void;
}

const ACT_LABEL: Record<AnnotationAct, string> = {
  translate: "译",
  explain: "释",
  summarize: "总结",
  vocab: "词",
  custom: "问",
  custom_preset: "定"
};

const ACT_COLOR: Record<AnnotationAct, string> = {
  translate: "bg-cinnabar text-white",
  explain: "bg-[#4a6b5d] text-white",
  summarize: "bg-gold text-white",
  vocab: "bg-[#3e5668] text-white",
  custom: "bg-ink text-[#efece2]",
  custom_preset: "bg-[#8b5cf6] text-white"
};

// Light RegExp-based Markdown compiler for styling terms & points elegantly
function renderMarkdown(content: string) {
  if (!content) return "";
  
  let html = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h4 class="font-song font-bold text-xs text-cinnabar mt-2 mb-1">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="font-song font-bold text-sm text-cinnabar mt-3 mb-1">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="font-song font-bold text-base text-cinnabar mt-4 mb-2">$1</h2>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-cinnabar">$1</strong>');
  
  // Inline Code/Highlight
  html = html.replace(/`(.*?)`/g, '<code class="font-mono bg-stone-200/60 px-1 py-0.5 rounded text-[11px] text-gold font-semibold">$1</code>');

  // Italics
  html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
  html = html.replace(/_(.*?)_/g, '<em class="italic">$1</em>');

  // Brackets content (English terms usually put in brackets)
  html = html.replace(/「(.*?)」/g, '<span class="text-cinnabar border-b border-cinnabar/30 bg-cinnabar/5 px-0.5">$1</span>');

  // Lists and paragraphs
  const lines = html.split("\n");
  let inList = false;
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("· ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const bulletText = trimmed.replace(/^[·\-*]\s*/, "");
      let prefix = "";
      if (!inList) {
        inList = true;
        prefix = '<ul class="list-disc pl-4 space-y-1.5 my-1.5 text-xs text-ink/90">';
      }
      return `${prefix}<li class="leading-relaxed">${bulletText}</li>`;
    } else {
      let suffix = "";
      if (inList) {
        inList = false;
        suffix = "</ul>";
      }
      if (trimmed === "") {
        return suffix;
      }
      return `${suffix}<p class="my-1.5 text-xs text-ink/90 leading-relaxed font-sans">$2`.replace("$2", trimmed);
    }
  });
  
  if (inList) {
    processedLines.push("</ul>");
  }
  
  return processedLines.join("\n");
}

export const AnnotationCard: React.FC<AnnotationCardProps> = ({
  annotation,
  width,
  onDelete,
  onUpdate
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(annotation.result);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditVal(annotation.result);
  }, [annotation.result]);

  const handleEditToggle = () => {
    if (isEditing) {
      onUpdate(annotation.id, { result: editVal });
    }
    setIsEditing(!isEditing);
  };

  const truncateSrc = (txt: string) => {
    if (!txt) return "";
    return txt.length > 120 ? txt.slice(0, 120) + "…" : txt;
  };

  return (
    <div
      className={`card absolute z-10 bg-paper-2 border border-line border-l-[3px] rounded-md py-2 px-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-opacity duration-200 ${
        annotation.mastered
          ? "opacity-55 border-l-gold"
          : "border-l-cinnabar"
      }`}
      style={{
        width: `${width}px`,
        visibility: "visible",
      }}
      id={`ann-card-${annotation.id}`}
    >
      {/* Header and Controls */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`font-song text-[10px] uppercase font-bold py-0.5 px-1.5 rounded tracking-wider ${
            ACT_COLOR[annotation.act] || "bg-cinnabar text-white"
          }`}
        >
          {ACT_LABEL[annotation.act]}
        </span>
        
        {annotation.custom && (
          <span className="text-[10px] text-ink-soft bg-stone-200/50 px-1 py-0.5 rounded truncate max-w-[100px]">
            {annotation.custom}
          </span>
        )}

        <div className="ml-auto flex gap-1">
          {/* Toggle Edit */}
          <button
            onClick={handleEditToggle}
            className="cursor-pointer text-ink-faint hover:text-cinnabar hover:bg-stone-200/60 p-1 rounded transition-colors"
            title={isEditing ? "保存修改" : "点击编辑"}
          >
            {isEditing ? <Check size={12} /> : <Edit2 size={12} />}
          </button>
          
          {/* Toggle Mastered */}
          <button
            onClick={() => onUpdate(annotation.id, { mastered: !annotation.mastered })}
            className={`cursor-pointer p-1 rounded transition-colors ${
              annotation.mastered 
                ? "text-gold bg-gold/10 hover:bg-gold/20" 
                : "text-ink-faint hover:text-gold hover:bg-stone-200/60"
            }`}
            title={annotation.mastered ? "标记为未掌握" : "标为已熟记"}
          >
            <CheckCircle2 size={12} />
          </button>

          {/* Delete Button */}
          <button
            onClick={() => onDelete(annotation.id)}
            className="cursor-pointer text-ink-faint hover:text-cinnabar hover:bg-stone-200/60 p-1 rounded transition-colors"
            title="删除批注"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Image Thumbnail has been removed per user preference so that side cards directly show the markdown text replies */}

      {/* Selected Source Text Quote */}
      {annotation.mode === "text" && annotation.src && (
        <div className="text-[10.5px] text-ink-soft font-song italic border-l border-line pl-1.5 mb-1.5 leading-relaxed bg-stone-100/30 py-0.5 pr-0.5 max-h-[80px] overflow-y-auto custom-scrollbar">
          {truncateSrc(annotation.src)}
        </div>
      )}

      {/* Markdown Content (Or Editing State Area) */}
      {isEditing ? (
        <div className="mt-1">
          <textarea
            ref={textRef}
            className="w-full min-h-[90px] text-xs font-sans p-1.5 border border-cinnabar/60 rounded focus:outline-none focus:ring-1 focus:ring-cinnabar bg-white text-ink leading-relaxed"
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
          />
        </div>
      ) : (
        <div className="text-xs text-ink leading-relaxed">
          {annotation.loading ? (
            <div className="flex items-center gap-1.5 py-1 text-ink-faint italic font-song">
              <span className="inline-block w-2 h-2 rounded-full bg-cinnabar animate-ping" />
              朱批运墨中...
            </div>
          ) : (
            <div 
              className="prose prose-sm max-w-none prose-stone font-sans"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(annotation.result) }}
            />
          )}
        </div>
      )}
    </div>
  );
};
