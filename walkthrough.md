# DogDesk Walkthrough（桌面版）

更新时间：2026-02-28  
项目定位：仅桌面端（Tauri v2），仓库中已无浏览器扩展模块。

## 1. 这个项目现在能做什么

DogDesk 是一个常驻桌面的小狗助手，核心能力是：

- 文本翻译：双击小狗读剪贴板翻译，或拖拽短语/句子到狗嘴附近翻译。
- AI 理解：输出不只翻译，还会给出“这句话真正是什么意思”的解释。
- 多模型接入：支持 DeepSeek/OpenAI/Claude/Gemini/Azure/OpenRouter/Groq/Together/Mistral/xAI/Ollama 等。
- 全局快捷键：`Ctrl+Shift+D` 触发复制并翻译当前选中文本。
- 久坐提醒：默认每 30 分钟触发一次跑动提醒，可点击“我已休息”重置计时。

## 2. 仓库结构（当前）

```text
Dogdesk/
├─ walkthrough.md
└─ desktop/
   ├─ index.html
   ├─ translation.html
   ├─ package.json
   ├─ vite.config.js
   ├─ 启动DogDesk.bat
   ├─ src/
   │  ├─ dog.js
   │  ├─ dog.css
   │  ├─ translation.js
   │  ├─ translation.css
   │  └─ shared.js
   └─ src-tauri/
      ├─ Cargo.toml
      ├─ tauri.conf.json
      ├─ capabilities/default.json
      └─ src/
         ├─ main.rs
         └─ lib.rs
```

## 3. 前后端职责分工

### 前端（WebView）

- `src/dog.js`  
  负责小狗窗口交互：单击问候、双击翻译、拖拽吸附投喂、首启 API 配置弹窗、提醒状态管理。

- `src/dog.css`  
  负责小狗视觉与动画：坐姿/开心/查询中/跑动状态，磁吸旋涡效果，问候气泡和配置面板样式。

- `src/translation.js`  
  负责翻译窗口：监听 `trigger-translate`，调用共享翻译层，渲染翻译+解释+词典信息，支持窗口拖动和人性化自动关闭。

- `src/translation.css`  
  翻译卡片样式，包含标题、正文、解释区、来源区、滚动区域样式。

- `src/shared.js`  
  统一翻译能力层：AI 配置读写、模型厂商预设、不同协议调用（OpenAI/Anthropic/Gemini/Azure）、重试与超时、结果解析、缓存与兜底翻译。

### Rust（Tauri 宿主）

- `src-tauri/src/lib.rs`  
  负责系统能力和窗口调度：
  1) 初始化狗窗口/翻译窗口  
  2) 托盘菜单与退出  
  3) 全局快捷键 `Ctrl+Shift+D`  
  4) 剪贴板读取和模拟复制  
  5) 翻译窗口定位（加载中和结果后两次定位）  
  6) 久坐提醒计时、展开跑动、重置逻辑

- `src-tauri/tauri.conf.json`  
  定义双窗口尺寸和属性（透明、无边框、置顶、隐藏任务栏），定义构建命令和打包目标。

- `src-tauri/capabilities/default.json`  
  定义能力权限：窗口调整/拖动、事件、剪贴板、开机启动、全局快捷键等。

## 4. 关键交互流程

### 4.1 双击翻译（剪贴板）

1. 前端双击狗头触发 `read_clipboard`。
2. `dog.js` 清洗文本后调用 `translate_text`。
3. Rust 打开翻译窗口并发事件 `trigger-translate`。
4. `translation.js` 调用 `translateTextWithUnderstanding`，渲染结果。
5. 渲染完成后通知 Rust 二次定位，避免遮挡狗头。

### 4.2 拖拽投喂翻译（磁吸）

1. 文本拖入狗嘴附近触发磁吸区（视觉旋涡 + 强度变化）。
2. 若落点在磁吸区，允许“吸附命中”并播放吸入动画。
3. 调用同一 `translate_text` 链路进入翻译流程。
4. 有并发保护：上一条还在处理中会提示稍等。

### 4.3 全局快捷键翻译

1. Rust 全局监听 `Ctrl+Shift+D`。
2. 在 Windows 下模拟 `Ctrl+C`，等待剪贴板更新。
3. 读取文本后走统一翻译窗口流程。

### 4.4 久坐提醒

1. 后台线程每 10 秒检查一次提醒计时。
2. 到达间隔后将狗窗口切到跑动提醒模式并发事件。
3. 用户点击“我已休息”或狗头，调用 `dismiss_reminder` 重置。

## 5. AI 配置和翻译策略

### 配置入口

- 首次启动自动弹出配置面板。
- 右键小狗可随时重新打开配置。

### 配置项

- 启用开关 `enabled`
- 服务商 `provider`
- 接口密钥 `apiKey`
- 模型名 `model`
- 接口地址 `endpoint`

### 生效逻辑

- 只要 `enabled + apiKey + endpoint` 成立，就始终优先使用配置的 AI。
- AI 请求失败时，返回中文错误解释，不自动切到“记忆模式”。
- 没有配置 API 时，才走 MyMemory 兜底翻译。

### 本地存储键（localStorage）

- `dogdesk.ai.first_launch_done`
- `dogdesk.ai.enabled`
- `dogdesk.ai.provider`
- `dogdesk.ai.api_key`
- `dogdesk.ai.model`
- `dogdesk.ai.endpoint`

兼容历史键（`dogdesk.deepseek.*`）仍保留读取。

## 6. 运行与构建

在 `desktop/` 目录执行：

```powershell
npm install
npx tauri dev
```

仅构建前端：

```powershell
npm run build
```

打包桌面安装包：

```powershell
npm run tauri build
```

## 7. 本次实测打包结果

已成功构建并产出安装包：

- `desktop/src-tauri/target/release/bundle/nsis/DogDesk_0.1.0_x64-setup.exe`
- `desktop/src-tauri/target/release/bundle/msi/DogDesk_0.1.0_x64_en-US.msi`

为便于发布，已复制到仓库根目录：

- `release/DogDesk_0.1.0_x64-setup.exe`
- `release/DogDesk_0.1.0_x64_en-US.msi`

## 8. 对外发布建议

- 个人网站优先放 `DogDesk_0.1.0_x64-setup.exe`（Windows 用户最常见）。
- 同时保留 `.msi` 供企业环境或静默部署使用。
- 在下载页明确说明：首次启动需要配置可用的 AI API Key 才能启用 AI 优先翻译。

