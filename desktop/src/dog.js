// ============================================================
// DogDesk Desktop - Dog Window Logic
// Double-click translate, drag-to-move, drop phrase to mouth, break reminders.
// ============================================================

import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
    AI_PROVIDER_PRESETS,
    getAiProviderPreset,
    getAiProviderLabel,
    getAiConfig,
    getAutostartConfig,
    saveAiConfig,
    saveAutostartConfig,
    markAiFirstLaunchDone,
    normalizeAiConfig,
    testAiConnection,
} from './shared.js';

const DOG_WINDOW_SIZE = new LogicalSize(180, 220);
const CONFIG_WINDOW_SIZE = new LogicalSize(440, 560);
const MAGNET_STICK_MS = 260;
const MAGNET_INHALE_MS = 220;
const SPEECH_SAFE_TOP = 4;
const DOUBLE_CLICK_GAP_MS = 320;
const SINGLE_CLICK_DELAY_MS = 240;
const PET_DURATION_MS = 980;
const CLIPBOARD_HAPPY_MS = 980;

const QUOTES = [
    '汪！今天也要加油哦 💪',
    '摸摸头就开心 😊',
    '阅读使人进步 📚',
    '你今天真棒 ✨',
    '记得喝水 💧',
    '休息一下眼睛吧 👀',
    '坚持就是胜利 🏆',
    '你是最棒的铲屎官 🐾',
    '汪汪！继续冲 🚀',
    '知识就是力量 🧠',
];

class DogApp {
    constructor() {
        this.state = 'sitting';
        this.runAnimFrame = null;
        this.container = null;
        this.dogEl = null;
        this.bubble = null;
        this.reminderBubble = null;
        this.lastClickTime = 0;
        this.configOverlay = null;
        this.configContext = { firstLaunch: false };
        this.dropTranslateInFlight = false;
        this.dragMagnetLocked = false;
        this.dragMagnetReleaseAt = 0;
        this.reminderStartedAtMs = 0;
        this.lastReminderToHeadClickMinutes = null;
        this.speechNudgeInFlight = false;
        this.singleClickTimer = null;
        this.happyResetTimer = null;
        this.queryingActive = false;
        this.init();
    }

    async init() {
        this.createDOM();
        this.setupDrag();
        this.setupDropToTranslate();
        await this.setupListeners();
        await this.syncAutostartSettingOnStartup();
        await this.maybeRunFirstLaunchConfig();
    }

    createDOM() {
        const app = document.getElementById('dog-app');

        this.container = document.createElement('div');
        this.container.className = 'dog-container mode-normal state-sitting';

        this.dogEl = document.createElement('div');
        this.dogEl.className = 'dog-sprite';
        this.dogEl.innerHTML = this.createDogSVG();
        this.container.appendChild(this.dogEl);

        this.bubble = document.createElement('div');
        this.bubble.className = 'speech-bubble';
        this.container.appendChild(this.bubble);

        app.appendChild(this.container);

        this.reminderBubble = document.createElement('div');
        this.reminderBubble.className = 'reminder-bubble';
        app.appendChild(this.reminderBubble);
    }

