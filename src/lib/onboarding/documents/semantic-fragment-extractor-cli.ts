import {
  parsePageSelection,
} from '@/lib/onboarding/documents/pdf-parser-cli';
import {
  PdfParserError,
} from '@/lib/onboarding/documents/pdf-parser';
import type { SemanticFragment } from '@/lib/onboarding/documents/semantic-fragment-extractor';

export type SemanticFragmentCliOptions = {
  inputPath: string;
  retrievalOnly: boolean;
  pages?: number[];
  outputPath?: string;
};

/** Inspection-only JSON envelope. Not a canonical onboarding domain model. */
export type SemanticFragmentInspectionOutput = {
  schemaVersion: 1;
  pagesInSource: number;
  parsedPages?: number[];
  fragmentCount: number;
  fragments: SemanticFragment[];
};

export function parseSemanticFragmentCliArguments(
  args: readonly string[],
): SemanticFragmentCliOptions {
  let inputPath: string | undefined;
  let outputPath: string | undefined;
  let pages: number[] | undefined;
  let retrievalOnly = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--retrieval-only') {
      retrievalOnly = true;
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
      throw new Error('Unknown semantic fragment option.');
    } else if (inputPath) {
      throw new Error('Unexpected additional input path.');
    } else {
      inputPath = argument;
    }
  }

  if (!inputPath) {
    throw new Error(
      'Usage: npm run onboarding:extract-fragments -- "<path-to-report.pdf>" [--pages 2,5-8] [--retrieval-only] [--output result.json]',
    );
  }
  if (outputPath && !outputPath.toLocaleLowerCase().endsWith('.json')) {
    throw new Error('--output must use a .json file extension.');
  }
  return {
    inputPath,
    retrievalOnly,
    ...(pages ? { pages } : {}),
    ...(outputPath ? { outputPath } : {}),
  };
}

export function buildSemanticFragmentInspectionOutput(
  pagesInSource: number,
  fragments: readonly SemanticFragment[],
  parsedPages?: readonly number[],
): SemanticFragmentInspectionOutput {
  return {
    schemaVersion: 1,
    pagesInSource,
    ...(parsedPages ? { parsedPages: [...parsedPages] } : {}),
    fragmentCount: fragments.length,
    fragments: [...fragments],
  };
}

export function serializeSemanticFragmentInspectionOutput(
  output: SemanticFragmentInspectionOutput,
): string {
  return JSON.stringify(output, null, 2);
}

export function semanticFragmentCliErrorMessage(error: unknown): string {
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
  return error instanceof Error
    ? error.message
    : 'Semantic fragment extraction failed.';
}
