'use strict';
const {spawn} = require('child_process');
const {findCodeTunnelCli} = require('./tunnel-manager');

// Uses the same preview CLI protocol as Microsoft's bundled tunnel-forwarding
// extension. This is version-dependent: reject unknown responses, never guess
// a hostname or switch to public access. CLI account credentials remain in CLI.
function createPreviewForwarder(options = {}) {
  let active, pending, startingChild, disposed=false;
  const ports=new Map();
  const send = p => p.stdin.write(JSON.stringify([...ports].map(([number,protocol])=>({number,privacy:'private',protocol})))+'\n');
  async function start() {
    const cli=(options.findCli || findCodeTunnelCli)(options);
    if (!cli) throw new Error('미리보기 포트 전달용 VS Code 터널 실행 파일(code-tunnel)을 찾을 수 없습니다.');
    return new Promise((resolve,reject)=>{
      const p=(options.spawn || spawn)(cli,['tunnel','forward-internal','--provider','github'],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
      startingChild=p;
      let settled=false,buffer='';
      const fail=message=>{if(settled)return;settled=true;clearTimeout(timer);if(active?.child===p)active=null;try{p.kill();}catch{}reject(new Error(message));};
      const timer=setTimeout(()=>fail('미리보기 포트 전달 준비 시간이 초과되었습니다. 공식 CLI GitHub 인증 또는 네트워크 상태를 확인해주세요.'),options.timeoutMs || 30000);
      p.stderr.on('data',chunk=>{
        buffer+=chunk.toString();
        let split;
        while((split=buffer.indexOf('\n'))>=0){
          const line=buffer.slice(0,split);buffer=buffer.slice(split+1);
          let data;try{data=JSON.parse(line);}catch{continue;}
          if(!data.port_format || settled)continue;
          if(!/^https:\/\/[a-z0-9-]+-\{port\}\.[a-z0-9.-]+\.devtunnels\.ms\/$/i.test(data.port_format))return fail('공식 미리보기 포트 전달 응답을 해석하지 못했습니다.');
          if(disposed)return fail('미리보기 연결이 종료되었습니다.');
          settled=true;clearTimeout(timer);startingChild=null;active={child:p,format:data.port_format};resolve(active);
        }
        if(buffer.length>65536)buffer=buffer.slice(-4096);
      });
      p.stdout.on('data',()=>{});
      p.on('error',()=>fail('미리보기 포트 전달 프로세스를 실행하지 못했습니다.'));
      p.on('exit',code=>{if(active?.child===p)active=null;fail('미리보기 포트 전달이 종료되었습니다 (코드 '+code+'). CLI 로그인과 연결 상태를 확인해주세요.');});
      p.stdin.on?.('error',()=>fail('미리보기 포트 전달 통신이 끊겼습니다.'));
      try{send(p);}catch{fail('미리보기 포트 전달 요청을 보내지 못했습니다.');}
    });
  }
  return {
    async resolve(localUrl) {
      if(disposed)throw new Error('미리보기 연결이 종료되었습니다.');
      const local=new URL(localUrl);
      if(!['http:','https:'].includes(local.protocol) || !['localhost','127.0.0.1','[::1]'].includes(local.hostname))throw new Error('자동 포트 전달은 로컬 HTTP(S) 개발 서버에만 사용합니다.');
      const port=Number(local.port)||(local.protocol==='https:'?443:80);
      ports.set(port,local.protocol.slice(0,-1));
      if(!active){if(!pending)pending=start().finally(()=>{pending=null;});await pending;}
      if(!active)throw new Error('미리보기 포트 전달 연결이 끊겼습니다. 다시 눌러주세요.');
      send(active.child);
      const target=new URL(active.format.replace('{port}',String(port)));
      target.pathname=local.pathname;target.search=local.search;target.hash=local.hash;
      return target.toString();
    },
    dispose(){disposed=true;try{startingChild?.kill();active?.child.kill();}catch{}active=null;}
  };
}
module.exports={createPreviewForwarder};
