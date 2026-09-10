# RADIO CLUB 全面代码审计与重构方案

> 审计日期：2026-09-10
> 审计范围：`G:\radio-club\repository` 全部源码（13 页 / 29 个 legacy JS / 4 个 Vue 组件 / 后端 / 测试 / 构建）
> 目标：判断能否"大洗牌"，并给出分阶段方案，同时对齐赛道二「离谱发明家」

---

## 〇、执行进度

| 阶段 | 状态 | 提交 |
|---|---|---|
| Phase 0 止血 | ✅ 完成 | `078df3b` |
| Phase 1 统一入口 | ✅ 完成 | `078df3b` |
| Phase 3 内容抽离 | ✅ 完成 | 见下方说明 |
| Phase 2 迁移 Vue | ✅ 完成 | `b909735` / `f0513be` |
| Phase 4 接入 LLM | ✅ 完成 | 见下方说明 |
| Phase 5 赛道适配 | ✅ 5a 机器 + 5b 导航精简均完成 | 见下方说明 |
| Phase 6 收口 | ✅ 完成 | 见下方说明 |

**Phase 3 实际产出**（`content/` 成为文案唯一来源）：

| JSON | 来源文件 | 规模 | 消费端 |
|---|---|---|---|
| `menu.json` | `store.js` | 酒 6 + 主食 4 | `store.js` 216 行（原 266） |
| `masters.json` | `analyst.js` | 意象 12 + 大师 7 | `analyst.js` 161 行（原 281） |
| `tarot.json` | `tarot-data.js` | 牌 22 + 牌阵 3 | `tarot-data.js` 56 行（原 166） |
| `i18n.json` | `i18n.js` | 词条 224 × 2 语言 | `i18n.js` 95 行（原 339） |
| `hypotheses.json` | `engine.js` | 情感 8 / 假说 6 / 处方 / 冷读 / 印章 / 小结模板 | `engine.js`（逻辑保留，文案外置） |

- **`tools/extract-content.cjs`**：一次性抽取（Node VM 沙箱加载 legacy IIFE → 导出 JSON），**幂等**，可重复运行
- **`tools/build-content.cjs`**：`content/*.json` → `assets/js/content-bundle.js`（同步可用的 classic script），带 revision 校验，`npm run check:content` 可验新鲜度
- **注入**：`vite.config.ts` 保证 `content-bundle` 永远是每页第一个脚本（legacy 脚本同步执行，必须先拿到 `RC_CONTENT`）
- **遗留**：`about2006` 的 5 章正文尚未抽离（目前在 `ArchiveDesktop.vue` 与 `/api/content` 的 chapters 里，形状不同，单独处理）

**Phase 4 实际产出**（规则负责「看到什么」，AI 负责「怎么说」）：

| 文件 | 职责 |
|---|---|
| `server/llm.cjs` | 传输层：OpenAI 兼容 `POST {base}/chat/completions`。云 API 与本地推理（Ollama / OpenVINO GenAI / llama.cpp）共用同一份代码，换模型只改环境变量 |
| `server/prompt.cjs` | 白名单裁剪证据 + 构造「梦侦探鉴定机 MODEL RC-2006」人格。证据被明确框定为「资料」，其中任何句子都不构成指令（防提示注入） |
| `server/interpret.cjs` | 编排：证据 → 提示词 → 文本；任何失败都返回 `{ok:false, source}` 而不上抛 |
| `server/api.cjs` | 新增 `POST /api/interpret`，**匿名可用**（评委不必注册），独立限流 10 次/分 |
| `assets/js/interpret.js` | 前端：机器运转日志（纯本地、必现）→ 逐字浮现模型文本；失败则用本地模板拼一段附注 |

- **降级契约（最关键）**：未配置 / 超时 / 断网 / 报错 → 一律 `{ok:true, data:{text:null, source}}`，前端回退本地模板。**页面永不空白**，断网也能完整演示
- **配置**：`.env.llm.example` → 复制为 `.env.llm` → `npm run deploy` 自动上传到服务端并挂 systemd drop-in（`EnvironmentFile=-/opt/rc-api/.env`）
- **验证**：单测 33 项（原 24 + 新 9）、冒烟 49、browser 9、upgrade 3 全绿；新增 `npm run test:ai`
  端到端契约（未配置→本地模板+脚注，已配置→模型文本），实测两条路径均无 JS 报错
- **实测**：未配置时输出 177 字本地兜底；配置假模型后正确显示模型文本