    createDogSVG() {
        return `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path class="dog-tail" d="M75 68 Q88 55 83 42"
              fill="none" stroke="#C4956A" stroke-width="4" stroke-linecap="round"/>
        <ellipse cx="50" cy="76" rx="22" ry="16" fill="#E8C89E" stroke="#C4956A" stroke-width="2"/>
        <g class="dog-legs-front">
          <ellipse cx="36" cy="92" rx="8" ry="5" fill="#E8C89E" stroke="#C4956A" stroke-width="1.5"/>
          <ellipse cx="64" cy="92" rx="8" ry="5" fill="#E8C89E" stroke="#C4956A" stroke-width="1.5"/>
        </g>
        <g class="dog-ears">
          <ellipse class="dog-ear-l" cx="27" cy="36" rx="10" ry="16" fill="#C4956A" stroke="#A0784A" stroke-width="1.5"
                   transform="rotate(-20 27 36)"/>
          <ellipse class="dog-ear-r" cx="73" cy="36" rx="10" ry="16" fill="#C4956A" stroke="#A0784A" stroke-width="1.5"
                   transform="rotate(20 73 36)"/>
        </g>
        <circle cx="50" cy="40" r="25" fill="#E8C89E" stroke="#C4956A" stroke-width="2"/>
        <ellipse cx="50" cy="46" rx="16" ry="13" fill="#F5DFC5"/>
        <g class="dog-eyes">
          <circle class="dog-eye-l" cx="40" cy="38" r="4" fill="#333"/>
          <circle class="dog-eye-r" cx="60" cy="38" r="4" fill="#333"/>
          <circle cx="41.5" cy="36.5" r="1.5" fill="white"/>
          <circle cx="61.5" cy="36.5" r="1.5" fill="white"/>
        </g>
        <ellipse cx="50" cy="48" rx="4" ry="3" fill="#333"/>
        <ellipse cx="49" cy="47" rx="1.5" ry="1" fill="white" opacity="0.3"/>
        <path class="dog-mouth" d="M46 51 Q50 56 54 51"
              fill="none" stroke="#8B6914" stroke-width="1.5" stroke-linecap="round"/>
        <ellipse class="dog-tongue" cx="50" cy="54" rx="3" ry="2" fill="#E57373"/>
        <circle cx="33" cy="46" r="4.5" fill="rgba(255,140,140,0.35)"/>
        <circle cx="67" cy="46" r="4.5" fill="rgba(255,140,140,0.35)"/>
        <path d="M33 62 Q50 68 67 62" fill="none" stroke="#e57373" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="50" cy="66" r="2.5" fill="#ffd54f" stroke="#e6a817" stroke-width="0.5"/>
      </svg>
    `;
    }

    showHint(text, durationMs = 2200) {
        this.bubble.textContent = text;
        this.positionSpeechBubble();
        this.bubble.classList.add('visible');
        requestAnimationFrame(() => this.positionSpeechBubble());
        setTimeout(() => this.bubble.classList.remove('visible'), durationMs);
    }

    positionSpeechBubble() {
        if (!this.bubble || !this.container) return;
        const anchorBottom = this.container.offsetHeight + 6;
        this.bubble.style.bottom = `${anchorBottom}px`;
        const rect = this.bubble.getBoundingClientRect();
        if (rect.top >= SPEECH_SAFE_TOP) {
            return;
        }
        const overflowTop = Math.ceil(SPEECH_SAFE_TOP - rect.top);
        this.nudgeWindowDown(overflowTop);
    }

    async nudgeWindowDown(deltaPx) {
        if (deltaPx <= 0 || this.speechNudgeInFlight || this.state === 'running') {
            return;
        }
        this.speechNudgeInFlight = true;
        try {
            const win = getCurrentWebviewWindow();
            const pos = await win.outerPosition();
            await win.setPosition(new PhysicalPosition(pos.x, pos.y + deltaPx));
        } catch (err) {
            console.error('Failed to nudge dog window:', err);
        } finally {
            this.speechNudgeInFlight = false;
        }
    }

    formatDurationLabel(totalMinutes) {
        const mins = Math.max(0, Number(totalMinutes) || 0);
        const hours = Math.floor(mins / 60);
        const rem = mins % 60;
        if (hours <= 0) return `${rem}分钟`;
        return `${hours}小时${rem}分钟`;
    }

    buildReminderGapQuote() {
        const minutes = Number(this.lastReminderToHeadClickMinutes);
        if (!Number.isFinite(minutes) || minutes <= 0) return null;
        const label = this.formatDurationLabel(minutes);
        if (minutes <= 5) {
            return `上次提醒后你${label}就点我了，休息节奏很棒 👍`;
        }
        if (minutes <= 20) {
            return `上次提醒后过了${label}你才点我，记得早点休息哦 😴`;
        }
        return `上次提醒到你点我间隔了${label}，这次别久坐太久 🧘`;
    }

    setupDrag() {
        let startX;
        let startY;
        let mousedownTime;
        let isDragging = false;

        this.dogEl.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || this.isConfigPanelVisible()) return;
            isDragging = false;
            startX = e.screenX;
            startY = e.screenY;
            mousedownTime = Date.now();

