// 仅内部就绪检查，不生成网页预览链接。
const assert=require('node:assert/strict');
(async()=>{
 const base='http://127.0.0.1:8787';const health=await(await fetch(base+'/health')).json();assert.equal(health.mode,'fictional-demo');
 const call=async(action,input)=>{const r=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,input,demoPersona:'parent'})});return r.json();};
 const allowed=await call('student',{studentId:'s01'});assert.equal(allowed.ok,true);assert.equal(allowed.data.student.id,'s01');
 const denied=await call('student',{studentId:'s02'});assert.equal(denied.ok,false);assert.equal(denied.error.code,'FORBIDDEN');
 console.log('演示服务就绪：已授权孩子读取成功，其他孩子读取拒绝。');
})().catch(e=>{console.error('演示服务未就绪：'+e.message);process.exitCode=1;});
