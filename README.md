# 🐶 DogDesk

<div align="center">
  <h1>🐕 DogDesk 🐾</h1>
  <p><strong>一款专为 Windows 打造的灵动桌面陪伴宠物</strong></p>
  
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

在这个快节奏的数字世界里，你是否也需要一个安静、贴心的陪伴？

**DogDesk** 是一只趴在你桌面上的电子小狗。它不会打扰你工作，但会默默守望着你。当你在屏幕前久坐不运动时，它会贴心地提醒你起来喝口水、活动一下筋骨。当然，如果你偶尔遇到了看不懂的外语，它也能充当你的专属智能翻译官！🌟

## ✨ 核心特色

- 🧘 **健康陪伴**：内置智能的久坐与休息提醒系统。工作再忙碌，你的小狗也会按时提醒你离开屏幕，喝杯水，放松一下眼睛。它不仅是宠物，更是你的健康大管家。
- 🐾 **灵动随心**：安安静静地趴在你的桌面上，陪伴你度过每一个敲击键盘的日夜。支持静默运行与开机自启，平时乖乖待在系统托盘，不占据你宝贵的屏幕空间。
- 🪄 **超神副业 (AI 翻译)**：虽然本职工作是陪伴，但这只小狗其实是个“语言天才”！
  - **拖拽秒翻**：只需选中任意文本，拖拽喂给桌面的小狗，即可瞬间在它头顶看到翻译结果！
  - **双击快翻**：直接双击小狗，快速翻译你当前剪贴板里的内容。
  - **全局呼唤**：无论你在哪个软件中，按下 `Ctrl + Shift + D` 随时呼唤小狗为你翻译。
  - **最强大脑**：无缝接入全球顶尖大模型，支持 **DeepSeek、OpenAI、Claude、Gemini、Groq、Ollama** 和 **xAI** 等。

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
