// ============================================================
// DogDesk Desktop - Shared Translation + Multi-Provider AI API
// ============================================================

export const AI_PROVIDER_PRESETS = [
    {
        id: 'deepseek',
        label: 'DeepSeek',
        protocol: 'openai',
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        model: 'deepseek-chat',
    },
    {
        id: 'openai',
        label: 'OpenAI',
        protocol: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o-mini',
    },
    {
        id: 'anthropic',
        label: 'Anthropic Claude',
        protocol: 'anthropic',
        endpoint: 'https://api.anthropic.com/v1/messages',
        model: 'claude-3-5-haiku-latest',
    },
    {
        id: 'gemini',
        label: 'Google Gemini',
        protocol: 'gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        model: 'gemini-2.0-flash',
    },
    {
        id: 'azure_openai',
        label: 'Azure OpenAI',
        protocol: 'azure-openai',
        endpoint:
            'https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT/chat/completions?api-version=2024-08-01-preview',
        model: 'YOUR-DEPLOYMENT',
    },
    {
        id: 'openrouter',
        label: 'OpenRouter',
        protocol: 'openai',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        model: 'openai/gpt-4o-mini',
    },
    {
        id: 'groq',
        label: 'Groq',
        protocol: 'openai',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.3-70b-versatile',
    },
    {
        id: 'together',
        label: 'Together AI',
        protocol: 'openai',
        endpoint: 'https://api.together.xyz/v1/chat/completions',
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    },
    {
        id: 'fireworks',
        label: 'Fireworks',
        protocol: 'openai',
        endpoint: 'https://api.fireworks.ai/inference/v1/chat/completions',
        model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    },
    {
        id: 'mistral',
        label: 'Mistral',
        protocol: 'openai',
        endpoint: 'https://api.mistral.ai/v1/chat/completions',
        model: 'mistral-small-latest',
    },
    {
        id: 'xai',
        label: 'xAI',
        protocol: 'openai',
        endpoint: 'https://api.x.ai/v1/chat/completions',
        model: 'grok-2-latest',
    },
    {
        id: 'moonshot',
        label: 'Moonshot',
        protocol: 'openai',
        endpoint: 'https://api.moonshot.cn/v1/chat/completions',
        model: 'moonshot-v1-8k',
    },
    {
        id: 'siliconflow',
        label: 'SiliconFlow',
        protocol: 'openai',
        endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
        model: 'Qwen/Qwen2.5-72B-Instruct',
    },
    {
        id: 'ollama',
        label: 'Ollama (Local)',
        protocol: 'openai',
        endpoint: 'http://127.0.0.1:11434/v1/chat/completions',
        model: 'qwen2.5:7b',
    },
    {
        id: 'custom_openai',
        label: 'Custom (OpenAI-Compatible)',
        protocol: 'openai',
        endpoint: 'https://your-endpoint/v1/chat/completions',
        model: 'your-model',
    },
];

export const AI_DEFAULT_PROVIDER = 'deepseek';
export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-chat';
export const DEEPSEEK_DEFAULT_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

const AI_TIMEOUT_MS = 14000;
const AI_RETRY_TIMEOUT_MS = 26000;
const AI_MAX_OUTPUT_TOKENS = 760;
const CACHE_MAX_ITEMS = 120;
const UNDERSTANDING_CACHE = new Map();

const STORAGE_KEYS = {
    firstLaunchDone: 'dogdesk.ai.first_launch_done',
    enabled: 'dogdesk.ai.enabled',
    provider: 'dogdesk.ai.provider',
    apiKey: 'dogdesk.ai.api_key',
    model: 'dogdesk.ai.model',
    endpoint: 'dogdesk.ai.endpoint',
    autostartConfigured: 'dogdesk.app.autostart_configured',
    autostartEnabled: 'dogdesk.app.autostart_enabled',
};