            const onMove = async (e2) => {
                const dx = Math.abs(e2.screenX - startX);
                const dy = Math.abs(e2.screenY - startY);
                if (dx > 3 || dy > 3) {
                    isDragging = true;
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    const win = getCurrentWebviewWindow();
                    await win.startDragging();
                }
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                if (!isDragging && Date.now() - mousedownTime < 300) {
                    this.handleClick();
                }
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    handleClick() {
        if (this.isConfigPanelVisible()) return;

        const now = Date.now();
        const isDoubleClick = now - this.lastClickTime <= DOUBLE_CLICK_GAP_MS;

        if (isDoubleClick) {
            this.lastClickTime = 0;
            if (this.singleClickTimer) {
                clearTimeout(this.singleClickTimer);
                this.singleClickTimer = null;
            }
            this.translateClipboard();
            return;
        }

        this.lastClickTime = now;
        if (this.singleClickTimer) {
            clearTimeout(this.singleClickTimer);
        }
        this.singleClickTimer = setTimeout(() => {
            this.singleClickTimer = null;
            if (this.state === 'running') {
                this.dismissReminder('head_click');
            } else {
                this.pet();
            }
        }, SINGLE_CLICK_DELAY_MS);
    }

    setHappyFor(durationMs) {
        this.setState('happy');
        if (this.happyResetTimer) {
            clearTimeout(this.happyResetTimer);
        }
        this.happyResetTimer = setTimeout(() => {
            this.happyResetTimer = null;
            if (this.state === 'happy') {
                this.setState('sitting');
            }
        }, Math.max(0, durationMs));
    }

    async translateClipboard() {
        try {
            const clipText = await invoke('read_clipboard');
            const text = this.normalizeDropText(clipText);
            if (!text) {
                this.showHint('请先复制文本，再双击我。');
                return;
            }

            this.startQuerying();

            await invoke('translate_text', { text });
        } catch (e) {
            console.error('Translate clipboard failed:', e);
            this.stopQuerying();
        }
    }

    normalizeDropText(raw) {
        const collapsed = String(raw || '').replace(/\s+/g, ' ').trim();
        return collapsed.slice(0, 700);
    }

    async extractDroppedText(dataTransfer) {
        if (!dataTransfer) return '';

        const tryType = (type) => {
            try {
                return this.normalizeDropText(dataTransfer.getData(type));
            } catch (e) {
                return '';
            }
        };

        const preferredTypes = ['text/plain', 'text', 'Text'];
        for (const type of preferredTypes) {
            const value = tryType(type);
            if (value) return value;
        }

        const dataTypes = Array.from(dataTransfer.types || []);
        for (const type of dataTypes) {
            if (!/text/i.test(type)) continue;
            const value = tryType(type);
            if (value) return value;
        }

        const textItem = Array.from(dataTransfer.items || []).find((item) => item.kind === 'string');
        if (!textItem) return '';

        return new Promise((resolve) => {
            try {
                textItem.getAsString((value) => {
                    resolve(this.normalizeDropText(value));
                });
            } catch (e) {
                resolve('');
            }
        });
    }

    getMouthGeometry() {
        const rect = this.dogEl.getBoundingClientRect();
        return {
            mouthX: rect.left + rect.width * 0.5,
            mouthY: rect.top + rect.height * 0.66,
            mouthDx: rect.width * 0.4,
            mouthDy: rect.height * 0.34,
            magnetDx: rect.width * 0.98,
            magnetDy: rect.height * 0.86,
        };
    }

    isDropOnMouth(x, y) {
        const g = this.getMouthGeometry();
        return Math.abs(x - g.mouthX) <= g.mouthDx && Math.abs(y - g.mouthY) <= g.mouthDy;
    }

    isInMagnetZone(x, y) {
        const g = this.getMouthGeometry();
        const nx = (x - g.mouthX) / g.magnetDx;
        const ny = (y - g.mouthY) / g.magnetDy;
        return nx * nx + ny * ny <= 1;
    }

    getMagnetStrength(x, y) {
        const g = this.getMouthGeometry();
        const nx = (x - g.mouthX) / g.magnetDx;
        const ny = (y - g.mouthY) / g.magnetDy;
        const normalizedDistance = Math.min(1, Math.sqrt(nx * nx + ny * ny));
        return 1 - normalizedDistance;
    }

    setMagnetVisual(strength) {
        this.container.style.setProperty('--magnet-strength', String(Math.max(0, Math.min(1, strength))));
        this.container.classList.add('drop-target');
        this.container.classList.add('magnet-active');
    }

    clearDragVisual() {
        this.container.style.removeProperty('--magnet-strength');
        this.container.classList.remove('drop-target');
        this.container.classList.remove('magnet-active');
        this.container.classList.remove('magnet-inhale');
        this.dragMagnetLocked = false;
        this.dragMagnetReleaseAt = 0;
    }

    async playMagnetInhale() {
        this.container.classList.remove('magnet-inhale');
        // Reflow to restart inhale animation.
        void this.container.offsetWidth;
        this.container.classList.add('magnet-inhale');
        await new Promise((resolve) => setTimeout(resolve, MAGNET_INHALE_MS));
        this.container.classList.remove('magnet-inhale');
    }

    setupDropToTranslate() {
        document.addEventListener('dragover', (e) => {
            if (this.isConfigPanelVisible()) return;
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
            const onMouth = this.isDropOnMouth(e.clientX, e.clientY);
            const inMagnet = this.isInMagnetZone(e.clientX, e.clientY);
            if (onMouth || inMagnet) {
                const strength = this.getMagnetStrength(e.clientX, e.clientY);
                this.setMagnetVisual(Math.max(0.2, strength));
                if (inMagnet) {
                    this.dragMagnetLocked = true;
                    this.dragMagnetReleaseAt = Date.now() + MAGNET_STICK_MS;
                }
            } else if (this.dragMagnetLocked && Date.now() < this.dragMagnetReleaseAt) {
                this.setMagnetVisual(0.22);
            } else {
                this.clearDragVisual();
            }
        });

        document.addEventListener('dragleave', (e) => {
            if (
                e.clientX <= 0 ||
                e.clientY <= 0 ||
                e.clientX >= window.innerWidth ||
                e.clientY >= window.innerHeight
            ) {
                this.clearDragVisual();
            }
        });

        document.addEventListener('dragend', () => {
            this.clearDragVisual();
        });

        document.addEventListener('drop', async (e) => {
            if (this.isConfigPanelVisible()) return;
            e.preventDefault();
            const onMouth = this.isDropOnMouth(e.clientX, e.clientY);
            const inMagnet = this.isInMagnetZone(e.clientX, e.clientY);
            const absorbedByMagnet = inMagnet || (this.dragMagnetLocked && Date.now() < this.dragMagnetReleaseAt);
            if (!onMouth && !absorbedByMagnet) {
                this.clearDragVisual();
                this.showHint('把短语拖到我嘴边再喂我。');
                return;
            }

            if (this.dropTranslateInFlight) {
                this.clearDragVisual();
                this.showHint('我还在理解上一句，请稍等。');
                return;
            }

            const text = await this.extractDroppedText(e.dataTransfer);
            if (!text) {
                this.clearDragVisual();
                this.showHint('没有读到拖拽文本，请重试。');
                return;
            }
            if (absorbedByMagnet && !onMouth) {
                await this.playMagnetInhale();
            }

            this.dropTranslateInFlight = true;
            try {
                this.startQuerying();
                await invoke('translate_text', { text });
            } catch (err) {
                console.error('Drop translate failed:', err);
                this.showHint('翻译请求失败，请重试。');
                this.stopQuerying();
            } finally {
                this.dropTranslateInFlight = false;
                this.clearDragVisual();
            }
        });
    }

    startQuerying() {
        this.queryingActive = true;
        if (this.state !== 'running') {
            this.setState('querying');
        }
    }

    stopQuerying() {
        this.queryingActive = false;
        if (this.state === 'querying') {
            this.setState('sitting');
        }
    }

    createConfigPanel() {
        if (this.configOverlay) return this.configOverlay;

        const overlay = document.createElement('div');
        overlay.className = 'deepseek-config-overlay';
        const providerOptions = AI_PROVIDER_PRESETS.map(
            (preset) => `<option value="${preset.id}">${preset.label}</option>`
        ).join('');

        overlay.innerHTML = `
      <div class="deepseek-config-card">
        <div class="deepseek-config-header">
          <h2>AI 翻译设置</h2>
          <button type="button" class="config-close-btn" data-role="close">×</button>
        </div>
        <p class="deepseek-config-desc">
          可配置主流模型厂商 API。配置后，翻译将始终优先使用你设置的 AI 接口。
        </p>

        <label class="config-row config-toggle">
          <input type="checkbox" data-field="enabled">
          <span>启用 AI 接口翻译</span>
        </label>

        <label class="config-row config-toggle">
          <input type="checkbox" data-field="autostartEnabled">
          <span>开机自启动（默认开启）</span>
        </label>

        <label class="config-row">
          <span>服务商</span>
          <select data-field="provider">${providerOptions}</select>
        </label>

        <label class="config-row">
          <span>接口密钥</span>
          <input type="password" data-field="apiKey" placeholder="sk-..." autocomplete="off">
        </label>

        <label class="config-row">
          <span>模型</span>
          <input type="text" data-field="model" placeholder="模型名称" autocomplete="off">
        </label>

        <label class="config-row">
          <span>接口地址</span>
          <input type="text" data-field="endpoint" placeholder="https://..." autocomplete="off">
        </label>

        <div class="config-status" data-role="status"></div>

        <div class="config-actions">
          <button type="button" data-role="test">测试连接</button>
          <button type="button" class="primary" data-role="save">保存配置</button>
          <button type="button" data-role="secondary">稍后再说</button>
        </div>
      </div>
    `;

        document.getElementById('dog-app').appendChild(overlay);
        this.configOverlay = overlay;
        this.bindConfigPanelEvents();
        return overlay;
    }

    bindConfigPanelEvents() {
        const panel = this.configOverlay;
        const header = panel.querySelector('.deepseek-config-header');
        const closeBtn = panel.querySelector('[data-role="close"]');
        const testBtn = panel.querySelector('[data-role="test"]');
        const saveBtn = panel.querySelector('[data-role="save"]');
        const secondaryBtn = panel.querySelector('[data-role="secondary"]');
        const providerField = panel.querySelector('[data-field="provider"]');
        const modelField = panel.querySelector('[data-field="model"]');
        const endpointField = panel.querySelector('[data-field="endpoint"]');

        const applyProviderDefaults = (force = true) => {
            const preset = getAiProviderPreset(providerField.value);
            if (!preset) return;
            if (force || !modelField.value.trim()) {
                modelField.value = preset.model || '';
            }
            if (force || !endpointField.value.trim()) {
                endpointField.value = preset.endpoint || '';
            }
        };

        providerField.addEventListener('change', () => {
            applyProviderDefaults(true);
            this.setConfigStatus(`已切换到 ${getAiProviderLabel(providerField.value)}。`, 'pending');
        });

        header.addEventListener('mousedown', async (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('button, input, textarea, select, label')) return;
            try {
                const win = getCurrentWebviewWindow();
                await win.startDragging();
            } catch (err) {
                console.error('Failed to drag config window:', err);
            }
        });

        closeBtn.addEventListener('click', async () => {
            if (this.configContext.firstLaunch) {
                await this.handleConfigSkip();
                return;
            }
            await this.closeConfigPanel({ markFirstLaunch: false });
        });

        testBtn.addEventListener('click', async () => {
            const values = this.getConfigFormValues();
            this.setConfigStatus('正在测试连接...', 'pending');
            this.toggleConfigActions(true);

            const result = await testAiConnection({
                enabled: true,
                provider: values.provider,
                apiKey: values.apiKey,
                model: values.model,
                endpoint: values.endpoint,
            });

            this.toggleConfigActions(false);
            if (result.ok) {
                this.setConfigStatus(`连接成功：${result.preview}`, 'success');
            } else {
                this.setConfigStatus(result.error || '连接失败', 'error');
            }
        });

        saveBtn.addEventListener('click', async () => {
            const values = this.getConfigFormValues();
            const normalized = normalizeAiConfig(values, getAiConfig());
            saveAiConfig(normalized);
            const autostartResult = await this.applyAutostartSetting(values.autostartEnabled);
            if (!autostartResult.ok) {
                this.setConfigStatus(autostartResult.error, 'error');
                return;
            }

            this.setConfigStatus('已保存。', 'success');
            await this.closeConfigPanel({ markFirstLaunch: this.configContext.firstLaunch });
            this.showHint(
                normalized.enabled && normalized.apiKey
                    ? `${getAiProviderLabel(normalized.provider)} 已启用`
                    : '配置已保存'
            );
        });

        secondaryBtn.addEventListener('click', async () => {
            await this.handleConfigSkip();
        });
    }

