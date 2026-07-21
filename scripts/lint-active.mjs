import path from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import ts from "typescript";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const configPath = path.join(repositoryRoot, "tsconfig.rtpt.json");
const activeRuntimeFiles = [
  "electron/main.cjs",
  "electron/offline-updater.cjs",
  "electron/preload.cjs",
  "eslint.config.js",
  "public/rtpt/service-worker-advanced.js",
  "scripts/lint-active.mjs",
  "scripts/release-smoke.cjs",
  "scripts/run-with-env.mjs",
  "vite.config.ts",
  "vitest.config.ts",
].map((relativePath) => path.join(repositoryRoot, relativePath));

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  console.error(ts.formatDiagnostic(configFile.error, diagnosticHost()));
  process.exit(2);
}

const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  repositoryRoot,
  undefined,
  configPath,
);

if (parsedConfig.errors.length > 0) {
  console.error(ts.formatDiagnostics(parsedConfig.errors, diagnosticHost()));
  process.exit(2);
}

const program = ts.createProgram({
  rootNames: parsedConfig.fileNames,
  options: parsedConfig.options,
  projectReferences: parsedConfig.projectReferences,
});

const activeTypeScriptFiles = program
  .getSourceFiles()
  .map((sourceFile) => sourceFile.fileName)
  .filter(isLocalTypeScriptFile)
  .sort((left, right) => left.localeCompare(right));
const activeFiles = [...new Set([...activeTypeScriptFiles, ...activeRuntimeFiles])]
  .sort((left, right) => left.localeCompare(right));

if (activeFiles.length === 0) {
  console.error("No active RT/PT TypeScript files were found.");
  process.exit(2);
}

console.log(`Linting ${activeFiles.length} active RT/PT TypeScript files.`);

const eslint = new ESLint({ cwd: repositoryRoot });
const results = await eslint.lintFiles(activeFiles);
const formatter = await eslint.loadFormatter("stylish");
const output = formatter.format(results);

if (output) {
  console.log(output);
}

const errorCount = results.reduce((total, result) => total + result.errorCount, 0);
process.exitCode = errorCount === 0 ? 0 : 1;

function isLocalTypeScriptFile(filePath) {
  const relativePath = path.relative(repositoryRoot, filePath);
  const isInsideRepository =
    relativePath.length > 0 &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath);

  return (
    isInsideRepository &&
    !relativePath.includes(`node_modules${path.sep}`) &&
    /\.(?:ts|tsx)$/.test(relativePath)
  );
}

function diagnosticHost() {
  return {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => repositoryRoot,
    getNewLine: () => ts.sys.newLine,
  };
}
