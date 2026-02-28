// ============================================================
// DogDesk Desktop - Translation Popup Logic
// ============================================================

import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { translateTextWithUnderstanding, fetchDictionary, escapeHtml, getAiProviderLabel } from './shared.js';

let autoHideTimer = null;
let autoHideDeadline = 0;
let autoHideRemainingMs = 0;
let autoHidePaused = false;
let blurHideTimer = null;

const DICTIONARY_WAIT_MS = 700;
const MIN_HIDE_MS = 12000;
const MAX_HIDE_MS = 90000;
const BLUR_HIDE_MS = 1200;

function normalizeInputText(raw) {
    return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 700);
}

function isSingleEnglishWord(text) {
    return /^[A-Za-z][A-Za-z'-]{0,63}$/.test(text);
}

function shortLabel(text, max = 26) {
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(num, min, max) {
    return Math.max(min, Math.min(max, num));
}

function clearAutoHideTimer() {
    if (autoHideTimer) {
        clearTimeout(autoHideTimer);
        autoHideTimer = null;
    }
}

function clearBlurHideTimer() {
    if (blurHideTimer) {
        clearTimeout(blurHideTimer);
        blurHideTimer = null;
    }
}

function scheduleAutoHide(ms) {
    clearAutoHideTimer();
    autoHideRemainingMs = Math.max(1500, ms);
    autoHideDeadline = Date.now() + autoHideRemainingMs;
    autoHideTimer = setTimeout(() => {
        hideWindow();
    }, autoHideRemainingMs);
}

function pauseAutoHide() {
    if (autoHidePaused || !autoHideTimer) return;
    autoHidePaused = true;
    autoHideRemainingMs = Math.max(1200, autoHideDeadline - Date.now());
    clearAutoHideTimer();
}

function resumeAutoHide() {
    if (!autoHidePaused) return;
    autoHidePaused = false;
    scheduleAutoHide(autoHideRemainingMs);
}

function computeAutoHideMs(inputText, translationText, explanationText, singleWord, isError) {
    const contentLen = String(inputText || '').length + String(translationText || '').length + String(explanationText || '').length;
    const base = singleWord ? 13000 : 18000;
    const scaled = contentLen * 48;
    const bonus = isError ? 9000 : 0;
    return clamp(base + scaled + bonus, MIN_HIDE_MS, MAX_HIDE_MS);
}

function bindCardHumanizedBehavior(app) {
    const card = app.querySelector('.trans-card');
    if (!card) return;
    card.addEventListener('mouseenter', () => {
        clearBlurHideTimer();
        pauseAutoHide();
    });
    card.addEventListener('mouseleave', () => {
        resumeAutoHide();
    });
}

function scheduleHideOnBlur() {
    clearBlurHideTimer();
    blurHideTimer = setTimeout(() => {
        hideWindow();
    }, BLUR_HIDE_MS);
}

async function init() {
    const app = document.getElementById('trans-app');
    const win = getCurrentWebviewWindow();

    window.addEventListener('blur', () => {
        scheduleHideOnBlur();
    });
    window.addEventListener('focus', () => {
        clearBlurHideTimer();
    });

    await listen('trigger-translate', async (event) => {
        const text = normalizeInputText(event.payload);
        if (!text) return;

        clearBlurHideTimer();
        autoHidePaused = false;

        const singleWord = isSingleEnglishWord(text);
        const lookupWord = text.split(/\s+/)[0];

        app.innerHTML = `
      <div class="trans-card">
        <div class="trans-loading">🐤 理解中...</div>
      </div>
    `;

        try {
            const preferredPromise = translateTextWithUnderstanding(text);
            const dictionaryPromise = singleWord ? fetchDictionary(lookupWord) : Promise.resolve(null);

            const preferredResult = await preferredPromise;
            const enResult = singleWord
                ? await Promise.race([dictionaryPromise, delay(DICTIONARY_WAIT_MS).then(() => null)])
                : null;

            const translationResult = preferredResult?.translation || preferredResult?.text || '';
            const explanationResult = preferredResult?.explanation || '';
            const providerLabel =
                preferredResult?.providerLabel ||
                (preferredResult?.provider === 'mymemory'
                    ? 'MyMemory'
                    : preferredResult?.provider
                      ? getAiProviderLabel(preferredResult.provider)
                      : '');

            let html = '<div class="trans-card">';
            html += '<div class="trans-header"><div>';
            html += `<span class="trans-word" title="${escapeHtml(text)}">${escapeHtml(shortLabel(text))}</span>`;
            if (singleWord && enResult && enResult.phonetic) {
                html += `<span class="trans-phonetic">${escapeHtml(enResult.phonetic)}</span>`;
            }
            html += '</div>';
            html += '<button class="trans-close" title="关闭">✕</button>';
            html += '</div>';
            html += '<div class="trans-body">';

            if (!singleWord) {
                html += `<div class="trans-source">原文：${escapeHtml(text)}</div>`;
            }

            if (translationResult) {
                const translationLabel = preferredResult?.targetLanguage === 'English' ? '英文表达' : '翻译结果';
                html += `<div class="trans-cn"><strong>${escapeHtml(translationLabel)}：</strong>${escapeHtml(translationResult)}</div>`;
            }

            if (explanationResult) {
                html += `<div class="trans-explain"><strong>AI 理解：</strong>${escapeHtml(explanationResult)}</div>`;
            }

            if (providerLabel) {
                html += `<div class="trans-provider">来源：${escapeHtml(providerLabel)}</div>`;
            }

            if (singleWord && enResult && enResult.meanings) {
                enResult.meanings.slice(0, 2).forEach((m) => {
                    html += `<div class="trans-pos">${escapeHtml(m.partOfSpeech)}</div>`;
                    m.definitions.slice(0, 2).forEach((d) => {
                        html += `<div class="trans-def">${escapeHtml(d.definition)}</div>`;
                        if (d.example) {
                            html += `<div class="trans-example">"${escapeHtml(d.example)}"</div>`;
                        }
                    });
                });
            }

            if (!translationResult && !explanationResult && !enResult) {
                html += '<div class="trans-error">🐤 暂时没有拿到结果，请稍后重试。</div>';
            }

            html += '</div></div>';
            app.innerHTML = html;

            const closeBtn = app.querySelector('.trans-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => hideWindow());
            }
            const header = app.querySelector('.trans-header');
            if (header) {
                header.addEventListener('mousedown', async (e) => {
                    if (e.button !== 0) return;
                    if (e.target.closest('.trans-close')) return;
                    try {
                        await win.startDragging();
                    } catch (err) {
                        console.error('Failed to drag translation window:', err);
                    }
                });
            }

            bindCardHumanizedBehavior(app);

            requestAnimationFrame(() => {
                invoke('reposition_translation', { settled: true }).catch((err) => {
                    console.error('Failed to reposition translation window:', err);
                });
            });
            invoke('translation_ready').catch((err) => {
                console.error('Failed to notify translation ready:', err);
            });

            const hideMs = computeAutoHideMs(
                text,
                translationResult,
                explanationResult,
                singleWord,
                Boolean(preferredResult?.isError)
            );
            scheduleAutoHide(hideMs);
        } catch (e) {
            app.innerHTML = `
        <div class="trans-card">
          <div class="trans-error">🐤 理解失败，请稍后再试。</div>
        </div>
      `;
            invoke('translation_ready').catch((err) => {
                console.error('Failed to notify translation failure:', err);
            });
            scheduleAutoHide(7000);
        }
    });

    document.addEventListener('mousedown', (e) => {
        const card = document.querySelector('.trans-card');
        if (card && !card.contains(e.target)) {
            hideWindow();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideWindow();
        }
    });
}

async function hideWindow() {
    clearAutoHideTimer();
    clearBlurHideTimer();
    autoHidePaused = false;
    try {
        await invoke('hide_translation');
    } catch (e) {
        console.error('Failed to hide translation window:', e);
    }
}

init();
