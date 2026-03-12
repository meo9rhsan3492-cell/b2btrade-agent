/**
 * B2Btrade-agent AI对接
 */
import { getConfig } from './config.js';
import { getAgent } from './agents/index.js';

const API_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  google: 'https://generativelanguage.googleapis.com/v1beta/models',
  minimax: 'https://api.minimax.chat/v1/text/chatcompletion_v2'
};

export async function chatWithAI(userMessage, agentId = 'default') {
  const config = getConfig();
  const agent = getAgent(agentId);
  
  const messages = [
    { role: 'system', content: agent.systemPrompt },
    { role: 'user', content: userMessage }
  ];

  switch (config.apiProvider) {
    case 'openai':
      return await callOpenAI(config, messages);
    case 'anthropic':
      return await callAnthropic(config, messages);
    case 'google':
      return await callGoogle(config, messages);
    case 'minimax':
      return await callMinimax(config, messages);
    default:
      throw new Error(`未知API提供商: ${config.apiProvider}`);
  }
}

async function callOpenAI(config, messages) {
  const response = await fetch(API_ENDPOINTS.openai, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4',
      messages: messages,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI错误: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(config, messages) {
  const system = messages.find(m => m.role === 'system')?.content || '';
  const anthropicMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, text: m.content }));

  const response = await fetch(API_ENDPOINTS.anthropic, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-sonnet-20240229',
      max_tokens: 4096,
      system: system,
      messages: anthropicMessages
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic错误: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callGoogle(config, messages) {
  const model = config.model || 'gemini-2.0-flash';
  const url = `${API_ENDPOINTS.google}/${model}:generateContent?key=${config.apiKey}`;

  const contents = messages.map(m => ({
    role: m.role === 'system' ? 'user' : m.role,
    parts: [{ text: m.content }]
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.7 } })
  });

  if (!response.ok) {
    throw new Error(`Google错误: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function callMinimax(config, messages) {
  const response = await fetch(API_ENDPOINTS.minimax, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model || 'MiniMax-M2.5',
      messages: messages,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`Minimax错误: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
