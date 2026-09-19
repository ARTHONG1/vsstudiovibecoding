const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

test('createShadowCheckpoint does NOT pollute user git index or modify staged files', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-tm-test-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Vibe Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@local"', { cwd: tempDir, stdio: 'ignore' });

    // User creates a staged file and an untracked file
    fs.writeFileSync(path.join(tempDir, 'staged.txt'), 'staged content');
    execSync('git add staged.txt', { cwd: tempDir, stdio: 'ignore' });
    fs.writeFileSync(path.join(tempDir, 'unstaged.txt'), 'unstaged content');

    const statusBefore = execSync('git status --porcelain', { cwd: tempDir, encoding: 'utf8' }).trim();
    assert.ok(statusBefore.includes('A  staged.txt'), 'staged.txt must be staged in user index');
    assert.ok(statusBefore.includes('?? unstaged.txt'), 'unstaged.txt must be untracked');

    // Load extension module with mocked vscode
    const vscode = {
      workspace: {
        getConfiguration: () => ({ get: () => '' }),
        workspaceFolders: [{ uri: { fsPath: tempDir } }]
      },
      window: {
      createOutputChannel: () => ({ appendLine() {} }),
      createStatusBarItem: () => ({ show() {}, dispose() {} }),
      showErrorMessage: () => {},
      showInformationMessage: () => {},
        showInputBox: async () => '테스트 체크포인트',
        terminals: [],
        onDidCloseTerminal: () => ({ dispose() {} })
      },
      commands: {
        registerCommand: (name, fn) => {
          commands.set(name, fn);
          return { dispose() {} };
        },
        executeCommand: async () => {}
      },
      QuickPickItemKind: { Separator: 1 },
      Uri: {
        joinPath: (base, ...segments) => ({ fsPath: path.join(base.fsPath, ...segments) })
      },
      StatusBarAlignment: { Right: 2 },
      env: {}
    };

    const commands = new Map();
    const module = { exports: {} };
    const code = fs.readFileSync(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension/extension.js'), 'utf8');
    vm.runInNewContext(code, {
      module, exports: module.exports,
      require: name => (name === 'vscode' ? vscode : name.startsWith('.') ? require(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension', name)) : require(name)),
      setTimeout: fn => fn(),
      clearTimeout: () => {},
      process, console, Buffer, URL
    });

    const subscriptions = [];
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-storage-'));
    await module.exports.activate({ subscriptions, globalStorageUri: { fsPath: storageDir } });
    await commands.get('vibe.createCheckpoint')();

    // Check status after checkpoint creation
    const statusAfter = execSync('git status --porcelain', { cwd: tempDir, encoding: 'utf8' }).trim();
    assert.equal(statusBefore, statusAfter, 'User git index must be 100% identical before and after checkpoint creation');

    // Checkpoints file should exist
    const checkpointsFile = path.join(tempDir, '.vibe', 'checkpoints.json');
    assert.ok(fs.existsSync(checkpointsFile), 'checkpoints.json must be created in .vibe');
    const list = JSON.parse(fs.readFileSync(checkpointsFile, 'utf8'));
    assert.ok(list.length > 0, 'At least one checkpoint must be recorded');

    // Verify Git hidden ref protection against Git GC
    const refSha = execSync('git rev-parse refs/vibe/checkpoints/' + list[0].id, { cwd: tempDir, encoding: 'utf8' }).trim();
    assert.equal(refSha, list[0].commitSha, 'Git ref refs/vibe/checkpoints/<id> must point to checkpoint commit');

    // Modify working tree and verify restore keeps user staged index intact
    fs.writeFileSync(path.join(tempDir, 'unstaged.txt'), 'modified-before-rollback');
    fs.writeFileSync(path.join(tempDir, 'new_rogue.txt'), 'rogue content');
    const targetCheckpoint = list[0];
    // Mock showQuickPick to select targetCheckpoint (must provide sha and title)
    vscode.window.showQuickPick = async () => ({ sha: targetCheckpoint.commitSha, title: targetCheckpoint.title, label: targetCheckpoint.title });
    await commands.get('vibe.restoreCheckpoint')();

    // Verify user staged file is STILL staged after restore AND working tree genuinely rolled back AND new file removed
    const statusAfterRestore = execSync('git status --porcelain', { cwd: tempDir, encoding: 'utf8' }).trim();
    assert.ok(statusAfterRestore.includes('A  staged.txt'), 'User staged file must remain staged after restore');
    const rolledBackContent = fs.readFileSync(path.join(tempDir, 'unstaged.txt'), 'utf8');
    assert.equal(rolledBackContent, 'unstaged content', 'Working tree file must be genuinely rolled back to checkpoint content');
    assert.equal(fs.existsSync(path.join(tempDir, 'new_rogue.txt')), false, 'Newly created file after checkpoint must be cleanly removed on rollback');

    // Verify old ref cleanup on same-turn checkpoint update
    const initialRef = list[0].id;
    fs.writeFileSync(path.join(tempDir, 'unstaged.txt'), 'same-turn-update');
    // create checkpoint with identical turn/title
    vscode.window.showInputBox = async () => '진행률 100% 완료 & "특수문자" | 테스트';
    await commands.get('vibe.createCheckpoint')();
    const updatedList = JSON.parse(fs.readFileSync(checkpointsFile, 'utf8'));
    const newRef = updatedList[0].id;
    assert.notEqual(initialRef, newRef, 'Updated checkpoint should have new id');
    assert.equal(execSync('git rev-parse refs/vibe/checkpoints/' + newRef, { cwd: tempDir, encoding: 'utf8' }).trim(), updatedList[0].commitSha);

    fs.rmSync(storageDir, { recursive: true, force: true });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('extension dispose lifecycle executes cleanly without ReferenceError', async () => {
  const vscode = {
    workspace: {
      getConfiguration: () => ({ get: () => '' }),
      workspaceFolders: [{ uri: { fsPath: 'C:/mock' } }]
    },
    window: {
      createOutputChannel: () => ({ appendLine() {} }),
      createStatusBarItem: () => ({ show() {}, dispose() {} }),
      showErrorMessage: () => {},
      terminals: [],
      onDidCloseTerminal: () => ({ dispose() {} })
    },
    commands: { registerCommand: () => ({ dispose() {} }) },
    StatusBarAlignment: { Right: 2 },
    env: {}
  };

  const module = { exports: {} };
  const code = fs.readFileSync(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension/extension.js'), 'utf8');
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => (name === 'vscode' ? vscode : name === 'fs' ? { existsSync: () => true, mkdirSync() {}, appendFileSync() {} } : name.startsWith('.') ? require(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension', name)) : require(name)),
    setTimeout: fn => fn(),
    clearTimeout: () => {},
    process, console, Buffer, URL
  });

  const subscriptions = [];
  await module.exports.activate({ subscriptions, globalStorageUri: { fsPath: 'C:/test' } });

  assert.doesNotThrow(() => {
    for (const s of subscriptions) {
      if (s && typeof s.dispose === 'function') {
        s.dispose();
      }
    }
  }, 'All subscriptions must dispose without throwing ReferenceError');
});
