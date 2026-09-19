'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractTunnelUrl, findCodeCli } = require('../vibe-coding/assets/workspace-extension/extension/tunnel-manager');
const { getMobileTunnelWebviewHtml } = require('../vibe-coding/assets/workspace-extension/extension/mobile-tunnel');

test('extractTunnelUrl extracts official vscode.dev tunnel url correctly', () => {
  const sampleStdout = [
    '* Visual Studio Code Server',
    '  ➜  Tunnel:   vibe-pc',
    '  ➜  Open:  https://vscode.dev/tunnel/vibe-pc/C:/Users/user/Documents/%EA%B3%BC%EC%A0%84%EA%B0%95'
  ].join('\n');

  const url = extractTunnelUrl(sampleStdout);
  assert.equal(url, 'https://vscode.dev/tunnel/vibe-pc/C:/Users/user/Documents/%EA%B3%BC%EC%A0%84%EA%B0%95');
});

test('extractTunnelUrl returns null when no tunnel url is present', () => {
  assert.equal(extractTunnelUrl('Just some random output'), null);
  assert.equal(extractTunnelUrl(''), null);
  assert.equal(extractTunnelUrl(null), null);
});

test('findCodeCli returns a valid string or existing path', () => {
  const cli = findCodeCli();
  assert.ok(typeof cli === 'string' && cli.length > 0);
});

test('getMobileTunnelWebviewHtml renders dynamic QR code card when tunnelUrl is passed', () => {
  const testUrl = 'https://vscode.dev/tunnel/vibe-pc/test-project';
  const html = getMobileTunnelWebviewHtml({
    projectPath: 'C:/test',
    tunnelUrl: testUrl,
    tunnelName: 'vibe-pc'
  });

  assert.ok(html.includes('<svg'), 'Should include SVG QR code');
  assert.ok(html.includes(testUrl), 'Should include the tunnel URL');
  assert.ok(html.includes('스마트폰에서 작업하기'), 'Should include mobile title');
  assert.ok(html.includes('주소 복사'), 'Should include copy button');
  assert.ok(html.includes('postMessage'), 'Should use message passing for clipboard copy');
});

test('getMobileTunnelWebviewHtml renders loading state when loading is true', () => {
  const html = getMobileTunnelWebviewHtml({ projectPath: 'C:/test', loading: true });
  assert.ok(html.includes('공식 원격 터널을 준비하고 있습니다'));
  assert.ok(html.includes('spinner'));
});

test('getMobileTunnelWebviewHtml renders error state when error is passed', () => {
  const html = getMobileTunnelWebviewHtml({ projectPath: 'C:/test', error: '권한이 없습니다' });
  assert.ok(html.includes('터널을 시작하지 못했습니다'));
  assert.ok(html.includes('권한이 없습니다'));
});

