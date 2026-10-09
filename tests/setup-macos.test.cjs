'use strict';
// The macOS setup is exercised on every host with injected commands; the real
// VS Code, osacompile and launcher run in the macOS CI job.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const setup = require('../vibe-coding/scripts/setup-macos.cjs');

const SKILL_ROOT = path.resolve(__dirname, '../vibe-coding');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(SKILL_ROOT, 'assets/workspace-extension/extension/package.json'), 'utf8'));
const LAYOUT_ID = MANIFEST.publisher + '.' + MANIFEST.name;

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-mac-'));
  const home = path.join(base, 'home');
  const app = path.join(base, 'Applications', 'Visual Studio Code.app');
  fs.mkdirSync(path.join(app, 'Contents', 'Resources', 'app', 'bin'), { recursive: true });
  fs.writeFileSync(path.join(app, 'Contents', 'Resources', 'app', 'bin', 'code'), '#!/bin/sh\n', {mode:0o755});
  fs.writeFileSync(path.join(app, 'Contents', 'Resources', 'Code.icns'), 'vscode-icon');
  const codex = path.join(base, 'bin', 'codex');
  fs.mkdirSync(path.dirname(codex), { recursive: true });
  fs.writeFileSync(codex, '#!/bin/sh\n', {mode:0o755});
  const desktop = path.join(home, 'Desktop');
  fs.mkdirSync(desktop, { recursive: true });
  return { base, home, app, codex, desktop };
}

// Simulates the macOS commands the setup calls and records them.
function fakeDeps(f) {
  const deps = {
    platform: 'darwin',
    home: f.home,
    env: { PATH: '' },
    now: () => new Date(2026, 9, 9, 10, 0, 0, 0),
    skillRoot: SKILL_ROOT,
    workspaceBase: path.join(f.base, 'SharedWorkspaces'),
    stdout: () => {},
    installed: [],
    calls: [],
    run(file, args) {
      deps.calls.push({ file, args });
      const name = path.basename(file);
      if (file === f.codex) return 'codex-cli 9.9.9\n';
      if (name === 'xcode-select') return '/Library/Developer/CommandLineTools\n';
      if (name === 'mdfind' || name === 'codesign' || name === 'open') return '';
      if (name === 'code') {
        if (args.includes('--list-extensions')) return deps.installed.join('\n');
        if (args.includes('--version')) return '1.200.0\ncommit\narm64\n';
        const target = args[args.indexOf('--install-extension') + 1];
        if (target.endsWith('.vsix')) {
          const extensionsDir = args[args.indexOf('--extensions-dir') + 1];
          const dest = path.join(extensionsDir, LAYOUT_ID + '-' + MANIFEST.version);
          fs.cpSync(path.join(SKILL_ROOT, 'assets/workspace-extension/extension'), dest, { recursive: true });
          fs.writeFileSync(path.join(dest, 'package.json'), JSON.stringify({ ...MANIFEST, __metadata: { installedTimestamp: 1 } }));
          deps.installed.push(LAYOUT_ID + '@' + MANIFEST.version);
        } else {
          deps.installed.push(target.toLowerCase() + '@1.0.0');
        }
        return '';
      }
      if (name === 'osacompile') {
        const out = args[args.indexOf('-o') + 1];
        fs.mkdirSync(path.join(out, 'Contents', 'Resources', 'Scripts'), { recursive: true });
        fs.writeFileSync(path.join(out, 'Contents', 'Resources', 'applet.icns'), 'applet-icon');
        fs.copyFileSync(args[args.length - 1], path.join(out, 'Contents', 'Resources', 'Scripts', 'main.applescript'));
        return '';
      }
      throw new Error('unexpected command ' + file);
    }
  };
  return deps;
}

function baseArgs(f) {
  return ['--create-sample', '--code-app', f.app, '--codex', f.codex, '--desktop', f.desktop];
}

