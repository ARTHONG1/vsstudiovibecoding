'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { generateQRCodeSVG } = require('../vibe-coding/assets/workspace-extension/extension/qrcode.js');
const { MobileServer, getLocalIpAddress } = require('../vibe-coding/assets/workspace-extension/extension/mobile-server.js');

test('qrcode generator produces valid SVG markup', () => {
  const url = 'http://192.168.1.100:4100/?token=abc123';
  const svg = generateQRCodeSVG(url);
  assert.ok(svg.startsWith('<svg'), 'Must start with <svg');
  assert.ok(svg.includes('</svg>'), 'Must end with </svg>');
  assert.ok(svg.includes('<path d="M'), 'Must contain path coordinates');
  assert.ok(svg.includes('shape-rendering="crispEdges"'), 'Must have crispEdges');
});

test('MobileServer handles remote status, commands, and prompts', async () => {
  let lastPrompt = null;
  let lastCommand = null;

  const server = new MobileServer({
    port: 4890,
    getStatus: () => ({
      mode: 'split',
      agent: 'Codex',
      project: '과전강',
      previewUrl: 'http://localhost:5173'
    }),
    onPrompt: async (p) => { lastPrompt = p; },
    onCommand: async (c) => { lastCommand = c; }
  });

  const url = await server.start();
  assert.ok(url.includes(':4890/'), 'URL contains port');
  assert.ok(url.includes('?token='), 'URL contains token');

  // Helper for requests
  const makeReq = (path, method = 'GET', data = null, headers = {}) => {
    return new Promise((resolve, reject) => {
      const u = new URL(path, `http://127.0.0.1:${server.port}`);
      const req = http.request({
        hostname: '127.0.0.1',
        port: server.port,
        path: u.pathname + u.search,
        method,
        headers: { 'Content-Type': 'application/json', ...headers }
      }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
      });
      req.on('error', reject);
      if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
      req.end();
    });
  };

  try {
    // 1. GET / without token (must 403)
    const homeUnauth = await makeReq('/');
    assert.equal(homeUnauth.status, 403);

    // 1-1. GET / with valid token (must 200)
    const homeAuth = await makeReq('/?token=' + server.token);
    assert.equal(homeAuth.status, 200);
    assert.ok(homeAuth.body.includes('Vibe Remote'), 'Home HTML includes Vibe Remote');
    assert.ok(homeAuth.body.includes('과전강'), 'Home HTML includes project name');

    // 2. GET /api/status without token (must 403)
    const unauthorized = await makeReq('/api/status');
    assert.equal(unauthorized.status, 403);

    // 3. GET /api/status with token
    const statusRes = await makeReq('/api/status?token=' + server.token);
    assert.equal(statusRes.status, 200);
    const statusData = JSON.parse(statusRes.body);
    assert.equal(statusData.project, '과전강');
    assert.equal(statusData.agent, 'Codex');
    assert.equal(statusData.mode, 'split');

    // 4. POST /api/command
    const cmdRes = await makeReq('/api/command', 'POST', { command: 'preview', token: server.token });
    assert.equal(cmdRes.status, 200);
    assert.equal(lastCommand, 'preview');

    // 5. POST /api/prompt
    const promptRes = await makeReq('/api/prompt', 'POST', { prompt: '헤더 색상 변경해줘', token: server.token });
    assert.equal(promptRes.status, 200);
    assert.equal(lastPrompt, '헤더 색상 변경해줘');

    // 6. GET /api/qr without token (must 403)
    const qrUnauth = await makeReq('/api/qr');
    assert.equal(qrUnauth.status, 403);

    // 6-1. GET /api/qr with token (must 200)
    const qrRes = await makeReq('/api/qr?token=' + server.token);
    assert.equal(qrRes.status, 200);
    assert.ok(qrRes.headers['content-type'].includes('image/svg+xml'));
  } finally {
    server.stop();
  }
});
