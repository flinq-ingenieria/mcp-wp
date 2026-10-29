#!/usr/bin/env node
// Build the Claude Desktop .mcpb bundle: compiled server, production
// node_modules and mcpb/manifest.json (version taken from package.json).
// Claude Desktop ships Node, so users need nothing preinstalled.
//
// Usage: npm run build:mcpb [-- --out dist]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MCPB_CLI = '@anthropic-ai/mcpb@2.1.2';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outIndex = process.argv.indexOf('--out');
const outDir = path.resolve(outIndex > 0 ? process.argv[outIndex + 1] : path.join(root, 'dist'));
const stage = path.join(outDir, 'mcpb-stage');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'mcpb', 'manifest.json'), 'utf8'));
manifest.version = pkg.version;

// Claude Desktop leaves "${user_config.x}" verbatim when an optional field has
// no value and no default, and the server would get that literal.
for (const [key, option] of Object.entries(manifest.user_config ?? {})) {
  if (!option.required && !('default' in option)) {
    throw new Error(`Optional user_config "${key}" needs a default`);
  }
}

run(npm, ['ci', '--no-audit', '--no-fund', '--ignore-scripts'], root);
run(npm, ['run', 'build'], root);

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
fs.cpSync(path.join(root, 'build'), path.join(stage, 'build'), { recursive: true });
for (const file of ['package.json', 'package-lock.json', 'README.md']) {
  fs.copyFileSync(path.join(root, file), path.join(stage, file));
}
run(npm, ['ci', '--omit=dev', '--no-audit', '--no-fund', '--ignore-scripts'], stage);
fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const bundle = path.join(outDir, `${manifest.name}-${manifest.version}.mcpb`);
run(npx, ['--yes', MCPB_CLI, 'pack', stage, bundle], root);
fs.rmSync(stage, { recursive: true, force: true });
console.log(bundle);