test('macOS plan uses ~/Library/VibeCoding and a desktop .app launcher without writing files', () => {
  const f = fixture();
  const plan = setup.buildPlan(setup.parseArgs(baseArgs(f)), fakeDeps(f));
  assert.equal(plan.platform, 'darwin');
  assert.equal(plan.root, path.join(f.home, 'Library', 'VibeCoding'));
  assert.equal(plan.project, path.join(plan.root, 'SampleProject'));
  assert.equal(plan.codeCli, path.join(f.app, 'Contents', 'Resources', 'app', 'bin', 'code'));
  assert.match(path.basename(plan.shortcut), /^Vibe Coding - SampleProject-[0-9a-f]{10}\.app$/);
  assert.match(path.basename(plan.workspace), /^vibe-[0-9a-f]{10}\.code-workspace$/);
  assert.deepEqual(plan.missing, []);
  assert.equal(fs.existsSync(plan.root), false, 'planning must not create files');
});

test('macOS setup refuses other operating systems and unsafe inputs', () => {
  const f = fixture();
  assert.throws(() => setup.buildPlan(setup.parseArgs(baseArgs(f)), { ...fakeDeps(f), platform: 'win32' }), /macOS only/);
  const custom = setup.buildPlan(setup.parseArgs([...baseArgs(f), '--root', path.join(f.base, 'with space')]), fakeDeps(f));
  assert.equal(custom.root, path.join(f.base, 'with space'));
  assert.ok(custom.workspace.startsWith(path.join(f.base, 'SharedWorkspaces')));
  const project = path.join(f.base, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'index.html'), '<h1>keep</h1>');
  const args = ['--project', project, '--code-app', f.app, '--codex', f.codex, '--desktop', f.desktop];
  assert.throws(() => setup.buildPlan(setup.parseArgs([...args, '--entry', '../outside.html']), fakeDeps(f)), /within the project/);
  assert.throws(() => setup.buildPlan(setup.parseArgs([...args, '--preview-url', 'http://example.com:3000']), fakeDeps(f)), /localhost/);
  assert.throws(() => setup.parseArgs(['--unknown']), /Unknown option/);
});

test('missing VS Code and Codex are reported instead of applied', () => {
  const f = fixture();
  const plan = setup.buildPlan(setup.parseArgs(['--create-sample', '--code-app', path.join(f.base, 'none.app'), '--codex', path.join(f.base, 'none'), '--desktop', f.desktop]), fakeDeps(f));
  assert.equal(plan.missing.length, 2);
  assert.throws(() => setup.applySetup(plan, {}, fakeDeps(f)), /prerequisites/);
});

