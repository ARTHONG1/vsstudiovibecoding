'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const {
  buildProjectTunnelUrl,
  extractTunnelUrl,
  findCodeTunnelCli,
  findCodeCli,
  getOrStartTunnel,
  stopTunnel,
  resetTunnelState,
  sanitizeErrorText
} = require('../vibe-coding/assets/workspace-extension/extension/tunnel-manager');
const {
  getMobileTunnelWebviewHtml,
  isAuthError
} = require('../vibe-coding/assets/workspace-extension/extension/mobile-tunnel');

const fs = require('fs');
const fixture = __filename.replace(/tunnel.test.cjs$/, 'tunnel-fixture.code-workspace');
fs.writeFileSync(fixture, JSON.stringify({folders:[{path:'C:/Users/user/Documents/과전강'}]}));
test.after(() => fs.unlinkSync(fixture));
const LF = String.fromCharCode(10);

test("extractTunnelUrl extracts official vscode.dev tunnel url correctly", () => {
  const sampleStdout = [
    "* Visual Studio Code Server",
    "  ➜  Tunnel:   vibe-pc",
    "  ➜  Open:  https://vscode.dev/tunnel/vibe-pc/C:/Users/user/Documents/과전강"
  ].join(LF);

  const url = extractTunnelUrl(sampleStdout);
  assert.equal(url, 'https://vscode.dev/tunnel/vibe-pc/C:/Users/user/Documents/과전강');
});

test("extractTunnelUrl returns null when no tunnel url is present", () => {
  assert.equal(extractTunnelUrl("Just some random output"), null);
  assert.equal(extractTunnelUrl(""), null);
  assert.equal(extractTunnelUrl(null), null);
});

test("findCodeTunnelCli or findCodeCli returns a valid string or existing path", () => {
  const cli = findCodeCli();
  assert.ok(typeof cli === "string" && cli.length > 0);
});

test("sanitizeErrorText masks sensitive tokens and auth secrets", () => {
  const sample = "Error with token=ghp_abc1234567890xyz and auth_code: secret12345678";
  const sanitized = sanitizeErrorText(sample);
  assert.ok(!sanitized.includes("ghp_abc1234567890xyz"));
  assert.ok(!sanitized.includes("secret12345678"));
  assert.ok(sanitized.includes("token=***"));
});

test("isAuthError correctly identifies authentication vs non-auth errors", () => {
  assert.equal(isAuthError("not logged in"), true);
  assert.equal(isAuthError("Please run code tunnel user login"), true);
  assert.equal(isAuthError("unauthorized access to tunnel service"), true);
  assert.equal(isAuthError("Tunnel process exited early with code 1"), false);
  assert.equal(isAuthError("File not found code-tunnel.exe"), false);
  assert.equal(isAuthError(""), false);
});

test("getMobileTunnelWebviewHtml renders dynamic QR code card when tunnelUrl is passed", () => {
  const testUrl = "https://vscode.dev/tunnel/vibe-pc/-project";
  const html = getMobileTunnelWebviewHtml({
    projectPath: "C:/test",
    tunnelUrl: testUrl,
    tunnelName: "vibe-pc"
  });

  assert.ok(html.includes("<svg"), "Should include SVG QR code");
  assert.ok(html.includes(testUrl), "Should include the tunnel URL");
  assert.ok(html.includes("스마트폰에서 작업하기"), "Should include mobile title");
  assert.ok(html.includes("주소 복사"), "Should include copy button");
  assert.ok(html.includes("postMessage"), "Should use message passing for clipboard copy");
});

test("getMobileTunnelWebviewHtml renders loading state when loading is true", () => {
  const html = getMobileTunnelWebviewHtml({ projectPath: "C:/test", loading: true });
  assert.ok(html.includes("공식 원격 터널을 준비하고 있습니다"));
  assert.ok(html.includes("spinner"));
});

