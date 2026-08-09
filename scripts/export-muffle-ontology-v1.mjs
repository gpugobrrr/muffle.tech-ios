import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { serializeMuffleOntologyV1 } from '@/domain/ontology/muffle-ontology.v1';
import { validateMuffleOntologyV1 } from '@/domain/ontology/validate-muffle-ontology.v1';

const failures = validateMuffleOntologyV1();
if (failures.length > 0) {
  throw new Error(`Ontology validation failed:\n${failures.join('\n')}`);
}

const outputDirectory = resolve('dist', 'ontology');
const outputPath = resolve(outputDirectory, 'muffle-ontology.v1.1.json');

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${serializeMuffleOntologyV1()}\n`, 'utf8');
console.log(outputPath);