test('apply merges isolated settings, installs the packaged extension and creates the launcher', () => {
  const f = fixture();
  const deps = fakeDeps(f);
  const root = path.join(f.home, 'Library', 'VibeCoding');
  const settingsPath = path.join(root, 'VSCodeUserData', 'User', 'settings.json');
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify({ 'editor.fontSize': 18, 'terminal.integrated.commandsToSkipShell': ['-vibe.toggleTerminal', 'custom.command'] }));
  const opts = setup.parseArgs([...baseArgs(f), '--apply', '--codex-arg', '--no-daemon']);
  const result = setup.applySetup(setup.buildPlan(opts, deps), opts, deps);

  assert.equal(result.applied, true);
  assert.equal(result.codexVersion, 'codex-cli 9.9.9');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(settings['editor.fontSize'], 18, 'unrelated settings stay');
  assert.equal(settings['vibe.codexPath'], f.codex);
  assert.ok(settings['terminal.integrated.commandsToSkipShell'].includes('custom.command'));
  assert.ok(settings['terminal.integrated.commandsToSkipShell'].includes('vibe.pasteImage'));
  assert.ok(!settings['terminal.integrated.commandsToSkipShell'].includes('-vibe.toggleTerminal'));
  assert.equal(settings['terminal.integrated.profiles.windows'], undefined);
  assert.equal(fs.existsSync(path.join(root, 'VSCodeUserData', 'User', 'keybindings.json')), false, 'macOS keeps native Cmd+C / Cmd+V');
  assert.ok(fs.readdirSync(result.backup).some(name => name.endsWith('-settings.json')), 'previous settings are backed up');

  const workspace = JSON.parse(fs.readFileSync(result.workspace, 'utf8'));
  assert.deepEqual(workspace.folders, [{ path: result.project }]);
  assert.deepEqual(workspace.settings['vibe.codexArgs'], ['--no-daemon']);
  assert.equal(workspace.settings['window.title'], 'Vibe Coding - ' + '$' + '{activeEditorShort}' + '$' + '{separator}' + '$' + '{rootName}');
  assert.ok(fs.existsSync(path.join(result.project, 'index.html')), 'sample entry file is created');
  const remote = JSON.parse(fs.readFileSync(path.join(result.project, '.vibe', 'remote-config.json'), 'utf8'));
  assert.equal(remote.codexPath, f.codex);
  assert.equal(fs.readFileSync(path.join(root, 'vibe-workspace.vsix')).subarray(0, 2).toString(), 'PK');

  const script = fs.readFileSync(path.join(result.shortcut, 'Contents', 'Resources', 'Scripts', 'main.applescript'), 'utf8');
  assert.match(script, /\/usr\/bin\/open -n -a /);
  assert.ok(script.includes('quoted form of "--skip-welcome"'), 'first-run onboarding is skipped');
  assert.equal(settings['workbench.welcomePage.experimentalOnboarding'], false);
  assert.ok(script.includes('quoted form of ' + JSON.stringify(result.workspace)));
  assert.ok(script.includes('quoted form of ' + JSON.stringify(f.app)));
  assert.equal(fs.readFileSync(path.join(result.shortcut, 'Contents', 'Resources', 'applet.icns'), 'utf8'), 'vscode-icon');
  assert.ok(deps.calls.some(call => path.basename(call.file) === 'codesign'));

  // Running again reuses the verified installation and keeps the old launcher in the backup.
  deps.calls.length = 0;
  const again = setup.applySetup(setup.buildPlan(opts, deps), opts, deps);
  assert.ok(!deps.calls.some(call => call.args.includes('--install-extension')), 'no reinstall when content matches');
  assert.ok(again.previousLauncher && fs.existsSync(again.previousLauncher));
  assert.ok(fs.existsSync(again.shortcut));
});

test('launcher source escapes AppleScript strings', () => {
  const source = setup.launcherSource({ appPath: '/Apps/My "VS" Code.app', userDir: '/u', extensionsDir: '/e', workspacePath: '/w/vibe.code-workspace' });
  assert.ok(source.includes('quoted form of "/Apps/My \\"VS\\" Code.app"'));
  assert.ok(source.includes('quoted form of "--user-data-dir" & " " & quoted form of "/u"'));
});

test('createZip stores every file under a forward-slash name with its exact bytes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-zip-src-'));
  fs.mkdirSync(path.join(dir, 'extension'));
  fs.writeFileSync(path.join(dir, '[Content_Types].xml'), '<Types/>');
  fs.writeFileSync(path.join(dir, 'extension', 'extension.js'), 'console.log("한글");\n');
  const zipPath = path.join(dir, '..', path.basename(dir) + '.vsix');
  assert.equal(setup.createZip(dir, zipPath), 2);
  const zip = fs.readFileSync(zipPath);
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const entries = {};
  for (let i = 0; i < count; i++) {
    const size = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    entries[name] = zip.subarray(localOffset + 30 + localNameLength, localOffset + 30 + localNameLength + size).toString('utf8');
    offset += 46 + nameLength;
  }
  assert.deepEqual(Object.keys(entries).sort(), ['[Content_Types].xml', 'extension/extension.js']);
  assert.equal(entries['extension/extension.js'], 'console.log("한글");\n');
});

