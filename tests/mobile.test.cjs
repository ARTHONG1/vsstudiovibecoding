'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateQRCodeSVG } = require('../vibe-coding/assets/workspace-extension/extension/qrcode.js');
const { getMobileTunnelWebviewHtml } = require('../vibe-coding/assets/workspace-extension/extension/mobile-tunnel.js');

test('qrcode generator produces valid SVG markup for direct tunnel URL', () => {
  const url = 'https://vscode.dev/tunnel/desktop-vibe-pc/workspaces/project';
  const svg = generateQRCodeSVG(url);
  assert.ok(svg.startsWith('<svg'), 'Must start with <svg');
  assert.ok(svg.includes('</svg>'), 'Must end with </svg>');
  assert.ok(svg.includes('<path d="M'), 'Must contain path coordinates');
  assert.ok(svg.includes('shape-rendering="crispEdges"'), 'Must have crispEdges');
});

test('getMobileTunnelWebviewHtml renders inactive waiting state with turnOnTunnel and checkTunnel triggers', () => {
  const html = getMobileTunnelWebviewHtml({ tunnelUrl: '', qrSvg: '', isTunnelActive: false });

  assert.ok(html.includes('원격 터널 대기 중'), 'Must show waiting status badge');
  assert.ok(html.includes('turnOnTunnel()'), 'Must provide turnOnTunnel trigger');
  assert.ok(html.includes('checkTunnel()'), 'Must provide checkTunnel trigger');
  assert.ok(html.includes('<div class="qr-placeholder"'), 'Must render placeholder markup while waiting for direct tunnel URL');
  assert.ok(html.includes('Remote Agent Host & Dev Tunnel'), 'Must explain VS Code remote tunnel architecture');
});

test('getMobileTunnelWebviewHtml renders active direct tunnel UI with direct host URL and QR SVG', () => {
  const directTunnelUrl = 'https://vscode.dev/tunnel/my-pc-hostname/home/project';
  const qrSvg = generateQRCodeSVG(directTunnelUrl);
  const html = getMobileTunnelWebviewHtml({ tunnelUrl: directTunnelUrl, qrSvg, isTunnelActive: true });

  assert.ok(html.includes('내 PC 원격 터널 연결됨 (다이렉트 직행)'), 'Must show active direct status badge');
  assert.ok(html.includes(directTunnelUrl), 'Must include direct host tunnel URL');
  assert.ok(html.includes('<svg'), 'Must render direct QR code SVG');
  assert.ok(!html.includes('<div class="qr-placeholder"'), 'Must not render placeholder markup when active');
});