**Phase 5 实际产出**（赛道二「离谱发明家」· 定位 A《梦侦探鉴定机 MODEL RC-2006》）：

**5a · 把四步压成一步**（`58bb766`）

| 文件 | 职责 |
|---|---|
| `index.html` | 首页新增机器面板：铭牌 / 指示灯 / 投币口 / 吐纸口 |
| `assets/js/machine.js` | 投币 → 逐行运转日志 → `RC.tarot.draw()` 代抽 5 张 → 存 case → 跳 `verdict.html`。输入过短即拦下 |
| `assets/css/club.css` | 机器外壳（金属渐变 / 指示灯闪烁 / 运转震动），尊重 `prefers-reduced-motion` |
| `tests/machine.cjs` | 端到端契约（`npm run test:machine`） |

- **塔罗由机器代抽**：访客不必手点 5 次牌，报告标注「非本人所抽，置信度下调」
- **精神分析不代做**：词联想 / 句子完成需要本人受诊，代做即是造假；缺席时报告标注此项留空、其余照常生成

**5b · 导航精简 10 → 6 项**（本次）

| 保留（主流程） | 移出（文件保留、URL 可达） |
|---|---|
| 吧台 `index` · 精神分析 `psyche` · 鉴定 `verdict` · 梦境 `dreams` · 画廊 `masters` · 树洞 `bbs` | 人物 `people` · 委托 `order` · 塔罗 `tarot` · 链接 `link` · 2006 档案 · 账户 |

- **委托与塔罗已被鉴定机合并**（投一句话即代抽牌），不再各占一个入口
- **精神分析必须保留**：它是机器唯一不能代做的模块，移出即等于砍掉
- **可达性兜底**：页脚新增「索引」一行，列出四个移出页面的入口；`link.html` 自身也是索引页，指向人物 / 委托 / 塔罗。全站无孤岛
- `tests/machine.cjs` 新增 7 项契约：导航恰好 6 项、移出项不在、`psyche` 仍在、页脚四个入口齐备

**Phase 6 实际产出**（收口）：

- **README 重写**：定位从「复刻站点」改为《梦侦探鉴定机 MODEL RC-2006》——开头即讲清「投币 → 取纸」两步，并把「机器不代做精神分析」写成产品原则；同步修正过时表述（树洞默认云端、导航 6 项、`test:machine` / `test:ai` 脚本）
- **文档同步**：本方案各阶段状态归位；`docs/hackathon-strategy.md` 与 `docs/track2-lipu-inventor.md` 保留为评估过程记录
- **上线核查**：构建 → 全量测试 → 部署 → `npm run test:remote` 冒烟，确认线上与本地一致

**Phase 2 实际产出**（分三批推进，每批跑全量测试）：

核查发现分层明显：`link-page.js`（7 行）/ `bbs-page.js`（7 行）这类控制器**只做 chrome 样板**；
`verdict / psyche / dreams / masters / tarot` 才是带真实逻辑的页。迁移按「收益高 → 一页一测」推进。

| 批次 | 页面 | 处置 | 提交 |
|---|---|---|---|
| 一 | verdict · masters · dreams · psyche | 各自迁成 Vue 组件 | `b909735` |
| 二 | order | 迁成 `OrderPage.vue`；link / bbs / people 的样板合并进 `chrome.ts` | `f0513be` |
| 三 | tarot | 迁成 `TarotPage.vue` | 见下方 |

**最终形态**：13 个页面里 **12 个由单一模块入口驱动**（`src/main.ts` 或 `src/chrome.ts`），
HTML 里不再手写 `<script>` 清单；`404.html` 无脚本。
**唯一保留的 legacy 交互内核是 `treehole.js`**（树洞，641 行：云同步 / 点亮 / 撤回 / 举报 /
投递动画 / 9 秒轮询）。它的页面外壳已由 `chrome.ts` 接管，只把有状态的业务逻辑留在原处——
重写的风险（打断云同步与「默认接云端」的行为）远大于收益。

