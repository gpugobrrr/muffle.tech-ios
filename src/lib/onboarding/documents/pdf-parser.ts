import { readFile, stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

import {
  assertSufficientSelectableText,
  reconstructParsedDocument,
  type PdfPageEvidence,
  type PdfTextItemEvidence,
} from '@/lib/onboarding/documents/pdf-layout';
import type { ParsedFirmDocument } from '@/lib/onboarding/documents/parsed-document';

export type PdfParserErrorCode =
  | 'FILE_NOT_FOUND'
  | 'NOT_A_FILE'
  | 'NOT_A_PDF'
  | 'UNREADABLE_PDF'
  | 'NO_SELECTABLE_TEXT'
  | 'INVALID_PAGE_SELECTION'
  | 'DEPENDENCY_FAILURE';

export class PdfParserError extends Error {
  readonly code: PdfParserErrorCode;

  constructor(code: PdfParserErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PdfParserError';
    this.code = code;
  }
}

function nodeErrorCode(error: unknown): string | undefined {
  return error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined;
}

export async function validatePdfFilePath(inputPath: string): Promise<string> {
  const resolvedPath = resolve(inputPath);
  let fileStats;
  try {
    fileStats = await stat(resolvedPath);
  } catch (error) {
    if (nodeErrorCode(error) !== 'ENOENT') {
      throw new PdfParserError(
        'UNREADABLE_PDF',
        `PDF path could not be inspected: ${resolvedPath}`,
        { cause: error },
      );
    }
    throw new PdfParserError(
      'FILE_NOT_FOUND',
      `PDF file does not exist: ${resolvedPath}`,
    );
  }
  if (!fileStats.isFile()) {
    throw new PdfParserError('NOT_A_FILE', `PDF path is not a file: ${resolvedPath}`);
  }
  if (extname(resolvedPath).toLocaleLowerCase() !== '.pdf') {
    throw new PdfParserError(
      'NOT_A_PDF',
      `Parser v1 accepts PDF files only: ${resolvedPath}`,
    );
  }
  return resolvedPath;
}

type PdfJsTextItem = {
  str: string;
  width: number;
  height: number;
  transform: readonly number[];
  fontName: string;
  hasEOL: boolean;
};

type PdfJsTextStyle = {
  fontFamily?: string;
};

export type PdfParserOptions = {
  pages?: readonly number[];
  debug?: boolean;
};

export function validateRequestedPages(
  requestedPages: readonly number[],
  pageCount: number,
): number[] {
  if (requestedPages.length === 0) {
    throw new PdfParserError(
      'INVALID_PAGE_SELECTION',
      'Invalid page selection: at least one page is required.',
    );
  }
  const pages = [...new Set(requestedPages)].sort((left, right) => left - right);
  for (const page of pages) {
    if (!Number.isInteger(page) || page < 1) {
      throw new PdfParserError(
        'INVALID_PAGE_SELECTION',
        'Invalid page selection: page numbers must be integers >= 1.',
      );
    }
    if (page > pageCount) {
      throw new PdfParserError(
        'INVALID_PAGE_SELECTION',
        `Requested page ${page} but the PDF contains ${pageCount} pages.`,
      );
    }
  }
  return pages;
}

function fontWeight(fontName: string, family?: string): string | undefined {
  return /bold|black|heavy|semibold|demi/i.test(`${fontName} ${family ?? ''}`)
    ? 'bold'
    : undefined;
}

function textItemEvidence(
  item: PdfJsTextItem,
  styles: Record<string, PdfJsTextStyle>,
  sourceOrder: number,
): PdfTextItemEvidence {
  const [a = 0, b = 0, , , x = 0, y = 0] = item.transform;
  const sizeFromTransform = Math.hypot(a, b);
  const fontSize = sizeFromTransform || item.height || 1;
  const family = styles[item.fontName]?.fontFamily;
  const weight = fontWeight(item.fontName, family);
  return {
    text: item.str,
    x,
    y,
    width: Math.abs(item.width),
    height: Math.abs(item.height) || fontSize,
    fontSize,
    ...(family ? { fontFamily: family } : {}),
    ...(weight ? { fontWeight: weight } : {}),
    hasEol: item.hasEOL,
    sourceOrder,
    fontName: item.fontName,
    transform: [...item.transform],
  };
}

export async function parseFirmPdf(
  inputPath: string,
  options: PdfParserOptions = {},
): Promise<ParsedFirmDocument> {
  const resolvedPath = await validatePdfFilePath(inputPath);
  let buffer;
  try {
    buffer = await readFile(resolvedPath);
  } catch (error) {
    throw new PdfParserError(
      'UNREADABLE_PDF',
      `PDF file could not be read: ${resolvedPath}`,
      { cause: error },
    );
  }
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new PdfParserError(
      'NOT_A_PDF',
      `File does not have a valid PDF signature: ${resolvedPath}`,
    );
  }

  let pdfjs;
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (error) {
    throw new PdfParserError(
      'DEPENDENCY_FAILURE',
      'PDF Parser v1 could not load its pdfjs-dist dependency.',
      { cause: error },
    );
  }

  let destroyLoadingTask: (() => Promise<void>) | undefined;
  try {
    const loadingTask = pdfjs.getDocument({
      data: Uint8Array.from(buffer),
      disableFontFace: true,
      useSystemFonts: true,
      stopAtErrors: true,
      verbosity: 0,
    });
    destroyLoadingTask = () => loadingTask.destroy();
    const document = await loadingTask.promise;
    const selectedMode = options.pages !== undefined;
    const pageNumbers =
      options.pages === undefined
        ? Array.from({ length: document.numPages }, (_, index) => index + 1)
        : validateRequestedPages(options.pages, document.numPages);
    const pages: PdfPageEvidence[] = [];
    for (const pageNumber of pageNumbers) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent({
        disableNormalization: false,
        includeMarkedContent: false,
      });
      const styles = content.styles as Record<string, PdfJsTextStyle>;
      const items: PdfTextItemEvidence[] = [];
      let sourceOrder = 0;
      for (const item of content.items) {
        if (!('str' in item) || typeof item.str !== 'string') continue;
        items.push(
          textItemEvidence(
            {
              str: item.str,
              width: item.width,
              height: item.height,
              transform: item.transform,
              fontName: item.fontName,
              hasEOL: item.hasEOL,
            },
            styles,
            sourceOrder,
          ),
        );
        sourceOrder += 1;
      }
      pages.push({
        page: pageNumber,
        width: viewport.width,
        height: viewport.height,
        items,
      });
      page.cleanup();
    }

    try {
      assertSufficientSelectableText(pages);
    } catch (error) {
      throw new PdfParserError(
        'NO_SELECTABLE_TEXT',
        error instanceof Error ? error.message : String(error),
        { cause: error },
      );
    }
    return reconstructParsedDocument(basename(resolvedPath), pages, {
      sourcePageCount: document.numPages,
      ...(selectedMode ? { parsedPages: pageNumbers } : {}),
      debug: options.debug,
    });
  } catch (error) {
    if (error instanceof PdfParserError) throw error;
    throw new PdfParserError(
      'UNREADABLE_PDF',
      `PDF could not be parsed: ${resolvedPath}`,
      { cause: error },
    );
  } finally {
    await destroyLoadingTask?.();
  }
}
