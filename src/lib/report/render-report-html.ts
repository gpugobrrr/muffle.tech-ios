import {
  applyFirmAdapter,
  type FirmAdapter,
  type FirmFindingBlock,
} from '@/lib/report/firm-adapter';
import type {
  FindingBlock,
  IdentityBlock,
  ReportAddress,
  ReportDocument,
} from '@/types/report';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function uniqueNonEmpty(values: (string | undefined)[]): string[] {
  return values.reduce<string[]>((result, value) => {
    const trimmed = value?.trim();
    if (!trimmed || result.includes(trimmed)) return result;
    return [...result, trimmed];
  }, []);
}

export function identityAddressLines(address: ReportAddress): string[] {
  const providerLines = uniqueNonEmpty([
    address.line1,
    address.line2,
    address.line3,
    address.line4,
  ]);
  const premises =
    providerLines.length > 0
      ? providerLines
      : uniqueNonEmpty([
          [address.subBuildingName ?? address.subBuildingNumber, address.buildingName]
            .filter(Boolean)
            .join(', '),
          [address.streetNumber, address.route].filter(Boolean).join(' '),
          address.locality,
        ]);

  const structuredLines = uniqueNonEmpty([
    ...premises,
    address.townOrCity,
    address.administrativeArea,
    address.postalCode,
    address.country,
  ]);
  return structuredLines.length > 0
    ? structuredLines
    : [address.formattedAddress];
}

function renderIdentityBlock(identity: IdentityBlock): string {
  const address = identityAddressLines(identity.property.address)
    .map((line) => `<span class="address-line">${escapeHtml(line)}</span>`)
    .join('');
  const instructingParty = identity.instructingParty
    ? `
      <dl class="metadata">
        <div class="metadata-row">
          <dt>Instructing party</dt>
          <dd>${escapeHtml(identity.instructingParty)}</dd>
        </div>
      </dl>`
    : '';

  return `
    <section class="identity" aria-labelledby="identity-heading">
      <p class="eyebrow">Property report</p>
      <h1 id="identity-heading">${address}</h1>
      ${instructingParty}
    </section>`;
}

function renderFindingRow(label: string, value: string): string {
  return `
        <div class="finding-row">
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>`;
}

function renderFindingBlock(
  finding: FindingBlock | FirmFindingBlock,
): string {
  const heading =
    'sectionHeading' in finding
      ? finding.sectionHeading
      : finding.elementLabel;
  const rows = [
    renderFindingRow('Observation', finding.observation),
    ...(finding.condition
      ? [renderFindingRow('Condition', finding.condition)]
      : []),
    ...(finding.defect ? [renderFindingRow('Defect', finding.defect)] : []),
    ...(finding.recommendation
      ? [renderFindingRow('Recommendation', finding.recommendation)]
      : []),
    ...(finding.limitation
      ? [renderFindingRow('Limitation', finding.limitation)]
      : []),
    ...(finding.furtherInvestigation
      ? [renderFindingRow('Further investigation', finding.furtherInvestigation)]
      : []),
    ...(finding.risk ? [renderFindingRow('Risk', finding.risk)] : []),
    ...(finding.evidenceIds?.length
      ? [renderFindingRow('Evidence', finding.evidenceIds.join(', '))]
      : []),
  ].join('');

  return `
    <section
      class="finding"
      data-finding-id="${escapeHtml(finding.findingId)}"
      data-element-concept-id="${escapeHtml(finding.elementConceptId)}"
      aria-labelledby="finding-${escapeHtml(finding.findingId)}"
    >
      <p class="eyebrow">Inspection finding</p>
      <h2 id="finding-${escapeHtml(finding.findingId)}">${escapeHtml(heading)}</h2>
      <dl class="finding-content">${rows}
      </dl>
    </section>`;
}

export type ReportHtmlOptions = {
  firmAdapter?: FirmAdapter;
};

/**
 * Dependency-free, print-safe HTML. A future PDF adapter can pass this output
 * to a supported HTML-to-PDF implementation without moving report logic.
 */
export function renderReportDocumentHtml(
  document: ReportDocument,
  options: ReportHtmlOptions = {},
): string {
  const blocks = options.firmAdapter
    ? applyFirmAdapter(document, options.firmAdapter).blocks
    : document.blocks;
  const identity = blocks.find(
    (block): block is IdentityBlock => block.kind === 'identity',
  );
  if (!identity) {
    throw new Error('Report document does not contain an Identity block.');
  }
  const findings = blocks
    .filter(
      (block): block is FindingBlock | FirmFindingBlock =>
        block.kind === 'finding',
    )
    .map(renderFindingBlock)
    .join('');

  return `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(identity.property.displayAddress)} — Property report</title>
    <style>
      @page { size: A4 portrait; margin: 22mm 20mm 24mm; }
      * { box-sizing: border-box; }
      html { color: #20262b; background: #ffffff; }
      body {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 10.5pt;
        line-height: 1.45;
      }
      .report {
        min-height: 251mm;
        display: flex;
        flex-direction: column;
      }
      .masthead {
        padding-bottom: 7mm;
        border-bottom: 0.35mm solid #20262b;
        font-size: 9pt;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .identity { padding-top: 34mm; }
      .eyebrow {
        margin: 0 0 5mm;
        color: #737a7d;
        font-size: 8.5pt;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      h1 {
        max-width: 150mm;
        margin: 0;
        font-size: 24pt;
        font-weight: 500;
        line-height: 1.2;
        letter-spacing: -0.015em;
      }
      h2 {
        margin: 0;
        font-size: 19pt;
        font-weight: 500;
        line-height: 1.25;
      }
      .address-line { display: block; }
      .metadata {
        max-width: 150mm;
        margin: 24mm 0 0;
        padding: 0;
      }
      .metadata-row {
        display: grid;
        grid-template-columns: 42mm 1fr;
        gap: 7mm;
        padding-top: 4mm;
        border-top: 0.2mm solid #c8cbcc;
      }
      dt {
        color: #737a7d;
        font-size: 8.5pt;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      dd { margin: 0; }
      .finding {
        break-before: page;
        padding-top: 18mm;
      }
      .finding-content {
        max-width: 150mm;
        margin: 12mm 0 0;
        padding: 0;
      }
      .finding-row {
        display: grid;
        grid-template-columns: 42mm 1fr;
        gap: 7mm;
        padding: 4mm 0;
        border-top: 0.2mm solid #c8cbcc;
      }
    </style>
  </head>
  <body>
    <main class="report">
      <header class="masthead">muffle.tech</header>
      ${renderIdentityBlock(identity)}
      ${findings}
    </main>
  </body>
</html>`;
}