test("getMobileTunnelWebviewHtml differentiates auth error vs execution path error", () => {
  const pathErrHtml = getMobileTunnelWebviewHtml({
    projectPath: "C:/test",
    error: "터널 프로세스가 비정상 종료되었습니다 (코드 1)."
  });
  assert.ok(pathErrHtml.includes("터널을 시작하지 못했습니다"));
  assert.ok(pathErrHtml.includes("터널 실행 경로 또는 네트워크 설정을 확인해주세요"));
  assert.ok(!pathErrHtml.includes("code tunnel user login"), "일반 오류일 때는 로그인 안내가 표시되지 않아야 함");

  const authErrHtml = getMobileTunnelWebviewHtml({
    projectPath: "C:/test",
    error: "You are not logged in. Run code tunnel user login."
  });
  assert.ok(authErrHtml.includes("터널을 시작하지 못했습니다"));
  assert.ok(authErrHtml.includes("code tunnel user login"), "인증 오류일 때 로그인 안내가 표시되어야 함");
});

test("getOrStartTunnel invokes spawn with shell: false and handles spaces in CLI path", async () => {
  resetTunnelState();
  let spawnArgsRecord = null;

  function mockSpawn(cliPath, args, options) {
    spawnArgsRecord = { cliPath, args, options };
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.pid = 99999;
    child.killed = false;
    child.kill = () => { child.killed = true; };

    process.nextTick(() => {
      child.stdout.emit("data", "Open: https://vscode.dev/tunnel/vibe-test/" + LF);
    });
    return child;
  }

  const cliWithSpaces = "C:\\Program Files\\Microsoft VS Code\\bin\\code-tunnel.exe";
  const projectWithKorean = "C:\\Users\\user\\Documents\\과전강 테스트";

  const result = await getOrStartTunnel(projectWithKorean, {
    findCli: () => cliWithSpaces,
    findVsix: () => "C:\\Users\\user\\AppData\\Local\\VibeCoding\\vibe-workspace.vsix",
    workspaceFile: __filename.replace(/tunnel.test.cjs$/, "tunnel-fixture.code-workspace"),
    spawn: mockSpawn
  });

  assert.ok(result && result.url);
  assert.equal(result.url, "https://vscode.dev/tunnel/vibe-test/" + __filename.replace(/tunnel.test.cjs$/, "tunnel-fixture.code-workspace").replace(/\\/g, "/"));
  assert.equal(spawnArgsRecord.cliPath, cliWithSpaces);
  assert.equal(spawnArgsRecord.options.shell, false, "shell must be false to prevent command line splitting on spaces");
  assert.equal(spawnArgsRecord.options.cwd, projectWithKorean);
  assert.ok(Array.isArray(spawnArgsRecord.args), "args must be passed as an array");
  assert.ok(spawnArgsRecord.args.includes("tunnel"));
  assert.ok(spawnArgsRecord.args.includes("--install-extension"));

  resetTunnelState();
});

test("getOrStartTunnel throws clear error when CLI executable is not found", async () => {
  resetTunnelState();
  await assert.rejects(
    async () => {
      await getOrStartTunnel("C:/test", {
        findCli: () => null
      });
    },
    err => {
      assert.ok(err.message.includes("code-tunnel.exe"));
      assert.ok(!err.message.includes("code tunnel user login"));
      return true;
    }
  );
  resetTunnelState();
});

test("getOrStartTunnel preserves exit code and CLI output when tunnel exits with code 1", async () => {
  resetTunnelState();

  function mockFailingSpawn() {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.pid = 88888;
    child.kill = () => {};

    process.nextTick(() => {
      child.stderr.emit("data", "Access denied to network socket" + LF);
      child.emit("exit", 1, null);
    });
    return child;
  }

  await assert.rejects(
    async () => {
      await getOrStartTunnel("C:/test", {
        findCli: () => "C:/bin/code-tunnel.exe",
        spawn: mockFailingSpawn
      });
    },
    err => {
      assert.ok(err.message.includes("코드 1"));
      assert.ok(err.message.includes("Access denied"));
      return true;
    }
  );
  resetTunnelState();
});