const LEGACY_STORAGE_KEYS = {
    firstLaunchDone: 'dogdesk.deepseek.first_launch_done',
    enabled: 'dogdesk.deepseek.enabled',
    apiKey: 'dogdesk.deepseek.api_key',
    model: 'dogdesk.deepseek.model',
    endpoint: 'dogdesk.deepseek.endpoint',
};

const DEFAULT_AI_CONFIG = {
    firstLaunchDone: false,
    enabled: false,
    provider: AI_DEFAULT_PROVIDER,
    apiKey: '',
    model: '',
    endpoint: '',
};

const DEFAULT_AUTOSTART_CONFIG = {
    configured: false,
    enabled: true,
};

function readStorage(key, fallback = '') {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
    } catch (e) {
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        // Ignore storage failures.
    }
}

function readStorageWithLegacy(key, legacyKey, fallback = '') {
    const primary = readStorage(key, '');
    if (primary !== '') return primary;
    const legacy = legacyKey ? readStorage(legacyKey, '') : '';
    if (legacy !== '') return legacy;
    return fallback;
}

function resolveProviderPreset(providerId) {
    const id = String(providerId || '').trim().toLowerCase();
    const found = AI_PROVIDER_PRESETS.find((item) => item.id === id);
    return found || AI_PROVIDER_PRESETS.find((item) => item.id === AI_DEFAULT_PROVIDER) || AI_PROVIDER_PRESETS[0];
}

export function getAiProviderPreset(providerId) {
    return resolveProviderPreset(providerId);
}

export function getAiProviderLabel(providerId) {
    return resolveProviderPreset(providerId).label;
}

export function normalizeAiConfig(input = {}, base = null) {
    const fallback = base || DEFAULT_AI_CONFIG;
    const merged = { ...fallback, ...input };
    const preset = resolveProviderPreset(merged.provider || AI_DEFAULT_PROVIDER);

    const model = String(merged.model || '').trim() || preset.model || '';
    const endpoint = String(merged.endpoint || '').trim() || preset.endpoint || '';

    return {
        firstLaunchDone: Boolean(merged.firstLaunchDone),
        enabled: Boolean(merged.enabled),
        provider: preset.id,
        apiKey: String(merged.apiKey || '').trim(),
        model,
        endpoint,
    };
}

export function getAiConfig() {
    const raw = {
        firstLaunchDone:
            readStorage(STORAGE_KEYS.firstLaunchDone, '') === '1' ||
            readStorage(LEGACY_STORAGE_KEYS.firstLaunchDone, '') === '1',
        enabled:
            readStorage(STORAGE_KEYS.enabled, '') === '1' || readStorage(LEGACY_STORAGE_KEYS.enabled, '') === '1',
        provider: readStorageWithLegacy(STORAGE_KEYS.provider, null, AI_DEFAULT_PROVIDER),
        apiKey: readStorageWithLegacy(STORAGE_KEYS.apiKey, LEGACY_STORAGE_KEYS.apiKey, ''),
        model: readStorageWithLegacy(STORAGE_KEYS.model, LEGACY_STORAGE_KEYS.model, ''),
        endpoint: readStorageWithLegacy(STORAGE_KEYS.endpoint, LEGACY_STORAGE_KEYS.endpoint, ''),
    };
    return normalizeAiConfig(raw, raw);
}

export function saveAiConfig(partial = {}) {
    const current = getAiConfig();
    const merged = normalizeAiConfig(partial, current);

    writeStorage(STORAGE_KEYS.enabled, merged.enabled ? '1' : '0');
    writeStorage(STORAGE_KEYS.provider, merged.provider);
    writeStorage(STORAGE_KEYS.apiKey, merged.apiKey);
    writeStorage(STORAGE_KEYS.model, merged.model);
    writeStorage(STORAGE_KEYS.endpoint, merged.endpoint);

    return merged;
}

export function markAiFirstLaunchDone() {
    writeStorage(STORAGE_KEYS.firstLaunchDone, '1');
}