| 页面 | 原控制器 | 新组件 | 关键改动 |
|---|---|---|---|
| 鉴定 verdict | `verdict-page.js`（204 行） | `src/VerdictPage.vue` | 报告主体逐字保持原 DOM（既有契约测试不变）；`hidden` 类语义保留 |
| 画廊 masters | `masters.js`（41 行） | `src/MastersGallery.vue` | 七大师网格改 `v-for`；致敬清单内联为常量 |
| 梦境 dreams | `dreams.js`（132 行） | `src/DreamsJournal.vue` | 表单 + 时间线 CRUD，存储键仍是 `dreamLog` |
| 精神分析 psyche | `psyche-page.js`（149 行） | `src/PsychePage.vue` | 联想计时 / SCT 改响应式；Panel A 交给 `RC.analyst.init()` |
| 委托 order | `order-page.js` | `src/OrderPage.vue` | 校验失败与保存失败都保留输入 |
| 塔罗 tarot | `tarot-page.js`（223 行） | `src/TarotPage.vue` | 牌阵 / 翻牌 / 读牌表改响应式；`tarotDraft` 草稿恢复语义保持不变 |
| 链接 / 树洞 / 人物 | `link-page.js` / `bbs-page.js` / `people-page.js` | `src/chrome.ts` | 三份重复的标题 / 导航 / 页脚 / 旁白收进一处 |

**过程中暴露并修掉的耦合点**：legacy 脚本在 `DOMContentLoaded` 时就去 `getElementById`，
而 Vue 挂载更晚。为此给跨页脚本加了**可重入初始化钩子**：

- `share-card.js`：`RC.shareCard.init()`，`#btnCard` 存在且未绑定才绑（鉴定页）
- `analyst.js`：`RC.analyst.init()`，找不到 `#masterGrid` 直接返回（精神分析页）
- `stamps.js`：原先绑 `#btnDeal` 计 `stat_tarot`，塔罗页 Vue 化后会漏绑 →
  计数改由 `TarotPage.vue` 自己负责，`stamps.js` 里那段删除

**顺手修掉的 3 处真实缺陷**：

- 牌阵提示的键名笔误：代码取 `spreadHintTimeLine` / `spreadHintDailyCard`，
  词条表里实为 `spreadHintTimeline` / `spreadHintDaily` → 「时间线」「每日一牌」的提示长期空白
- 元素分布条标签 `elementHint` 词条缺失 → 已补入 `content/i18n.json`
- `people.html` 缺 `skeleton.js`（Phase 0 已修）

另补齐 `src/legacy.ts` 的类型桥：`ui.bi/dialog/type`、`engine`、`analyst`、
`tarot.byId/sealOf/drawFor`、`share`、`util`、`interpret`、`shareCard`、`stamps`、
`case.start/save`、`model.formError`。


---

## 一、项目体检

### 1.1 规模

| 类别 | 文件数 | 行数 | 说明 |
|---|---|---|---|
| legacy JS | 29 | 5,117 | vanilla IIFE + 全局 `window.RC` |
| TS / Vue | 13 | 494 | 只覆盖 3 个页面 |
| CSS | 6 | 1,051 | `club.css` 单文件 1,045 行 |
| HTML | 13 | 1,554 | 手写 `<script>` 清单 |
| 后端 | 5 | 237 | `server/api.cjs` + 云函数 |
| 测试 | 6 | ~950 | 24 单测 + 49 冒烟 |
| **源码合计** | — | **~8,200** | |
| 图片资产 | — | 33 MB | WebP 响应式已做 |

### 1.2 结构性问题（按严重度）

#### S1 · 技术栈精神分裂（最严重）

3 个页面是 **Vue 3 + TS + Pinia**（`index` 吧台 / `about2006` 时间胶囊 / `account` 同步面板），
其余 **10 个页面是 vanilla IIFE + 全局 `RC` 命名空间**。

- 类型覆盖只有 **6%**（494 / 8,200）
- 状态靠 `window.RC.*` 全局对象传递，`main.ts` 甚至用 `document.getElementById('bar-app')` 是否存在来判断当前页
- 两套状态层并存：`RC.store`（localStorage + `window.name` 兜底）与 Pinia `counter-store`
- 后果：心智负担 ×2，新人（和 AI）每次都要先猜"这页是哪套"

#### S2 · 页面样板重复且已经不一致

13 个 HTML **手写** `<script>` 清单，数量 4 ~ 16 个不等，顺序各不相同：

| 页面 | script 数 |
|---|---|
| verdict.html | 16 |
| bbs / psyche.html | 14 |
| tarot.html | 13 |
| dreams / index / masters.html | 12 |
| people.html | 11 |
| link / order.html | 10 |
| about2006 / account.html | 2 |

> **实证缺陷**：`people.html` 的 `#regMount` 与 `#boardMount` 都写了 `data-skel="cards"`，
> 但该页**没有引入 `skeleton.js`** → 常客墙与数据看板的骨架屏**从未生效**。
> 这类"清单式"配置必然出错，第二批新增页面时也是靠 Python 脚本批量灌进去的。

