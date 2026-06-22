/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AnnotationAct = "translate" | "explain" | "summarize" | "vocab" | "custom";

export interface Annotation {
  id: number;
  act: AnnotationAct;
  custom: string | null;
  pi: number; // 0-based page index
  mode: "text" | "box";
  src: string; // original source text
  img: string | null; // cropped screenshot base64 image (for box select mode)
  scrRects: Rect[]; // absolute scroll relative coordinates for rendering marks
  pdfRects: Rect[]; // PDF absolute scale coordinates for drawing on PDF
  scr: Rect; // combined bounding box
  side: "left" | "right";
  result: string; // AI generated markdown content
  loading: boolean;
  mastered: boolean;
}

export interface PDFState {
  bytes: ArrayBuffer | null;
  pdf: any | null; // PDFDocumentProxy from pdfjs
  tool: "underline" | "box";
  viewports: any[]; // Viewport objects
  pageW: number[];
  pageH: number[];
  annotations: Annotation[];
  filter: "all" | "translate" | "explain" | "summarize" | "vocab" | "unmastered";
  docKey: string; // constructed via filename + size to allow seamless local persistence
}