export function getAutostartConfig() {
    const enabledRaw = readStorage(STORAGE_KEYS.autostartEnabled, '');
    return {
        configured: readStorage(STORAGE_KEYS.autostartConfigured, '') === '1',
        enabled: enabledRaw === '' ? DEFAULT_AUTOSTART_CONFIG.enabled : enabledRaw === '1',
    };
}

export function saveAutostartConfig(partial = {}) {
    const current = getAutostartConfig();
    const merged = {
        configured:
            typeof partial.configured === 'boolean' ? partial.configured : current.configured,
        enabled: typeof partial.enabled === 'boolean' ? partial.enabled : current.enabled,
    };

    writeStorage(STORAGE_KEYS.autostartConfigured, merged.configured ? '1' : '0');
    writeStorage(STORAGE_KEYS.autostartEnabled, merged.enabled ? '1' : '0');
    return merged;
}

export function hasAiApiConfig(config = getAiConfig()) {
    return Boolean(config.enabled && config.apiKey && config.endpoint);
}

// ---- Backward-compatible DeepSeek helpers ----
export function normalizeDeepSeekConfig(input = {}, base = null) {
    const seed = base ? { ...base, provider: 'deepseek' } : { ...getAiConfig(), provider: 'deepseek' };
    return normalizeAiConfig({ ...input, provider: 'deepseek' }, seed);
}

export function getDeepSeekConfig() {
    return normalizeDeepSeekConfig(getAiConfig(), getAiConfig());
}

export function saveDeepSeekConfig(partial = {}) {
    return saveAiConfig(normalizeDeepSeekConfig(partial));
}

export function markDeepSeekFirstLaunchDone() {
    markAiFirstLaunchDone();
}

export function hasDeepSeekApiConfig(config = getDeepSeekConfig()) {
    return hasAiApiConfig(normalizeDeepSeekConfig(config));
}

// ---- Cache ----
function readCache(text) {
    const key = String(text || '').trim().toLowerCase();
    if (!key || !UNDERSTANDING_CACHE.has(key)) return null;
    const value = UNDERSTANDING_CACHE.get(key);
    UNDERSTANDING_CACHE.delete(key);
    UNDERSTANDING_CACHE.set(key, value);
    return value;
}

function writeCache(text, value) {
    const key = String(text || '').trim().toLowerCase();
    if (!key || !value) return;
    if (UNDERSTANDING_CACHE.has(key)) {
        UNDERSTANDING_CACHE.delete(key);
    }
    UNDERSTANDING_CACHE.set(key, value);
    if (UNDERSTANDING_CACHE.size > CACHE_MAX_ITEMS) {
        const oldest = UNDERSTANDING_CACHE.keys().next().value;
        if (oldest) UNDERSTANDING_CACHE.delete(oldest);
    }
}

function containsChinese(text) {
    return /[\u3400-\u9fff]/u.test(String(text || ''));
}

function parseJsonObject(raw) {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const candidates = [];
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch && fencedMatch[1]) {
        candidates.push(fencedMatch[1].trim());
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
    }

    candidates.push(trimmed);

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object') {
                return parsed;
            }
        } catch (e) {
            // Try next candidate.
        }
    }

    return null;
}

function cleanupModelText(raw) {
    let text = String(raw || '').trim();
    if (!text) return '';
    text = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    return text;
}

