/**
 * Where Arc registry files install in a project, and how their imports are rewritten for it. Shared by every script that
 * builds registry items, and by scripts/check-registry.mjs in the public repository.
 *
 * Every file lands in one `arc/` folder under the project's `components` alias, keeping Arc's own layout:
 *   registry/components/button/button.tsx → arc/button/button.tsx
 *   registry/blocks/sign-in/sign-in.tsx   → arc/blocks/sign-in/sign-in.tsx
 *   registry/foundation.css               → arc/foundation.css
 *   lib/motion-tokens.ts                  → arc/lib/motion-tokens.ts
 * The `@components/` target placeholder resolves from the project's components.json, so `src/` layouts, custom aliases,
 * package imports and monorepo packages all work. Because every file shares that tree, imports between Arc files become
 * relative and never depend on how the project maps `@/*`.
 */
import path from "node:path";

export function installPath(file) {
  if (file.startsWith("registry/components/")) return `arc/${file.slice("registry/components/".length)}`;
  if (file.startsWith("registry/")) return `arc/${file.slice("registry/".length)}`;
  return `arc/${file}`;
}

export const installTarget = file => `@components/${installPath(file)}`;
export const installType = file => (file.startsWith("lib/") ? "registry:lib" : "registry:component");

/**
 * Rewrites each import of another repo file (`@/…` or relative) in `content` to the relative path between the installed
 * locations. `resolve(specifier)` returns the repo file a specifier points at, or null for packages.
 */
export async function withRelativeImports(file, content, specifiers, resolve) {
  let next = content;
  for (const specifier of new Set(specifiers)) {
    const target = await resolve(specifier);
    if (!target) continue;
    let relative = path.posix.relative(path.posix.dirname(installPath(file)), installPath(target));
    if (!relative.startsWith(".")) relative = `./${relative}`;
    // Keep the specifier's own style: extensionless for scripts, explicit for CSS; directory imports keep pointing at the folder.
    if (/\/index\.tsx?$/.test(target) && !/\/index(?:\.tsx?)?$/.test(specifier)) relative = relative.replace(/\/index\.tsx?$/, "");
    else if (/\.tsx?$/.test(target) && !/\.tsx?$/.test(specifier)) relative = relative.replace(/\.tsx?$/, "");
    for (const quote of ["\"", "'"]) next = next.replaceAll(`${quote}${specifier}${quote}`, `${quote}${relative}${quote}`);
  }
  return next;
}
