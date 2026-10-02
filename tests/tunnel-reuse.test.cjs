'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const manager = require('../vibe-coding/assets/workspace-extension/extension/tunnel-manager');

test('reuse a connected host tunnel without launching another process', async () => {
  manager.resetTunnelState();
  let spawned = false;
  const info = await manager.getOrStartTunnel('C:/project', {
    findCli: () => 'C:/bin/code-tunnel.exe',
    getStatus: async () => ({ tunnel: { name: 'vibe-test', tunnel: 'Connected', has_editor_link: true } }),
    spawn() { spawned = true; throw new Error('duplicate tunnel'); }
  });
  assert.equal(spawned, false);
  assert.equal(info.reused, true);
  assert.equal(info.url, 'https://vscode.dev/tunnel/vibe-test/C:/project');
  manager.resetTunnelState();
});

test('a disconnected existing host is reported instead of starting a competing tunnel', async () => {
  manager.resetTunnelState();
  await assert.rejects(manager.getOrStartTunnel('C:/project', {
    findCli: () => 'C:/bin/code-tunnel.exe',
    getStatus: async () => ({ tunnel: { name: 'vibe-test', tunnel: 'Disconnected' } }),
    spawn() { throw new Error('duplicate tunnel'); }
  }), /연결.*준비/);
});