#### S3 · 内容与逻辑耦合

叙事文案硬编码在逻辑文件里：

| 文件 | 行数 | 内容 |
|---|---|---|
| `i18n.js` | 339 | 中／日双语词条表 |
| `about2006-page.js` | 335 | 5 章时间胶囊正文 |
| `engine.js` | 302 | 假说文案 + 处方文案 |
| `analyst.js` | 281 | 七位大师人格与台词 |
| `store.js` | 266 | 菜单（酒单 + 主食）文案 |
| `tarot-data.js` | 166 | 塔罗牌义 |

- 改一句台词要改代码；译者无法介入；无法做内容管理

#### S4 · 零 AI（对赛道二是致命伤）

`engine.js` 是**纯关键词规则引擎**：情感词谱打分 → 假说阈值排序 → 模板拼接。
全仓 `grep openai|anthropic|gpt|llm|qwen|generateText` **结果为空**。

> README 自述："分析仍使用本地关键词、规则和预设文本，不调用大模型。"
> 而赛道二的描述是"**用 AI 造**一些不太正经但让人眼前一亮的东西"。

#### S5 · CSS 追加式膨胀

`club.css` 1,045 行，第二批 9 项功能的样式**全部 `cat >>` 追加到文件尾部**，靠后写的 `@media` 覆盖前面的规则。
历史上已发生过类名冲突（`.mcard` 被 psyche 页占用 → 画廊被迫改名 `.gcard`），下次还会踩。

#### S6 · `about2006.html` / `account.html` 体量异常

分别只有 17 / 15 行，是空壳 + Vue 挂载点，与其余 10 页（模板 + 脚本清单）完全不同构。

### 1.3 明确不该动的资产（重构必须保住）

| 资产 | 为什么保 |
|---|---|
| 视觉与世界观 | 皮影侦探、暖灯酒吧、07 位大师、17 层电梯——这是作品的灵魂 |
| `share.js` 的 `#c=` 片段分享 | 隐私设计是稀缺加分项（不随 HTTP 发送） |
| 测试基线 | 24 单测 + 49 冒烟，是重构的安全网 |
| 部署链路 | `tools/deploy.py` + systemd + nginx:8080 已跑通 |
| 33MB 图片资产 | 已完成 WebP 响应式，别重复劳动 |

---

## 二、洗牌判断

### 结论：**能洗，且建议洗——但不是推倒重来，是分层重建。**

| 层 | 处置 | 理由 |
|---|---|---|
| 视觉 / 世界观 / 内容文案 | **保留** | 是作品价值本身 |
| 渲染层 | **重写** | 统一到 Vue，消除双栈 |
| 内容层 | **抽取** | 从 JS 里搬进 `content/` |
| 引擎层 | **改造 + 新增** | 规则降级为"证据层"，新增 LLM"叙事层" |
| 赛道内核 | **新增** | 见 Phase 4 |
| 页面集合 | **精简** | 13 页砍到 5–6 页 |

**风险提示**：13 页全量迁移会打破现有 49 项冒烟测试的 DOM 假设。
因此必须**分阶段、每阶段可回滚**（重构前先 `git tag pre-refactor`）。

---

## 三、分阶段方案

### Phase 0 · 止血（约 0.5h，零风险）

- [ ] 修 `people.html` 缺 `skeleton.js` 的缺陷
- [ ] 加一条构建期校验：扫描所有 HTML，凡有 `data-skel` 必须有 `skeleton.js`，凡引用不存在的脚本即报错

**产出**：一个 `tools/check-pages.cjs`，纳入 `npm run build`

### Phase 1 · 统一入口，消灭手写清单（约半天）

- [ ] 用 Vite 的 `transformIndexHtml` **构建期自动注入**公共脚本（store/model/share/i18n/ui/skeleton/stamps/ambient/haunt）
- [ ] 各页只保留自己的页面脚本，HTML 里不再手写一长串
- [ ] 顺势修正所有顺序不一致

**收益**：13 份清单 → 1 处配置；新增页面成本从"改 Python 脚本"降到"加一个文件"

### Phase 2 · 逐页迁移到 Vue（约 1.5 天）

从最简单的页开始，**一次一页，每页跑完测试再下一页**：

```
link.html → people.html → masters.html → dreams.html
→ bbs.html → order.html → tarot.html → psyche.html → verdict.html
```

- 统一入口 `src/pages/<name>.ts`
- `chrome / nav / siteFoot` 改成 `<SiteChrome>` 组件
- `RC.store` 收敛到 Pinia（保留 `window.name` 兜底逻辑）
- 每迁完一页，删除对应 legacy JS

