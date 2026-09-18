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
  'vibe-coding/scripts/native-files.ps1',
  'vibe-coding/scripts/setup-files.ps1',
  'vibe-coding/references/execution.md',
  'vibe-coding/references/verification.md',
  'vibe-coding/assets/sample.html',
  'vibe-coding/assets/workspace-extension/extension/package.json',
  'vibe-coding/assets/workspace-extension/extension/extension.js',
  'vibe-coding/assets/workspace-extension/extension/qrcode.js',
  'vibe-coding/assets/workspace-extension/extension/mobile-server.js'
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
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
if (!fs.existsSync(path.join(ROOT, 'TESTING.md')) && readme.includes('[검증 범위](TESTING.md)')) {
  error('README links to TESTING.md, but the file does not exist.');
} else {
  success('Documentation links are valid.');
}

if (errors > 0) {
  console.error(`\n\x1b[31mInspection failed with ${errors} error(s).\x1b[0m\n`);
  process.exit(1);
} else {
  console.log('\n\x1b[32m✔ All package, version, and link checks passed cleanly!\x1b[0m\n');
  process.exit(0);
}
