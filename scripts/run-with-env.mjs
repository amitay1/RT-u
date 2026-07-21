import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const [nodeEnvironment, packageName, ...packageArguments] = process.argv.slice(2);

if (!nodeEnvironment || !packageName) {
  console.error("Usage: node scripts/run-with-env.mjs <NODE_ENV> <package-bin> [...args]");
  process.exit(2);
}

if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(packageName)) {
  console.error(`Invalid package binary name: ${packageName}`);
  process.exit(2);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const manifestPath = path.join(repositoryRoot, "node_modules", ...packageName.split("/"), "package.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const commandName = packageName.split("/").at(-1);
const binaryRelativePath = typeof manifest.bin === "string"
  ? manifest.bin
  : manifest.bin?.[commandName];

if (!binaryRelativePath) {
  console.error(`Package ${packageName} does not expose the ${commandName} binary.`);
  process.exit(2);
}

const binaryPath = path.resolve(path.dirname(manifestPath), binaryRelativePath);
const child = spawn(process.execPath, [binaryPath, ...packageArguments], {
  cwd: repositoryRoot,
  env: { ...process.env, NODE_ENV: nodeEnvironment },
  stdio: "inherit",
});

const forwardedSignals = ["SIGINT", "SIGTERM"];
const forwardSignal = (signal) => {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill(signal);
  }
};
const signalHandlers = forwardedSignals.map((signal) => ({
  signal,
  handler: () => forwardSignal(signal),
}));

for (const { signal, handler } of signalHandlers) {
  process.on(signal, handler);
}

const removeSignalHandlers = () => {
  for (const { signal, handler } of signalHandlers) {
    process.off(signal, handler);
  }
};

child.once("error", (error) => {
  removeSignalHandlers();
  console.error(`Unable to launch ${packageName}:`, error);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  removeSignalHandlers();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