test("getOrStartTunnel rejects on timeout and does NOT fabricate a fallback URL", async () => {
  resetTunnelState();

  let killedCalled = false;
  function mockHangingSpawn() {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.pid = 77777;
    child.killed = false;
    child.kill = () => { killedCalled = true; child.killed = true; };
    return child;
  }

  await assert.rejects(
    async () => {
      await getOrStartTunnel("C:/test", {
        findCli: () => "C:/bin/code-tunnel.exe",
        spawn: mockHangingSpawn,
        timeoutMs: 50
      });
    },
    err => {
      assert.ok(err.message.includes("대기 시간이 초과"));
      return true;
    }
  );

  assert.equal(killedCalled, true, "Hanging child process should be killed on timeout");
  resetTunnelState();
});

test("getOrStartTunnel shares startingPromise to prevent duplicate tunnel spawns on double click", async () => {
  resetTunnelState();
  let spawnCount = 0;

  function mockSlowSpawn() {
    spawnCount++;
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.pid = 66666;
    child.kill = () => {};

    setTimeout(() => {
      child.stdout.emit("data", "Open: https://vscode.dev/tunnel/vibe-pc/" + LF);
    }, 30);
    return child;
  }

  const p1 = getOrStartTunnel("C:/test", {
    findCli: () => "C:/bin/code-tunnel.exe",
    spawn: mockSlowSpawn
  });
  const p2 = getOrStartTunnel("C:/test", {
    findCli: () => "C:/bin/code-tunnel.exe",
    spawn: mockSlowSpawn
  });

  const [res1, res2] = await Promise.all([p1, p2]);
  assert.equal(res1.url, "https://vscode.dev/tunnel/vibe-pc/C:/test");
  assert.equal(res2.url, "https://vscode.dev/tunnel/vibe-pc/C:/test");
  assert.equal(spawnCount, 1, "Only ONE child process must be spawned for concurrent requests");

  resetTunnelState();
});


test("qrcode.js supports Version 6 for URLs up to 134 bytes", () => {
  const longUrl = "https://vscode.dev/tunnel/vibe-book7j969ccoh7/C:/Users/user/AppData/Local/VibeCoding/Workspaces/vibe-f02daad379.code-workspace";
  const { generateQRCodeSVG } = require('../vibe-coding/assets/workspace-extension/extension/qrcode');
  const svg = generateQRCodeSVG(longUrl);
  assert.ok(svg.includes("<svg"), "Should generate valid SVG for 126-byte URL");
});

test("getMobileTunnelWebviewHtml safely falls back to copyable URL when QR fails", () => {
  const hugeUrl = "https://vscode.dev/tunnel/vibe-pc/" + "x".repeat(10000);
  const html = getMobileTunnelWebviewHtml({
    projectPath: "C:/test",
    tunnelUrl: hugeUrl,
    tunnelName: "vibe-pc"
  });

  assert.ok(html.includes("스마트폰에서 작업하기"), "Page title should render");
  assert.ok(html.includes(hugeUrl), "URL input should contain the full URL");
  assert.ok(html.includes("주소 복사"), "Copy button should render");
  assert.ok(html.includes("URL이 길어"), "Fallback note should render instead of throwing error");
});

test('project URL uses ASCII workspace and never CLI encoded folder or root', () => {
  const url=buildProjectTunnelUrl('https://vscode.dev/tunnel/vibe-pc/c:/wrong/%EA%B3%BC', 'C:/과전강', fixture);
  assert.equal(url, 'https://vscode.dev/tunnel/vibe-pc/' + fixture.replace(/\\/g,'/'));
  assert.ok(!url.includes('%'));
  assert.deepEqual(JSON.parse(fs.readFileSync(fixture,'utf8')).folders,[{path:'C:/Users/user/Documents/과전강'}]);
  assert.throws(()=>buildProjectTunnelUrl('https://vscode.dev/tunnel/vibe-pc/', 'C:/과전강', 'C:/missing.code-workspace'));
  assert.equal(buildProjectTunnelUrl('https://vscode.dev/tunnel/vibe-pc/', 'C:/project'), 'https://vscode.dev/tunnel/vibe-pc/C:/project');
});
