#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let errors = 0;

function error(msg) {
  console.error('\x1b[31m✖ ' + msg + '\x1b[0m');
  errors++;
}

function success(msg) {
  console.log('\x1b[32m✔ ' + msg + '\x1b[0m');
}

console.log('\x1b[36m[1/4] Checking required files and licenses...\x1b[0m');
const requiredFiles = [
  'LICENSE',
  'README.md',
  'TESTING.md',
  'package.json',
  '.github/workflows/ci.yml',
  'agents/openai.yaml',
  'vibe-coding/SKILL.md',
  'vibe-coding/agents/openai.yaml',
  'vibe-coding/scripts/setup.ps1',
  'vibe-coding/scripts/setup-macos.sh',
  'vibe-coding/scripts/setup-macos.cjs',
  'vibe-coding/scripts/jsonc.cjs',
  'vibe-coding/assets/workspace-extension/extension/jsonc.js',
  'vibe-coding/assets/workspace-extension/extension/vendor/jsonc-parser/LICENSE.md',
  'vibe-coding/assets/workspace-extension/extension/vendor/jsonc-parser/lib/umd/main.js',
  'vibe-coding/scripts/native-files.ps1',
  'vibe-coding/scripts/setup-files.ps1',
  'vibe-coding/references/execution.md',
  'vibe-coding/references/verification.md',
  'vibe-coding/references/mobile-remote.md',
  'vibe-coding/references/macos.md',
  'vibe-coding/references/agent-tools.md',
  'vibe-coding/references/codex-startup.md',
  'vibe-coding/references/playwright.md',
  'vibe-coding/references/context7.md',
  'vibe-coding/references/chrome-devtools.md',
  'vibe-coding/references/rea.md',
  'vibe-coding/assets/agent-tool-guidance.md',
  'vibe-coding/assets/sample.html',
  'vibe-coding/assets/workspace-extension/extension/package.json',
  'vibe-coding/assets/workspace-extension/extension/extension.js',
  'vibe-coding/assets/workspace-extension/extension/qrcode.js',
  'vibe-coding/assets/workspace-extension/extension/tunnel-manager.js',
  'vibe-coding/assets/workspace-extension/extension/mobile-tunnel.js',
  'vibe-coding/assets/workspace-extension/extension/preview-forwarding.js',
  'vibe-coding/assets/workspace-extension/extension/platform.js',
  '.gitattributes',
  '.github/workflows/macos-e2e.yml'
];

for (const rel of requiredFiles) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    error('Missing required file: ' + rel);
  }
}
if (errors === 0) success('All essential repository files exist.');

console.log('\x1b[36m[2/4] Checking version consistency...\x1b[0m');
try {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const extPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vibe-coding/assets/workspace-extension/extension/package.json'), 'utf8'));
  const readmeText = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

  if (rootPkg.version !== extPkg.version) {
    error(`Version mismatch: root package.json (${rootPkg.version}) vs extension package.json (${extPkg.version})`);
  } else {
    success(`Version aligned: v${rootPkg.version}`);
  }

  const manifest = fs.readFileSync(path.join(ROOT, 'vibe-coding/assets/workspace-extension/extension.vsixmanifest'), 'utf8');
  if (!manifest.includes('Version="' + rootPkg.version + '"')) error('VSIX manifest version mismatch');
  for (const file of ['index.html', 'llms.txt']) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (!content.includes('/releases/download/v' + rootPkg.version + '/vibe-coding-' + rootPkg.version + '.zip') && file === 'index.html') error(file + ' download version mismatch');
    if (!content.includes('v' + rootPkg.version)) error(file + ' release version mismatch');
  }
  const expectedDownloadUrl = `/releases/download/v${rootPkg.version}/vibe-coding-${rootPkg.version}.zip`;
  if (!readmeText.includes(expectedDownloadUrl)) {
    error(`README.md does not reference the exact release download URL: ${expectedDownloadUrl}`);
  } else {
    success(`README.md correctly references release tag and download asset: ${expectedDownloadUrl}`);
  }
} catch (e) {
  error('Failed to parse versions: ' + e.message);
}

console.log('\x1b[36m[3/4] Checking JavaScript syntax and formatting...\x1b[0m');
const jsFilesToCheck = [
  'vibe-coding/assets/workspace-extension/extension/extension.js',
  'vibe-coding/assets/workspace-extension/extension/qrcode.js',
  'vibe-coding/assets/workspace-extension/extension/tunnel-manager.js',
  'vibe-coding/assets/workspace-extension/extension/preview-forwarding.js',
  'vibe-coding/assets/workspace-extension/extension/platform.js',
  'site.js',
  'vibe-coding/scripts/setup-macos.cjs',
  'vibe-coding/scripts/jsonc.cjs',
  'vibe-coding/assets/workspace-extension/extension/jsonc.js',
  'scripts/ci-macos-verify.cjs',
  'scripts/check.cjs'
];

for (const js of jsFilesToCheck) {
  try {
    execSync(`node -c "${path.join(ROOT, js)}"`, { stdio: 'pipe' });
    success('Syntax valid: ' + js);
  } catch (e) {
    error('Syntax error in ' + js + ': ' + e.message);
  }
}

console.log('\x1b[36m[4/4] Checking documentation and links...\x1b[0m');
function inspectDocs(dir) {
  for (const item of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) { inspectDocs(full); continue; }
    if (/\.bak(?:[-.]|$)|~$|^\.DS_Store$/.test(item.name)) error('Backup/temp file in skill package: ' + full);
    if (!item.name.endsWith('.md')) continue;
    const content = fs.readFileSync(full, 'utf8');
    for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^(?:[a-z]+:|\/)/i.test(target) || target.includes(' ') || target.startsWith('<')) continue;
      if (!fs.existsSync(path.resolve(path.dirname(full), target))) error('Broken local link in ' + full + ': ' + target);
    }
  }
}
inspectDocs(path.join(ROOT, 'vibe-coding'));
if (!errors) success('Skill documentation targets and package file exclusions verified.');

if (errors > 0) {
  console.error(`\n\x1b[31mInspection failed with ${errors} error(s).\x1b[0m\n`);
  process.exit(1);
} else {
  console.log('\n\x1b[32m✔ All package, version, and link checks passed cleanly!\x1b[0m\n');
  process.exit(0);
}
