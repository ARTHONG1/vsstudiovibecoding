'use strict';
const siteUrl='https://arthong1.github.io/vsstudiovibecoding/';
document.getElementById('share-page')?.addEventListener('click',async()=>{
 const status=document.getElementById('share-status');
 try { if(navigator.share){await navigator.share({title:'Vibe Coding · AI찬우쌤',text:'복잡한 Windows VS Code 환경 세팅을 AI 에이전트에게 맡기세요.',url:siteUrl});status.textContent=' 공유했습니다.';}else{await navigator.clipboard.writeText(siteUrl);status.textContent=' 링크를 복사했습니다.';} }catch(e){status.textContent=e.name==='AbortError'?'':' 공유가 차단되었습니다. 주소창의 링크를 복사해주세요.';}
});
document.getElementById('copy-prompt')?.addEventListener('click',async()=>{
 const status=document.getElementById('copy-status');try{await navigator.clipboard.writeText(document.querySelector('#setup-prompt code').textContent);status.textContent=' 복사했습니다. AI에게 붙여넣으세요.';}catch{status.textContent=' 요청문을 직접 선택해서 복사해주세요.';}
});