    getConfigFormValues() {
        const panel = this.configOverlay;
        return {
            enabled: panel.querySelector('[data-field="enabled"]').checked,
            autostartEnabled: panel.querySelector('[data-field="autostartEnabled"]').checked,
            provider: panel.querySelector('[data-field="provider"]').value.trim(),
            apiKey: panel.querySelector('[data-field="apiKey"]').value.trim(),
            model: panel.querySelector('[data-field="model"]').value.trim(),
            endpoint: panel.querySelector('[data-field="endpoint"]').value.trim(),
        };
    }

    fillConfigForm(config) {
        const panel = this.configOverlay;
        const normalized = normalizeAiConfig(config, getAiConfig());
        const autostart = getAutostartConfig();
        panel.querySelector('[data-field="enabled"]').checked = Boolean(normalized.enabled);
        panel.querySelector('[data-field="autostartEnabled"]').checked = Boolean(autostart.enabled);
        panel.querySelector('[data-field="provider"]').value = normalized.provider;
        panel.querySelector('[data-field="apiKey"]').value = normalized.apiKey || '';
        panel.querySelector('[data-field="model"]').value = normalized.model || '';
        panel.querySelector('[data-field="endpoint"]').value = normalized.endpoint || '';
    }

    setConfigStatus(text, type = 'pending') {
        const status = this.configOverlay.querySelector('[data-role="status"]');
        status.textContent = text || '';
        status.className = `config-status ${type}`;
    }

