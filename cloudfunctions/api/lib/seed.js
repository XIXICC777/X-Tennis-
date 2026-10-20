const {hash,day,subjects}=require('./domain');
function demoSeed(){
 const uid=x=>hash('demo:'+x).slice(0,32);const a=uid('demo-admin'),t=uid('demo-teacher'),p=uid('demo-parent'),p2=uid('demo-other');const today=day();
 const seed={users:{},schools:{},classes:{},groups:{},students:{},bindings:{},homework:{},tasks:{},scores:{},mistakes:{}};
 for(const [openid,name,roles] of [['demo-admin','演示·周老师',['admin','teacher','lead']],['demo-teacher','演示·林老师',['teacher']],['demo-parent','演示·小禾家长',['parent']],['demo-other','演示·另一位家长',['parent']]])seed.users[uid(openid)]={id:uid(openid),openid,name,roles,enabled:true};
 seed.schools.s1={id:'s1',name:'演示·向阳小学'};seed.schools.s2={id:'s2',name:'演示·育才小学'};
 for(const [id,schoolId,grade,name] of [['c1','s1',3,'三年一班'],['c2','s1',3,'三年二班'],['c3','s2',4,'四年一班']]) seed.classes[id]={id,schoolId,grade,name,schoolYear:2026};
 seed.groups.g1={id:'g1',name:'演示·周一至五晚托'};seed.groups.g2={id:'g2',name:'演示·周末组'};
 for(const [id,name,classId,schoolId,grade] of [['s01','小禾','c1','s1',3],['s02','小川','c1','s1',3],['s03','小宁','c2','s1',3],['s04','小星','c3','s2',4]]) seed.students[id]={id,name,number:'ZM'+id,schoolId,classId,grade,schoolYear:2026,groupId:id==='s04'?'g2':'g1',leadId:a,assignments:{语文:a,数学:t,英语:a},active:true};
 for(const [studentId,userId] of [['s01',p],['s03',p],['s02',p2]]){const id=hash(studentId+':'+userId).slice(0,32);seed.bindings[id]={id,studentId,userId,verified:true,active:true,relationship:'监护人',phone:'13800000000'};}
 for(const subject of subjects){const h='h'+subject;seed.homework[h]={id:h,classId:'c1',schoolId:'s1',grade:3,schoolYear:2026,date:today,subject,content:subject==='数学'?'课本第32页第1、2题':'课本朗读与练习（虚构演示）',source:'演示学校作业单',verified:true,revision:1};for(const studentId of ['s01','s02']){const id=h+studentId;seed.tasks[id]={id,studentId,homeworkId:h,classId:'c1',schoolId:'s1',grade:3,schoolYear:2026,date:today,subject,status:subject==='数学'?'待检查':'未开始',help:false,version:1,updatedAt:new Date().toISOString(),...(studentId==='s02'&&subject==='英语'?{exception:'请假补做',note:'周末补做（演示）'}:{})};}}
 for(let i=0;i<3;i++){const id='score'+i;seed.scores[id]={id,studentId:'s01',date:`2026-09-${10+i*7}`,subject:'数学',name:'演示单元'+(i+1),type:'单元测验',score:[76,82,80][i],full:100,source:'虚构演示成绩单',verified:true,classId:'c1',schoolId:'s1',grade:3,schoolYear:2026};}
 seed.mistakes.m1={id:'m1',studentId:'s01',date:today,subject:'数学',location:'第32页第2题',knowledge:'数量关系',symptom:'未区分总数与每份数',support:'画线段图后再列式',result:'提示后完成',reviewDate:'2026-09-01',ownerId:t,closed:false};
 return seed;
}
module.exports={demoSeed};
