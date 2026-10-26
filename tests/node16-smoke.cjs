// 可由真正的 Node.js 16.13 执行；不依赖该版本尚未提供的 node:test。
const assert=require('node:assert/strict');
delete global.structuredClone;
const {clone}=require('../cloudfunctions/api/lib/clone');
const {createService,day}=require('../cloudfunctions/api/lib/domain');
const {CloudStore}=require('../cloudfunctions/api/lib/cloud-store');
const {MemoryStore}=require('../cloudfunctions/api/lib/memory');
const {demoSeed}=require('../cloudfunctions/api/lib/seed');
function fakeDb(){let state={};for(const [t,rows]of Object.entries(demoSeed()))state['p_'+t]=rows;
 return {collection(name){let offset=0,limit=100,filter={};return {where(v){filter=v;return this;},orderBy(){return this;},skip(v){offset=v;return this;},limit(v){limit=v;return this;},async get(){return {data:Object.values(state[name]||{}).filter(r=>Object.entries(filter).every(([k,v])=>r[k]===v)).slice(offset,offset+limit).map(r=>({...clone(r),_id:r.id}))};}};},async runTransaction(fn){const snapshot=clone(state);const native={collection(name){return {doc(id){return {async get(){return {data:clone(snapshot[name]?.[id]||null)};},async set({data}){(snapshot[name]??={})[id]=clone(data);return {};}};}};}};const result=await fn(native);state=snapshot;return result;}};
}
async function check(store){const api=createService(store,{namespace:'demo'});const call=(action,input={},who='demo-admin')=>api(who,action,input);
 const session=await call('session');assert.equal(session.user.roles.includes('admin'),true);
 const published=await call('publishHomework',{requestId:'node16-publish',date:day(),classId:'c1',subject:'数学',content:'Node16兼容测试作业',source:'虚构测试单',verified:true,studentIds:['s01','s02']});assert.equal(published.count,2);
 const tasks=(await call('student',{studentId:'s01'},'demo-parent')).tasks;const task=tasks.find(t=>t.homeworkId===published.id);assert.ok(task);
 await call('taskUpdate',{requestId:'node16-update',id:task.id,version:task.version,status:'待检查'},'demo-teacher');
 assert.equal((await call('student',{studentId:'s01'},'demo-parent')).tasks.find(t=>t.id===task.id).status,'待检查');
 await assert.rejects(call('student',{studentId:'s02'},'demo-parent'),/无权/);
 const again=await call('publishHomework',{requestId:'node16-publish',date:day(),classId:'c1',subject:'数学',content:'Node16兼容测试作业',source:'虚构测试单',verified:true,studentIds:['s01','s02']});assert.deepEqual(again,published);
}
(async()=>{assert.equal(typeof global.structuredClone,'undefined');await check(new MemoryStore(demoSeed()));await check(new CloudStore(fakeDb(),'p_'));console.log(JSON.stringify({node:process.version,structuredClone:'absent',memoryStore:'passed',cloudAdapter:'passed',workflow:'session,publish,update,parent-read,forbidden,retry'}));})().catch(e=>{console.error(e);process.exitCode=1;});
