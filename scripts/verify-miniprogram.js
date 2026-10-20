const fs=require('node:fs');
const path=require('node:path');
function verifyMiniprogram(root=path.join(__dirname,'../miniprogram')){
 root=path.resolve(root);
 const app=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8'));
 const visited=new Set();
 const walk=file=>{
  file=path.resolve(file);
  if(!file.startsWith(root+path.sep))throw Error('小程序模块超出项目目录：'+file);
  if(visited.has(file))return;
  if(!fs.existsSync(file))throw Error('缺少编译模块 '+path.relative(root,file)+'；请在项目根目录执行 npm run build，确认成功后再编译小程序。');
  visited.add(file);
  const source=fs.readFileSync(file,'utf8');
  for(const match of source.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)){
   if(!match[1].startsWith('.'))throw Error('存在尚未打包的小程序依赖：'+match[1]);
   const dependency=path.resolve(path.dirname(file),match[1]);
   walk(path.extname(dependency)?dependency:dependency+'.js');
  }
 };
 walk(path.join(root,'app.js'));
 for(const page of app.pages||[])walk(path.join(root,page+'.js'));
 return [...visited];
}
if(require.main===module){try{const files=verifyMiniprogram();console.log('小程序模块检查通过：'+files.length+'个模块（含 config.js），页面依赖完整。');}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={verifyMiniprogram};
