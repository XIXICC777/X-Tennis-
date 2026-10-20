const cloud=require('wx-server-sdk');
const {createService,tables,hash}=require('./lib/domain');
const {CloudStore}=require('./lib/cloud-store');
const {demoSeed}=require('./lib/seed');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const demo=process.env.DEMO_MODE==='true';
const prefix=demo?'zimo_demo_':'zimo_live_';
exports.main=async(event)=>{
 try{
  const ctx=cloud.getWXContext();const db=cloud.database();
  if(event.action==='initialize'){
   if(ctx.OPENID)throw new Error('初始化只允许云控制台执行，不允许小程序调用');
   if(!demo&&!process.env.BOOTSTRAP_OPENID)throw new Error('请先配置首位管理员 BOOTSTRAP_OPENID');
   for(const t of [...tables,'meta']){try{await db.createCollection(prefix+t);}catch(e){if(!/exist|已存在/i.test(e.message||e.errMsg||''))throw e;}}
   for(const t of tables){const exists=await db.collection(prefix+'meta').where({_id:t}).get();if(!exists.data.length)await db.collection(prefix+'meta').doc(t).set({data:{revision:0}});}
   if(demo){const seed=demoSeed();for(const [t,rows]of Object.entries(seed))for(const [id,r]of Object.entries(rows)){
    const exists=await db.collection(prefix+t).where({_id:id}).get();if(!exists.data.length)await db.collection(prefix+t).doc(id).set({data:r});
   }}else{const id=hash('live:'+process.env.BOOTSTRAP_OPENID).slice(0,32);const ref=db.collection(prefix+'users').doc(id);const exists=await db.collection(prefix+'users').where({_id:id}).get();if(!exists.data.length)await ref.set({data:{id,openid:process.env.BOOTSTRAP_OPENID,name:'机构管理员',roles:['admin','teacher','lead'],enabled:true}});}
   return {ok:true,data:{message:'初始化完成；请检查数据库及存储权限规则'}};
  }
  // 演示身份仅在独立演示环境允许；正式环境完全忽略客户端身份。
  const identity=demo?({'admin':'demo-admin','teacher':'demo-teacher','parent':'demo-parent','other':'demo-other'}[event.demoPersona]||'demo-parent'):ctx.OPENID;
  const api=createService(new CloudStore(db,prefix),{namespace:demo?'demo':'live',
   putFile:async(path,buf)=>(await cloud.uploadFile({cloudPath:path,fileContent:buf})).fileID,
   getFile:async id=>(await cloud.downloadFile({fileID:id})).fileContent.toString('base64')});
  const data=await api(identity,event.action,event.input||{});return {ok:true,data,demo};
 }catch(e){const known=['AUTH','INVALID','FORBIDDEN','NOT_FOUND','CONFLICT'].includes(e.code);return {ok:false,error:{code:known?e.code:'SERVER',message:known?e.message:'操作失败，请检查云环境配置或联系管理员；数据未确认保存'}};}
};
