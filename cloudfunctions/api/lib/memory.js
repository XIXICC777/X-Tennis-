const {clone}=require('./clone');
// 仅用于自动化测试和独立演示服务器；生产入口使用 cloud-store。
class MemoryStore {
 constructor(seed={},onCommit=null) {this.data=clone(seed);this.queue=Promise.resolve();this.onCommit=onCommit;}
 async transaction(fn) {
  const run=this.queue.then(async()=>{const data=clone(this.data);const tx={get:async(t,id)=>data[t]?.[id]||null,list:async(t,filter={})=>Object.values(data[t]||{}).filter(r=>Object.entries(filter).every(([k,v])=>r[k]===v)),set:async(t,id,value)=>{(data[t]??={})[id]=clone(value);}};const result=await fn(tx);if(this.onCommit)await this.onCommit(data);this.data=data;return clone(result);});
  this.queue=run.catch(()=>{});return run;
 }
}
module.exports={MemoryStore};
