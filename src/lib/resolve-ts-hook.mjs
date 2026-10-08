import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.(?:ts|tsx|js|mjs|cjs|json)$/.test(specifier) &&
    context.parentURL?.startsWith("file:")
  ) {
    const candidate = join(dirname(fileURLToPath(context.parentURL)), `${specifier}.ts`);
    if (existsSync(candidate)) return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
