const {test}=require('node:test');const assert=require('node:assert/strict');
test('客户端保存失败明确报错、保留表单、不显示保存成功，重试沿用请求编号',async()=>{
 const payloads=[];global.wx={request(opts){payloads.push(opts.data);opts.success({statusCode:200,data:{ok:false,error:{message:'数据库写入失败'}}});},cloud:{async callFunction(opts){payloads.push(opts.data);return {result:{ok:false,error:{message:'数据库写入失败'}}};}},showToast(){}};
 let definition;global.Page=d=>{definition=d;};require('../miniprogram/pages/workspace/index.js');
 const state=structuredClone(definition.data);state.form={title:'尚未保存的输入'};
 const page={...definition,data:state,setData(patch){Object.assign(this.data,patch);}};
 assert.equal(await page.submit('communicationCreate',{studentId:'s01',text:'请回电'}),null);
 assert.match(page.data.error,/数据库写入失败/);assert.equal(page.data.notice,'');assert.equal(page.data.form.title,'尚未保存的输入');assert.equal(page.data.saving,false);
 await page.submit('communicationCreate',{studentId:'s01',text:'请回电'});assert.equal(payloads[0].input.requestId,payloads[1].input.requestId);
});
test('成绩筛选不补零，仅保留真实记录',()=>{let definition;global.Page=d=>definition=d;delete require.cache[require.resolve('../miniprogram/pages/workspace/index.js')];require('../miniprogram/pages/workspace/index.js');const page={...definition,data:{detail:{scores:[{id:'a',date:'2026-09-01',subject:'数学',type:'期中',score:70,full:100}]},subject:'英语',scoreType:'全部',rangeStart:'',rangeEnd:''},setData(p){Object.assign(this.data,p)},drawChart(){}};page.updateScores();assert.deepEqual(page.data.scoreRows,[]);page.data.subject='数学';page.updateScores();assert.equal(page.data.scoreRows.length,1);assert.equal(page.data.scoreRows[0].score,70);});
test('成绩表单空分数不能被数字转换成0',async()=>{let def;global.Page=d=>def=d;delete require.cache[require.resolve('../miniprogram/pages/workspace/index.js')];require('../miniprogram/pages/workspace/index.js');let called=false;const p={...def,data:{form:{base:{},fields:[{key:'score',name:'得分',type:'number',value:''}]}},setData(v){Object.assign(this.data,v)},submit(){called=true}};await p.saveForm();assert.equal(called,false);assert.match(p.data.formError,/不能记作零/);});
