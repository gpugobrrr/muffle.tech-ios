import {
  parsePageSelection,
} from '@/lib/onboarding/documents/pdf-parser-cli';
import {
  PdfParserError,
} from '@/lib/onboarding/documents/pdf-parser';
import type { OntologyConceptProposal } from '@/lib/onboarding/documents/ontology-seed-proposals';

export type OntologySeedProposalCliOptions = {
  inputPaths: string[];
  pages?: number[];
  outputPath: string;
};

export type OntologySeedProposalInspectionOutput = {
  schemaVersion: 1;
  sourceDocumentCount: number;
  evidenceCount: number;
  proposalCount: number;
  proposals: OntologyConceptProposal[];
};

export class OntologySeedProposalCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OntologySeedProposalCliError';
  }
}

export function parseOntologySeedProposalCliArguments(
  args: readonly string[],
): OntologySeedProposalCliOptions {
  const inputPaths: string[] = [];
  let pages: number[] | undefined;
  let outputPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--pages') {
      if (pages) {
        throw new OntologySeedProposalCliError(
          '--pages may be provided only once.',
        );
      }
      const selection = args[index + 1];
      if (!selection || selection.startsWith('--')) {
        throw new OntologySeedProposalCliError(
          '--pages requires a page selection.',
        );
      }
      try {
        pages = parsePageSelection(selection);
      } catch (error) {
        throw new OntologySeedProposalCliError(
          error instanceof Error
            ? error.message
            : 'Invalid page selection.',
        );
      }
      index += 1;
    } else if (argument === '--output') {
      outputPath = args[index + 1];
      if (!outputPath || outputPath.startsWith('--')) {
        throw new OntologySeedProposalCliError(
          '--output requires a file path.',
        );
      }
      index += 1;
    } else if (argument.startsWith('--')) {
      throw new OntologySeedProposalCliError(
        'Unknown ontology proposal option.',
      );
    } else {
      inputPaths.push(argument);
    }
  }

  if (inputPaths.length === 0 || !outputPath) {
    throw new OntologySeedProposalCliError(
      'Usage: npm run onboarding:propose-ontology -- "<report.pdf>" ["<additional-report.pdf>"] [--pages 1-47] --output result.json',
    );
  }
  if (!outputPath.toLocaleLowerCase().endsWith('.json')) {
    throw new OntologySeedProposalCliError(
      '--output must use a .json file extension.',
    );
  }
  return {
    inputPaths,
    ...(pages ? { pages } : {}),
    outputPath,
  };
}

export function buildOntologySeedProposalInspectionOutput(
  sourceDocumentCount: number,
  evidenceCount: number,
  proposals: readonly OntologyConceptProposal[],
): OntologySeedProposalInspectionOutput {
  return {
    schemaVersion: 1,
    sourceDocumentCount,
    evidenceCount,
    proposalCount: proposals.length,
    proposals: [...proposals],
  };
}

export function serializeOntologySeedProposalInspectionOutput(
  output: OntologySeedProposalInspectionOutput,
): string {
  return JSON.stringify(output, null, 2);
}

export function ontologySeedProposalCliErrorMessage(error: unknown): string {
  if (error instanceof OntologySeedProposalCliError) return error.message;
  if (error instanceof PdfParserError) {
    if (error.code === 'INVALID_PAGE_SELECTION') return error.message;
    const messages: Record<typeof error.code, string> = {
      FILE_NOT_FOUND: 'An input PDF was not found.',
      NOT_A_FILE: 'An input PDF path is not a file.',
      NOT_A_PDF: 'An input file is not a valid PDF.',
      UNREADABLE_PDF: 'An input PDF could not be read or parsed.',
      NO_SELECTABLE_TEXT:
        'An input PDF does not contain sufficient selectable text.',
      DEPENDENCY_FAILURE: 'The PDF parser dependency could not be loaded.',
    };
    return messages[error.code];
  }
  return 'Ontology proposal generation failed.';
}
