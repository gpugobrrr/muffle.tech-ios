import {
  SemanticMappingConfigurationError,
  SemanticMappingHttpError,
} from '@/lib/onboarding/llama-cpp-semantic-mapper';
import {
  parsePageSelection,
} from '@/lib/onboarding/documents/pdf-parser-cli';
import {
  PdfParserError,
} from '@/lib/onboarding/documents/pdf-parser';
import type { SemanticMappingInspectionOutput } from '@/lib/onboarding/documents/semantic-mapping-inspection';

export type SemanticMappingInspectionCliOptions = {
  inputPath: string;
  pages: number[];
  outputPath: string;
};

export class SemanticMappingInspectionCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SemanticMappingInspectionCliError';
  }
}

export function parseSemanticMappingInspectionCliArguments(
  args: readonly string[],
): SemanticMappingInspectionCliOptions {
  let inputPath: string | undefined;
  let outputPath: string | undefined;
  let pages: number[] | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--pages') {
      if (pages) {
        throw new SemanticMappingInspectionCliError(
          '--pages may be provided only once.',
        );
      }
      const selection = args[index + 1];
      if (!selection || selection.startsWith('--')) {
        throw new SemanticMappingInspectionCliError(
          '--pages requires a page selection.',
        );
      }
      try {
        pages = parsePageSelection(selection);
      } catch (error) {
        throw new SemanticMappingInspectionCliError(
          error instanceof Error
            ? error.message
            : 'Invalid page selection.',
        );
      }
      index += 1;
    } else if (argument === '--output') {
      outputPath = args[index + 1];
      if (!outputPath || outputPath.startsWith('--')) {
        throw new SemanticMappingInspectionCliError(
          '--output requires a file path.',
        );
      }
      index += 1;
    } else if (argument.startsWith('--')) {
      throw new SemanticMappingInspectionCliError(
        'Unknown local mapping inspection option.',
      );
    } else if (inputPath) {
      throw new SemanticMappingInspectionCliError(
        'Unexpected additional input path.',
      );
    } else {
      inputPath = argument;
    }
  }

  if (!inputPath || !pages || !outputPath) {
    throw new SemanticMappingInspectionCliError(
      'Usage: npm run onboarding:map-fragments-local -- "<path-to-report.pdf>" --pages 1-6 --output result.json',
    );
  }
  if (!outputPath.toLocaleLowerCase().endsWith('.json')) {
    throw new SemanticMappingInspectionCliError(
      '--output must use a .json file extension.',
    );
  }
  return { inputPath, pages, outputPath };
}

export function serializeSemanticMappingInspectionOutput(
  output: SemanticMappingInspectionOutput,
): string {
  return JSON.stringify(output, null, 2);
}

export function semanticMappingInspectionCliErrorMessage(
  error: unknown,
): string {
  if (error instanceof SemanticMappingInspectionCliError) {
    return error.message;
  }
  if (error instanceof PdfParserError) {
    if (error.code === 'INVALID_PAGE_SELECTION') return error.message;
    const messages: Record<typeof error.code, string> = {
      FILE_NOT_FOUND: 'Input PDF was not found.',
      NOT_A_FILE: 'Input PDF path is not a file.',
      NOT_A_PDF: 'Input file is not a valid PDF.',
      UNREADABLE_PDF: 'Input PDF could not be read or parsed.',
      NO_SELECTABLE_TEXT:
        'Input PDF does not contain sufficient selectable text.',
      DEPENDENCY_FAILURE: 'The PDF parser dependency could not be loaded.',
    };
    return messages[error.code];
  }
  if (error instanceof SemanticMappingConfigurationError) {
    return error.message;
  }
  if (error instanceof SemanticMappingHttpError) {
    return error.status === 0
      ? 'Local llama.cpp server is unavailable. Start the configured localhost server and retry.'
      : `Local llama.cpp request failed with HTTP ${error.status}.`;
  }
  return 'Local semantic mapping inspection failed.';
}
