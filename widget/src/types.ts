export type ConsoleLevel = 'error' | 'warn';

export interface ConsoleEntry {
  level: ConsoleLevel;
  message: string;
  at: string;
}

export interface ElementInfo {
  tag: string;
  text: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  w: number;
  h: number;
  dpr: number;
}

export interface FeedbackMeta {
  author: string;
  comment: string;
  page: string;
  title?: string;
  selector?: string;
  element?: ElementInfo;
  click?: Point;
  rect?: Rect;
  viewport: Viewport;
  userAgent: string;
  console: ConsoleEntry[];
}

export interface FeedbackItem {
  id: string;
  repo?: string;
  pr?: number;
  app?: string;
  page: string;
  author: string;
  comment: string;
  selector?: string | null;
  element?: ElementInfo | null;
  click?: Point | null;
  rect?: Rect | null;
  viewport?: Viewport | null;
  created_at: string;
  comment_url?: string | null;
  screenshot_url?: string | null;
}
