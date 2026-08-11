import type {
  ParsedDocumentBlock,
  ParsedDocumentBounds,
  ParsedDocumentBlockType,
  ParsedDocumentDebugPage,
  ParsedFirmDocument,
} from '@/lib/onboarding/documents/parsed-document';

export type PdfTextItemEvidence = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: string;
  hasEol?: boolean;
  sourceOrder?: number;
  fontName?: string;
  transform?: number[];
};

export type PdfPageEvidence = {
  page: number;
  width: number;
  height: number;
  items: readonly PdfTextItemEvidence[];
};

type ParsedLine = {
  text: string;
  bounds: ParsedDocumentBounds;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: string;
  itemCount: number;
  structuralHint?: 'marker';
  sourceStart?: number;
  sourceEnd?: number;
};

const LIST_PATTERN = /^(?:[•●▪◦‣⁃*-]|\(?\d+[.)]|[a-zA-Z][.)])\s+/;
const SECTION_PATTERN = /^(?:[A-Z]\d+(?:\.\d+)*|\d+(?:\.\d+)+)\s+\S/;

export function normalizeExtractedText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function rounded(value: number): number {
  return Number(value.toFixed(2));
}

function boundsForItems(items: readonly PdfTextItemEvidence[]): ParsedDocumentBounds {
  const left = Math.min(...items.map((item) => item.x));
  const bottom = Math.min(...items.map((item) => item.y));
  const right = Math.max(...items.map((item) => item.x + item.width));
  const top = Math.max(...items.map((item) => item.y + item.height));
  return {
    x: rounded(left),
    y: rounded(bottom),
    width: rounded(right - left),
    height: rounded(top - bottom),
  };
}

function joinItems(items: readonly PdfTextItemEvidence[]): string {
  let text = '';
  let previous: PdfTextItemEvidence | undefined;
  for (const item of items) {
    const value = normalizeExtractedText(item.text);
    if (!value) continue;
    const gap = previous ? item.x - (previous.x + previous.width) : 0;
    const needsSpace =
      text.length > 0 &&
      gap > Math.max(0.8, Math.min(item.fontSize, previous?.fontSize ?? 0) * 0.12) &&
      !/[-/\u2013\u2014]$/.test(text) &&
      !/^[,.;:!?%)}\]]/.test(value);
    text += `${needsSpace ? ' ' : ''}${value}`;
    previous = item;
  }
  return normalizeExtractedText(text);
}

function sourceRange(items: readonly PdfTextItemEvidence[]): {
  sourceStart?: number;
  sourceEnd?: number;
} {
  const orders = items
    .map((item) => item.sourceOrder)
    .filter((value): value is number => value !== undefined);
  return orders.length > 0
    ? { sourceStart: Math.min(...orders), sourceEnd: Math.max(...orders) }
    : {};
}

type LineItemGroup = {
  items: PdfTextItemEvidence[];
  structuralHint?: 'marker';
};

function isCompactMarkerCandidate(item: PdfTextItemEvidence): boolean {
  const text = normalizeExtractedText(item.text);
  return (
    /^(?:\d{1,2}|[A-Z]{1,3})$/.test(text) &&
    item.width <= Math.max(28, item.fontSize * 3)
  );
}

function markerGapThreshold(marker: PdfTextItemEvidence): number {
  return Math.max(8, marker.fontSize * 0.8);
}

function splitWideLine(items: readonly PdfTextItemEvidence[]): LineItemGroup[] {
  const sorted = [...items].sort((left, right) => left.x - right.x);
  const groups: LineItemGroup[] = [];
  let startIndex = 0;
  const marker = sorted[0];
  const markerNeighbour = sorted[1];
  if (marker && markerNeighbour) {
    const markerGap = markerNeighbour.x - (marker.x + marker.width);
    if (
      isCompactMarkerCandidate(marker) &&
      markerGap >= markerGapThreshold(marker) &&
      normalizeExtractedText(markerNeighbour.text).length >= 8
    ) {
      groups.push({ items: [marker], structuralHint: 'marker' });
      startIndex = 1;
    }
  }

  for (const item of sorted.slice(startIndex)) {
    const current = groups.at(-1);
    const previous = current?.items.at(-1);
    const gap = previous ? item.x - (previous.x + previous.width) : 0;
    if (
      current &&
      previous &&
      current.structuralHint !== 'marker' &&
      gap > Math.max(48, Math.max(item.fontSize, previous.fontSize) * 5)
    ) {
      groups.push({ items: [item] });
    } else if (current) {
      if (current.structuralHint === 'marker') {
        groups.push({ items: [item] });
      } else {
        current.items.push(item);
      }
    } else {
      groups.push({ items: [item] });
    }
  }
  return groups;
}

