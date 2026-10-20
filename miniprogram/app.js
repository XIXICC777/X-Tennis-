"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
App({ onLaunch() { if (config_1.config.mode === 'cloud' && config_1.config.envId)
        wx.cloud.init({ env: config_1.config.envId, traceUser: false }); } });
