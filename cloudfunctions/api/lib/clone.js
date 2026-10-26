'use strict';
// Node.js 16.13 没有全局 structuredClone；V8序列化保留undefined、日期和Buffer。
const {serialize,deserialize}=require('node:v8');
function clone(value){return deserialize(serialize(value));}
module.exports={clone};
