/**
 * B2Btrade-agent AI对接层
 * 支持 OpenAI / Anthropic / Google / MiniMax 多平台
 */
import { getConfig } from './config.js';
import { getAgent } from './agents/index.js';
import { getProviderLimiter } from './utils/rateLimiter.js';
import { info, error, warn } from './utils/logger.js';

const API_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  google: 'https://generativelanguage.googleapis.com/v1beta/models',
  minimax: 'https://api.minimax.chat/v1/text/chatcompletion_v2'
};

const PROVIDER_LIMITS = {
  openai: { rpm: 500, rpd: 100000 },
  anthropic: { rpm: 50, rpd: 100000 },
  google: { rpm: 60, rpd: 100000 },
  minimax: { rpm: 100, rpd: 100000 }
};

export async function chatWithAI(userMessage, agentId = 'default', options = {}) {
  const config = getConfig();
  const agent = getAgent(agentId);
  const provider = config.apiProvider || 'openai';

  const systemMsg = { role: 'system', content: buildSystemPrompt(agent, config) };
  const userMsg = { role: 'user', content: userMessage };
  const messages = [systemMsg, userMsg];

  // 限流保护
  const limiter = getProviderLimiter(provider);
  const acquired = await limiter.acquire();
  if (!acquired) {
    warn('AI', `${provider} 限流中，等待重试...`);
    await new Promise(r => setTimeout(r, 2000));
    const retry = await limiter.acquire();
    if (!retry) throw new Error(`${provider} 限流超时，请稍后重试`);
  }

  info('AI', `${provider}/${config.model || 'default'} → ${agentId}`);

  try {
    switch (provider) {
      case 'openai':   return await callOpenAI(config, messages, options);
      case 'anthropic': return await callAnthropic(config, messages, options);
      case 'google':   return await callGoogle(config, messages, options);
      case 'minimax':  return await callMinimax(config, messages, options);
      default:         return await callOpenAI(config, messages, options);
    }
  } catch (e) {
    // 限流429自动等待重试
    if (e.status === 429 || e.message?.includes('429')) {
      warn('AI', '触發限流，等待5秒后重试...');
      await new Promise(r => setTimeout(r, 5000));
      switch (provider) {
        case 'openai':   return await callOpenAI(config, messages, options);
        case 'anthropic': return await callAnthropic(config, messages, options);
        case 'google':   return await callGoogle(config, messages, options);
        case 'minimax':  return await callMinimax(config, messages, options);
      }
    }
    error('AI', `API错误: ${e.message}`);
    throw e;
  }
}

function buildSystemPrompt(agent, config) {
  const locale = config.locale || 'zh';
  const base = agent.systemPrompt || '';
  const localeHint = locale === 'zh'
    ? '\n\n## 输出要求\n全部使用简体中文，涉及金额注明币种。'
    : '\n\n## Output\nRespond in English. Currency amounts must include currency code.';
  return base + localeHint;
}

// ===== OpenAI =====
async function callOpenAI(config, messages, options = {}) {
  const body = {
    model: config.model || 'gpt-4o-mini',
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096
  };

  const response = await fetchWithTimeout(API_ENDPOINTS.openai, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body)
  }, 30000);

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw Object.assign(new Error(`OpenAI ${response.status}: ${err}`), { status: response.status });
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ===== Anthropic =====
async function callAnthropic(config, messages, options = {}) {
  const system = messages.find(m => m.role === 'system')?.content || '';
  const anthropicMsgs = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

  const response = await fetchWithTimeout(API_ENDPOINTS.anthropic, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-5-haiku-20241022',
      max_tokens: options.maxTokens ?? 4096,
      system: system,
      messages: anthropicMsgs,
      temperature: options.temperature ?? 0.7
    })
  }, 35000);

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw Object.assign(new Error(`Anthropic ${response.status}: ${err}`), { status: response.status });
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// ===== Google Gemini =====
async function callGoogle(config, messages, options = {}) {
  const model = config.model || 'gemini-2.0-flash';
  const url = `${API_ENDPOINTS.google}/${model}:generateContent?key=${config.apiKey}`;

  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048
      }
    })
  }, 25000);

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw Object.assign(new Error(`Google ${response.status}: ${err}`), { status: response.status });
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ===== MiniMax =====
async function callMinimax(config, messages, options = {}) {
  const response = await fetchWithTimeout(API_ENDPOINTS.minimax, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model || 'MiniMax-M2.5',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.7
    })
  }, 25000);

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw Object.assign(new Error(`MiniMax ${response.status}: ${err}`), { status: response.status });
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ===== 通用超时fetch =====
async function fetchWithTimeout(url, options, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ===== 批量对话 =====
export async function chatBatch(prompts, agentId = 'default', options = {}) {
  const results = [];
  for (const prompt of prompts) {
    try {
      const result = await chatWithAI(prompt, agentId, options);
      results.push({ ok: true, result });
    } catch (e) {
      results.push({ ok: false, error: e.message });
    }
    // 每个请求间隔500ms，避免触发限流
    if (prompts.indexOf(prompt) < prompts.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return results;
}
