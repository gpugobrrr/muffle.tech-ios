export type OntologyPromotionProposalCliOptions = {
  interpretationPath: string;
  outDir?: string;
};

export function parseOntologyPromotionProposalCliArguments(
  args: readonly string[],
): OntologyPromotionProposalCliOptions {
  let interpretationPath: string | undefined;
  let outDir: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === '--interpretation' && value) {
      interpretationPath = value;
      index += 1;
    } else if (argument === '--out-dir' && value) {
      outDir = value;
      index += 1;
    } else {
      throw new Error(
        'Usage: npm run ontology:promotion:propose -- --interpretation <path> [--out-dir <path>]',
      );
    }
  }
  if (!interpretationPath) {
    throw new Error(
      'Usage: npm run ontology:promotion:propose -- --interpretation <path> [--out-dir <path>]',
    );
  }
  return { interpretationPath, outDir };
}
