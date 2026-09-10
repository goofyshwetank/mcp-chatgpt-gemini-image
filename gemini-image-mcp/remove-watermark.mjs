import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const gwr = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "node_modules",
  "@pilio",
  "gemini-watermark-remover",
  "bin",
  "gwr.mjs"
);

export function removeGeminiWatermark(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [gwr, "remove", inputPath, "--output", outputPath, "--overwrite"],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
    );
    let err = "";
    child.stderr.on("data", (d) => {
      err += d;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(err.trim() || `gwr exit ${code}`));
      else resolve({ outputPath });
    });
  });
}
