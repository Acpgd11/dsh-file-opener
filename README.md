# dsh-file-opener

把 DSH 对话中出现的文件和目录路径变成可点击按钮：点击即可在右侧侧边栏预览，或调用系统默认程序打开。

- 包名：`dsh-file-opener`
- 上游仓库：<https://github.com/sailoumili/dsh-file-opener>（MIT）
- 支持 DSH 0.1.7-alpha.1 及以上的 web 版与桌面版
- 零第三方运行时依赖，不写运行状态文件，不联网

> ### 本目录是本地 fork（v1.5.0），不是上游原样拷贝
>
> 基于上游 **v1.4.0** 修改，针对本机 **DSH 0.2.1-rc.3 桌面版**做了三处改动，详见文末
> [本地 fork 改了什么](#本地-fork-改了什么v150)。上游版权与 MIT 许可原样保留，见 `LICENSE`。

## 功能

| 操作 | 结果 |
|---|---|
| 点击文件路径 | 右侧侧边栏可显示则在侧边栏打开，否则调用系统默认程序 |
| Shift + 点击文件路径 | 强制调用系统默认程序 |
| 点击目录路径 | 用资源管理器打开该目录 |
| 点击路径后的文件夹图标 | 文件：打开其所在目录；目录：打开该目录本身 |
| 点击不存在的路径 | 打开其所在的那一级真实目录，控制台留一条警告、图标闪红 |

- 可识别的路径写法：绝对路径、`~/...`（展开为当前用户主目录）、`./` 与 `../`（按会话工作目录解析）。
- 用户消息中未附带官方按钮的行内代码，只要内容是路径，同样可点击并带文件夹图标。
- 打开失败会给出可见提示，不会静默失败。

## 安装

### web 版

```
dsh plugin --profile web add dsh-file-opener
```

### 桌面版

1. 打开 DSH 桌面版，点击左侧栏「插件」。
2. 点击「添加插件」。
3. 输入包名 `dsh-file-opener`，点击「安装」，等待完成。
4. 安装完成后点击「立即启用」，并在「已安装」中确认其开关为打开状态。

## 让 AI 输出可点击的路径

插件识别的是行内代码（反引号包裹）中的路径文本。若要让 AI 回复中提到的文件可以直接点击打开，请在 agent 指令文件（如 `AGENTS.md`）中要求 AI 写出完整路径，例如：

```
回复中提到的每个文件或目录，都必须用反引号包裹完整绝对路径，例如 `C:\work\报告.md`。
不要只写文件名，也不要只给目录再另写文件名。
```

## 点击后的打开方式

点击文件路径时按以下顺序判断：

1. 路径不存在 → 打开其所在目录。
2. 路径是目录 → 用资源管理器打开。
3. 路径是文件：
   1. 内容为纯文本 → 右侧侧边栏；
   2. 否则查询官方预览器注册表，命中 → 右侧侧边栏；
   3. 均未命中 → 系统默认程序。

是否纯文本只按内容判断：读取文件开头 4 KB，无 NUL 字节且可按 UTF-8 解码即为纯文本，与扩展名无关。

### 在右侧侧边栏打开

Markdown（`md`、`markdown`）、HTML（`html`、`htm`）、图片（`png`、`jpg`、`jpeg`、`gif`、`webp`、`bmp`、`ico`、`svg`）、PDF（`pdf`）、Office（`doc`、`docx`、`ppt`、`pptx`）、Excel（`xlsx`、`xls`、`csv`、`tsv`）、代码高亮（官方代码语言表内的全部后缀，如 `ts`、`js`、`py`、`go`、`rs`、`java`、`c`、`cpp`、`cs`、`php`、`sh`、`bat`、`ps1`、`yaml`、`toml`、`sql`、`xml`、`css`），以及任何内容为纯文本的文件（如 `txt`、`log`、`dxf`）。

### 用系统默认程序打开

`dwg`、`psd`、`ai`、`skp`、`max`、`zip`、`7z`、`rar`、`mp3`、`mp4`、`exe`、`msi`、`lnk`、`iso`、`tif`、`tiff`、`avif` 等：压缩包、音视频、安装程序、磁盘映像，以及官方未提供预览器的二进制格式。

### 两种容易被误认为故障的情况

- `.dxf`：DXF 为文本格式，按纯文本处理，在侧边栏显示源码，不会启动 CAD。需用 CAD 打开时按住 Shift 点击。
- `.docx`、`.xlsx`、`.pptx`：官方 0.2.0-rc.2 自带 Office 与 Excel 预览器，在侧边栏打开，不会启动 Office。此属预期行为。

Office 与 Excel 的侧边栏预览依赖宿主转换组件，转换失败时仅显示「无法预览」，不会自动改用系统程序；此时按住 Shift 点击即可。

## 已知限制

- 目录打开仅支持 Windows；其他平台退回侧边栏打开。
- UNC 网络路径（`\\server\share`）与 Windows 保留设备名（`CON`、`PRN`、`AUX`、`NUL`、`COM1`-`COM9`、`LPT1`-`LPT9`）不予打开。
- 相对路径无绝对路径可用，仅能通过侧边栏打开；Shift 强制系统程序对其无效。
- 工作区外的路径交给侧边栏预览时，可能因宿主访问策略返回 403，文件过大可能返回 413；此时按住 Shift 点击用系统程序打开。
- 权限不足的路径会被视为不存在，表现为打开其上级目录。
- 文件名以单引号或反引号结尾时，该字符会被当作标点去掉。

## 许可

MIT，见 `LICENSE`。上游版权归 sailoumili 所有；本 fork 的改动同样以 MIT 发布。

---

## 本地 fork 改了什么（v1.5.0）

基线：上游 v1.4.0。目标宿主：**DSH 0.2.1-rc.3 桌面版**（本机 `D:\DSH-Official`）。

### 1. 补上兼容性声明

上游 `package.json` 里**没有** `dsh.compatibility`，也**没有** `peerDependencies`。
DSH 0.2 起会对 profile bundle 做 peer 兼容性门禁，没声明范围的包在升级时可能被静默跳过，
或者装完才发现不匹配。补的内容：

```json
"dsh": { "compatibility": { "dshReleases": { "0.1.7-rc.1": "compatible", ... "0.2.1-rc.3": "compatible" } } },
"peerDependencies": { "@deepseek-ai/dsh": "^0.1.7-rc.1 || ^0.2.0-rc.1" },
"peerDependenciesMeta": { "@deepseek-ai/dsh": { "optional": true } }
```

标 `optional` 是因为本机用 `file:` 链接安装，profile 里并没有 `@deepseek-ai/dsh` 这个依赖，
不标 optional 会让 pnpm 报 peer 缺失警告。

**为什么这个插件升级风险本来就低**：它只用两样官方公开契约——
宿主侧 `ctx.webServer.register({ kind: 'exact', path, handler })` 与客户端的
`ctx.get('chatFileMentions' / 'documentPreviews' / 'sidebarRight' / 'sessions')`。
本机 0.2.1-rc.3 里这几样**都还在**（已逐个在 app.asar 中核实）：
`dsh-host-webserver` 的 `register` / `port` / `host`，
`dsh-client-ui-deliverables` 注册的 `chatFileMentions`，
`dsh-client-ui-sidebar-documentpreview` 的 `documentPreviews.candidates(path)`，
`dsh-client-ui-chat` 的 `openFile` 与 `[data-conversation-scroll]`。
而且取不到时插件是**降级**而不是崩溃（退化成"一律用系统程序打开"）。

### 2. 扫描不再监听 `characterData`（性能）

上游在 `document.body` 上监听 `{ childList, subtree, characterData }`，并且每次回调都把
对话容器整个 `querySelectorAll` 一遍。`characterData` 会被**每一次按键**触发，等于把输入
变成全量扫描的触发器。

上游自己在 issue #11 / #9 里遇到过这类问题的极端形态（大文档把页面卡死），修法是
"缩小扫描边界 + 增量扫描"。上游 v1.4.0 缩了边界（认 `[data-conversation-scroll]`），
但 `characterData` 和全量扫描都还在。本 fork 补完剩下的一半：

- 观察者只监听 `childList`（图标只认 `code` / `button` 节点，都是节点替换）；
- 回调只攒记录，120ms 防抖后合并成一次；
- 本轮只扫**新增的** `code` / `button` 节点；新增超过 40 个或记录超过 300 条才退回整量扫描。

### 3. 失效路径不再静默

上游点一个不存在的路径：打开上级目录，但界面和日志里**什么痕迹都没有**，用户会以为没反应。
本 fork 改成：控制台 `console.warn` 一条记录 + 对应图标闪红。**不弹窗**——一次点击弹一个
alert 太吵，所以这里刻意不用 `failOpen` 那套。

### 自测

```powershell
node scripts/test.mjs       # 上游原有 170 项，全部保留
node scripts/fork-test.mjs  # 本 fork 新增 11 项：兼容性声明、观察者选项、导出完整性
```

### 改动的文件

| 文件 | 改动 |
|---|---|
| `package.json` | 版本 1.5.0；加 `dsh.compatibility`、`peerDependencies`、`peerDependenciesMeta` |
| `lib/client.js` | 观察者去 `characterData`；增量扫描；失效路径可观测 |
| `scripts/fork-test.mjs` | 新增 |
| `README.md` | 本段说明 |

`lib/index.js`（宿主半边）**没有改动**——它在 0.2.1-rc.3 上用的契约都还在。

