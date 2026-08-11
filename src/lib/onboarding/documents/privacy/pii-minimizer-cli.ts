import {
  parsePageSelection,
} from '@/lib/onboarding/documents/pdf-parser-cli';
import {
  PdfParserError,
} from '@/lib/onboarding/documents/pdf-parser';
import type { PiiMinimizedDocument } from '@/lib/onboarding/documents/privacy/pii-minimized-document';

export type PiiMinimizerCliOptions = {
  inputPath: string;
  json: boolean;
  pages?: number[];
  outputPath?: string;
};

export function parsePiiMinimizerCliArguments(
  args: readonly string[],
): PiiMinimizerCliOptions {
  let inputPath: string | undefined;
  let outputPath: string | undefined;
  let pages: number[] | undefined;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--json') {
      json = true;
    } else if (argument === '--pages') {
      if (pages) throw new Error('--pages may be provided only once.');
      const selection = args[index + 1];
      if (!selection || selection.startsWith('--')) {
        throw new Error('--pages requires a page selection.');
      }
      pages = parsePageSelection(selection);
      index += 1;
    } else if (argument === '--output') {
      outputPath = args[index + 1];
      if (!outputPath || outputPath.startsWith('--')) {
        throw new Error('--output requires a file path.');
      }
      index += 1;
    } else if (argument.startsWith('--')) {
      throw new Error('Unknown PII minimiser option.');
    } else if (inputPath) {
      throw new Error('Unexpected additional input path.');
    } else {
      inputPath = argument;
    }
  }

  if (!inputPath) {
    throw new Error(
      'Usage: npm run onboarding:minimize-pii -- "<path-to-report.pdf>" [--pages 2,5-8] [--json] [--output result.txt|result.json]',
    );
  }
  if (
    outputPath &&
    !outputPath.toLocaleLowerCase().endsWith(json ? '.json' : '.txt')
  ) {
    throw new Error(
      `--output must use a ${json ? '.json' : '.txt'} file extension.`,
    );
  }
  return {
    inputPath,
    json,
    ...(pages ? { pages } : {}),
    ...(outputPath ? { outputPath } : {}),
  };
}

export function formatPiiMinimizedDocument(
  document: PiiMinimizedDocument,
): string {
  const lines = ['PII-minimised document', `Pages in source: ${document.pageCount}`];
  if (document.parsedPages) {
    lines.push(`Parsed pages: ${document.parsedPages.join(', ')}`);
  }
  lines.push(`Blocks: ${document.blocks.length}`);

  const actionCount = Object.values(document.summary).reduce(
    (total, count) => total + count,
    0,
  );
  lines.push(`Minimisation actions: ${actionCount}`);
  for (const [category, count] of Object.entries(document.summary)) {
    if (count > 0) lines.push(`  ${category}: ${count}`);
  }

  let currentPage = 0;
  for (const block of document.blocks) {
    if (block.page !== currentPage) {
      currentPage = block.page;
      lines.push('', `Page ${currentPage}`);
    }
    const flags = [
      block.repeatedAcrossPages ? 'repeated' : undefined,
      block.likelyPageFurniture ? 'page-furniture' : undefined,
    ].filter(Boolean);
    lines.push(
      '',
      `[${block.type}${flags.length > 0 ? `; ${flags.join(', ')}` : ''}]`,
    );
    if (block.text) lines.push(block.text);
  }
  return lines.join('\n');
}

export function serializePiiMinimizedDocument(
  document: PiiMinimizedDocument,
  json: boolean,
): string {
  return json
    ? JSON.stringify(document, null, 2)
    : formatPiiMinimizedDocument(document);
}

export function piiMinimizerCliErrorMessage(error: unknown): string {
  if (error instanceof PdfParserError) {
    if (error.code === 'INVALID_PAGE_SELECTION') return error.message;
    const messages: Record<typeof error.code, string> = {
      FILE_NOT_FOUND: 'Input PDF was not found.',
      NOT_A_FILE: 'Input PDF path is not a file.',
      NOT_A_PDF: 'Input file is not a valid PDF.',
      UNREADABLE_PDF: 'Input PDF could not be read or parsed.',
      NO_SELECTABLE_TEXT: 'Input PDF does not contain sufficient selectable text.',
      DEPENDENCY_FAILURE: 'The PDF parser dependency could not be loaded.',
    };
    return messages[error.code];
  }
  return error instanceof Error ? error.message : 'PII minimisation failed.';
}
