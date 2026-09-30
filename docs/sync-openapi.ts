import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const rootDir = resolve(import.meta.dir, "..");
const srcPath = resolve(rootDir, "api/openapi.yaml");
const destPath = resolve(rootDir, "docs/api-reference/openapi.yaml");

const isCheck = process.argv.includes("--check");

try {
  const srcContent = readFileSync(srcPath, "utf-8");

  if (isCheck) {
    let destContent = "";
    try {
      destContent = readFileSync(destPath, "utf-8");
    } catch {
      console.error(`❌ docs:check failed: ${destPath} does not exist.`);
      process.exit(1);
    }

    if (srcContent !== destContent) {
      console.error(
        "❌ docs:check failed: docs/api-reference/openapi.yaml is out of sync with api/openapi.yaml.\nRun `bun run docs:sync` to synchronize."
      );
      process.exit(1);
    }

    console.log("✅ OpenAPI docs are in sync.");
    process.exit(0);
  }

  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, srcContent, "utf-8");
  console.log(`✅ Synchronized ${srcPath} -> ${destPath}`);
} catch (err) {
  console.error("❌ Failed to synchronize OpenAPI docs:", err);
  process.exit(1);
}