test('the Korean language pack is registered before the first launch, with VS Code\'s hash', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-lp-'));
  const userDir = path.join(base, 'user');
  const extensionsDir = path.join(base, 'extensions');
  const relative = 'ms-ceintl.vscode-language-pack-ko-1.131.2026090407';
  fs.mkdirSync(path.join(extensionsDir, relative, 'translations'), { recursive: true });
  fs.mkdirSync(userDir, { recursive: true });
  fs.writeFileSync(path.join(extensionsDir, relative, 'package.json'), JSON.stringify({
    name: 'vscode-language-pack-ko', version: '1.131.2026090407',
    contributes: { localizations: [{ languageId: 'ko', languageName: 'Korean', localizedLanguageName: '한국어', translations: [{ id: 'vscode', path: './translations/main.i18n.json' }] }] }
  }));
  // A CLI install records the gallery id in metadata, not yet in identifier.uuid.
  fs.writeFileSync(path.join(extensionsDir, 'extensions.json'), JSON.stringify([
    { identifier: { id: 'ms-ceintl.vscode-language-pack-ko' }, version: '1.131.2026090407', relativeLocation: relative, metadata: { id: '7c15d326-cfdd-4932-9409-634b512daebe' } },
    { identifier: { id: 'ms-vscode.live-server' }, version: '1.0.0', relativeLocation: 'missing-folder' }
  ]));
  fs.writeFileSync(path.join(userDir, 'languagepacks.json'), JSON.stringify({ ja: { hash: 'keep' } }));
  assert.equal(setup.writeLanguagePacks(userDir, extensionsDir), true);
  const packs = JSON.parse(fs.readFileSync(path.join(userDir, 'languagepacks.json'), 'utf8'));
  // Value written by VS Code 1.141 itself for this language pack version.
  assert.equal(packs.ko.hash, 'd7d556079a3b7c73bd10ddac55bcb029');
  assert.equal(packs.ko.label, '한국어');
  assert.equal(packs.ko.translations.vscode, path.join(extensionsDir, relative, 'translations', 'main.i18n.json'));
  assert.deepEqual(packs.ko.extensions, [{ extensionIdentifier: { id: 'ms-ceintl.vscode-language-pack-ko', uuid: '7c15d326-cfdd-4932-9409-634b512daebe' }, version: '1.131.2026090407' }]);
  assert.deepEqual(packs.ja, { hash: 'keep' }, 'other languages are preserved');
  assert.equal(setup.writeLanguagePacks(userDir, extensionsDir), false, 'an up-to-date file is left alone');
  packs.ko.translations.vscode=path.join(base,'old-location','missing.i18n.json');
  fs.writeFileSync(path.join(userDir,'languagepacks.json'),JSON.stringify(packs));
  assert.equal(setup.writeLanguagePacks(userDir,extensionsDir),true,'same version with old paths is repaired');
  assert.equal(JSON.parse(fs.readFileSync(path.join(userDir,'languagepacks.json'),'utf8')).ko.translations.vscode,path.join(extensionsDir,relative,'translations','main.i18n.json'));
});

test('failed replacement compilation leaves the working desktop launcher intact', () => {
  const f=fixture(),deps=fakeDeps(f),opts=setup.parseArgs(baseArgs(f));
  const plan=setup.buildPlan(opts,deps);setup.applySetup(plan,opts,deps);
  const icon=path.join(plan.shortcut,'Contents/Resources/applet.icns');
  const before=fs.readFileSync(icon,'utf8'),run=deps.run;
  deps.run=(file,args)=>{
    if(path.basename(file)==='osacompile') {fs.mkdirSync(args[args.indexOf('-o')+1],{recursive:true});throw Error('compile interrupted');}
    return run(file,args);
  };
  assert.throws(()=>setup.applySetup(plan,opts,deps),/compile interrupted/);
  assert.equal(fs.readFileSync(icon,'utf8'),before);
  assert.equal(fs.readdirSync(f.desktop).length,1,'failed staging app removed');
});

test('POSIX discovery skips Codex files without execute permission', {skip:process.platform==='win32'}, () => {
  const f=fixture(),deps=fakeDeps(f);
  const bad=path.join(f.base,'badbin');fs.mkdirSync(bad);fs.writeFileSync(path.join(bad,'codex'),'not executable',{mode:0o644});
  deps.env.PATH=bad+':'+path.dirname(f.codex);
  const args=['--create-sample','--code-app',f.app,'--desktop',f.desktop];
  assert.equal(setup.buildPlan(setup.parseArgs(args),deps).codex,f.codex);
});