**收益**：双栈归零，类型覆盖率从 6% → 90%+

### Phase 3 · 内容层抽离（约 1 天）

- [ ] 新建 `content/`：`menu.json` / `masters.json` / `tarot.json` / `i18n.json` / `chapters.json`
- [ ] 保持 `{cn, jp}` 双语结构不变（叙事需要双语，不是国际化）
- [ ] 代码只负责渲染与逻辑

### Phase 4 · 接入 LLM：规则变"证据"，AI 变"叙事"（约 1 天）★

- [ ] 新增 `server/llm.cjs`：统一模型调用（本地 Qwen + OpenVINO **或** 云 API）
- [ ] 新增 `/api/interpret`：把 `engine.js` 的规则结果（情感谱、命中的假说、牌阵）当作**证据**喂给模型，让它**写出**解读
- [ ] **强制兜底**：模型超时/失败/无网络 → 回退现有模板，绝不空白
- [ ] 前端逐字浮现，把生成延迟变成表演

> 原则：**规则负责"看到什么"，AI 负责"怎么说"。**
> 这样既保住了原有推理的严谨感，又让文字活起来——而且断网也能演示。

### Phase 5 · 赛道适配：把它变成"一台机器"（约 1.5 天）★

见下一节。

### Phase 6 · 收口（约 0.5 天）

- [ ] 更新测试（DOM 假设随 Vue 化调整）
- [ ] 重写 README 定位
- [ ] `npm run deploy` 重新上线，`npm run test:remote` 冒烟

**总计约 6 天**（可压缩：Phase 2 可只迁关键页）

---

## 四、赛道适配：怎么把它变成「离谱发明」

**判断：RADIO CLUB 的设定本身就是"离谱发明"的富矿，问题不是缺素材，是太认真了。**

已有的荒诞设定（全是现成的）：
一间只存在于网络上的酒吧 · 收"故事"当钱 · 电梯只到 17 层 · 用塔罗和精神分析工作的梦侦探 · 一份盖着"假说成立／待观察"印章的鉴定书

### 核心改造思路：**把"伪科学的庄严"释放成"一本正经的胡说八道"**

三个可选定位（推荐 A）：

#### 定位 A · 《梦侦探鉴定机 MODEL RC-2006》★ 推荐

把它从"一个站"重新包装成**一台机器**：

- **视觉**：机器外壳、控制面板、指示灯、投币口、吐纸口
- **交互**：投入一个故事（投币）→ 机器轰隆运转（现成的打字机 + 环境音）→ 吐出一份鉴定书
- **AI 内核**：LLM 生成**格式极其正式、内容一本正经胡说八道**的报告
- **笑点来源**：格式越像公文，结论越离谱（"经鉴定，您的症状属于『周日晚八点型焦虑』，1874 年由 XX 首次描述"）
- **迷人性**：它真的读了你写的东西，然后认真地胡说

> 为什么选它：**它让现有 90% 的资产直接变成"机器的零件"**（塔罗 = 模块 1，精神分析 = 模块 2，鉴定书 = 输出），迁移成本最低，离谱度最高。

#### 定位 B · 《人生客服总机 95777》

酒吧的电话总机，永远转不到萨弗兰。你唯一的交互是"不挂断"。
（详见 `docs/track2-lipu-inventor.md`）

#### 定位 C · 《17 层电梯模拟器》

把 404 页的电梯故障梗扩成一整个作品：按哪个楼层都不对，每个错误楼层是一个陌生人的房间。

### 无论选哪个，都要做的三件事

1. **压缩流程**：现在是"点单→塔罗→精神分析→鉴定"四步，评委不会走完。要能做到**一句话直达高潮**
2. **砍页面**：13 页 → 5–6 页。`link.html` / `about2006.html` / `account.html` 对赛道无价值，可移出主流程
3. **准备 90 秒 Demo**

---

## 五、待您拍板

| # | 决策 | 选项 |
|---|---|---|
| 1 | 是否开工洗牌 | 全部执行 / 只做 Phase 0–1（止血+统一入口）/ 先只做 Phase 4（AI 化） |
| 2 | 赛道定位 | **A 鉴定机（推荐）** / B 客服总机 / C 电梯模拟器 |
| 3 | 模型 | 本地 Qwen + OpenVINO（离线稳）/ 云 API（话术活） |
| 4 | 页面精简 | 同意砍到 5–6 页 / 保留全部 13 页 |
