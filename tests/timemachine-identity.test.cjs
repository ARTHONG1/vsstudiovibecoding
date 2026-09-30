const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

// Reproduces the "체크포인트 저장 실패: Command failed: git commit-tree" report:
// a project whose Git has no user.name/user.email configured anywhere.
test('checkpoint saves without any Git author identity and leaves Git config untouched', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-tm-noid-'));
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-tm-home-'));
  // useConfigOnly stops Git from guessing an identity from the account and host
  // names, so the missing-identity state is the same on every machine, CI included.
  const globalConfig = path.join(fakeHome, 'no-identity.gitconfig');
  const globalConfigText = '[user]\n\tuseConfigOnly = true\n';
  fs.writeFileSync(globalConfig, globalConfigText);
  const isolate = {
    HOME: fakeHome, USERPROFILE: fakeHome, XDG_CONFIG_HOME: fakeHome,
    GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1',
    EMAIL: undefined, GIT_AUTHOR_NAME: undefined, GIT_AUTHOR_EMAIL: undefined,
    GIT_COMMITTER_NAME: undefined, GIT_COMMITTER_EMAIL: undefined
  };
  const savedEnv = {};
  for (const [key, value] of Object.entries(isolate)) {
    savedEnv[key] = process.env[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    fs.writeFileSync(path.join(tempDir, 'page.tsx'), 'export default 1');

    // Precondition: identity is really missing, so a plain commit-tree fails here.
    const probeEnv = { ...process.env, GIT_INDEX_FILE: path.join(tempDir, '.git', 'probe_index') };
    execSync('git add -A', { cwd: tempDir, env: probeEnv, stdio: 'ignore' });
    const tree = execSync('git write-tree', { cwd: tempDir, env: probeEnv, encoding: 'utf8' }).trim();
    assert.throws(() => execSync('git commit-tree ' + tree + ' -m probe', { cwd: tempDir, stdio: 'pipe' }));
    fs.rmSync(path.join(tempDir, '.git', 'probe_index'), { force: true });
    const configBefore = fs.readFileSync(path.join(tempDir, '.git', 'config'), 'utf8');

    const errors = [];
    const commands = new Map();
    const vscode = {
      workspace: { getConfiguration: () => ({ get: () => '' }), workspaceFolders: [{ uri: { fsPath: tempDir } }] },
      window: {
        createOutputChannel: () => ({ appendLine() {} }),
        createStatusBarItem: () => ({ show() {}, dispose() {} }),
        showErrorMessage: message => errors.push(message),
        showInformationMessage: () => {},
        showInputBox: async () => '신원 없는 저장소',
        terminals: [],
        onDidCloseTerminal: () => ({ dispose() {} })
      },
      commands: {
        registerCommand: (name, fn) => { commands.set(name, fn); return { dispose() {} }; },
        executeCommand: async () => {}
      },
      QuickPickItemKind: { Separator: 1 },
      Uri: { joinPath: (base, ...segments) => ({ fsPath: path.join(base.fsPath, ...segments) }) },
      StatusBarAlignment: { Right: 2 },
      env: {}
    };
    const module = { exports: {} };
    const extDir = path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension');
    const code = fs.readFileSync(path.join(extDir, 'extension.js'), 'utf8');
    vm.runInNewContext(code, {
      module, exports: module.exports,
      require: name => (name === 'vscode' ? vscode : name.startsWith('.') ? require(path.join(extDir, name)) : require(name)),
      setTimeout: fn => fn(), clearTimeout: () => {}, process, console, Buffer, URL
    });
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-storage-'));
    await module.exports.activate({ subscriptions: [], globalStorageUri: { fsPath: storageDir } });
    await commands.get('vibe.createCheckpoint')();

    assert.deepEqual(errors.filter(m => m.includes('체크포인트 저장 실패')), [], 'Checkpoint must save without a configured identity');
    const list = JSON.parse(fs.readFileSync(path.join(tempDir, '.vibe', 'checkpoints.json'), 'utf8'));
    assert.equal(execSync('git rev-parse refs/vibe/checkpoints/' + list[0].id, { cwd: tempDir, encoding: 'utf8' }).trim(), list[0].commitSha);
    assert.equal(fs.readFileSync(path.join(tempDir, '.git', 'config'), 'utf8'), configBefore, 'Repository Git config must not change');
    assert.equal(fs.readFileSync(globalConfig, 'utf8'), globalConfigText, 'Global Git config must not change');
    fs.rmSync(storageDir, { recursive: true, force: true });
  } finally {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(fakeHome, { recursive: true, force: true });
  }
});