    toggleConfigActions(disabled) {
        const buttons = this.configOverlay.querySelectorAll('.config-actions button');
        buttons.forEach((btn) => {
            btn.disabled = disabled;
        });
    }

    async resizeForConfig(isOpen) {
        const win = getCurrentWebviewWindow();
        try {
            await win.setResizable(true);
            await win.setSize(isOpen ? CONFIG_WINDOW_SIZE : DOG_WINDOW_SIZE);
            if (isOpen) {
                await win.center();
            }
            await win.setResizable(false);
        } catch (e) {
            console.error('Failed to resize dog window:', e);
            this.showHint('窗口尺寸调整失败，请重启应用后重试。');
        }
    }

    isConfigPanelVisible() {
        return Boolean(this.configOverlay && this.configOverlay.classList.contains('visible'));
    }

    async openConfigPanel({ firstLaunch }) {
        this.createConfigPanel();
        this.configContext = { firstLaunch: Boolean(firstLaunch) };

        const config = getAiConfig();
        this.fillConfigForm(config);

        const secondaryBtn = this.configOverlay.querySelector('[data-role="secondary"]');
        secondaryBtn.textContent = firstLaunch ? '稍后再说' : '关闭';

        this.setConfigStatus(firstLaunch ? '首次启动：请先配置服务商，再测试并保存。' : '', 'pending');
        this.configOverlay.classList.add('visible');
        await this.resizeForConfig(true);
    }

