// 云开发事务内仅使用 doc().get/set；集合查询在事务外执行。
// 每个被扫描或写入的表都锁定 meta 修订文档，提交时递增；并发写会冲突并由 SDK 重试。
// 所有业务写入必须经过此适配器；控制台修改数据前应暂停服务。
class CloudStore {
 constructor(db,prefix){this.db=db;this.prefix=prefix;}
 async transaction(fn){return this.db.runTransaction(async native=>{
  const pending=new Map(),cache=new Map(),guards=new Map(),lists=new Map();
  const collection=t=>native.collection(this.prefix+t);
  const check=res=>{if(res.errCode||res.code)throw Object.assign(new Error(res.errMsg||res.message||'数据库请求失败'),{code:res.code||res.errCode});return res;};
  const unpack=res=>{const data=check(res).data;const r=Array.isArray(data)?data[0]||null:data||null;if(r)delete r._id;return r;};
  const guard=async t=>{if(!guards.has(t)){const row=unpack(await collection('meta').doc(t).get());guards.set(t,row?.revision||0);}};
  const tx={
   get:async(t,id)=>{
    if(!id||typeof id!=='string')return null;const key=t+':'+id;
    if(pending.has(key))return structuredClone(pending.get(key).value);
    if(!cache.has(key))cache.set(key,unpack(await collection(t).doc(id).get()));
    return structuredClone(cache.get(key));
   },
   list:async(t,filter={})=>{
    const listKey=t+':'+JSON.stringify(filter);const matches=r=>Object.entries(filter).every(([k,v])=>r[k]===v);
    await guard(t);
    if(!lists.has(listKey)){
     const rows=[];let skip=0;
     for(;;){const res=check(await this.db.collection(this.prefix+t).where(filter).orderBy('_id','asc').skip(skip).limit(100).get());rows.push(...res.data);if(res.data.length<100)break;skip+=100;if(skip>=10000)throw new Error('超过首版单次查询10000条扫描上限，请归档或升级分页接口');}
     lists.set(listKey,rows.map(r=>{delete r._id;return r;}));
    }
    const mapped=new Map(lists.get(listKey).map(r=>[r.id,r]));for(const item of pending.values())if(item.t===t&&matches(item.value))mapped.set(item.id,item.value);return structuredClone([...mapped.values()]);
   },
   set:async(t,id,value)=>{await guard(t);pending.set(t+':'+id,{t,id,value:JSON.parse(JSON.stringify(value))});}
  };
  const result=await fn(tx);
  for(const [t,revision]of [...guards].sort((a,b)=>a[0].localeCompare(b[0])))check(await collection('meta').doc(t).set({data:{revision:revision+1}}));
  for(const item of pending.values())check(await collection(item.t).doc(item.id).set({data:item.value}));
  return result;
 });}
}
module.exports={CloudStore};
