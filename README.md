# 🐶 DogDesk

<div align="center">
  <h1>🐕 DogDesk 🐾</h1>
  <p><strong>一款专为 Windows 打造的灵动桌面 AI 翻译小狗助手</strong></p>
  
  <p>
    <a href="https://github.com/lingcang728/DogDesk">
      <img src="https://img.shields.io/github/stars/lingcang728/DogDesk?style=social" alt="GitHub stars">
    </a>
    <a href="https://dog-desk.vercel.app/">
      <img src="https://img.shields.io/badge/Website-Live-brightgreen.svg" alt="Website">
    </a>
  </p>
</div>

---

再也不用来回切换翻译软件了！让 **DogDesk** 趴在你的桌面上，为你提供最快捷、最智能的翻译与健康陪伴。🌟

## ✨ 核心特色

- 🦴 **拖拽秒翻**：只需选中任意文本，拖拽喂给桌面的小狗，即可瞬间在它头顶看到翻译结果！
- 🖱️ **双击翻译**：直接双击小狗，快速翻译你当前剪贴板里的内容。
- ⌨️ **全局快捷键**：无论你在哪个软件中，按下 `Ctrl + Shift + D` 随时呼唤小狗为你服务。
- 🤖 **超强大脑**：无缝接入全球顶尖大模型，支持 **DeepSeek、OpenAI、Claude、Gemini、Groq、Ollama** 和 **xAI** 等。
- 🧘 **健康关怀**：内置贴心的久坐休息提醒功能，工作再忙，小狗也会提醒你起来活动活动。
- 🚀 **静默运行**：支持开机自启，平时乖乖待在系统托盘，不打扰你的屏幕空间。

## 📦 下载与体验

访问我们的 [官方网站](https://dog-desk.vercel.app/) 获取最新版本，或直接在这里下载：

- 🪟 **Windows EXE 安装版**: [DogDesk_0.1.0_x64-setup.exe](./release/DogDesk_0.1.0_x64-setup.exe) *(推荐)*
- 🪟 **Windows MSI 安装包**: [DogDesk_0.1.0_x64_en-US.msi](./release/DogDesk_0.1.0_x64_en-US.msi)

## 🌐 官方指路

- 🏠 **产品主页**：[https://dog-desk.vercel.app/](https://dog-desk.vercel.app/)
- 💻 **开源仓库**：[https://github.com/lingcang728/DogDesk](https://github.com/lingcang728/DogDesk)

## 🛠️ 极客专属：本地开发

想要自己动手撸一只专属小狗？或者来参与贡献？跟着下面的步骤走吧！

### 1. 启动开发环境
```bash
cd desktop
npm install
npm run tauri dev
```

### 2. 构建安装包
```bash
cd desktop
npm run tauri build
```
构建产物将会乖乖躺在以下目录：
- EXE: `desktop/src-tauri/target/release/bundle/nsis/DogDesk_0.1.0_x64-setup.exe`
- MSI: `desktop/src-tauri/target/release/bundle/msi/DogDesk_0.1.0_x64_en-US.msi`

## 🗂️ 目录结构指北

```text
Dogdesk/
├── desktop/                 # Tauri 桌面端引用的核心宇宙
│   ├── src/                 # 前端视觉与交互逻辑 (React/Vite 驱动)
│   └── src-tauri/           # 坚如磐石的 Rust 后端
├── website/                 # 漂亮的官方落地页源码
└── release/                 # 构建好的安装包大本营
```


---
<div align="center">
  <sub>Made with ❤️ by 凌苍. 如果 DogDesk 帮到了你，不妨点个 ⭐ 支持一下吧！</sub>
</div>
