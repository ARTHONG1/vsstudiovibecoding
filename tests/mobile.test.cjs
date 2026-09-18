'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getMobileTunnelWebviewHtml, getMobileSetupPrompt } = require('../vibe-coding/assets/workspace-extension/extension/mobile-tunnel');
test('official Remote guide has no fabricated connection or active script', () => {
  const html = getMobileTunnelWebviewHtml({ projectPath: 'C:/work/과전강' });
  assert.ok(html.includes('Codex Remote'));
  assert.ok(html.includes('C:/work/과전강'));
  assert.ok(html.includes('연결 상태는 이 화면에서 자동 확인하지 않습니다'));
  assert.ok(html.includes('https://learn.chatgpt.com/docs/remote-connections'));
  assert.ok(!/vscode\.dev|turnOnTunnel|checkTunnel|<svg|<script/.test(html));
  assert.ok(html.includes("default-src 'none'"));
});
test('project path is escaped as text', () => {
  const html = getMobileTunnelWebviewHtml({ projectPath: '<img src=x onerror="alert(1)">&' });
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('&amp;'));
});
test('setup request delegates to AI with reuse and verification boundaries', () => {
  const prompt = getMobileSetupPrompt('C:/work/과전강');
  for (const text of ['C:/work/과전강', '$vibe-coding', '기존 연결', '미검증']) assert.ok(prompt.includes(text));
});