test('reapply preserves JSONC comments, both port scopes, remote fields and backups', () => {
  const f = fixture(), deps = fakeDeps(f);
  const opts = setup.parseArgs([...baseArgs(f), '--root', path.join(f.base, '사용자 설정'), '--preview-url', 'http://localhost:5173']);
  const plan = setup.buildPlan(opts, deps);
  const settings = path.join(plan.root, 'VSCodeUserData/User/settings.json');
  const argv = path.join(plan.root, 'VSCodeUserData/argv.json');
  const remote = path.join(plan.project, '.vibe/remote-config.json');
  fs.mkdirSync(path.dirname(settings), {recursive:true});
  fs.mkdirSync(path.dirname(remote), {recursive:true});
  fs.mkdirSync(path.dirname(plan.workspace), {recursive:true});
  fs.writeFileSync(settings, '{\n // user comments remain\n "editor.fontSize": 19,\n "remote.portsAttributes": {"8080":{"label":"API","protocol":"https"},"5173":{"protocol":"https"}},\n}\n');
  fs.writeFileSync(argv, '{\n // runtime comments remain\n "disable-hardware-acceleration": true,\n}\n');
  fs.writeFileSync(plan.workspace, JSON.stringify({settings:{'remote.portsAttributes':{'9000':{label:'another'},'5173':{protocol:'http'}}}}));
  fs.writeFileSync(remote, JSON.stringify({version:1,customValue:'keep'}));
  const result = setup.applySetup(plan,opts,deps);
  const jsonc = require('../vibe-coding/scripts/jsonc.cjs');
  const after = jsonc.readObject(settings);
  assert.equal(after['editor.fontSize'],19);
  assert.equal(after['vibe.dataRoot'],plan.root);
  assert.equal(after['remote.portsAttributes']['8080'].protocol,'https');
  assert.equal(after['remote.portsAttributes']['5173'].protocol,'https');
  assert.equal(after['remote.portsAttributes']['9000'],undefined,'global and workspace scopes stay separate');
  const ws = jsonc.readObject(plan.workspace);
  assert.equal(ws.settings['remote.portsAttributes']['9000'].label,'another');
  assert.equal(ws.settings['remote.portsAttributes']['5173'].protocol,'http');
  assert.match(fs.readFileSync(settings,'utf8'),/user comments remain/);
  assert.match(fs.readFileSync(argv,'utf8'),/runtime comments remain/);
  assert.equal(jsonc.readObject(argv)['disable-hardware-acceleration'],true);
  assert.equal(jsonc.readObject(remote).customValue,'keep');
  assert.ok(fs.readdirSync(result.backup).some(n=>n.endsWith('-remote-config.json')));
});

test('malformed runtime config fails before any settings or project writes', () => {
  const f=fixture(), deps=fakeDeps(f), opts=setup.parseArgs(baseArgs(f)), plan=setup.buildPlan(opts,deps);
  const settings=path.join(plan.root,'VSCodeUserData/User/settings.json');
  fs.mkdirSync(path.dirname(settings),{recursive:true});
  const before='{"editor.fontSize":20}'; fs.writeFileSync(settings,before);
  fs.writeFileSync(path.join(plan.root,'VSCodeUserData/argv.json'),'{"broken":');
  assert.throws(()=>setup.applySetup(plan,opts,deps),/parse|JSONC/i);
  assert.equal(fs.readFileSync(settings,'utf8'),before);
  assert.equal(fs.existsSync(plan.project),false);
});

test('Unicode home is supported and gets an ASCII mobile workspace alias', () => {
  const f=fixture(), deps=fakeDeps(f); deps.home=path.join(f.base,'찬우 사용자');
  const plan=setup.buildPlan(setup.parseArgs(baseArgs(f)),deps);
  assert.equal(plan.root,path.join(deps.home,'Library','VibeCoding'));
  assert.ok(plan.workspace.startsWith(deps.workspaceBase));
  assert.equal(fs.existsSync(plan.workspace),false,'plan creates no alias');
});

