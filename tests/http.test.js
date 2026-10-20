const {test}=require('node:test');const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {once}=require('node:events');
async function start(dir){const p=spawn(process.execPath,['scripts/demo-server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:'0',ZIMO_DEMO_DIR:dir},stdio:['ignore','pipe','pipe']});const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{p.kill();reject(Error('演示服务启动超时'))},5000);p.once('error',reject);p.stdout.on('data',b=>{const m=b.toString().match(/端口 (\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});p.once('exit',code=>{clearTimeout(timer);reject(Error('启动退出 '+code))});});return {p,url:'http://127.0.0.1:'+port};}
async function stop(p){p.kill('SIGTERM');await once(p,'exit');}
test('实际HTTP：批量发布、个人更新、家长隔离、图片鉴权和服务重启恢复',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zimo-http-'));let server=await start(dir);t.after(async()=>{if(server?.p.exitCode===null&&server?.p.signalCode===null)await stop(server.p);fs.rmSync(dir,{recursive:true,force:true});});let seq=0;
 const call=async(action,input={},persona='admin')=>{const response=await fetch(server.url+'/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,input:{requestId:'http'+(++seq),...input},demoPersona:persona})});return response.json();};
 assert.equal((await(await fetch(server.url+'/health')).json()).mode,'fictional-demo');const date=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 const r=await call('publishHomework',{date,classId:'c1',subject:'数学',source:'虚构验收作业单',verified:true,content:'演示HTTP任务',studentIds:['s01','s02']});assert.equal(r.ok,true);assert.equal(r.data.createdCount,2);
 const before=await call('student',{studentId:'s01'},'parent');const task=before.data.tasks.find(x=>x.homeworkId===r.data.id);assert.ok(task);
 assert.equal((await call('taskUpdate',{id:task.id,version:task.version,status:'待检查'},'teacher')).ok,true);
 assert.equal((await call('student',{studentId:'s02'},'parent')).error.code,'FORBIDDEN');
 // JPEG magic + test bytes，业务层不宣称能解码成真实照片；这里验证受限字节鉴权路径。
 const image=await call('fileUpload',{studentId:'s01',subject:'数学',base64:Buffer.from([255,216,255,224,0,16,74,70,73,70,0,1,2,3,4,5]).toString('base64')},'teacher');assert.equal(image.ok,true);
 assert.equal((await call('fileRead',{id:image.data.id},'parent')).ok,true);assert.equal((await call('fileRead',{id:image.data.id},'other')).error.code,'FORBIDDEN');
 await stop(server.p);server=await start(dir);const after=await call('student',{studentId:'s01'},'parent');assert.equal(after.data.tasks.find(x=>x.id===task.id).status,'待检查');assert.equal((await call('fileRead',{id:image.data.id},'parent')).ok,true);
});
