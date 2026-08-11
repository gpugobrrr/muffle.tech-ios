import type { ParsedFirmDocument } from '@/lib/onboarding/documents/parsed-document';

export type PdfParserCliOptions = {
  inputPath: string;
  json: boolean;
  debug: boolean;
  pages?: number[];
  outputPath?: string;
};

export function parsePageSelection(value: string): number[] {
  if (!value.trim()) {
    throw new Error('Invalid page selection: at least one page is required.');
  }
  const selected = new Set<number>();
  for (const rawPart of value.split(',')) {
    const part = rawPart.trim();
    if (!part) {
      throw new Error(`Invalid page selection: ${value}.`);
    }
    if (/^-\d+$/.test(part)) {
      throw new Error('Invalid page selection: page numbers must be >= 1.');
    }
    if (/^\d+$/.test(part)) {
      const page = Number(part);
      if (page < 1) {
        throw new Error('Invalid page selection: page numbers must be >= 1.');
      }
      selected.add(page);
      continue;
    }
    const range = /^(\d+)-(\d+)$/.exec(part);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start < 1 || end < 1) {
        throw new Error('Invalid page selection: page numbers must be >= 1.');
      }
      if (start > end) {
        throw new Error(`Invalid page range: ${part}.`);
      }
      for (let page = start; page <= end; page += 1) selected.add(page);
      continue;
    }
    if (part.includes('-')) {
      throw new Error(`Invalid page range: ${part}.`);
    }
    throw new Error(`Invalid page selection value: ${part}.`);
  }
  return [...selected].sort((left, right) => left - right);
}

export function parsePdfParserCliArguments(
  args: readonly string[],
): PdfParserCliOptions {
  let inputPath: string | undefined;
  let outputPath: string | undefined;
  let pages: number[] | undefined;
  let json = false;
  let debug = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--json') {
      json = true;
    } else if (argument === '--debug') {
      debug = true;
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
        throw new Error('--output requires a JSON file path.');
      }
      index += 1;
    } else if (argument.startsWith('--')) {
      throw new Error(`Unknown PDF parser option: ${argument}`);
    } else if (inputPath) {
      throw new Error(`Unexpected additional input path: ${argument}`);
    } else {
      inputPath = argument;
    }
  }

  if (!inputPath) {
    throw new Error(
      'Usage: npm run onboarding:parse-pdf -- "<path-to-report.pdf>" [--pages 2,5-8] [--json] [--debug] [--output result.json]',
    );
  }
  if (outputPath && !outputPath.toLocaleLowerCase().endsWith('.json')) {
    throw new Error('--output must use a .json file extension.');
  }
  return {
    inputPath,
    json,
    debug,
    ...(pages ? { pages } : {}),
    ...(outputPath ? { outputPath } : {}),
  };
}

function evidenceLine(
  block: ParsedFirmDocument['blocks'][number],
): string | undefined {
  const bounds = block.bounds;
  const font = block.font;
  if (!bounds && !font && block.sourceItemCount === undefined) return undefined;
  const parts = [
    bounds
      ? `bounds=${bounds.x},${bounds.y},${bounds.width},${bounds.height}`
      : undefined,
    font?.size !== undefined ? `font=${font.size}pt` : undefined,
    font?.weight ? `weight=${font.weight}` : undefined,
    font?.family ? `family=${font.family}` : undefined,
    block.sourceItemCount !== undefined
      ? `items=${block.sourceItemCount}`
      : undefined,
  ].filter(Boolean);
  return `  ${parts.join(' | ')}`;
}

export function formatParsedFirmDocument(
  document: ParsedFirmDocument,
  debug = false,
): string {
  const lines = [`Parsed: ${document.sourceFile}`];
  if (document.parsedPages) {
    lines.push(
      `Pages in source: ${document.pageCount}`,
      `Parsed pages: ${document.parsedPages.join(', ')}`,
    );
  } else {
    lines.push(`Pages: ${document.pageCount}`);
  }
  lines.push(`Blocks: ${document.blocks.length}`);
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
    if (debug) {
      const evidence = evidenceLine(block);
      if (evidence) lines.push(evidence);
    }
  }
  if (debug && document.debugPages) {
    for (const page of document.debugPages) {
      lines.push('', `Raw items — Page ${page.page}`);
      for (const item of page.items) {
        lines.push(
          `  #${item.sourceOrder ?? '?'} ${JSON.stringify(item.text)} | ` +
            `bounds=${item.x},${item.y},${item.width},${item.height} | ` +
            `font=${item.fontSize}pt${item.fontName ? ` ${item.fontName}` : ''}` +
            `${item.transform ? ` | transform=${item.transform.join(',')}` : ''}`,
        );
      }
    }
  }
  return lines.join('\n');
}
