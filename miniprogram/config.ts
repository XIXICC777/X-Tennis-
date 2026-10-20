// 开箱为独立本地演示。使用真云环境时设为 cloud 并填写 envId。
// 云演示需部署独立环境并在云函数配置 DEMO_MODE=true；不可复用正式环境。
export const config: {mode:'local-demo'|'cloud';envId:string}={mode:'local-demo',envId:''};
