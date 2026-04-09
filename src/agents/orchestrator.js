/**
 * 结构化 LLM 调用层
 *
 * 改进：
 * 1. 自动清理 <thinking> 标签（MiniMax 模型输出格式）
 * 2. 多级重试 + 指数退避
 * 3. 结构化 JSON 返回（强制 Schema）
 * 4. 统一的错误处理
 */

import { getConfig } from '../config.js';
import { getAgent } from './index.js';

// 清理 <thinking> 标签和<think>... 块
export function cleanThinking(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let result = raw;
  // 移除 <thinking>...</thinking>
  while (result.includes('<thinking>')) {
    const start = result.indexOf('<thinking>');
    const end = result.indexOf('</thinking>');
    if (end > start) {
      result = result.substring(0, start) + result.substring(end + 10);
    } else break;
  }
  // 移除<think>...（中文方块）
  while (result.includes('<think>')) {
    const start = result.indexOf('<think>');
    const end = result.indexOf('<\/think>');
    if (end > start) {
      result = result.substring(0, start) + result.substring(end + 9);
    } else break;
  }
  // 移除 开头的情况
  if (result.startsWith('<\/think>')) {
    result = result.substring(9);
  }
  // 处理嵌套的<think>... 简单版本
  result = result.replace(/<think>[\s\S]*?<\/think>/g, '');
  return result.trim();
}

// 核心：发送消息到 LLM，返回结构化 JSON
export async function llmCall(prompt, {
  agentId = 'default',
  schema = null,
  retries = 2,
  timeout = 60000,
  temperature = 0.3,
  model = null,
} = {}) {
  const config = getConfig();
  const agent = getAgent(agentId);

  let systemPrompt = agent?.systemPrompt || '';
  if (schema) {
    systemPrompt += '\n\n【重要输出格式】\n你必须且只能输出有效的JSON，不要包含任何其他文字。不要用 markdown 代码块，不要有 thinking 标签。\n\n期望的 JSON Schema：\n' + JSON.stringify(schema, null, 2) + '\n\n直接输出JSON对象本身，例如：{"key": "value"}';
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const raw = await rawChat(messages, {
        provider: config.apiProvider,
        apiKey: config.apiKey,
        baseUrl: getBaseUrl(config),
        model: model || config.model,
        timeout,
        temperature
      });

      const cleaned = cleanThinking(raw);

      if (schema) {
        const parsed = JSON.parse(cleaned);
        return parsed;
      }
      return cleaned;
    } catch (e) {
      const isLast = attempt === retries;
      const isRetryable = isNetworkError(e) || isTimeoutError(e);

      if (isLast || !isRetryable) {
        throw e;
      }

      const delay = 1000 * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
}

// 底层 HTTP 调用
async function rawChat(messages, {
  provider = 'openai',
  apiKey,
  baseUrl,
  model = 'gpt-4',
  timeout = 60000,
  temperature = 0.3,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const headers = { 'Content-Type': 'application/json' };
    let body;
    let url;

    switch (provider) {
      case 'openai':
      case 'minimax':
        headers['Authorization'] = `Bearer ${apiKey}`;
        url = baseUrl + '/chat/completions';
        body = {
          model: provider === 'minimax' ? (model || 'MiniMax-M2.7') : (model || 'gpt-4'),
          messages,
          temperature,
          max_tokens: 2048,
        };
        break;

      case 'anthropic':
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        const systemMsg = messages.find(m => m.role === 'system');
        const userMsgs = messages.filter(m => m.role !== 'system');
        url = baseUrl + '/messages';
        body = {
          model: model || 'claude-3-sonnet-20240229',
          max_tokens: 2048,
          system: systemMsg?.content || '',
          messages: userMsgs.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
        };
        break;

      case 'google':
        const googleModel = model || 'gemini-2.0-flash';
        url = baseUrl + '/' + googleModel + ':generateContent?key=' + apiKey;
        body = {
          contents: messages
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
          generationConfig: { temperature, maxOutputTokens: 2048 }
        };
        break;

      default:
        throw new Error('不支持的 provider: ' + provider);
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(provider + ' API 错误 ' + resp.status + ': ' + text);
    }

    const data = await resp.json();
    return extractContent(data, provider);

  } finally {
    clearTimeout(timer);
  }
}

function extractContent(data, provider) {
  switch (provider) {
    case 'openai':
    case 'minimax':
      return data.choices?.[0]?.message?.content || '';
    case 'anthropic':
      return data.content?.[0]?.text || '';
    case 'google':
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    default:
      return '';
  }
}

function getBaseUrl(config) {
  const urls = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta/models',
    minimax: config.minimaxBaseUrl || 'https://api.minimaxi.com/v1',
  };
  return urls[config.apiProvider] || urls.openai;
}

function isNetworkError(e) {
  return e.name === 'AbortError' || e.message?.includes('fetch') || e.message?.includes('ECONNREFUSED');
}

function isTimeoutError(e) {
  return e.name === 'AbortError' || e.message?.includes('timeout');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}