function compatibleLineFonts(left: ParsedLine, right: ParsedLine): boolean {
  return (
    Math.abs(left.fontSize - right.fontSize) <= 1.5 &&
    left.fontWeight === right.fontWeight &&
    (!left.fontFamily ||
      !right.fontFamily ||
      left.fontFamily === right.fontFamily)
  );
}

function mergedSourceRange(lines: readonly ParsedLine[]): {
  sourceStart?: number;
  sourceEnd?: number;
} {
  const starts = lines
    .map((line) => line.sourceStart)
    .filter((value): value is number => value !== undefined);
  const ends = lines
    .map((line) => line.sourceEnd)
    .filter((value): value is number => value !== undefined);
  return starts.length > 0 && ends.length > 0
    ? {
        sourceStart: Math.min(...starts),
        sourceEnd: Math.max(...ends),
      }
    : {};
}

function mergeInterruptedProseLines(
  lines: readonly ParsedLine[],
  pageWidth?: number,
): ParsedLine[] {
  const merged: ParsedLine[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const left = lines[index];
    const right = lines[index + 1];
    const continuation = lines[index + 2];
    if (!right || !continuation) {
      merged.push(left);
      continue;
    }

    const fontSize = Math.max(
      left.fontSize,
      right.fontSize,
      continuation.fontSize,
    );
    const baselineDelta = Math.abs(left.bounds.y - right.bounds.y);
    const horizontalGap =
      right.bounds.x - (left.bounds.x + left.bounds.width);
    const nextLineGap =
      left.bounds.y -
      (continuation.bounds.y + continuation.bounds.height);
    const following = lines[index + 3];
    const rightColumnContinues =
      following !== undefined &&
      Math.abs(following.bounds.y - continuation.bounds.y) <=
        Math.max(2, fontSize * 0.3) &&
      following.bounds.x >= right.bounds.x - fontSize * 2;
    const substantialWidth =
      left.bounds.width >= Math.max(140, (pageWidth ?? 0) * 0.22);

    const matches =
      !left.structuralHint &&
      !right.structuralHint &&
      !continuation.structuralHint &&
      left.text.length >= 24 &&
      substantialWidth &&
      !/[.!?;:]$/.test(left.text) &&
      /^[a-z]/.test(right.text) &&
      /^[a-z]/.test(continuation.text) &&
      right.text.length <= 80 &&
      right.bounds.width <= Math.max(90, left.bounds.width * 0.35) &&
      baselineDelta <= Math.max(0.75, fontSize * 0.12) &&
      horizontalGap >= Math.max(24, fontSize * 2.5) &&
      horizontalGap <= Math.max(220, fontSize * 22) &&
      nextLineGap >= -fontSize * 0.2 &&
      nextLineGap <= fontSize * 1.25 &&
      Math.abs(continuation.bounds.x - left.bounds.x) <= fontSize * 1.5 &&
      compatibleLineFonts(left, right) &&
      compatibleLineFonts(left, continuation) &&
      !rightColumnContinues;

    if (!matches) {
      merged.push(left);
      continue;
    }

    const contributing = [left, right, continuation];
    merged.push({
      text: `${left.text} ${right.text} ${continuation.text}`,
      bounds: unionBounds(contributing),
      fontSize: left.fontSize,
      fontFamily: left.fontFamily,
      fontWeight: left.fontWeight,
      itemCount: contributing.reduce(
        (total, line) => total + line.itemCount,
        0,
      ),
      ...mergedSourceRange(contributing),
    });
    index += 2;
  }
  return merged;
}