function extractByLabel(text, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*[:锛歖\\s*([\\s\\S]*?)(?=\\n\\s*[A-Za-z\\u4e00-\\u9fff_]+\\s*[:锛歖|$)`, 'i');
    const match = text.match(regex);
    return match && match[1] ? match[1].trim() : '';
}

function buildPrompts(inputText) {
    const normalized = String(inputText || '').trim();
    const sourceLanguageHint = containsChinese(normalized) ? 'Chinese' : 'English or mixed';
    const targetLanguageHint = containsChinese(normalized) ? 'English' : 'Simplified Chinese';
    const systemPrompt =
        'You are a bilingual reading assistant. Return strict JSON only with keys: translation, explanation, source_language, target_language.';
    const userPrompt =
        `Input text:\n${normalized}\n\n` +
        `Likely source language: ${sourceLanguageHint}\n` +
        `Translate into: ${targetLanguageHint}\n\n` +
        'Rules:\n' +
        '1) translation: natural and faithful.\n' +
        '2) explanation: explain what the ORIGINAL sentence really means in natural Simplified Chinese, include implied intent/context when helpful.\n' +
        '3) Do NOT explain translation decisions, wording choices, grammar, or why it is translated this way.\n' +
        '4) Return JSON only.';

    return {
        normalized,
        sourceLanguageHint,
        targetLanguageHint,
        systemPrompt,
        userPrompt,
    };
}

function normalizeModelOutput(text, normalizedInput) {
    const cleaned = cleanupModelText(text);
    const parsed = parseJsonObject(cleaned);

    let translation = '';
    let explanation = '';
    let sourceLanguageRaw = '';
    let targetLanguageRaw = '';

    if (parsed) {
        translation = String(parsed.translation || '').trim();
        explanation = String(parsed.explanation || '').trim();
        sourceLanguageRaw = String(parsed.source_language || '').trim();
        targetLanguageRaw = String(parsed.target_language || '').trim();
    } else {
        // 瀹归敊: 渚涘簲鍟嗘湭涓ユ牸杩斿洖 JSON 鏃讹紝灏介噺浠庢枃鏈腑鎻愬彇锛岃嚦灏戜繚鐣欒В閲娿€?        translation = extractByLabel(cleaned, 'translation') || extractByLabel(cleaned, '缈昏瘧');
        explanation = extractByLabel(cleaned, 'explanation') || extractByLabel(cleaned, '瑙ｉ噴');
        if (!translation && !explanation && cleaned) {
            explanation = cleaned;
        }
    }

    const sourceLanguage =
        String(sourceLanguageRaw || (containsChinese(normalizedInput) ? 'Chinese' : 'English')).trim() ||
        (containsChinese(normalizedInput) ? 'Chinese' : 'English');
    const targetLanguage =
        String(targetLanguageRaw || (containsChinese(normalizedInput) ? 'English' : 'Simplified Chinese')).trim() ||
        (containsChinese(normalizedInput) ? 'English' : 'Simplified Chinese');

    if (!translation && !explanation) return null;
    return {
        translation,
        explanation,
        sourceLanguage,
        targetLanguage,
    };
}

async function fetchJsonWithTimeout(url, init, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const resp = await fetch(url, {
            ...init,
            signal: controller.signal,
        });
        if (!resp.ok) return null;
        return await resp.json();
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

function applyModelPlaceholder(endpoint, model) {
    const resolvedModel = String(model || '').trim();
    if (!resolvedModel) return endpoint;
    if (!endpoint.includes('{model}')) return endpoint;
    return endpoint.replaceAll('{model}', encodeURIComponent(resolvedModel));
}

function appendApiKeyQuery(endpoint, apiKey) {
    if (!apiKey) return endpoint;
    if (/[?&]key=/.test(endpoint)) return endpoint;
    const sep = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${sep}key=${encodeURIComponent(apiKey)}`;
}

async function requestOpenAiCompatibleUnderstanding(config, prompt, timeoutMs, azureMode = false) {
    const endpoint = applyModelPlaceholder(config.endpoint, config.model);
    const headers = azureMode
        ? {
              'Content-Type': 'application/json',
              'api-key': config.apiKey,
          }
        : {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.apiKey}`,
          };

    const data = await fetchJsonWithTimeout(
        endpoint,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: config.model,
                temperature: 0.1,
                max_tokens: AI_MAX_OUTPUT_TOKENS,
                messages: [
                    {
                        role: 'system',
                        content: prompt.systemPrompt,
                    },
                    {
                        role: 'user',
                        content: prompt.userPrompt,
                    },
                ],
            }),
        },
        timeoutMs
    );
    if (!data) return null;

    const content = data?.choices?.[0]?.message?.content;
    const text =
        typeof content === 'string'
            ? content
            : Array.isArray(content)
              ? content
                    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
                    .join('\n')
                    .trim()
              : '';

    return normalizeModelOutput(text, prompt.normalized);
}

async function requestAnthropicUnderstanding(config, prompt, timeoutMs) {
    const endpoint = applyModelPlaceholder(config.endpoint, config.model);
    const data = await fetchJsonWithTimeout(
        endpoint,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: config.model,
                max_tokens: AI_MAX_OUTPUT_TOKENS,
                temperature: 0.1,
                system: prompt.systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: prompt.userPrompt,
                    },
                ],
            }),
        },
        timeoutMs
    );
    if (!data) return null;

    const text = Array.isArray(data?.content)
        ? data.content
              .map((part) => (typeof part?.text === 'string' ? part.text : ''))
              .join('\n')
              .trim()
        : '';

    return normalizeModelOutput(text, prompt.normalized);
}

async function requestGeminiUnderstanding(config, prompt, timeoutMs) {
    const endpoint = appendApiKeyQuery(applyModelPlaceholder(config.endpoint, config.model), config.apiKey);
    const data = await fetchJsonWithTimeout(
        endpoint,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: `${prompt.systemPrompt}\n\n${prompt.userPrompt}`,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
                },
            }),
        },
        timeoutMs
    );
    if (!data) return null;

    const text = data?.candidates?.[0]?.content?.parts
        ? data.candidates[0].content.parts
              .map((part) => (typeof part?.text === 'string' ? part.text : ''))
              .join('\n')
              .trim()
        : '';

    return normalizeModelOutput(text, prompt.normalized);
}

async function requestAiUnderstanding(text, config, options = {}) {
    const cfg = normalizeAiConfig(config);
    if (!hasAiApiConfig(cfg)) return null;

    const preset = resolveProviderPreset(cfg.provider);
    const timeoutMs = Number(options.timeoutMs) || AI_TIMEOUT_MS;
    const prompt = buildPrompts(text);

    if (!prompt.normalized) return null;

    const runOnce = async (ms) => {
        switch (preset.protocol) {
            case 'openai':
                return requestOpenAiCompatibleUnderstanding(cfg, prompt, ms, false);
            case 'azure-openai':
                return requestOpenAiCompatibleUnderstanding(cfg, prompt, ms, true);
            case 'anthropic':
                return requestAnthropicUnderstanding(cfg, prompt, ms);
            case 'gemini':
                return requestGeminiUnderstanding(cfg, prompt, ms);
            default:
                return requestOpenAiCompatibleUnderstanding(cfg, prompt, ms, false);
        }
    };

    const first = await runOnce(timeoutMs);
    if (first) return first;
    const retryTimeoutMs = Math.max(timeoutMs, AI_RETRY_TIMEOUT_MS);
    return runOnce(retryTimeoutMs);
}

export async function testAiConnection(partial = {}) {
    const config = normalizeAiConfig(partial, getAiConfig());
    if (!config.apiKey) {
        return { ok: false, error: '请先填写接口密钥。' };
    }
    if (!config.endpoint) {
        return { ok: false, error: '请先填写接口地址。' };
    }

    const result = await requestAiUnderstanding('Hello world', {
        ...config,
        enabled: true,
    });

    if (!result) {
        return {
            ok: false,
            error: `${getAiProviderLabel(config.provider)} 连接失败，请检查密钥、模型和接口地址。`,
        };
    }

    return { ok: true, preview: result.translation || result.explanation || 'ok' };
}
export async function testDeepSeekConnection(partial = {}) {
    return testAiConnection(normalizeDeepSeekConfig(partial));
}

/**
 * If API is configured, always use configured AI provider.
 * Fallback to MyMemory only when no API config exists.
 */
export async function translateTextWithUnderstanding(text) {
    const normalized = String(text || '').trim();
    if (!normalized) return null;

    const cached = readCache(normalized);
    if (cached) return cached;

    const config = getAiConfig();
    if (hasAiApiConfig(config)) {
        const aiResult = await requestAiUnderstanding(normalized, config, {
            timeoutMs: AI_TIMEOUT_MS,
        });
        if (aiResult) {
            const result = {
                text: aiResult.translation || '',
                translation: aiResult.translation || '',
                explanation: aiResult.explanation || '',
                sourceLanguage: aiResult.sourceLanguage,
                targetLanguage: aiResult.targetLanguage,
                provider: config.provider,
                providerLabel: getAiProviderLabel(config.provider),
            };
            writeCache(normalized, result);
            return result;
        }
        return {
            text: '',
            translation: '',
            explanation: 'AI 没有返回可解析结果，请稍后重试或检查接口配置。',
            sourceLanguage: containsChinese(normalized) ? 'Chinese' : 'English',
            targetLanguage: containsChinese(normalized) ? 'English' : 'Simplified Chinese',
            provider: config.provider,
            providerLabel: getAiProviderLabel(config.provider),
            isError: true,
        };
    }

    const fallback = await fetchBasicTranslation(normalized);
    if (fallback) {
        const result = {
            text: fallback.translation,
            translation: fallback.translation,
            explanation: '',
            sourceLanguage: fallback.sourceLanguage,
            targetLanguage: fallback.targetLanguage,
            provider: 'mymemory',
            providerLabel: 'MyMemory',
        };
        writeCache(normalized, result);
        return result;
    }

    return null;
}

/**
 * Backward-compatible API.
 */
export async function translateTextToChinese(text) {
    return translateTextWithUnderstanding(text);
}

/**
 * Fetch translation + understanding via configured AI provider.
 */
export async function fetchAiUnderstanding(text) {
    const config = getAiConfig();
    return requestAiUnderstanding(text, config);
}

/**
 * Fetch translation text via configured AI provider.
 */
export async function fetchAiTranslation(text) {
    const result = await fetchAiUnderstanding(text);
    return result?.translation || null;
}

/**
 * Backward-compatible DeepSeek entry points.
 */
export async function fetchDeepSeekUnderstanding(text) {
    const config = normalizeDeepSeekConfig(getAiConfig());
    return requestAiUnderstanding(text, config);
}

export async function fetchDeepSeekTranslation(text) {
    const result = await fetchDeepSeekUnderstanding(text);
    return result?.translation || null;
}

/**
 * Fetch fallback translation via MyMemory API.
 */
export async function fetchBasicTranslation(text) {
    try {
        const normalized = String(text || '').trim();
        if (!normalized) return null;

        const sourceLanguage = containsChinese(normalized) ? 'zh-CN' : 'en';
        const targetLanguage = sourceLanguage === 'zh-CN' ? 'en' : 'zh-CN';
        const resp = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(normalized)}&langpair=${sourceLanguage}|${targetLanguage}`
        );
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.responseStatus === 200 && data.responseData) {
            const translated = String(data.responseData.translatedText || '').trim();
            if (translated && translated.toLowerCase() !== normalized.toLowerCase()) {
                return {
                    translation: translated,
                    sourceLanguage,
                    targetLanguage,
                };
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Backward-compatible API.
 */
export async function fetchChineseTranslation(text) {
    const result = await fetchBasicTranslation(text);
    return result?.translation || null;
}

/**
 * Fetch English dictionary definition via Free Dictionary API.
 */
export async function fetchDictionary(word) {
    try {
        const resp = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`
        );
        if (!resp.ok) return null;
        const data = await resp.json();
        if (!Array.isArray(data) || data.length === 0) return null;

        const entry = data[0];
        return {
            word: entry.word,
            phonetic:
                entry.phonetic ||
                (entry.phonetics && entry.phonetics.find((p) => p.text)?.text) ||
                '',
            meanings: entry.meanings || [],
        };
    } catch (e) {
        return null;
    }
}

/**
 * Escape HTML special characters.
 */
export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

