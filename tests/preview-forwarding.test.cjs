'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {createPreviewForwarder} = require('../vibe-coding/assets/workspace-extension/extension/preview-forwarding');

function child() {
  const p=new EventEmitter(); p.stderr=new EventEmitter();p.stdout=new EventEmitter();
  p.messages=[];p.stdin={write:text=>p.messages.push(JSON.parse(text))};p.kill=()=>{p.killed=true};return p;
}
test('creates private forwarding and preserves preview route and query', async () => {
  const p=child();let calls=0;
  const f=createPreviewForwarder({findCli:()=> 'C:/code-tunnel.exe',spawn:(file,args,options)=>{calls++;assert.equal(options.shell,false);assert.ok(!args.includes('--access-token'));process.nextTick(()=>p.stderr.emit('data','{"port_format":"https://test-{port}.jpe1.devtunnels.ms/"}\n'));return p;}});
  assert.equal(await f.resolve('http://127.0.0.1:3012/studio?mode=touch'),'https://test-3012.jpe1.devtunnels.ms/studio?mode=touch');
  assert.equal(p.messages[0][0].privacy,'private');
  await f.resolve('http://localhost:3012/studio');assert.equal(calls,1);
  f.dispose();assert.equal(p.killed,true);
});
test('startup timeout kills only owned forwarding process', async () => {
  const p=child();const f=createPreviewForwarder({findCli:()=> 'C:/code.exe',spawn:()=>p,timeoutMs:20});
  await assert.rejects(f.resolve('http://localhost:3012'),/포트/);assert.equal(p.killed,true);f.dispose();
});
test('process exit invalidates address and next request reconnects', async () => {
  let calls=0;const children=[];
  const f=createPreviewForwarder({findCli:()=> 'C:/code.exe',spawn:()=>{calls++;const p=child();children.push(p);process.nextTick(()=>p.stderr.emit('data','{"port_format":"https://test-{port}.jpe1.devtunnels.ms/"}\n'));return p;}});
  await f.resolve('http://localhost:3012');children[0].emit('exit',1);
  await f.resolve('http://localhost:3012');assert.equal(calls,2);f.dispose();
});

test('private forwarding preserves the HTTPS upstream protocol and default port', async () => {
  const p=child();const f=createPreviewForwarder({findCli:()=>'/custom/code-tunnel',spawn:()=>{process.nextTick(()=>p.stderr.emit('data','{"port_format":"https://test-{port}.jpe1.devtunnels.ms/"}\n'));return p;}});
  assert.equal(await f.resolve('https://localhost/studio?a=1#camera'),'https://test-443.jpe1.devtunnels.ms/studio?a=1#camera');
  assert.deepEqual(p.messages.at(-1),[{number:443,privacy:'private',protocol:'https'}]);
  await f.resolve('http://localhost:3012');
  assert.deepEqual(p.messages.at(-1),[{number:443,privacy:'private',protocol:'https'},{number:3012,privacy:'private',protocol:'http'}]);
  f.dispose();
});