test('upgrade reuses the matching legacy workspace without losing project settings', () => {
  const f=fixture(),deps=fakeDeps(f),opts=setup.parseArgs(baseArgs(f));
  const initial=setup.buildPlan(opts,deps);
  const oldId=require('crypto').createHash('sha256').update(initial.project.normalize('NFC').toLowerCase()).digest('hex').slice(0,10);
  const legacy=path.join(path.dirname(initial.workspace),'vibe-'+oldId+'.code-workspace');
  fs.mkdirSync(path.dirname(legacy),{recursive:true});
  fs.writeFileSync(legacy,JSON.stringify({folders:[{path:initial.project}],settings:{'vibe.codexArgs':['--custom-user-arg']}}));
  const plan=setup.buildPlan(opts,deps);
  assert.equal(plan.workspace,legacy);
  setup.applySetup(plan,opts,deps);
  assert.deepEqual(JSON.parse(fs.readFileSync(plan.workspace,'utf8')).settings['vibe.codexArgs'],['--custom-user-arg']);
});

test('unsafe custom roots get separate mobile workspaces for the same project', () => {
  const f=fixture(),deps=fakeDeps(f); delete deps.workspaceBase;
  const project=path.join(f.base,'Existing');fs.mkdirSync(project);fs.writeFileSync(path.join(project,'index.html'),'keep');
  const args=['--project',project,'--code-app',f.app,'--codex',f.codex,'--desktop',f.desktop];
  const a=setup.buildPlan(setup.parseArgs([...args,'--root',path.join(f.base,'profile A')]),deps);
  const b=setup.buildPlan(setup.parseArgs([...args,'--root',path.join(f.base,'profile B')]),deps);
  assert.notEqual(a.workspace,b.workspace);
});

test('a new sample identity resolves symlinked ancestors before creation', {skip:process.platform==='win32'}, () => {
  const f=fixture(),deps=fakeDeps(f),actual=path.join(f.base,'actual'),alias=path.join(f.base,'alias');
  fs.mkdirSync(actual);fs.symlinkSync(actual,alias,'dir');
  const opts=setup.parseArgs([...baseArgs(f),'--root',alias]);
  const before=setup.buildPlan(opts,deps);fs.mkdirSync(before.project);
  const after=setup.buildPlan(opts,deps);assert.equal(before.workspace,after.workspace);assert.equal(before.shortcut,after.shortcut);
});

test('reapply uses the saved JSONC remote preview route', () => {
  const f=fixture(),deps=fakeDeps(f),opts=setup.parseArgs(baseArgs(f));
  const first=setup.buildPlan(opts,deps);const remote=path.join(first.project,'.vibe/remote-config.json');
  fs.mkdirSync(path.dirname(remote),{recursive:true});fs.writeFileSync(remote,'{\n // saved route\n "previewUrl":"http://localhost:3012/studio",\n}\n');
  const plan=setup.buildPlan(opts,deps);assert.equal(plan.previewUrl,'http://localhost:3012/studio');
});

test('case-distinct real projects never share a workspace', {skip:process.platform==='win32'}, t => {
  const f=fixture(), deps=fakeDeps(f);
  const upper=path.join(f.base,'Music'), lower=path.join(f.base,'music');
  fs.mkdirSync(upper); try {fs.mkdirSync(lower);}catch(e){if(e.code==='EEXIST'){t.skip('requires a case-sensitive volume');return;}throw e;}
  fs.writeFileSync(path.join(upper,'index.html'),'upper'); fs.writeFileSync(path.join(lower,'index.html'),'lower');
  const args=['--code-app',f.app,'--codex',f.codex,'--desktop',f.desktop];
  const a=setup.buildPlan(setup.parseArgs([...args,'--project',upper]),deps);
  const b=setup.buildPlan(setup.parseArgs([...args,'--project',lower]),deps);
  assert.notEqual(a.workspace,b.workspace);
});