    async closeConfigPanel({ markFirstLaunch }) {
        if (markFirstLaunch) {
            markAiFirstLaunchDone();
        }
        if (this.configOverlay) {
            this.configOverlay.classList.remove('visible');
        }
        await this.resizeForConfig(false);
    }

    async handleConfigSkip() {
        if (this.configContext.firstLaunch) {
            saveAiConfig({ enabled: false });
            await this.closeConfigPanel({ markFirstLaunch: true });
            this.showHint('已跳过配置，可右键小狗随时再设置。');
            return;
        }
        await this.closeConfigPanel({ markFirstLaunch: false });
    }

    async getSystemAutostartEnabled() {
        return await invoke('plugin:autostart|is_enabled');
    }

    async setSystemAutostartEnabled(enabled) {
        const command = enabled ? 'plugin:autostart|enable' : 'plugin:autostart|disable';
        await invoke(command);
    }

    async applyAutostartSetting(enabled) {
        const desired = Boolean(enabled);
        try {
            const current = await this.getSystemAutostartEnabled();
            if (current !== desired) {
                await this.setSystemAutostartEnabled(desired);
            }
            saveAutostartConfig({ configured: true, enabled: desired });
            return { ok: true };
        } catch (err) {
            console.error('Failed to update autostart setting:', err);
            return { ok: false, error: '开机自启动设置失败，请稍后重试。' };
        }
    }

