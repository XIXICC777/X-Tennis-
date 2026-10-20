const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {verifyMiniprogram}=require('../scripts/verify-miniprogram');
const root=path.join(__dirname,'../miniprogram');
test('发布模块检查发现缺失的config.js并阻止不完整构建',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zimo-bundle-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 fs.cpSync(root,temp,{recursive:true});assert.equal(verifyMiniprogram(temp).length,4);
 fs.unlinkSync(path.join(temp,'config.js'));assert.throws(()=>verifyMiniprogram(temp),/缺少编译模块 config\.js/);
});
test('使用独立模块注册表加载已编译App和Page，配置依赖完整且可启动',()=>{
 const files=verifyMiniprogram(root);const registry=new Map(files.map(f=>[path.relative(root,f).split(path.sep).join('/'),fs.readFileSync(f,'utf8')]));
 const cache=new Map();let app,page;
 function load(name){if(cache.has(name))return cache.get(name).exports;const source=registry.get(name);if(!source)throw Error(`module '${name}' is not defined`);const mod={exports:{}};cache.set(name,mod);
  const requireLocal=request=>{let target=path.posix.normalize(path.posix.join(path.posix.dirname(name),request));if(!target.endsWith('.js'))target+='.js';return load(target);};
  vm.runInNewContext(source,{module:mod,exports:mod.exports,require:requireLocal,App:d=>app=d,Page:d=>page=d,wx:{},console,setTimeout,clearTimeout},{filename:name});return mod.exports;
 }
 load('app.js');load('pages/workspace/index.js');assert.equal(typeof app.onLaunch,'function');assert.doesNotThrow(()=>app.onLaunch());assert.equal(page.data.demo,true);assert.equal(typeof page.refresh,'function');assert.equal(cache.get('config.js').exports.config.mode,'local-demo');
});