export function groupTextItemsIntoLines(
  items: readonly PdfTextItemEvidence[],
  pageWidth?: number,
): ParsedLine[] {
  const rows: PdfTextItemEvidence[][] = [];
  const ordered = items
    .filter((item) => normalizeExtractedText(item.text))
    .sort((left, right) => right.y - left.y || left.x - right.x);

  for (const item of ordered) {
    const row = rows.find((candidate) => {
      const anchor = candidate[0];
      return Math.abs(anchor.y - item.y) <= Math.max(2, item.fontSize * 0.3);
    });
    if (row) row.push(item);
    else rows.push([item]);
  }

  const lines = rows
    .sort((left, right) => right[0].y - left[0].y)
    .flatMap(splitWideLine)
    .map((group) => {
      const lineItems = group.items;
      const sorted = [...lineItems].sort((left, right) => left.x - right.x);
      const primary = sorted.reduce((largest, item) =>
        item.fontSize > largest.fontSize ? item : largest,
      );
      return {
        text: joinItems(sorted),
        bounds: boundsForItems(sorted),
        fontSize: rounded(primary.fontSize),
        fontFamily: primary.fontFamily,
        fontWeight: primary.fontWeight,
        itemCount: sorted.length,
        structuralHint: group.structuralHint,
        ...sourceRange(sorted),
      };
    })
    .filter((line) => line.text.length > 0);
  return mergeInterruptedProseLines(lines, pageWidth);
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function classifyLine(
  line: ParsedLine,
  bodyFontSize: number,
  gapBefore: number,
  gapAfter: number,
): ParsedDocumentBlockType {
  if (line.structuralHint === 'marker') return 'marker';
  if (LIST_PATTERN.test(line.text)) return 'list';
  const short = line.text.length <= 100;
  const isolated =
    gapBefore > line.fontSize * 0.75 || gapAfter > line.fontSize * 0.75;
  const larger = bodyFontSize > 0 && line.fontSize >= bodyFontSize * 1.16;
  const bold = line.fontWeight === 'bold';
  if (
    short &&
    (larger || (bold && isolated) || (SECTION_PATTERN.test(line.text) && isolated))
  ) {
    return 'heading';
  }
  return 'paragraph';
}

function unionBounds(lines: readonly ParsedLine[]): ParsedDocumentBounds {
  const left = Math.min(...lines.map((line) => line.bounds.x));
  const bottom = Math.min(...lines.map((line) => line.bounds.y));
  const right = Math.max(
    ...lines.map((line) => line.bounds.x + line.bounds.width),
  );
  const top = Math.max(
    ...lines.map((line) => line.bounds.y + line.bounds.height),
  );
  return {
    x: rounded(left),
    y: rounded(bottom),
    width: rounded(right - left),
    height: rounded(top - bottom),
  };
}

function joinLines(lines: readonly ParsedLine[]): string {
  return lines.reduce((text, line) => {
    if (!text) return line.text;
    if (text.endsWith('-') && /^[a-z]/.test(line.text)) {
      return `${text.slice(0, -1)}${line.text}`;
    }
    return `${text} ${line.text}`;
  }, '');
}

function linesCanShareParagraph(previous: ParsedLine, next: ParsedLine): boolean {
  const verticalGap = previous.bounds.y - (next.bounds.y + next.bounds.height);
  return (
    verticalGap <= Math.max(previous.fontSize, next.fontSize) * 0.85 &&
    Math.abs(previous.bounds.x - next.bounds.x) <=
      Math.max(previous.fontSize, next.fontSize) * 1.5 &&
    Math.abs(previous.fontSize - next.fontSize) <= 1.5 &&
    previous.fontWeight === next.fontWeight
  );
}

function linesCanShareList(
  first: ParsedLine,
  previous: ParsedLine,
  next: ParsedLine,
): boolean {
  const verticalGap = previous.bounds.y - (next.bounds.y + next.bounds.height);
  const fontSize = Math.max(previous.fontSize, next.fontSize);
  return (
    verticalGap >= -fontSize * 0.2 &&
    verticalGap <= fontSize * 0.95 &&
    next.bounds.x >= first.bounds.x - 1 &&
    next.bounds.x - first.bounds.x <= fontSize * 4 &&
    Math.abs(previous.fontSize - next.fontSize) <= 1.5 &&
    previous.fontWeight === next.fontWeight &&
    (!previous.fontFamily ||
      !next.fontFamily ||
      previous.fontFamily === next.fontFamily)
  );
}

export function reconstructPageBlocks(
  page: PdfPageEvidence,
): ParsedDocumentBlock[] {
  const lines = groupTextItemsIntoLines(page.items, page.width);
  const bodyFontSize = median(lines.map((line) => line.fontSize));
  const typedLines = lines.map((line, index) => {
    const previous = lines[index - 1];
    const next = lines[index + 1];
    const gapBefore = previous
      ? previous.bounds.y - (line.bounds.y + line.bounds.height)
      : Number.POSITIVE_INFINITY;
    const gapAfter = next
      ? line.bounds.y - (next.bounds.y + next.bounds.height)
      : Number.POSITIVE_INFINITY;
    return {
      line,
      type: classifyLine(line, bodyFontSize, gapBefore, gapAfter),
    };
  });

  const groups: { type: ParsedDocumentBlockType; lines: ParsedLine[] }[] = [];
  for (const typed of typedLines) {
    const current = groups.at(-1);
    if (current && typed.type === 'paragraph') {
      const previous = current.lines.at(-1)!;
      if (
        (current.type === 'paragraph' &&
          linesCanShareParagraph(previous, typed.line)) ||
        (current.type === 'list' &&
          linesCanShareList(current.lines[0], previous, typed.line))
      ) {
        current.lines.push(typed.line);
        continue;
      }
    }
    groups.push({ type: typed.type, lines: [typed.line] });
  }

  return groups.map((group, index) => {
    const primary = group.lines[0];
    return {
      id: `p${page.page}-b${index + 1}`,
      page: page.page,
      type: group.type,
      text: joinLines(group.lines),
      bounds: unionBounds(group.lines),
      font: {
        size: primary.fontSize,
        ...(primary.fontWeight ? { weight: primary.fontWeight } : {}),
        ...(primary.fontFamily ? { family: primary.fontFamily } : {}),
      },
      sourceItemCount: group.lines.reduce(
        (total, line) => total + line.itemCount,
        0,
      ),
    };
  });
}

function furnitureKey(block: ParsedDocumentBlock): string {
  return normalizeExtractedText(block.text ?? '')
    .toLocaleLowerCase()
    .replace(/\bpage\s+\d+\b/g, 'page #')
    .replace(/^\d+$/, '#');
}

function flagRepeatedFurniture(
  blocks: ParsedDocumentBlock[],
  pages: readonly PdfPageEvidence[],
): void {
  const pageHeights = new Map(pages.map((page) => [page.page, page.height]));
  const occurrences = new Map<string, ParsedDocumentBlock[]>();
  for (const block of blocks) {
    const key = furnitureKey(block);
    if (!key || key.length > 160) continue;
    const matches = occurrences.get(key) ?? [];
    matches.push(block);
    occurrences.set(key, matches);
  }

  for (const matches of occurrences.values()) {
    if (new Set(matches.map((block) => block.page)).size < 2) continue;
    for (const block of matches) {
      block.repeatedAcrossPages = true;
      const pageHeight = pageHeights.get(block.page);
      const bounds = block.bounds;
      if (
        pageHeight &&
        bounds &&
        (bounds.y + bounds.height >= pageHeight * 0.88 ||
          bounds.y <= pageHeight * 0.12)
      ) {
        block.likelyPageFurniture = true;
      }
    }
  }
}

export function reconstructParsedDocument(
  sourceFile: string,
  pages: readonly PdfPageEvidence[],
  options: {
    sourcePageCount?: number;
    parsedPages?: readonly number[];
    debug?: boolean;
  } = {},
): ParsedFirmDocument {
  const orderedPages = [...pages].sort((left, right) => left.page - right.page);
  const blocks = orderedPages.flatMap(reconstructPageBlocks);
  flagRepeatedFurniture(blocks, orderedPages);
  return {
    parserVersion: 1,
    sourceFile,
    pageCount: options.sourcePageCount ?? orderedPages.length,
    ...(options.parsedPages
      ? { parsedPages: [...options.parsedPages] }
      : {}),
    ...(options.debug
      ? {
          debugPages: orderedPages.map((page): ParsedDocumentDebugPage => ({
            page: page.page,
            items: page.items.map((item) => ({
              text: item.text,
              x: item.x,
              y: item.y,
              width: item.width,
              height: item.height,
              fontSize: item.fontSize,
              ...(item.fontFamily ? { fontFamily: item.fontFamily } : {}),
              ...(item.fontWeight ? { fontWeight: item.fontWeight } : {}),
              ...(item.fontName ? { fontName: item.fontName } : {}),
              ...(item.transform ? { transform: [...item.transform] } : {}),
              ...(item.sourceOrder !== undefined
                ? { sourceOrder: item.sourceOrder }
                : {}),
            })),
          })),
        }
      : {}),
    blocks,
  };
}

export function assertSufficientSelectableText(
  pages: readonly PdfPageEvidence[],
): void {
  const characterCount = pages.reduce(
    (total, page) =>
      total +
      page.items.reduce(
        (pageTotal, item) =>
          pageTotal + normalizeExtractedText(item.text).length,
        0,
      ),
    0,
  );
  if (characterCount < 20) {
    throw new Error(
      'This PDF does not contain sufficient selectable text for Parser v1. OCR is not implemented.',
    );
  }
}
