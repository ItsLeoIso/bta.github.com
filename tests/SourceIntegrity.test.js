import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(root, "src");

async function collectJavaScript(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectJavaScript(path));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}

test("every source module parses with the supported Node runtime", async () => {
  const files = await collectJavaScript(sourceRoot);
  assert.ok(files.length > 0, "expected browser source modules");
  for (const file of files) {
    assert.doesNotThrow(
      () => execFileSync(process.execPath, ["--check", file], { stdio: "pipe" }),
      "JavaScript syntax check failed: " + file.slice(root.length + 1)
    );
  }
});

test("all relative source imports resolve to files in the repository", async () => {
  const files = await collectJavaScript(sourceRoot);
  const importPattern = /(?:from\s*|import\s*)["'](\.{1,2}\/[^"']+)["']/g;
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const target = resolve(dirname(file), match[1]);
      assert.ok(
        target.startsWith(sourceRoot + sep),
        "Import escapes src/: " + match[1] + " in " + file.slice(root.length + 1)
      );
      assert.equal(
        await stat(target).then(result => result.isFile()).catch(() => false),
        true,
        "Missing import " + match[1] + " in " + file.slice(root.length + 1)
      );
    }
  }
});

test("the browser entry references the stylesheet and native module entry", async () => {
  const html = await readFile(join(root, "index.html"), "utf8");
  for (const asset of ["./src/ui/styles.css", "./src/main.js"]) {
    assert.ok(html.includes(asset), "index.html must reference " + asset);
    assert.equal(
      await stat(join(root, asset.slice(2))).then(result => result.isFile()).catch(() => false),
      true,
      "Missing browser asset: " + asset
    );
  }
  assert.match(html, /<script type="module">[\s\S]*import\(["']\.\/src\/main\.js["']\)/);
});