    async syncAutostartSettingOnStartup() {
        const config = getAutostartConfig();
        const desired = config.configured ? config.enabled : true;
        try {
            const current = await this.getSystemAutostartEnabled();
            if (current !== desired) {
                await this.setSystemAutostartEnabled(desired);
            }
            saveAutostartConfig({ configured: true, enabled: desired });
        } catch (err) {
            console.error('Failed to sync autostart on startup:', err);
        }
    }

    async maybeRunFirstLaunchConfig() {
        const config = getAiConfig();
        if (config.firstLaunchDone) return;
        await this.openConfigPanel({ firstLaunch: true });
    }

    setState(newState) {
        if (this.state === newState) return;
        this.state = newState;
        this.container.className = `dog-container mode-${newState === 'running' ? 'reminder' : 'normal'} state-${newState}`;
    }

    pet() {
        this.setHappyFor(PET_DURATION_MS);
        let quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        // Occasionally inject a usage-time based rest reminder.
        if (Math.random() < 0.35) {
            const usageQuote = this.buildReminderGapQuote();
            if (usageQuote) {
                quote = usageQuote;
            }
        }
        this.bubble.textContent = quote;
        this.positionSpeechBubble();
        this.bubble.classList.add('visible');
        requestAnimationFrame(() => this.positionSpeechBubble());
        setTimeout(() => {
            this.bubble.classList.remove('visible');
        }, PET_DURATION_MS);
    }

    startReminder() {
        this.stopQuerying();
        this.setState('running');
        this.reminderStartedAtMs = Date.now();
        this.reminderBubble.innerHTML = `
      <span>起来活动一下，喝口水吧。</span>
      <button class="dismiss-btn">我已休息</button>
    `;
        this.reminderBubble.classList.add('visible');
        const btn = this.reminderBubble.querySelector('.dismiss-btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dismissReminder('button');
            });
        }
        this.startRunning();
    }

    startRunning() {
        const spriteEl = this.dogEl;
        const containerWidth = window.innerWidth;
        let posX = containerWidth - 80;
        let dir = -1;
        const speed = 2.5;
        spriteEl.style.position = 'absolute';
        spriteEl.style.bottom = '30px';
        const animate = () => {
            if (this.state !== 'running') return;
            posX += speed * dir;
            if (posX < 10) {
                dir = 1;
                spriteEl.style.transform = 'scaleX(-1)';
            } else if (posX > containerWidth - 80) {
                dir = -1;
                spriteEl.style.transform = 'scaleX(1)';
            }
            spriteEl.style.left = `${posX}px`;
            spriteEl.style.right = 'auto';
            this.runAnimFrame = requestAnimationFrame(animate);
        };
        this.runAnimFrame = requestAnimationFrame(animate);
    }

    async dismissReminder(reason = 'unknown') {
        if (reason === 'head_click' && this.reminderStartedAtMs > 0) {
            const elapsedMin = Math.max(1, Math.round((Date.now() - this.reminderStartedAtMs) / 60000));
            this.lastReminderToHeadClickMinutes = elapsedMin;
        }
        this.reminderStartedAtMs = 0;

        if (this.runAnimFrame) {
            cancelAnimationFrame(this.runAnimFrame);
            this.runAnimFrame = null;
        }
        this.reminderBubble.classList.remove('visible');
        this.dogEl.style.transform = '';
        this.dogEl.style.left = '';
        this.dogEl.style.right = '';
        this.dogEl.style.position = '';
        if (this.queryingActive) {
            this.setState('querying');
        } else {
            this.setState('sitting');
        }
        try {
            await invoke('dismiss_reminder');
        } catch (e) {
            // Ignore.
        }
    }

    async setupListeners() {
        await listen('break-reminder', () => this.startReminder());
        await listen('reminder-dismissed', () => {
            if (this.state === 'running') this.dismissReminder('external');
        });
        await listen('translation-started', () => {
            if (this.state !== 'running' && !this.isConfigPanelVisible()) {
                this.startQuerying();
            }
        });
        await listen('translation-finished', () => {
            this.stopQuerying();
        });

        this.dogEl.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            if (this.isConfigPanelVisible()) return;
            await this.openConfigPanel({ firstLaunch: false });
        });
    }
}

new DogApp();

