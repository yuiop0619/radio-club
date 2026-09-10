# RADIO CLUB · 梦侦探鉴定机 MODEL RC-2006

> 一台 2006 年的伪科学机器。投一句话进去，它替你把牌抽了，吐出一份鉴定书。

一间只存在于网络上的酒吧。梦侦探萨弗兰用塔罗与精神分析，替来访者把线头理清楚。本站视觉与设定致敬今敏导演的《红辣椒》（パプリカ，2006）。

## 这是什么

首页摆着一台老机器，铭牌写着 **MODEL RC-2006**。它的用法只有两步：

1. **投币** —— 写下你最近想不通的那件事，一句话就够
2. **取纸** —— 机器运转几秒，替你把五张塔罗抽了，然后吐出一份《鉴定书》

原本「委托 → 塔罗 → 精神分析 → 鉴定」四步的流程，被这台机器压成了一步。**你唯一要做的动作，是投币。**

机器**不代做精神分析**。词联想与句子完成测试需要本人受诊，代做即是造假——缺席时鉴定书照常完整生成，只在那一栏标注「此项留空」，并相应下调置信度。

## 运行

推荐 Node.js 22.12+：

```sh
npm ci
npm start
# http://127.0.0.1:8080
```

`npm start` 先构建，再同时运行前端和 API。开发时另开终端运行 `npm run dev`，其 API 会转发到 8080。新版 Vue 页面需要构建，不能直接双击源 HTML。

纯静态部署上传 `dist/`，并关闭或单独配置服务连接；完整功能需要运行 Node 后端。具体步骤见 [新版功能与部署](docs/upgrades.md)。

## 功能与数据

- **鉴定机**：投一句话即出报告。机器替你抽五张牌并标注「非本人所抽，置信度下调」；输入过短会被拦下，不消耗机器。
- **委托**：昵称、正文与可选资料。编辑保留当前测试；「新建委托」生成新档案并清空当前测试，最近五份历史保存在本机，可在委托页恢复（委托与塔罗页已并入机器流程，移出导航，URL 仍可达）。
- **塔罗**：五张解读、三张时间线和每日一牌；翻牌进度可恢复，切换语言不重抽。
- **精神分析**：七位预设大师解梦、12 次词联想、6 道句子完成题。切换语言不清空输入，已保存的答案可恢复。
- **鉴定书**：依据统一档案生成，包含 SCT、正确牌阵位置和关键词证据；无需等台词播放完即可阅读，支持打印。
- **树洞**：进页自动连接公开服务，纸条默认按「公开投递」送出；把可见范围切回「仅本机」则只留在这台设备（切回后不再被默认值覆盖）。自动回声明确标为预设内容，不冒充真人。
- 中日切换、可跳过的打字效果、减少动态效果设置、键盘按钮与表单标签。

## 隐私和分享

委托和测试默认保存在浏览器中。新增「保存与同步」页面提供手动备份和恢复；上传需要主动连接并勾选同意，故事与探索原文默认不包含。浏览器清理站点数据会删除本机档案；写入失败会显示提示。

报告默认分享不含姓名、生日和原文的摘要；勾选完整档案后才包含原始资料。先查看预览，再复制链接。新链接用 `#c=` / `#n=` 片段承载数据，片段不随 HTTP 页面请求发送给服务器，但对页面脚本和链接持有人可见；Base64 不是加密。已分发的链接副本不能撤回。旧 `?c=` / `?n=` 链接停止解析并提示重新生成：浏览器首次请求已经可能发送旧查询数据，页面无法撤回该请求。

当前连接使用同站 Node 服务及 HttpOnly 会话。选择 CloudBase 部署时才加载其 SDK，身份恢复取决于对应登录配置。

站点已部署在 `http://101.42.158.132:8080`（nginx 8080，`/api/` 反代到本机 8091 的 rc-api）。接口的同源校验要求反代透传带端口的 Host：nginx 侧用 `proxy_set_header Host $http_host;` 与 `proxy_set_header X-Forwarded-Host $http_host;`，后端会优先读 `X-Forwarded-Host`/`X-Forwarded-Proto`，只丢端口的反代也能通过。若改为 `$host`，端口被剥掉会让浏览器请求被误判为跨站并返回 `ORIGIN_REJECTED`。CloudBase 是可选路线，见 [云端部署](docs/cloud-deployment.md)。旧版公开数据库必须由管理员迁移或关闭客户端直写权限。

## 叙事模型（可选）

鉴定书的文字可以由一台叙事模型来写。规则引擎负责给出结论（情感谱、命中的假说、牌阵、关键词证据），模型负责把它说成一段话。

> 原则：**规则负责「看到什么」，模型负责「怎么说」。**

```bash
cp .env.llm.example .env.llm   # 填入 RC_LLM_BASE_URL / RC_LLM_MODEL / RC_LLM_API_KEY
npm run deploy                 # 部署时自动上传到服务器，并挂 systemd drop-in
```

不配也能跑：未配置、超时或断网时，前端自动用本地模板拼一段附注，页面完整可用，**报告永不空白**。

## 目录

```text
*.html                 静态页面（13 页，导航 6 项；其余可达但移出主流程）
assets/js/machine.js   鉴定机：投币 → 运转日志 → 代抽塔罗 → 跳鉴定书
assets/js/model.js     档案版本、结构校验和字段边界
assets/js/store.js     本机存储、档案与历史
assets/js/share.js     片段链接、解析和复制
assets/js/engine.js    规则分析与报告模型
assets/js/*-page.js    页面控制器
assets/js/treehole*    本地纸条、公开操作与重试队列
assets/js/cloud-config.js  服务配置（默认同站 Node）
src/                   Vue / TypeScript 交互与状态（index / account / about2006）
server/                Node API、单进程持久化适配器与叙事模型层
  llm.cjs              统一模型调用（OpenAI 兼容；云 API 与本地推理共用）
  prompt.cjs           证据白名单裁剪 + 机器人格提示词
  interpret.cjs        证据 → 叙事，失败一律降级而不抛错
content/               叙事文案唯一来源（menu / masters / tarot / i18n / hypotheses）
tools/build-content.cjs  content/*.json → assets/js/content-bundle.js（构建期生成）
assets/js/interpret.js 前端接入叙事层：运转日志 → 逐字浮现，失败回退本地模板
assets/img/            原始素材及响应式衍生资源
cloudfunctions/treehole/  带鉴权、事务与幂等控制的云函数
tests/                 逻辑、浏览器回归及模拟数据库
tools/                 本地预览与素材处理
```

## 开发与检查

```sh
npm ci
npm test                 # 逻辑单测
npx playwright install chromium
npm run test:browser     # 原有页面回归
npm run test:second      # 冒烟
npm run test:upgrade     # 升级流程
npm run test:machine     # 鉴定机 + 导航契约
npm run test:ai          # 叙事层降级契约
npm run images           # 从清理后的原图生成 WebP 与会诊头像 PNG 回退
```

Node 内置测试覆盖模型、存储、服务端操作与叙事层降级；Playwright 覆盖原有页面、新版点菜/档案/恢复流程及鉴定机投币链路，测试使用隔离数据。CI 执行类型检查、构建、逻辑与浏览器回归。

修复依据、验证边界和资源指标见 [修复记录](docs/fixes.md)。

## 版权

本项目为《红辣椒》（今敏 / Madhouse / Sony Pictures Entertainment，2006）的同人致敬，仅用于学习与技术展示，不用于商业用途。原作角色和场景设定版权归原权利方所有。
