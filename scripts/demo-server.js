// 独立本地演示：不是微信云环境，也不承载真实学生信息。
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {MemoryStore}=require('../cloudfunctions/api/lib/memory');
const {createService}=require('../cloudfunctions/api/lib/domain');
const {demoSeed}=require('../cloudfunctions/api/lib/seed');
const dir=process.env.ZIMO_DEMO_DIR||'/tmp/zimo-school-demo';fs.mkdirSync(dir,{recursive:true,mode:0o700});
const file=path.join(dir,'state.json');
const store=new MemoryStore(fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):demoSeed(),async data=>{fs.writeFileSync(file+'.tmp',JSON.stringify(data),{mode:0o600});fs.renameSync(file+'.tmp',file);});
const api=createService(store,{namespace:'demo',putFile:async(p,b)=>{const id=require('node:crypto').randomUUID();fs.writeFileSync(path.join(dir,id),b,{mode:0o600});return id;},getFile:async id=>fs.readFileSync(path.join(dir,path.basename(id))).toString('base64')});
const personas={admin:'demo-admin',teacher:'demo-teacher',parent:'demo-parent',other:'demo-other'};
const server=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 if(req.method==='GET'&&req.url==='/health'){res.end(JSON.stringify({ok:true,mode:'fictional-demo',storage:'server-json'}));return;}
 if(req.method!=='POST'||req.url!=='/api'){res.writeHead(404);res.end('{}');return;}
 try{
  let chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>900000)throw new Error('请求过大');chunks.push(chunk);}
  const event=JSON.parse(Buffer.concat(chunks).toString());const who=personas[event.demoPersona]||'demo-parent';
  const data=await api(who,event.action,event.input||{});res.end(JSON.stringify({ok:true,data,demo:true}));
 }catch(e){res.end(JSON.stringify({ok:false,error:{code:e.code||'SERVER',message:e.message}}));}
});
server.listen(Number(process.env.PORT||8787),'127.0.0.1',()=>process.stdout.write('子墨学堂虚构演示服务已启动，端口 '+server.address().port+'；不用于真实学生数据。\n'));
