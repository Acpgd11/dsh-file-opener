# dsh-file-opener · DSH 0.2.1 fork

把 DeepSeek Harness（DSH）对话里的**文件与目录路径变成可点击按钮**：点一下，能在右侧侧边栏预览的就在侧边栏打开，其余用系统默认程序打开。

> **这是 [sailoumili/dsh-file-opener](https://github.com/sailoumili/dsh-file-opener) 的 fork**，基于上游 **v1.4.0**，
> 针对 **DSH 0.2.1-rc.3 桌面版（Windows）**做了三处改动。上游是 MIT 协议，本 fork 同样 MIT，
> 原版权声明完整保留，见 [LICENSE](LICENSE)。

## 为什么有这个 fork

| 问题 | 上游 v1.4.0 | 本 fork v1.5.0 |
|---|---|---|
| 兼容性声明 | `package.json` 里**没有** `dsh.compatibility` 与 `peerDependencies` | 声明到 `0.2.1-rc.3`，peer 范围 `^0.1.7-rc.1 \|\| ^0.2.0-rc.1` |
| 扫描触发时机 | `MutationObserver` 监听 `characterData`，**每敲一个字**触发一次全量扫描 | 只听 `childList` + 120ms 防抖 + 只扫新增节点 |
| 点了失效路径 | 静默打开上级目录，界面和日志无任何痕迹 | 控制台 `warn` + 图标闪红（不弹窗） |

三处改动都是**加法与减法**，没有替换上游的实现思路：

1. **兼容性声明** —— DSH 0.2 起会对 profile bundle 做 peer 兼容性门禁。没有声明范围的包，
   升级时可能被静默跳过，或装完才发现不匹配。补上后宿主能明确判断"这个版本能用"。
   `peerDependenciesMeta` 标 `optional`，是因为本地 `file:` 链接安装时 profile 里并没有
   `@deepseek-ai/dsh` 这个依赖，不标会让 pnpm 报 peer 缺失。

2. **扫描性能** —— 上游在 `document.body` 上监听 `{ childList, subtree, characterData }`，
   每次回调都把整个对话容器 `querySelectorAll` 一遍。`characterData` 会被**每一次按键**触发，
   等于把输入变成全量扫描的触发器。本 fork：
   - 只监听 `childList`（图标只认 `code` / `button`，都是节点替换）；
   - 变更记录先入队，120ms 防抖后合并成一次；
   - 只扫**本轮新增的** `code` / `button`；新增超过 40 个或记录超过 300 条才退回整量扫描。

3. **失效路径可观测** —— 上游点一个不存在的路径会打开上级目录，但没有任何提示，
   用户会以为插件坏了。本 fork 在控制台留一条 `warn`，并让对应图标闪红。
   刻意**不用弹窗**：一次点击弹一个 alert 太吵。

## 功能

| 操作 | 结果 |
|---|---|
| 点击文件路径 | 右侧侧边栏可显示则在侧边栏打开，否则调用系统默认程序 |
| `Shift` + 点击文件路径 | 强制调用系统默认程序 |
| 点击目录路径 | 用资源管理器打开该目录 |
| 点击路径后的文件夹图标 | 文件：打开其所在目录；目录：打开该目录本身 |
| 点击不存在的路径 | 打开其所在的那一级真实目录，控制台留警告、图标闪红 |

- 可识别：绝对路径、`~/...`（展开为用户主目录）、`./` 与 `../`（按会话工作目录解析）。
- 用户消息中未附带官方按钮的行内代码，只要内容是路径，同样可点击并带文件夹图标。
- 打开失败会给出可见提示，不会静默失败。

## 兼容性

本 fork 只用两样官方**公开**契约，不 import 任何官方内部包：

| 依赖的契约 | 由哪个包提供 | 在 0.2.1-rc.3 的核实结果 |
|---|---|---|
| `ctx.webServer.register` / `port` / `host` | `dsh-host-webserver` | 存在 |
| `ctx.get('chatFileMentions')` | `dsh-client-ui-deliverables` | 存在 |
| `ctx.get('documentPreviews').candidates(path)` | `dsh-client-ui-sidebar-documentpreview` | 存在 |
| `ctx.get('sidebarRight').openResource(...)` | `dsh-client-ui-sidebar-right` | 存在 |
| `owner.openFile`、`[data-conversation-scroll]` | `dsh-client-ui-chat` | 存在 |

取不到任何一项时，插件**降级而不是崩溃**（退化成"一律用系统程序打开"）。
不过要说清楚：没有第三方插件能保证永远兼容，DSH 官方也说明插件 API 在 0.2 期间仍会演化。

## 安装

### 方式一：从 GitHub 装（需要宿主支持 bundle 插件）

```bash
dsh plugin --profile desktop add "github:Acbgd11/dsh-file-opener#main"
```

> 上面用的是默认 `desktop` profile；如果你的 DSH 是 `web` 版，把 `--profile desktop` 换成 `--profile web`。

### 方式二：本地目录链接（不适合公开分发，仅给本机用）

把整个目录放到自己的插件目录，然后在 profile 的 `package.json` 里加入：

```json
"dependencies": { "dsh-file-opener": "file:D:/path/to/dsh-file-opener" },
"dsh": { "profile": { "bundles": [ "...", "dsh-file-opener" ] } }
```

再在 profile 目录执行 `pnpm install`，然后**重启 DSH**。
bundle 层在启动时合成，HMR 对它不生效。

### 让 AI 输出可点击的路径

插件识别的是**反引号包裹**的行内代码。在 agent 指令文件（如 `AGENTS.md`）里要求 AI 写完整路径：

```
回复中提到的每个文件或目录，都必须用反引号包裹完整绝对路径，例如 `C:\work\报告.md`。
不要只写文件名，也不要只给目录再另写文件名。
```

## 点击后的打开方式

1. 路径不存在 → 打开其所在目录（并在控制台留警告）。
2. 路径是目录 → 用资源管理器打开。
3. 路径是文件：
   1. 内容是纯文本 → 右侧侧边栏；
   2. 否则查询官方预览器注册表，命中 → 右侧侧边栏；
   3. 均未命中 → 系统默认程序。

是否纯文本只看**内容**：读文件开头 4 KB，无 NUL 字节且能按 UTF-8 解码即为纯文本，与扩展名无关。

### 两种容易被误认为故障的情况

- `.dxf`：DXF 是文本格式，按纯文本处理，侧边栏显示源码，不会启动 CAD → 用 CAD 打开请 `Shift` + 点击。
- `.docx` / `.xlsx` / `.pptx`：官方自带 Office 预览器，在侧边栏打开 → 要启动 Office 请 `Shift` + 点击。
- 侧边栏显示「无法预览」：宿主转换组件失败，插件不会自动改用系统程序 → `Shift` + 点击即可。

## 已知限制

- 目录打开仅支持 Windows；其他平台退回侧边栏打开。
- UNC 网络路径（`\\server\share`）与 Windows 保留设备名（`CON`、`PRN`、`AUX`、`NUL`、`COM1`-`COM9`、`LPT1`-`LPT9`）不予打开。
- 相对路径无绝对路径可用时，仅能通过侧边栏打开；对其 `Shift` 强制系统程序无效。
- 工作区外的路径交给侧边栏预览时，可能因宿主访问策略返回 403，文件过大可能返回 413 → `Shift` + 点击用系统程序打开。
- 权限不足的路径会被视为不存在，表现为打开其上级目录。
- 文件名以单引号或反引号结尾时，该字符会被当作标点去掉。

## 自测

```bash
node scripts/test.mjs       # 上游原有 170 项
node scripts/fork-test.mjs  # 本 fork 新增 11 项：兼容性声明、观察者选项、导出完整性
```

截至 2026-10-27，两套在 DSH 0.2.1-rc.3 桌面版（Node v24.21.0）上全绿。

## 分支

| 分支 | 内容 |
|---|---|
| `main` | 上游 v1.4.0 + 本 fork 的三处改动（默认分支） |
| `fork/dsh-0.2.1` | 与 `main` 相同，保留该名字以备后续按 DSH 版本开分支 |

## 上游

- 上游仓库：<https://github.com/sailoumili/dsh-file-opener>
- 上游作者：sailoumili
- 上游 issue 编号会与本仓库对不上，本仓库的问题请提在这里。

## 许可

MIT，见 [LICENSE](LICENSE)。原版权归 sailoumili 所有，本 fork 的修改部分由 Acbgd11 声明。
