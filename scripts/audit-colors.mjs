import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// The landing page's vendored QR encoder is independent of the app theme.
const ALLOWED = new Set(["src/theme.ts", "src/mapStyle.ts", "deploy/landing/qrcode.min.js"]);
const HEX = /#[0-9A-Fa-f]{3,8}\b/g;

const files = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .map((line) => line.trim())
  .filter((file) => /\.(ts|tsx|js|jsx|mjs)$/.test(file) && !ALLOWED.has(file) && existsSync(file));

const findings = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const matches = text.match(HEX);
  if (matches) findings.push(`${file}: ${[...new Set(matches)].join(", ")}`);
}

if (findings.length === 0) {
  console.log(`No raw hex colors outside ${[...ALLOWED].join(", ")} (${files.length} files checked).`);
} else {
  console.error("Raw hex colors found outside theme.ts / mapStyle.ts:");
  for (const finding of findings) console.error(`  ${finding}`);
  process.exitCode = 1;
}
