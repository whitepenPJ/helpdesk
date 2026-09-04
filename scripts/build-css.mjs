// Minifies the project's own CSS sources into public/adminlte/css/*.min.css.
//
// - styles/adminlte.css — an unminified copy of AdminLTE-master's compiled
//   main stylesheet (dist/css/adminlte.css), kept here because
//   AdminLTE-master/ itself is git-ignored (see CLAUDE.md).
// - styles/custom.css — this project's own overrides, empty until someone
//   adds rules to it.
//
// Runs automatically before `next build` (see the "build" script in
// package.json) and can be run standalone during development with
// `npm run build:css` after editing either source file.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import CleanCSS from "clean-css";

const rootDir = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const outDir = path.join(rootDir, "public/adminlte/css");

const targets = [
  { src: "styles/adminlte.css", out: "adminlte.min.css" },
  { src: "styles/custom.css", out: "custom.min.css" },
];

await mkdir(outDir, { recursive: true });

for (const { src, out } of targets) {
  const srcPath = path.join(rootDir, src);
  const outPath = path.join(outDir, out);
  const input = await readFile(srcPath, "utf8");

  const result = await new CleanCSS({ level: 2 }).minify(input);
  if (result.errors.length > 0) {
    console.error(`build-css: failed to minify ${src}`);
    for (const err of result.errors) console.error(`  ${err}`);
    process.exit(1);
  }
  for (const warning of result.warnings) {
    console.warn(`build-css: ${src}: ${warning}`);
  }

  await writeFile(outPath, result.styles);
  const before = Buffer.byteLength(input);
  const after = Buffer.byteLength(result.styles);
  console.log(`build-css: ${src} -> public/adminlte/css/${out} (${before}b -> ${after}b)`);
}
