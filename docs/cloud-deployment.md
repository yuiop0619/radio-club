# 公开树洞部署

新版默认使用同站 Node 服务（`transport:'local'`），本文件仅用于可选 CloudBase 部署。完成配置后将 transport 改为 `cloudbase` 并重新构建。配置开关不是后台已部署的证明。

## 资源和权限

1. 在自己的 CloudBase 环境开启匿名登录，配置站点安全域名。保留同一浏览器已有登录态；作者身份来自 SDK 的已认证调用上下文，绝不接收客户端传入的 owner/uid 作为授权。
2. 创建文档集合 `rc_notes`、`rc_operations`、`rc_limits`、`rc_reports`、`rc_profiles`、`rc_content`。为所有集合设置客户端不可读、不可写；规则参考 `cloudfunctions/treehole/database.rules.json`。只有云函数的服务端身份访问这些集合。配置文件不会自动上传规则，必须在控制台应用并核对。
3. `rc_notes` 增加 `updatedAt` 降序索引，用于轮询查询。`rc_reports` 仅对管理员开放，用于查询 `pending` 举报、人工处理并更新状态。
4. 在 `cloudfunctions/treehole` 执行 `npm ci --omit=dev`，将该目录上传为 Node.js 20+ 云函数 `treehole`，入口 `index.main`。配置函数调用权限，只允许已认证用户调用，不开放未经认证的 HTTP 入口。函数环境由 SDK 当前环境常量确定。
5. 实施下方双用户验收后，编辑 `assets/js/cloud-config.js` 为 `{enabled:true,env:'自己的环境 ID',functionName:'treehole'}`，部署静态文件。环境 ID 是配置，不要在该文件中放密钥。

接口使用官方 [云函数调用](https://docs.cloudbase.net/api-reference/webv2/functions)、[服务端身份认证](https://docs.cloudbase.net/api-reference/server/node-sdk/auth) 和 [数据库事务](https://docs.cloudbase.net/database/transaction)。

## 协议

所有响应形如 `{ok:true,data:...}` 或 `{ok:false,error:'ERROR_CODE'}`。`hello` 返回协议版本 1 和调用者身份；前端只在握手成功后开放公开投递。

| 操作 | 输入 | 结果 |
|---|---|---|
| hello | action | protocol、uid |
| list | known（最多 80 个已缓存 ID） | 最近更新的纸条及已知纸条的最新状态 |
| publish | id、operationId、body、sig、mood | 作者绑定后的纸条 |
| reply | id、operationId、body | 包含新增回复的纸条 |
| light | id、operationId | 去重后的点赞计数 |
| withdraw | id、operationId | 已清空正文和回复的撤回状态 |
| report | id、operationId、可选 reason | 可查询的 reportId |

服务端强制正文/回复 140 字、署名 16 字；每位用户每分钟最多 20 次新的写操作，每篇最多 200 条回复、1000 位点赞者。界面限长不是权限边界。

同一纸条的回复及反应在事务内更新，回复有独立 ID，防止并发覆盖。幂等记录与变更同时提交。重试旧操作时读取纸条当前版本，撤回后的原文不会从旧响应缓存复活。幂等集合只存结果引用/举报编号，不保留正文副本。

本地队列在发送前持久化，成功确认后移除；失败可手动重试。队列绑定原始用户身份，不会用另一个账号重放。取消待同步仅移除本机队列，不保证撤销已经到达服务器的操作。自动角色回声始终本地生成，不上传伪装成真人的回复。

撤回保留无正文的状态记录，用于其他设备清除缓存。分享链接包含的是独立副本，不能由云端撤回。服务端不把内部 owner、点赞者列表或举报者信息放入公共纸条响应。

## 旧数据与验收

旧 `treehole` 集合没有可靠的客户端作者绑定，不能根据纸条 ID 或本地 mine 标记自动认领。管理员需要先备份、清点历史数据与原访问规则；旧集合应关闭客户端直接写权限。需要保留的历史资料应通过管理员迁移脚本与可靠作者证据处理，不要直接复制为可被任意访客撤回的新资料。

实际环境至少验证：

- 访客 A 发布，B 能读取并回复；两人并发回复都保留，A 能看到新的回复和点赞。
- B 直接调用撤回 A 的纸条会得到 FORBIDDEN；修改本地 mine 或传入伪造 uid 无效。
- A 撤回后两端刷新均不显示正文；重试旧发布请求不会复活资料。
- 举报取得编号，管理员可在 rc_reports 查到记录；失败不会提示已受理。
- 网络中断、请求已提交但响应丢失、恢复后重试均不重复发布。
- 拒绝客户端直接访问四个新集合，并检查旧集合仍不存在绕过入口。

本仓库测试使用事务语义的内存适配器和隔离浏览器，未代替上述生产验收。匿名账号被清除后无法靠昵称恢复作者权限，需要管理员流程。集合保留、备份与举报处理期限需由运营方配置；不要清理仍可能被客户端重试的幂等记录或撤回状态。
