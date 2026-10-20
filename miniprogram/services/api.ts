import {config} from '../config';
let persona='admin';
let pending:{action:string;payload:string;id:string}|null=null;
export function setPersona(value:string){persona=value;pending=null;}
export const isLocalDemo=()=>config.mode==='local-demo';
export async function api(action:string,input:any={}):Promise<any>{
 const reading=['session','dashboard','student','export','fileRead','contacts'].includes(action);
 const payload=JSON.stringify(input);
 if(!reading){if(!pending||pending.action!==action||pending.payload!==payload) pending={action,payload,id:Date.now()+'-'+Math.random().toString(36).slice(2)};input={...input,requestId:pending.id};}
 let result:any;
 try{
  if(config.mode==='local-demo')result=await new Promise((resolve,reject)=>wx.request({url:'http://127.0.0.1:8787/api',method:'POST',data:{action,input,demoPersona:persona},success:r=>r.statusCode===200?resolve(r.data):reject(new Error('演示服务器不可用')),fail:()=>reject(new Error('无法连接演示服务器，请先运行 npm run demo；真机请使用独立云演示环境'))}));
  else {if(!config.envId)throw new Error('尚未配置云环境ID');const r=await wx.cloud.callFunction({name:'api',data:{action,input,demoPersona:persona}});result=r.result;}
  if(!result?.ok)throw new Error(result?.error?.message||'请求失败，未确认保存');
  if(!reading)pending=null;return result.data;
 }catch(e){throw e instanceof Error?e:new Error('网络异常，未确认保存，请重试');}
}
