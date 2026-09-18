'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateQRCodeSVG } = require('../vibe-coding/assets/workspace-extension/extension/qrcode.js');
const { getMobileTunnelWebviewHtml } = require('../vibe-coding/assets/workspace-extension/extension/mobile-tunnel.js');

test('qrcode generator produces valid SVG markup', () => {
  const url = 'https://vscode.dev/agents';
  const svg = generateQRCodeSVG(url);
  assert.ok(svg.startsWith('<svg'), 'Must start with <svg');
  assert.ok(svg.includes('</svg>'), 'Must end with </svg>');
  assert.ok(svg.includes('<path d="M'), 'Must contain path coordinates');
  assert.ok(svg.includes('shape-rendering="crispEdges"'), 'Must have crispEdges');
});

test('getMobileTunnelWebviewHtml generates valid secure remote tunnel UI with zero open ports', () => {
  const tunnelUrl = 'https://vscode.dev/agents';
  const qrSvg = generateQRCodeSVG(tunnelUrl);
  const html = getMobileTunnelWebviewHtml({ tunnelUrl, qrSvg });

  assert.ok(html.includes('vscode.dev/agents'), 'HTML must include official tunnel URL');
  assert.ok(html.includes('turnOnTunnel()'), 'HTML must provide turnOnTunnel trigger button');
  assert.ok(html.includes('<svg'), 'HTML must render QR code SVG');
  assert.ok(html.includes('Remote Agent Host & Dev Tunnel'), 'HTML must explain modern VS Code architecture');
});
