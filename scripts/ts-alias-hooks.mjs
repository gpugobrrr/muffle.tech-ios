/**
 * Module resolution hooks so Node can import the app's TypeScript sources
 * directly: maps the `@/` alias onto `src/` and adds the `.ts` extension.
 * Node strips the types itself (v22.6+), so no build step is required.
 */
import { pathToFileURL } from 'node:url';
import { extname, resolve as resolvePath } from 'node:path';

const SRC_URL = pathToFileURL(
  `${resolvePath(import.meta.dirname, '..', 'src')}/`,
).href;

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    return nextResolve(`${SRC_URL}${specifier.slice(2)}.ts`, context);
  }
  const extension = extname(specifier);
  const hasModuleExtension = [
    '.js',
    '.mjs',
    '.cjs',
    '.json',
    '.ts',
    '.tsx',
    '.jsx',
  ].includes(extension);
  if (specifier.startsWith('.') && !hasModuleExtension) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
