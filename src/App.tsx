/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { AnnotatorHeader } from "./components/AnnotatorHeader";
import { AnnotationCard } from "./components/AnnotationCard";
import { Annotation, AnnotationAct, Rect } from "./types";
import { HelpCircle, ChevronRight, X, AlertCircle } from "lucide-react";

// For loading PDF libs from index.html global scripts
const getPdfJS = () => (window as any).pdfjsLib;
const getPdfLib = () => (window as any).PDFLib;

export default function App() {
  // Persistence state
  const [provider, setProvider] = useState<string>(() => localStorage.getItem("zhupi_provider") || "builtin");
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(`zhupi_key_${provider}`) || "");
  const [model, setModel] = useState<string>(() => localStorage.getItem(`zhupi_model_${provider}`) || "gemini-3.5-flash");
  const [customPresetPrompt, setCustomPresetPrompt] = useState<string>(
    () => localStorage.getItem("zhupi_custom_preset_prompt") || "提炼这一段的核心商业背景和主要合规风险点。"
  );

  useEffect(() => {
    localStorage.setItem("zhupi_custom_preset_prompt", customPresetPrompt);
  }, [customPresetPrompt]);

  // App running state
  const [tool, setTool] = useState<"underline" | "box">("underline");
  const toolRef = useRef<"underline" | "box">(tool);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  const [filter, setFilter] = useState<any>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [hasPdfLoaded, setHasPdfLoaded] = useState(false);
  const [pdfFilename, setPdfFilename] = useState("");
  const [docSize, setDocSize] = useState(0);
  const [exportPdfLoading, setExportPdfLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Hidden file input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Pending highlight state for popover/floater trigger
  const [pendingSelection, setPendingSelection] = useState<{
    pi: number;
    mode: "text" | "box";
    src: string;
    img: string | null;
    scrRects: Rect[];
    pdfRects: Rect[];
    scr: Rect;
  } | null>(null);

  // Keyboard and general overlay triggers
  const [floaterPos, setFloaterPos] = useState<{ left: number; top: number } | null>(null);
  const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pageMetadata, setPageMetadata] = useState<{ width: number; height: number; scale: number }[]>([]);

  // Custom question form states
  const [isAsking, setIsAsking] = useState(false);
  const [askQuery, setAskQuery] = useState("");

  // Reset custom query state on floater closed or selection updated
  useEffect(() => {
    setIsAsking(false);
    setAskQuery("");
  }, [floaterPos, pendingSelection]);

  // Page elements & wrappers refs for responsive rendering & scrolling
  const spreadRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const fileDropRef = useRef<HTMLDivElement>(null);
  const readerScrollRef = useRef<HTMLDivElement>(null);

  // Toast trigger helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Sync state variables back to localStorage
  useEffect(() => {
    localStorage.setItem("zhupi_provider", provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem(`zhupi_key_${provider}`, apiKey);
  }, [apiKey, provider]);

  useEffect(() => {
    localStorage.setItem(`zhupi_model_${provider}`, model);
  }, [model, provider]);

  // Construct a deterministic key for document annotations storage
  const getDocumentStorageKey = () => {
    return `zhupi_ann::${pdfFilename}|${docSize}`;
  };

  // Load saved annotations for the loaded document
  useEffect(() => {
    if (hasPdfLoaded && pdfFilename) {
      try {
        const key = getDocumentStorageKey();
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved) as Annotation[];
          setAnnotations(parsed.map(ann => ({ ...ann, loading: false })));
          showToast(`已成功载入 PDF 并恢复 ${parsed.length} 条智能朱批记录`);
        } else {
          setAnnotations([]);
        }
      } catch (e) {
        setAnnotations([]);
      }
    }
  }, [hasPdfLoaded, pdfFilename, docSize]);

  // Save annotations automatically whenever modified
  useEffect(() => {
    if (hasPdfLoaded && pdfFilename) {
      try {
        const key = getDocumentStorageKey();
        localStorage.setItem(key, JSON.stringify(annotations));
      } catch (err) {
        console.error("Local persistence limit warning:", err);
      }
    }
  }, [annotations, hasPdfLoaded, pdfFilename]);

  // Compute text selection highlighting
  const handleTextSelection = () => {
    if (tool !== "underline") return;
    const selection = window.getSelection();
    const textStr = selection ? selection.toString().trim() : "";
    if (!textStr || textStr.length < 2) {
      setFloaterPos(null);
      setPendingSelection(null);
      return;
    }

    try {
      const range = selection!.getRangeAt(0);
      let container: Node | null = range.startContainer;
      while (container && container.nodeType !== 1) {
        container = container.parentNode;
      }
      
      const pageDiv = container ? (container as HTMLElement).closest(".pdf-page-container") : null;
      if (!pageDiv) return;

      const pageIndex = parseInt((pageDiv as HTMLElement).dataset.pageIndex || "0", 10);
      const pageBounds = pageDiv.getBoundingClientRect();
      const clientRects = range.getClientRects();
      if (clientRects.length === 0) return;

      const pdfjs = getPdfJS();
      // Render coordinate mapping with pdfjs viewports
      const scaleVal = 1.35;
      const meta = pageMetadata[pageIndex];
      if (!meta) return;

      // Access active page's viewports from cache or build on-the-fly
      const renderViewport = (pageRefs.current[pageIndex] as any)?.__viewport;
      if (!renderViewport) return;

      const scrRects: Rect[] = [];
      const pdfRects: Rect[] = [];

      for (let i = 0; i < clientRects.length; i++) {
        const cr = clientRects[i];
        if (cr.width < 1 || cr.height < 1) continue;

        const x = cr.left - pageBounds.left;
        const yTop = cr.top - pageBounds.top;
        const yBot = cr.bottom - pageBounds.top;

        scrRects.push({ x, y: yTop, w: cr.width, h: cr.height });

        // Translate viewport to original PDF coordinates
        const [p1x, p1y] = renderViewport.convertToPdfPoint(x, yBot);
        const [p2x, p2y] = renderViewport.convertToPdfPoint(x + cr.width, yTop);

        pdfRects.push({
          x: Math.min(p1x, p2x),
          y: Math.min(p1y, p2y),
          w: Math.abs(p2x - p1x),
          h: Math.abs(p2y - p1y)
        });
      }

      if (scrRects.length === 0) return;

      // Create bounding box enclosing selection elements
      const minX = Math.min(...scrRects.map(r => r.x));
      const minY = Math.min(...scrRects.map(r => r.y));
      const maxX = Math.max(...scrRects.map(r => r.x + r.w));
      const maxY = Math.max(...scrRects.map(r => r.y + r.h));
      const bbox: Rect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

      setPendingSelection({
        pi: pageIndex,
        mode: "text",
        src: textStr,
        img: null,
        scrRects,
        pdfRects,
        scr: bbox
      });

      // Place selection floater above the last text bounding rect
      const lastLine = clientRects[clientRects.length - 1];
      const readerContainer = readerScrollRef.current?.getBoundingClientRect();
      if (readerContainer) {
        setFloaterPos({
          left: Math.max(12, Math.min(lastLine.left + lastLine.width / 2 - 130, window.innerWidth - 270)),
          top: lastLine.bottom + 10 + window.scrollY
        });
      }
    } catch (e) {
      console.error("Text selection parser failure:", e);
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      if (tool === "underline") {
        setTimeout(handleTextSelection, 30);
      }
    };
    
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [tool, pageMetadata]);

  // Hook for Box selections (drawing rectangular region, capturing base64 image)
  const bindBoxSelectionEvents = (pageIndex: number, pageDiv: HTMLDivElement) => {
    let draftDiv: HTMLDivElement | null = null;
    let startX = 0;
    let startY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (toolRef.current !== "box" || e.button !== 0) return;
      e.preventDefault();
      setFloaterPos(null);
      setPendingSelection(null);

      const bounds = pageDiv.getBoundingClientRect();
      startX = e.clientX - bounds.left;
      startY = e.clientY - bounds.top;

      draftDiv = document.createElement("div");
      draftDiv.className = "absolute border border-dashed border-cinnabar bg-cinnabar/10 pointer-events-none z-30";
      draftDiv.style.left = `${startX}px`;
      draftDiv.style.top = `${startY}px`;
      draftDiv.style.width = "0px";
      draftDiv.style.height = "0px";
      pageDiv.appendChild(draftDiv);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!draftDiv) return;
        const currentX = moveEvent.clientX - bounds.left;
        const currentY = moveEvent.clientY - bounds.top;

        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        draftDiv.style.left = `${left}px`;
        draftDiv.style.top = `${top}px`;
        draftDiv.style.width = `${width}px`;
        draftDiv.style.height = `${height}px`;
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        if (!draftDiv) return;
        const endX = upEvent.clientX - bounds.left;
        const endY = upEvent.clientY - bounds.top;

        const rx = Math.min(startX, endX);
        const ry = Math.min(startY, endY);
        const rw = Math.abs(endX - startX);
        const rh = Math.abs(endY - startY);

        draftDiv.remove();
        draftDiv = null;

        if (rw < 8 || rh < 8) return;

        const base64Crop = cropCanvasRegion(pageIndex, { x: rx, y: ry, w: rw, h: rh });
        const renderViewport = (pageRefs.current[pageIndex] as any)?.__viewport;
        if (!renderViewport) return;

        const [p1x, p1y] = renderViewport.convertToPdfPoint(rx, ry + rh);
        const [p2x, p2y] = renderViewport.convertToPdfPoint(rx + rw, ry);

        const scrRect: Rect = { x: rx, y: ry, w: rw, h: rh };
        const pdfRect: Rect = {
          x: Math.min(p1x, p2x),
          y: Math.min(p1y, p2y),
          w: Math.abs(p2x - p1x),
          h: Math.abs(p2y - p1y)
        };

        setPendingSelection({
          pi: pageIndex,
          mode: "box",
          src: `[框选识图] Page ${pageIndex + 1} (${Math.round(rw)}x${Math.round(rh)})`,
          img: base64Crop,
          scrRects: [scrRect],
          pdfRects: [pdfRect],
          scr: scrRect
        });

        // Set action popover slightly under the newly cropped selection bounding rect
        const triggerBounds = pageDiv.getBoundingClientRect();
        setFloaterPos({
          left: Math.max(12, Math.min(triggerBounds.left + rx + rw / 2 - 130, window.innerWidth - 270)),
          top: triggerBounds.top + ry + rh + 12 + window.scrollY
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    pageDiv.addEventListener("mousedown", handleMouseDown);
    return () => {
      pageDiv.removeEventListener("mousedown", handleMouseDown);
    };
  };

  // Extract custom base64 image slice for multi-modal context pipeline
  const cropCanvasRegion = (pageIdx: number, scr: Rect): string => {
    const origCanvas = canvasRefs.current[pageIdx];
    if (!origCanvas) return "";

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = Math.max(1, Math.round(scr.w));
    tempCanvas.height = Math.max(1, Math.round(scr.h));
    
    const ctx = tempCanvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(
        origCanvas,
        scr.x, scr.y, scr.w, scr.h,
        0, 0, tempCanvas.width, tempCanvas.height
      );
    }
    return tempCanvas.toDataURL("image/png").split(",")[1];
  };

  // Re-render matching paths and leader-lines connections between cards and references
  const drawPageAnnotationConnections = (pageIndex: number) => {
    const spreadEl = spreadRefs.current[pageIndex];
    if (!spreadEl) return;

    const svgElement = spreadEl.querySelector(".page-leaders-svg");
    if (!svgElement) return;

    // Clear previous paths
    while (svgElement.firstChild) {
      svgElement.removeChild(svgElement.firstChild);
    }

    const pw = pageMetadata[pageIndex]?.width || 600;
    const gutterWidth = pw / 2;
    const gutterPadding = 12;

    const currentFilteredAnns = annotations.filter(
      a => a.pi === pageIndex && isAnnotationVisible(a)
    );

    currentFilteredAnns.forEach((ann) => {
      // Find rendered card on page
      const cardEl = document.getElementById(`ann-card-${ann.id}`);
      if (!cardEl) return;

      const cardHeight = cardEl.offsetHeight;
      const cardTop = parseFloat(cardEl.style.top || "0");
      const cardCenterY = cardTop + 14;

      const markCenterY = ann.scr.y + ann.scr.h / 2;
      let lineStartPointX = 0;
      let lineEndPointX = 0;

      if (ann.side === "left") {
        lineStartPointX = gutterWidth + ann.scr.x;
        lineEndPointX = gutterWidth - gutterPadding;
      } else {
        lineStartPointX = gutterWidth + ann.scr.x + ann.scr.w;
        lineEndPointX = gutterWidth + pw + gutterPadding;
      }

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const ctrlPointX = (lineStartPointX + lineEndPointX) / 2;

      path.setAttribute(
        "d",
        `M ${lineStartPointX} ${markCenterY} C ${ctrlPointX} ${markCenterY}, ${ctrlPointX} ${cardCenterY}, ${lineEndPointX} ${cardCenterY}`
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "var(--leader)");
      path.setAttribute("stroke-width", "1");
      path.setAttribute("stroke-dasharray", "3 3");

      svgElement.appendChild(path);
    });
  };

  // Visible flag computation based on selected filter
  const isAnnotationVisible = (ann: Annotation) => {
    if (filter === "all") return true;
    if (filter === "unmastered") return !ann.mastered;
    return ann.act === filter;
  };

  // Re-adjust card heights, preventing overlap, sorting chronologically by their vertical PDF position
  const layoutPageSpreads = (pageIndex: number) => {
    const spreadWrapper = spreadRefs.current[pageIndex];
    if (!spreadWrapper) return;

    const visibleAnns = annotations
      .filter(a => a.pi === pageIndex && isAnnotationVisible(a))
      .sort((a, b) => a.scr.y - b.scr.y);

    const activeHeights = { left: 8, right: 8 };

    visibleAnns.forEach((ann) => {
      const cardEl = document.getElementById(`ann-card-${ann.id}`);
      if (!cardEl) return;

      const cardHeight = cardEl.offsetHeight || 100;
      const computedStartTop = Math.max(ann.scr.y, activeHeights[ann.side]);
      
      cardEl.style.top = `${computedStartTop}px`;
      cardEl.style.visibility = "visible";

      // Increment placement baseline height
      activeHeights[ann.side] = computedStartTop + cardHeight + 12;
    });

    // Draw lines matching correct heights
    setTimeout(() => drawPageAnnotationConnections(pageIndex), 50);
  };

  // Sync spreads rendering whenever annotations are registered or loaded
  useEffect(() => {
    if (hasPdfLoaded) {
      for (let i = 0; i < pageMetadata.length; i++) {
        layoutPageSpreads(i);
      }
    }
  }, [annotations, filter, hasPdfLoaded, pageMetadata]);

  // Keep track of which pages have been rendered to avoid multiple renders
  const renderedPagesRef = useRef<Record<number, boolean>>({});

  // Load selected raw PDF bytes, rendering its visual contents manually with accuracy
  const parseAndRenderPDF = async (buffer: ArrayBuffer, name: string) => {
    const pdfjs = getPdfJS();
    if (!pdfjs) {
      showToast("发生错误：PDF.js 脚本组件未能正常加载，请刷新页面重试。");
      return;
    }

    try {
      setHasPdfLoaded(false);
      setPdfFilename(name);
      setDocSize(buffer.byteLength);
      
      // Clone the arrayBuffer so that pdfBytes is never detached by PDF.JS web worker thread
      const pdfBytesClone = buffer.slice(0);
      setPdfBytes(pdfBytesClone);

      const renderBuffer = buffer.slice(0);
      const loadingTask = pdfjs.getDocument({ data: renderBuffer });
      const pdf = await loadingTask.promise;
      setPdfDocProxy(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);

      const totalNumPages = pdf.numPages;
      const metadataList: typeof pageMetadata = [];

      // FAST INITIALIZATION: Read the first page as baseline. This enables 500+ page PDFs to open instantly!
      const firstPage = await pdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1.35 });

      for (let i = 1; i <= totalNumPages; i++) {
        metadataList.push({
          width: viewport.width,
          height: viewport.height,
          scale: 1.35
        });
      }
      renderedPagesRef.current = {}; // reset rendered pages tracker
      setPageMetadata(metadataList);
      setHasPdfLoaded(true);
    } catch (err: any) {
      console.error(err);
      showToast(`加载 PDF 失败: ${err?.message || err}`);
    }
  };

  // Render single page on demand when it is scrolled into view (lazy render mechanism)
  const renderSinglePage = async (pageIndex: number) => {
    if (!pdfDocProxy) return;
    try {
      const pageNum = pageIndex + 1;
      const page = await pdfDocProxy.getPage(pageNum);
      const canvas = canvasRefs.current[pageIndex];
      const pageDiv = pageRefs.current[pageIndex];
      
      if (canvas && pageDiv) {
        const viewport = page.getViewport({ scale: 1.35 });
        
        // Cache viewport inside DOM element to bypass re-computation overhead in mouse handlers
        (pageDiv as any).__viewport = viewport;

        // Auto-correct page metadata if original estimated height differs from actual page height
        if (pageMetadata[pageIndex] && (Math.abs(pageMetadata[pageIndex].height - viewport.height) > 2 || Math.abs(pageMetadata[pageIndex].width - viewport.width) > 2)) {
          setPageMetadata((prev) => {
            const next = [...prev];
            next[pageIndex] = {
              width: viewport.width,
              height: viewport.height,
              scale: 1.35
            };
            return next;
          });
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        
        if (ctx) {
          await page.render({
            canvasContext: ctx,
            viewport: viewport
          }).promise;
        }

        // Render transparent text nodes overlay for highlighting
        const textLayerDiv = pageDiv.querySelector(".pdf-text-layer") as HTMLElement;
        if (textLayerDiv) {
          textLayerDiv.innerHTML = "";
          try {
            const pdfjs = getPdfJS();
            if (pdfjs && pdfjs.renderTextLayer) {
              const textContent = await page.getTextContent();
              pdfjs.renderTextLayer({
                textContent: textContent,
                container: textLayerDiv,
                viewport: viewport,
                textDivs: []
              });
            }
          } catch (te) {
            console.error("Failed to render text overlay:", te);
          }
        }

        // Setup box mouse selection listeners for custom cropping
        bindBoxSelectionEvents(pageIndex, pageDiv);

        // Immediate layout alignment for this page's annotations
        layoutPageSpreads(pageIndex);
      }
    } catch (err) {
      console.error(`Failed to render page ${pageIndex + 1}:`, err);
    }
  };

  // Scroll visibility observer for lazy rendering PDF pages (supports unlimited size / 500+ pages!)
  useEffect(() => {
    if (!hasPdfLoaded || !pdfDocProxy || pageMetadata.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageIndexStr = entry.target.getAttribute("data-page-index");
            if (pageIndexStr !== null) {
              const pageIndex = parseInt(pageIndexStr, 10);
              if (!renderedPagesRef.current[pageIndex]) {
                renderedPagesRef.current[pageIndex] = true;
                renderSinglePage(pageIndex);
              }
            }
          }
        });
      },
      {
        root: readerScrollRef.current,
        rootMargin: "800px 0px 800px 0px", // Render slightly before scrolling onto screen
        threshold: 0.01
      }
    );

    const activeElementsList: HTMLDivElement[] = [];
    for (let i = 0; i < pageMetadata.length; i++) {
      const el = spreadRefs.current[i];
      if (el) {
        observer.observe(el);
        activeElementsList.push(el);
      }
    }

    return () => {
      activeElementsList.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [hasPdfLoaded, pdfDocProxy, pageMetadata]);

  // Submit highlighted context to backend GPT-powered endpoints
  const handleAIRequest = async (act: AnnotationAct, customQ?: string) => {
    if (!pendingSelection) return;

    let apiToken = apiKey;
    if (provider === "builtin") {
      apiToken = ""; // Handled automatically server-side
    }

    const { pi, mode, src, img, scrRects, pdfRects, scr } = pendingSelection;
    const side = scr.x + scr.w / 2 < (pageMetadata[pi]?.width || 600) / 2 ? "left" : "right";

    setFloaterPos(null);
    setPendingSelection(null);

    const newId = Date.now();
    const newAnnotation: Annotation = {
      id: newId,
      act,
      custom: customQ || null,
      pi,
      mode,
      src,
      img,
      scrRects,
      pdfRects,
      scr,
      side,
      result: "朱批运墨中...",
      loading: true,
      mastered: false
    };

    // Update active UI layer to show annotation loading
    const updatedAnnotations = [...annotations, newAnnotation];
    setAnnotations(updatedAnnotations);

    try {
      const res = await fetch("/api/zhupi/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-custom-api-key": apiToken
        },
        body: JSON.stringify({
          act,
          customQuestion: customQ || "",
          srcText: src,
          image: img,
          mode,
          provider,
          model
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP 错误 ${res.status}`);
      }

      const reply = await res.json();
      setAnnotations(prev =>
        prev.map(ann =>
          ann.id === newId ? { ...ann, result: reply.result, loading: false } : ann
        )
      );
    } catch (e: any) {
      console.error(e);
      setAnnotations(prev =>
        prev.map(ann =>
          ann.id === newId
            ? {
                ...ann,
                result: `⚠️ 朱批落墨失败：${e?.message || "服务器连接异常，请检查配置。"}`,
                loading: false
              }
            : ann
        )
      );
    }
  };

  // File Upload drag states
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          parseAndRenderPDF(reader.result as ArrayBuffer, file.name);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      showToast("只支持载入 PDF 格式文件");
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          parseAndRenderPDF(reader.result as ArrayBuffer, file.name);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handlePageChange = (pageNum: number) => {
    setCurrentPage(pageNum);
    const targetSpread = spreadRefs.current[pageNum - 1];
    if (targetSpread) {
      targetSpread.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Parse scrolling height to update navigation page counter
  const handleReaderScroll = () => {
    if (!readerScrollRef.current) return;
    const viewContainer = readerScrollRef.current;
    const scrollMiddle = viewContainer.scrollTop + viewContainer.clientHeight / 2;

    let matchingPage = 1;
    for (let i = 0; i < spreadRefs.current.length; i++) {
      const el = spreadRefs.current[i];
      if (el) {
        const top = el.offsetTop;
        const bottom = top + el.clientHeight;
        if (scrollMiddle >= top && scrollMiddle <= bottom) {
          matchingPage = i + 1;
          break;
        }
      }
    }
    setCurrentPage(matchingPage);
  };

  // Save changes inside editable box contents
  const updateAnnotationData = (id: number, updated: Partial<Annotation>) => {
    setAnnotations(prev => prev.map(ann => (ann.id === id ? { ...ann, ...updated } : ann)));
  };

  // Remove annotation item from list
  const deleteAnnotation = (id: number) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== id));
  };

  // Dynamic Markdown exports representing user workflow
  const exportAnnotationsMarkdown = () => {
    if (annotations.length === 0) {
      showToast("目前还没有任何已经建成的智能朱批，无法导出笔记。");
      return;
    }

    const pagesMap: Record<number, Annotation[]> = {};
    annotations.forEach(ann => {
      pagesMap[ann.pi] = pagesMap[ann.pi] || [];
      pagesMap[ann.pi].push(ann);
    });

    let markdownText = `# 《${pdfFilename.replace(/\.pdf$/gi, "")}》朱批智能批注笔记\n`;
    markdownText += `*生成时刻: ${new Date().toLocaleString()}*\n\n---\n\n`;

    const sortedPageKeys = Object.keys(pagesMap).map(Number).sort((a, b) => a - b);
    
    sortedPageKeys.forEach(pi => {
      markdownText += `## 📖 第 ${pi + 1} 页 批注\n\n`;
      const pageAnns = pagesMap[pi];

      pageAnns.forEach(ann => {
        const typeLabel =
          ann.act === "translate"
            ? "翻译"
            : ann.act === "explain"
            ? "法律释义"
            : ann.act === "summarize"
            ? "提炼要点"
            : ann.act === "vocab"
            ? "精析术语"
            : `问答: ${ann.custom || ""}`;

        markdownText += `### ✦ 朱批类型: 【${typeLabel}】${ann.mastered ? "  *(★ 已熟记)*" : ""}\n`;
        if (ann.src && ann.mode === "text") {
          markdownText += `> 📌 **原文摘录:**\n> *${ann.src.replace(/\n/g, "\n> ")}*\n\n`;
        }
        markdownText += `✒️ **释述朱批:**\n\n${ann.result}\n\n---\n\n`;
      });
    });

    const blob = new Blob([markdownText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `朱批笔记_${pdfFilename.replace(/\.pdf$/g, "")}.md`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("以 Markdown 格式导出精细笔记已完成。");
  };

  // Compile Annotations back onto the PDF binary using high-fidelity WYSIWYG screenshot rendering (spread scale)
  const compileAnnotatedPDF = async () => {
    if (!pdfBytes) return;
    if (annotations.some(a => a.loading)) {
      showToast("存在尚在生成中的朱批，请稍作等待再开始导出。");
      return;
    }

    setExportPdfLoading(true);
    showToast("正在启动网页高保真排版快照渲染引擎...");

    try {
      const PDFLibInstance = getPdfLib();
      if (!PDFLibInstance) {
        throw new Error("PDF-Lib 组件库尚未安装，无法完成在PDF内圈画合成。");
      }

      // Load html2canvas dynamically to keep head load featherweight
      const html2canvas = (window as any).html2canvas || await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = () => resolve((window as any).html2canvas);
        script.onerror = (err) => reject(new Error("无法载入网页排版渲染插件: " + err));
        document.head.appendChild(script);
      });

      const { PDFDocument } = PDFLibInstance;
      const outputDoc = await PDFDocument.create();
      let annotatedCount = 0;

      for (let idx = 0; idx < totalPages; idx++) {
        showToast(`正在高保真合成第 ${idx + 1} / ${totalPages} 页的智能朱批版面及导引线...`);
        const spreadEl = spreadRefs.current[idx];

        if (spreadEl) {
          // Temporarily ensure full page rendering for screenshot
          const canvas = await html2canvas(spreadEl, {
            scale: 1.5, // optimal resolution vs footprint file-size ratio
            useCORS: true,
            logging: false,
            backgroundColor: "#f9f8f4",
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0
          });

          // Compress to high density JPeg representation
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          const base64Data = dataUrl.split(",")[1];
          const binaryStr = atob(base64Data);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          const embeddedImg = await outputDoc.embedJpg(bytes);
          const spreadW = spreadEl.clientWidth || 1200;
          const spreadH = spreadEl.clientHeight || 800;

          // Add widescreen side-balanced print page
          const page = outputDoc.addPage([spreadW, spreadH]);
          page.drawImage(embeddedImg, {
            x: 0,
            y: 0,
            width: spreadW,
            height: spreadH
          });
          annotatedCount++;
        } else {
          // Fallback to source document structure
          const sourceDoc = await PDFDocument.load(pdfBytes.slice(0));
          const [copiedPage] = await outputDoc.copyPages(sourceDoc, [idx]);
          outputDoc.addPage(copiedPage);
        }
      }

      const processedBytes = await outputDoc.save();
      const bOption = new Blob([processedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(bOption);
      const tempLink = document.createElement("a");
      tempLink.href = url;
      tempLink.download = `朱批合订本_${pdfFilename}`;
      tempLink.click();
      URL.revokeObjectURL(url);
      
      showToast(`合订本导出成功！已输出包含两侧朱批、底本及彩色墨迹引线的‘所见即所得’高保真 PDF。`);
    } catch (e: any) {
      console.error(e);
      showToast(`合并导出 PDF 时发生故障: ${e?.message || e}`);
    } finally {
      setExportPdfLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-desk select-none">
      {/* Platform Header Navigation controls */}
      <AnnotatorHeader
        tool={tool}
        setTool={(t) => {
          setTool(t);
          setFloaterPos(null);
          setPendingSelection(null);
        }}
        filter={filter}
        setFilter={setFilter}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onLoadPDF={triggerFileInput}
        onExportMarkdown={exportAnnotationsMarkdown}
        onExportPDF={compileAnnotatedPDF}
        exportPdfLoading={exportPdfLoading}
        hasPdfLoaded={hasPdfLoaded}
        provider={provider}
        setProvider={setProvider}
        apiKey={apiKey}
        setApiKey={setApiKey}
        model={model}
        setModel={setModel}
        customPresetPrompt={customPresetPrompt}
        setCustomPresetPrompt={setCustomPresetPrompt}
      />

      {/* Embedded File upload handler for dynamic selectors */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Main Workspace Frame */}
      <div 
        ref={fileDropRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        className="flex-1 overflow-hidden relative flex flex-col items-center justify-start pb-12"
      >
        {!hasPdfLoaded ? (
          <div className="flex-1 w-full flex items-center justify-center p-8 bg-gradient-to-b from-[#36332b] via-[#262318] to-desk select-none">
            <div className="max-w-[500px] w-full text-center p-8 bg-slab border border-[#3c3931] rounded-2xl shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-cinnabar via-gold to-cinnabar" />
              
              <div 
                className="font-song text-7xl text-cinnabar select-none mb-6 font-bold cursor-pointer transition-transform hover:scale-105"
                onClick={triggerFileInput}
              >
                批
              </div>

              <h2 className="font-song font-bold text-xl text-[#efece2] mb-3">
                朱批 · PDF 阅批台
              </h2>

              <p className="text-xs text-ink-faint leading-relaxed font-sans mb-6">
                书册居中，两翼即为批注留白。
                <br />
                支持对 PDF「划线」识取可选择的文本，亦可自主切换「框选」直接截图，交由高级 AI 模型识读翻译并解析（支持生僻图解或公式）。
                <br />
                所有在端建立的朱批都会静默自动保存于浏览器，下次载入同名文件时即自动复原。
              </p>

              <button
                onClick={triggerFileInput}
                className="cursor-pointer bg-cinnabar border border-cinnabar-d hover:bg-cinnabar-d text-white font-sans text-xs px-6 py-2.5 rounded-lg shadow-md transition-colors"
              >
                点此载入一份 PDF 文件
              </button>

              <div className="text-[10px] text-ink-faint mt-4 italic">
                安全承诺：所有文档与提取均在纯本地环境解析，无需上传任何第三方后台。
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={readerScrollRef}
            onScroll={handleReaderScroll}
            className={`flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar py-6 flex flex-col items-center gap-10 scroll-smooth ${
              tool === "box" ? "cursor-crosshair" : "cursor-text"
            }`}
          >
            {pageMetadata.map((meta, idx) => {
              const pw = meta.width;
              const ph = meta.height;
              const gutterW = pw / 2;

              return (
                <div
                  key={idx}
                  ref={(el) => {
                    spreadRefs.current[idx] = el;
                  }}
                  className="spread relative flex bg-white border border-[#15140f]/10 rounded shadow-[0_4px_16px_rgba(0,0,0,0.08),0_16px_48px_rgba(0,0,0,0.1)] select-none shrink-0"
                  style={{
                    width: `${pw + gutterW * 2}px`,
                    height: `${ph}px`,
                  }}
                  data-page-index={idx}
                >
                  {/* Left Gutter */}
                  <div
                    className="left-gutter relative shrink-0 overflow-visible self-stretch z-20 pointer-events-auto bg-white/95 border-r border-[#15140f]/10"
                    style={{ width: `${gutterW}px` }}
                  >
                    {annotations
                      .filter(ann => ann.pi === idx && ann.side === "left" && isAnnotationVisible(ann))
                      .map((ann) => (
                        <AnnotationCard
                          key={ann.id}
                          annotation={ann}
                          width={gutterW - 24}
                          onDelete={deleteAnnotation}
                          onUpdate={updateAnnotationData}
                        />
                      ))}
                  </div>

                  {/* Main Page Canvas & Text Overlay */}
                  <div
                    ref={(el) => {
                      pageRefs.current[idx] = el;
                    }}
                    className="pdf-page-container relative shrink-0 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.02)] z-10 pointer-events-auto select-none"
                    style={{ width: `${pw}px`, height: `${ph}px` }}
                    data-page-index={idx}
                  >
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[idx] = el;
                      }}
                      className="block select-none"
                    />

                    {/* Annotation Highlights representation (Client coordinates representation overlay) */}
                    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                      {annotations
                        .filter(ann => ann.pi === idx && isAnnotationVisible(ann))
                        .map((ann) => {
                          const isBox = ann.mode === "box";
                          return ann.scrRects.map((r, rIdx) => (
                            <div
                              key={`${ann.id}-${rIdx}`}
                              className={`absolute border-cinnabar/60 ${
                                isBox 
                                  ? "border border-cinnabar/70 bg-cinnabar/5" 
                                  : "border-b bg-cinnabar/[0.07] border-b-cinnabar"
                              }`}
                              style={{
                                left: `${r.x}px`,
                                top: `${r.y}px`,
                                width: `${r.w}px`,
                                height: `${r.h}px`,
                              }}
                            />
                          ));
                        })}
                    </div>

                    {/* PDF text nodes rendering layer overlay parsed directly with PDF.js */}
                    <div className={`absolute inset-0 pdf-text-layer select-text text-transparent ${tool === "box" ? "pointer-events-none" : ""}`} />

                    <div className="absolute top-2 right-2.5 font-song text-[10px] text-ink-faint select-none z-20 bg-paper/50 rounded px-1.5 py-0.5">
                      页: {idx + 1}
                    </div>
                  </div>

                  {/* Right Gutter */}
                  <div
                    className="right-gutter relative shrink-0 overflow-visible self-stretch z-20 pointer-events-auto bg-white/95 border-l border-[#15140f]/10"
                    style={{ width: `${gutterW}px` }}
                  >
                    {annotations
                      .filter(ann => ann.pi === idx && ann.side === "right" && isAnnotationVisible(ann))
                      .map((ann) => (
                        <AnnotationCard
                          key={ann.id}
                          annotation={ann}
                          width={gutterW - 24}
                          onDelete={deleteAnnotation}
                          onUpdate={updateAnnotationData}
                        />
                      ))}
                  </div>

                  {/* Background Connection Overlay paths (SVG layer representation) */}
                  <svg className="page-leaders-svg absolute inset-0 w-full h-full pointer-events-none z-30" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating toolbox overlay with contextual quick actions */}
      {floaterPos && pendingSelection && (
        <div
          className="fixed z-50 flex flex-col bg-slab border border-[#45423a] p-1.5 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.6)] select-none hover:shadow-2xl animate-fade-in"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            left: `${floaterPos.left}px`,
            top: `${floaterPos.top}px`
          }}
        >
          {!isAsking ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleAIRequest("translate")}
                className="cursor-pointer bg-transparent hover:bg-cinnabar text-[#efece2] border-0 text-xs font-semibold py-1.5 px-2.5 rounded flex items-center gap-1 transition-colors group select-none"
              >
                <span className="font-song text-sm font-bold text-gold group-hover:text-white">译</span>翻译
              </button>
              
              <button
                onClick={() => handleAIRequest("explain")}
                className="cursor-pointer bg-transparent hover:bg-cinnabar text-[#efece2] border-0 text-xs font-semibold py-1.5 px-2.5 rounded flex items-center gap-1 transition-colors group select-none"
              >
                <span className="font-song text-sm font-bold text-gold group-hover:text-white">释</span>解释
              </button>
              
              <button
                onClick={() => handleAIRequest("summarize")}
                className="cursor-pointer bg-transparent hover:bg-cinnabar text-[#efece2] border-0 text-xs font-semibold py-1.5 px-2.5 rounded flex items-center gap-1 transition-colors group select-none"
              >
                <span className="font-song text-sm font-bold text-gold group-hover:text-white">总</span>总结
              </button>
              
              <button
                onClick={() => handleAIRequest("vocab")}
                className="cursor-pointer bg-transparent hover:bg-cinnabar text-[#efece2] border-0 text-xs font-semibold py-1.5 px-2.5 rounded flex items-center gap-1 transition-colors group select-none"
              >
                <span className="font-song text-sm font-bold text-gold group-hover:text-white">词</span>研究词术
              </button>
              
              <button
                onClick={() => handleAIRequest("custom_preset", customPresetPrompt)}
                className="cursor-pointer bg-transparent hover:bg-cinnabar text-[#efece2] border-0 text-xs font-semibold py-1.5 px-2.5 rounded flex items-center gap-1 transition-colors group select-none"
                title={`自定义定标提示词: "${customPresetPrompt}"，可在顶部「朱批 AI 配置」中修改。`}
              >
                <span className="font-song text-sm font-bold text-gold group-hover:text-white">定</span>定制
              </button>

              <button
                onClick={() => setIsAsking(true)}
                className="cursor-pointer bg-transparent hover:bg-cinnabar text-[#efece2] border-0 text-xs font-semibold py-1.5 px-2.5 rounded flex items-center gap-1 transition-colors group select-none"
              >
                <span className="font-song text-sm font-bold text-gold group-hover:text-white">问</span>提问
              </button>

              <button
                onClick={() => {
                  setFloaterPos(null);
                  setPendingSelection(null);
                }}
                className="cursor-pointer text-ink-faint hover:text-white hover:bg-stone-300/20 p-1.5 rounded"
                title="关闭浮动栏"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (askQuery.trim()) {
                  handleAIRequest("custom", askQuery.trim());
                }
              }}
              className="flex items-center gap-2 p-1 w-[320px]"
            >
              <input
                autoFocus
                type="text"
                value={askQuery}
                onChange={(e) => setAskQuery(e.target.value)}
                placeholder="键入自定义提问/指令，回车发送..."
                className="flex-1 bg-[#15140f] text-[#efece2] border border-[#45423a] text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-cinnabar"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsAsking(false);
                    setAskQuery("");
                  }
                }}
              />
              <button
                type="submit"
                disabled={!askQuery.trim()}
                className="cursor-pointer bg-cinnabar hover:bg-cinnabar-d text-white font-sans text-xs px-3 py-1.5 rounded disabled:opacity-40 transition-colors shrink-0"
              >
                发送
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAsking(false);
                  setAskQuery("");
                }}
                className="cursor-pointer text-ink-faint hover:text-white hover:bg-stone-300/20 px-2 py-1.5 rounded text-xs transition-colors"
              >
                返回
              </button>
            </form>
          )}
        </div>
      )}

      {/* Dynamic Native looking interactive alerts */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 border border-black/80 text-[#efece2] font-semibold text-xs px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <AlertCircle size={13} className="text-gold" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
