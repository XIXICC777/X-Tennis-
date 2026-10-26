// 当前连接用户指定的微信云环境；AppID需在开发者工具中填写真实注册账号。
// 此阶段请在独立演示环境部署 api 并设置 DEMO_MODE=true，不录入真实学生资料。
// 如需电脑本地演示，可改回 mode: 'local-demo' 并运行 npm run demo。
export const config: {mode:'local-demo'|'cloud';envId:string}={mode:'cloud',envId:'cx100-d3ga3i1ljcfc054ca'};
