export type ParsedDocumentBlockType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'marker'
  | 'table'
  | 'image'
  | 'unknown';

export type ParsedDocumentBounds = {
  /** PDF points from the left edge. */
  x: number;
  /** PDF points from the bottom edge. */
  y: number;
  width: number;
  height: number;
};

export type ParsedDocumentFont = {
  size?: number;
  weight?: string;
  family?: string;
};

export type ParsedDocumentBlock = {
  id: string;
  page: number;
  type: ParsedDocumentBlockType;
  text?: string;
  bounds?: ParsedDocumentBounds;
  font?: ParsedDocumentFont;
  sourceItemCount?: number;
  repeatedAcrossPages?: boolean;
  likelyPageFurniture?: boolean;
};

export type ParsedDocumentDebugItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: string;
  fontName?: string;
  transform?: number[];
  sourceOrder?: number;
};

export type ParsedDocumentDebugPage = {
  page: number;
  items: ParsedDocumentDebugItem[];
};

/**
 * Neutral structural evidence extracted from a firm document. Block types and
 * furniture flags are parser heuristics, not canonical survey semantics.
 */
export type ParsedFirmDocument = {
  parserVersion: 1;
  sourceFile: string;
  /** Total page count in the source PDF. */
  pageCount: number;
  /** Present when this invocation parsed only a selected subset of source pages. */
  parsedPages?: number[];
  /** Raw PDF.js extraction evidence, present only for an explicit debug parse. */
  debugPages?: ParsedDocumentDebugPage[];
  blocks: ParsedDocumentBlock[];
};
