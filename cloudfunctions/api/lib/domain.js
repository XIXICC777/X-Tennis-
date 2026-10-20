'use strict';
const crypto = require('node:crypto');
const subjects = ['语文','数学','英语'];
const statuses = ['待核实','未开始','进行中','待检查','检查通过','订正中','订正已复核','有遗留事项'];
const results = ['未验证','独立通过','提示后完成','仍需支持'];
const tables = ['users','schools','classes','groups','students','bindings','invites','homework','tasks','attendance','mistakes','reviews','scores','feedback','goals','progress','handoffs','communications','emotions','files','audit','requests'];
const hash = x => crypto.createHash('sha256').update(String(x)).digest('hex');
const day = () => new Date(Date.now()+8*3600000).toISOString().slice(0,10);
function fail(message, code='INVALID') { throw Object.assign(new Error(message), {code}); }
function required(v, name, max=2000) { if(typeof v !== 'string'||!v.trim()||v.length>max) fail(`请填写${name}（最多${max}字）`); return v.trim(); }
function date(v) { if(!/^\d{4}-\d{2}-\d{2}$/.test(v||'') || new Date(v).toISOString().slice(0,10)!==v) fail('日期格式应为 YYYY-MM-DD'); return v; }
function pick(o,keys) { return Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]])); }
function createService(store, options={}) {
 return async function execute(openid, action, input={}) {
  if(!openid) fail('请在微信内登录','AUTH');
  if(!tables.length) fail('未初始化');
  return store.transaction(async tx => {
   const namespace=options.namespace||'live';
   const uid=hash(namespace+':'+openid).slice(0,32);
   let user=await tx.get('users',uid);
   if(!user) {user={id:uid,openid,roles:['parent'],name:'新家长',enabled:true};await tx.set('users',uid,user);}
   if(user.enabled===false) fail('账号已停用','FORBIDDEN');
   const admin=user.roles.includes('admin');
   const staff=admin||user.roles.some(x=>['teacher','lead'].includes(x));
   const get=async(t,id)=>{const r=await tx.get(t,id);if(!r) fail('记录不存在','NOT_FOUND');return r;};
   const list=(t,filter={})=>tx.list(t,filter);
   const write=async(t,id,data)=>tx.set(t,id,{...data,id,updatedAt:new Date().toISOString()});
   const canStudent=async(id,edit=false,subject=null)=>{
    const s=await get('students',id);
    if(admin) return s;
    if(staff) {
     if(!edit) return s;
     if(s.leadId===uid||s.assignments?.[subject]===uid) return s;
     if(!subject&&Object.values(s.assignments||{}).includes(uid)) return s;
    } else if(!edit) {
     const b=await tx.get('bindings',hash(id+':'+uid).slice(0,32));
     if(b?.verified&&b.active) return s;
    }
    fail('无权访问该学生或学科','FORBIDDEN');
   };
   const lead=async id=>{const s=await canStudent(id,true);if(!admin&&s.leadId!==uid) fail('仅主责老师可确认发布或处理此事项','FORBIDDEN');return s;};
   const requireAdmin=()=>{if(!admin) fail('仅机构管理员可操作','FORBIDDEN');};
   const requireStaff=()=>{if(!staff) fail('仅老师可操作','FORBIDDEN');};
   const snapshot=s=>pick(s,['schoolId','classId','grade','schoolYear']);
   const mutate=!['session','dashboard','student','export','fileRead','contacts'].includes(action);
   const requestId=input.requestId;
   let requestKey;
   if(mutate) {
    required(requestId,'请求编号',100);
    requestKey=hash(uid+':'+requestId);
    const existing=await tx.get('requests',requestKey);
    if(existing) {if(existing.action!==action||existing.payload!==hash(JSON.stringify(input))) fail('请求编号冲突');return existing.result;}
   }
   let result,auditChange;
   switch(action) {
    case 'session': result={user:pick(user,['id','name','roles']),demo:namespace==='demo',today:day()};break;
    case 'register':
     await write('users',uid,{...user,name:required(input.name,'称呼',40)}); result={id:uid};break;
    case 'adminSave': {
     requireAdmin(); const t=input.table; const allowed={schools:['name'],groups:['name'],classes:['schoolId','grade','name','schoolYear'],users:['name','roles','enabled'],students:['number','name','schoolId','classId','grade','schoolYear','groupId','leadId','assignments','active']};
     if(!allowed[t]) fail('不可管理此表');
     const data=pick(input.record||{},allowed[t]);const id=input.id||crypto.randomUUID();
     const prev=await tx.get(t,id);
     const r={...prev,...data};
     required(r.name||r.number,'名称或编号',60);
     if(t==='users') {
      if(!prev) fail('员工须先登录并提供账号编号，再由管理员授权');
      if(!Array.isArray(r.roles)||r.roles.some(x=>!['parent','teacher','lead','admin'].includes(x))) fail('角色无效');
      if(id===uid&&(!r.roles.includes('admin')||r.enabled===false)) fail('不能取消自己的管理员权限');
     }
     if(t==='classes'||t==='students') {
      await get('schools',r.schoolId); if(!Number.isInteger(r.grade)||r.grade<1||r.grade>6) fail('年级必须为1至6'); date(`${r.schoolYear}-09-01`);
     }
     if(t==='students') {
      const c=await get('classes',r.classId); if(c.schoolId!==r.schoolId||c.grade!==r.grade||c.schoolYear!==r.schoolYear) fail('学校、年级、学年与班级不一致');
      await get('groups',r.groupId); const teacher=await get('users',r.leadId);
      if(!teacher.enabled||!teacher.roles.some(x=>['teacher','lead','admin'].includes(x))) fail('主责老师无效');
      for(const subject of subjects) {const u=await get('users',r.assignments?.[subject]);if(!u.enabled||!u.roles.some(x=>['teacher','lead','admin'].includes(x))) fail('请为三科分配有效老师');}
      required(r.number,'学生编号',40);
      if((await list('students',{number:r.number})).some(s=>s.number===r.number&&s.id!==id)) fail('学生编号重复');
     }
     auditChange={before:pick(prev||{},allowed[t]),after:pick(r,allowed[t])};await write(t,id,r);result={id};break;
    }
    case 'inviteCreate': {
     await lead(input.studentId); const code=crypto.randomBytes(16).toString('hex');
     await write('invites',hash(code),{studentId:input.studentId,expiresAt:Date.now()+24*3600000,used:false,createdBy:uid});result={code,expiresIn:'24小时；申请后仍须机构核验'};break;
    }
    case 'inviteClaim': {
     const id=hash(required(input.code,'邀请码',64));const inv=await get('invites',id);
     if(inv.used||inv.expiresAt<Date.now()) fail('邀请已使用或已过期');
     await write('invites',id,{...inv,used:true,claimedBy:uid});
     await write('users',uid,user);
     await write('bindings',hash(inv.studentId+':'+uid).slice(0,32),{studentId:inv.studentId,userId:uid,verified:false,active:false,relationship:required(input.relationship,'与孩子的关系',20),phone:required(input.phone,'联系电话',30)});
     result={message:'申请已提交，等待机构核验'};break;
    }
    case 'bindingVerify': {
     const b=await get('bindings',input.id);await lead(b.studentId);
     required(input.evidence,'线下核验说明',300);
     await write('bindings',b.id,{...b,verified:input.approve===true,active:input.approve===true,verifiedBy:uid,evidence:input.evidence});result={id:b.id};break;
    }
    case 'bindingRevoke': {const b=await get('bindings',input.id);await lead(b.studentId);await write('bindings',b.id,{...b,active:false});result={id:b.id};break;}
    case 'publishHomework': {
     requireStaff();date(input.date);if(!subjects.includes(input.subject)) fail('科目无效');
     const c=await get('classes',input.classId);const ids=[...new Set(input.studentIds||[])];if(!ids.length||ids.length>60) fail('请选择1至60位学生');
     const students=[];for(const id of ids){const s=await canStudent(id,true,input.subject);if(s.classId!==c.id||!s.active) fail('学生不属于此班级或已停读');students.push(s);}
     const h={classId:c.id,schoolId:c.schoolId,grade:c.grade,schoolYear:c.schoolYear,date:input.date,subject:input.subject,content:required(input.content,'作业内容'),source:input.source?.trim()||'待核实',verified:input.verified===true&&!!input.source?.trim(),revision:1,createdBy:uid};
     const matched=(await list('homework',{classId:c.id,date:h.date,subject:h.subject})).find(x=>x.content===h.content&&x.source===h.source);
     const id=matched?.id||hash([c.id,h.date,h.subject,h.content,h.source].join('\n')).slice(0,32);const existing=await tx.get('homework',id);
     if(existing&&existing.content!==h.content)fail('这份作业已经修订，请使用已有作业，避免重复发布');
     if(!existing)await write('homework',id,h);let createdCount=0;
     for(const s of students) {const taskId=hash(id+':'+s.id).slice(0,32);if(await tx.get('tasks',taskId))continue;createdCount++;await write('tasks',taskId,{studentId:s.id,homeworkId:id,...snapshot(s),date:h.date,subject:h.subject,status:h.verified?'未开始':'待核实',help:false,version:1});}
     result={id,count:ids.length,createdCount};break;
    }
    case 'reviseHomework': {
     requireStaff();const h=await get('homework',input.id);const affected=await list('tasks',{homeworkId:h.id});
     for(const t of affected) await canStudent(t.studentId,true,h.subject);
     if(input.confirm!==true) fail('请明确确认受影响学生后修改');
     if(input.version!==h.revision) fail('作业已更新，请刷新','CONFLICT');
     await write('homework',h.id,{...h,content:required(input.content,'作业内容'),revision:h.revision+1,history:[...(h.history||[]),{content:h.content,revision:h.revision,by:uid,at:new Date().toISOString()}]});
     result={affected:affected.map(t=>t.studentId)};break;
    }
    case 'taskUpdate': {
     const t=await get('tasks',input.id);await canStudent(t.studentId,true,t.subject);
     if(input.version!==t.version) fail('记录已被更新，请刷新后重试','CONFLICT');
     const next=pick(input,['status','help','exception','note']);
     if(next.status&&!statuses.includes(next.status)) fail('任务状态无效');
     const transitions={'待核实':['未开始','有遗留事项'],'未开始':['进行中','待检查','有遗留事项'],'进行中':['待检查','有遗留事项'],'待检查':['检查通过','订正中','有遗留事项'],'检查通过':['订正中','有遗留事项'],'订正中':['订正已复核','有遗留事项'],'订正已复核':['订正中','有遗留事项'],'有遗留事项':['进行中','待检查','订正中']};
     if(next.status&&next.status!==t.status&&!transitions[t.status]?.includes(next.status)) fail('请按核实、完成、检查和复核的顺序记录');
     if(['检查通过','订正已复核'].includes(next.status)&&input.confirm!==true) fail('检查或复核需要老师明确确认');
     if(next.status==='未开始') {const h=await get('homework',t.homeworkId);if(!h.verified&&input.confirm!==true) fail('请先明确核实作业来源');}
     if(next.help!==undefined&&typeof next.help!=='boolean') fail('帮助标记无效');
     if(next.note!==undefined&&String(next.note).length>1000) fail('备注过长');
     if(next.exception!==undefined&&!['','分层作业','请假补做','免做','个人订正','约定家庭加练'].includes(next.exception)) fail('个人例外无效');
     auditChange={before:pick(t,['status','help','exception','note','version']),after:{...next,version:t.version+1}};
     await write('tasks',t.id,{...t,...next,version:t.version+1,changedBy:uid,...(['检查通过','订正已复核'].includes(next.status)?{confirmedBy:uid,confirmedAt:new Date().toISOString()}: {})});result={id:t.id};break;
    }
    case 'attendanceSave': {
     await canStudent(input.studentId,true); date(input.date);if(!['未到店','已到店','已离店','请假'].includes(input.status)) fail('到店状态无效');
     const id=hash(input.studentId+':'+input.date).slice(0,32);const old=await tx.get('attendance',id);
     await write('attendance',id,{...old,studentId:input.studentId,date:input.date,status:input.status,...(input.status==='已到店'?{arrivedAt:new Date().toISOString()}:{}),...(input.status==='已离店'?{leftAt:new Date().toISOString()}:{}),by:uid});result={id};break;
    }
    case 'mistakeSave': {
     await canStudent(input.studentId,true,input.subject);if(!subjects.includes(input.subject)||!results.includes(input.result)) fail('科目或验证结果无效');
     date(input.date);date(input.reviewDate);const id=crypto.randomUUID();
     if(input.fileId){const f=await get('files',input.fileId);if(f.studentId!==input.studentId) fail('附件不属于该学生');}
     await write('mistakes',id,{...pick(input,['studentId','subject','date','location','fileId','knowledge','symptom','support','result','reviewDate']),knowledge:required(input.knowledge,'知识点',150),symptom:required(input.symptom,'错误表现',500),support:required(input.support,'提示或补讲',500),location:required(input.location||'见附件','题目位置',300),ownerId:uid,closed:false});result={id};break;
    }
    case 'reviewSave': {
     const m=await get('mistakes',input.id);await canStudent(m.studentId,true,m.subject);if(!results.includes(input.result)) fail('验证结果无效');
     if(input.close&&!['独立通过','提示后完成'].includes(input.result)) fail('仍需支持时不能结束跟进');
     if(!input.close) date(input.nextDate);
     const id=crypto.randomUUID();await write('reviews',id,{mistakeId:m.id,studentId:m.studentId,date:day(),result:input.result,note:required(input.note,'复查说明',500),by:uid});
     await write('mistakes',m.id,{...m,closed:input.close===true,reviewDate:input.close?m.reviewDate:input.nextDate,lastResult:input.result});result={id};break;
    }
    case 'scoreSave': {
     const s=await canStudent(input.studentId,true,input.subject);date(input.date);
     if(!subjects.includes(input.subject)||!['单元测验','期中','期末','其他'].includes(input.type)) fail('科目或考试类型无效');
     if(!Number.isFinite(input.score)||!Number.isFinite(input.full)||input.full<=0||input.score<0||input.score>input.full) fail('请输入真实得分和满分，缺失成绩请勿录入');
     const id=crypto.randomUUID();await write('scores',id,{...pick(input,['studentId','subject','date','type','score','full','scope','note']),name:required(input.name,'考试名称',80),source:required(input.source,'成绩来源',200),verified:input.verified===true,...snapshot(s),by:uid});result={id};break;
    }
    case 'goalSave': case 'handoffSave': case 'progressSave': case 'emotionSave': {
     await lead(input.studentId);date(input.date);let id=crypto.randomUUID();let t,data;
     if(action==='goalSave'){t='goals';const d=new Date(input.date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));const week=d.toISOString().slice(0,10);id=hash(input.studentId+':'+week).slice(0,32);data={goal:required(input.goal,'可观察的周目标',300),endDate:date(input.endDate)};if(input.endDate<input.date||(new Date(input.endDate)-d)/86400000>6)fail('目标结束日期须在本周内且不早于开始日期');}
     if(action==='handoffSave'){t='handoffs';const owner=await get('users',input.ownerId);if(!owner.enabled||!owner.roles.some(r=>['teacher','lead','admin'].includes(r)))fail('交接负责人必须是有效老师');data={issue:required(input.issue,'遗留事项',500),reason:required(input.reason,'原因',300),next:required(input.next,'下一步',500),ownerId:input.ownerId,dueDate:date(input.dueDate),closed:false};}
     if(action==='progressSave'){t='progress';const before=await get('reviews',input.beforeId),after=await get('reviews',input.afterId);if(before.studentId!==input.studentId||after.studentId!==input.studentId||before.id===after.id||before.date>after.date) fail('请关联该学生两条不同的复查记录');data={text:required(input.text,'具体变化',500),beforeId:before.id,afterId:after.id};}
     if(action==='emotionSave'){t='emotions';data={internal:required(input.internal,'可观察事实及已采取的支持',1000),parentText:input.parentText||''};if(/懒惰|摆烂|问题儿童/.test(data.internal+data.parentText)) fail('请描述可观察事实，避免给孩子贴标签');}
     await write(t,id,{studentId:input.studentId,date:input.date,...data,by:uid});result={id};break;
    }
    case 'handoffClose': {const h=await get('handoffs',input.id);await lead(h.studentId);await write('handoffs',h.id,{...h,closed:true,result:required(input.result,'处理结果',500)});result={id:h.id};break;}
    case 'feedbackDraft': {
     await lead(input.studentId);date(input.date);const kind=input.kind==='weekly'?'weekly':'daily';const start=kind==='weekly'?date(input.startDate):input.date;if(start>input.date) fail('起始日期晚于结束日期');
     const tasks=(await list('tasks',{studentId:input.studentId})).filter(t=>t.date>=start&&t.date<=input.date);
     const cards=(await list('progress',{studentId:input.studentId})).filter(t=>t.date>=start&&t.date<=input.date);
     const issues=await list('handoffs',{studentId:input.studentId,closed:false});
     const followups=kind==='weekly'?await list('mistakes',{studentId:input.studentId,closed:false}):[];
     const id=hash(input.studentId+':'+kind+':'+input.date).slice(0,32);const old=await tx.get('feedback',id);if(old?.published) fail('已发布反馈不能被草稿覆盖');
     await write('feedback',id,{studentId:input.studentId,date:input.date,startDate:start,kind,published:false,version:(old?.version||0)+1,taskIds:tasks.map(t=>t.id),text:`${kind==='weekly'?'本周':'今日'}进度：\n${tasks.map(t=>`${t.date} ${t.subject}：${t.status}${t.help?'（需要帮助）':''}`).join('\n')||'尚无作业记录，请先核对。'}\n具体收获：${cards.map(c=>c.text).join('；')||'尚无已关联记录的进步说明。'}\n遗留事项：${issues.map(h=>`${h.issue}；下一步：${h.next}（${h.dueDate}）`).join('；')||'暂无已记录事项。'}\n必要状态说明：由主责老师补充。\n家庭配合：由主责老师确认。${kind==='weekly'?`\n重点及反复问题参考：${followups.map(m=>m.knowledge+'（当前跟进中）').join('；')||'暂无未结束的跟进卡，需老师核对。'}\n下周重点：由主责老师核对记录后填写，不自动判断长期掌握。`:''}`,by:uid});result={id};break;
    }
    case 'feedbackPublish': {
     const f=await get('feedback',input.id);await lead(f.studentId);if(input.confirm!==true) fail('发布前须明确确认');if(input.version!==f.version) fail('草稿已变化，请刷新','CONFLICT');if(f.published) fail('反馈已经发布');
     await write('feedback',f.id,{...f,text:required(input.text,'反馈正文',6000),published:true,version:f.version+1,publishedBy:uid,publishedAt:new Date().toISOString()});result={id:f.id};break;
    }
    case 'feedbackRead': {
     const f=await get('feedback',input.id);await canStudent(f.studentId);if(!f.published) fail('反馈尚未发布','FORBIDDEN');
     await write('feedback',f.id,{...f,readBy:{...f.readBy,[uid]:new Date().toISOString()}});result={id:f.id};break;
    }
    case 'communicationCreate': {
     await canStudent(input.studentId);const s=await get('students',input.studentId);const id=crypto.randomUUID();await write('communications',id,{studentId:s.id,text:required(input.text,'沟通内容',1000),from:uid,ownerId:s.leadId,closed:false,date:day()});result={id};break;
    }
    case 'communicationClose': {
     const c=await get('communications',input.id);await lead(c.studentId);await write('communications',c.id,{...c,closed:true,result:required(input.result,'处理结果',1000),by:uid});result={id:c.id};break;
    }
    case 'contacts': {
     await lead(input.studentId);result=(await list('bindings',{studentId:input.studentId,active:true,verified:true})).map(b=>pick(b,['relationship','phone']));break;
    }
    case 'fileUpload': {
     await canStudent(input.studentId,true,input.subject);if(!subjects.includes(input.subject)) fail('科目无效');
     if(!options.putFile) fail('文件服务未配置');
     const raw=required(input.base64,'图片',700000);const buf=Buffer.from(raw,'base64');if(buf.length>500000||buf.length<12) fail('图片应小于500KB');
     const jpeg=buf[0]===255&&buf[1]===216&&buf[2]===255;const png=buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));if(!jpeg&&!png) fail('仅支持JPEG或PNG图片');
     const id=crypto.randomUUID();const storageId=await options.putFile(`${namespace}/${input.studentId}/${id}.${jpeg?'jpg':'png'}`,buf);
     await write('files',id,{studentId:input.studentId,subject:input.subject,storageId,by:uid});result={id};break;
    }
    case 'fileRead': {
     const f=await get('files',input.id);await canStudent(f.studentId);if(!options.getFile) fail('文件服务未配置');
     // 不返回云存储ID或可转发的临时URL；每次下载通过已鉴权函数返回受限字节。
     result={base64:await options.getFile(f.storageId)};break;
    }
    case 'student': case 'export': {
     const s=await canStudent(input.studentId);const names=['tasks','homework','attendance','mistakes','reviews','scores','feedback','goals','progress','handoffs','communications'];result={student:pick(s,['id','number','name','schoolId','classId','grade','schoolYear','groupId','leadId','active']),updatedAt:new Date().toISOString()};
     for(const t of names){let rows;if(t==='homework'){const ts=await list('tasks',{studentId:s.id});rows=[];for(const id of new Set(ts.map(x=>x.homeworkId)))rows.push(await get('homework',id));}else rows=await list(t,{studentId:s.id});
      if(!staff&&t==='feedback') rows=rows.filter(x=>x.published);
      if(!staff&&t==='communications') rows=rows.filter(x=>x.from===uid);
      result[t]=rows;
     }
     if(staff&&(admin||s.leadId===uid||Object.values(s.assignments||{}).includes(uid))) {result.student.assignments=s.assignments;result.emotions=await list('emotions',{studentId:s.id});result.bindings=(await list('bindings',{studentId:s.id})).map(b=>pick(b,['id','userId','relationship','verified','active']));}
     break;
    }
    case 'dashboard': {
     date(input.date||day());const selectedDate=input.date||day();let students=staff?await list('students',{active:true}):[];
     if(!staff){const bs=await list('bindings',{userId:uid,verified:true,active:true});for(const b of bs)students.push(await get('students',b.studentId));}
     if(staff) students=students.filter(s=>s.active);
     for(const k of ['schoolId','classId','grade','leadId','groupId']) if(input[k]) students=students.filter(s=>s[k]===input[k]);
     const ids=new Set(students.map(s=>s.id));const ts=(await list('tasks',{date:selectedDate})).filter(t=>ids.has(t.studentId)&&(!input.subject||t.subject===input.subject));
     result={date:selectedDate,user:pick(user,['id','name','roles']),students:students.map(s=>pick(s,['id','number','name','schoolId','classId','grade','schoolYear','groupId','leadId','assignments','active'])),tasks:ts,attendance:(await list('attendance',{date:selectedDate})).filter(a=>ids.has(a.studentId)),due:(await list('mistakes',{closed:false})).filter(m=>ids.has(m.studentId)&&m.reviewDate<=selectedDate),handoffs:(await list('handoffs',{closed:false})).filter(m=>ids.has(m.studentId)),communications:(await list('communications',{closed:false})).filter(m=>ids.has(m.studentId)&&(staff||m.from===uid)),schools:await list('schools'),classes:await list('classes'),groups:await list('groups'),updatedAt:new Date().toISOString()};
     if(staff) {result.homework=await list('homework',{date:selectedDate});result.teachers=(await list('users')).filter(u=>u.roles.some(r=>['teacher','lead','admin'].includes(r))).map(u=>pick(u,['id','name','roles','enabled']));}
     break;
    }
    default: fail('接口不存在','NOT_FOUND');
   }
   if(mutate) {
    await write('audit',crypto.randomUUID(),{actor:uid,action,target:input.id||input.studentId||result.id||'',at:new Date().toISOString(),...(auditChange?{change:auditChange}:{})});
    await write('requests',requestKey,{action,payload:hash(JSON.stringify(input)),result,actor:uid});
   }
   return result;
  });
 };
}
module.exports={createService,tables,hash,day,subjects,statuses};
