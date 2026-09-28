const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), http = require('node:http');
test('preview readiness rejects HTTP failures', async () => {
 const source = fs.readFileSync(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension/extension.js'),'utf8');
 const scope = {require: name => name==='vscode'||name.startsWith('.') ? {} : require(name), URL, module:{exports:{}}};
 vm.runInNewContext(source + '\nmodule.exports.probe = checkPortReachable;',scope);
 const server = http.createServer((req,res)=>{res.statusCode=Number(req.url.slice(1));res.end('test');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {for(const status of [200,404,500]) assert.equal(await scope.module.exports.probe('http://127.0.0.1:'+server.address().port+'/'+status),status===200);}
 finally {await new Promise(resolve=>server.close(resolve));}
});
