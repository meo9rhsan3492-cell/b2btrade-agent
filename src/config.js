/**
 * B2Btrade-agent 配置管理
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import inquirer from 'inquirer';
import chalk from 'chalk';

const CONFIG_FILE = path.join(os.homedir(), '.b2btrade-agent.json');

const defaultConfig = {
  apiProvider: 'openai',
  apiKey: '',
  model: 'gpt-4',
  defaultAgent: 'default',

  // ── Shopify 配置 ──────────────────────────────────────────
  // 获取: Shopify Admin > Settings > Apps > Develop apps > Admin API Access Token
  shopify: {
    storeUrl: '',       // 例: my-store.myshopify.com
    accessToken: ''     // shpat_xxxxx
  },

  // ── 阿里巴巴1688 配置 ───────────────────────────────────────
  // 获取: https://open.1688.com/ > 开发者中心 > 创建应用 > OAuth2.0 获取 Token
  ali1688: {
    appKey: '',
    appSecret: '',
    accessToken: ''
  },

  // ── TikTok Shop 配置 ───────────────────────────────────────
  // 获取: TikTok Shop Seller Center > Partner Platform > 创建应用
  tiktok: {
    clientKey: '',
    clientSecret: '',
    shopId: '',
    accessToken: ''
  },

  // ── Instagram 配置 ─────────────────────────────────────────
  // 获取: Facebook Developers > 创建 Business App > Instagram Graph API
  instagram: {
    accessToken: '',           // Facebook Page Access Token
    instagramAccountId: '',     // Instagram Business Account ID
    facebookPageId: ''         // Facebook Page ID
  },

  // LinkedIn 配置
  linkedin: {
    // 批量处理最大数量
    maxBatchSize: 20,
    // 默认语气: professional | friendly | formal | casual
    defaultTone: 'professional',
    // 默认语言: zh-CN | en-US
    defaultLanguage: 'zh-CN',
    // Google 搜索并发数
    searchConcurrency: 3,
    // 搜索间隔（ms）
    searchDelayMs: 1000,
    // 抓取超时（ms）
    scrapeTimeout: 15000,
    // 是否启用缓存
    enableCache: false,
    // 备注字段（发送连接请求时是否添加个性化备注）
    includeCustomNote: true,
  },

  // ── WhatsApp 外展配置 ─────────────────────────────────────
  // 用于 WhatsApp 外展助手（批量消息生成）
  whatsapp: {
    // 默认语言: zh | en | ar | es | fr | pt | ru | de | ja | ko
    defaultLanguage: 'zh',
    // 默认语气: formal | friendly | concise
    defaultTone: 'formal',
    // AI 增强开关
    enableAIEnhance: true,
    // 批量处理间隔（ms）
    batchDelayMs: 200,
    // 发件人信息（生成消息时自动填充）
    sender: {
      name: '',
      company: '',
      phone: '',
      email: ''
    }
  },

  // ── Email 外展配置 ─────────────────────────────────────────
  // 用于 Email 外展助手（开发信/跟进/报价）
  email: {
    // 默认语言: zh | en | ar | es | fr | pt | ru | de | ja | ko
    defaultLanguage: 'zh',
    // 默认语气: formal | friendly | concise
    defaultTone: 'formal',
    // 默认邮件类型: cold | followup | quote | intro | meeting
    defaultEmailType: 'cold',
    // AI 增强开关
    enableAIEnhance: true,
    // 是否启用 HTML 格式
    enableHtml: true,
    // 发件人信息（生成邮件时自动填充）
    sender: {
      name: '',
      company: '',
      email: '',
      phone: '',
      city: ''
    },
    // Gmail OAuth2（仅发送时需要，生成邮件不需要）
    gmail: {
      clientId: '',
      clientSecret: '',
      refreshToken: ''
    },
    // Outlook OAuth2（仅发送时需要，生成邮件不需要）
    outlook: {
      tenantId: '',
      clientId: '',
      clientSecret: ''
    }
  }
};

export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return { ...defaultConfig, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('加载配置失败:', e.message);
  }
  return { ...defaultConfig };
}

export function getConfig() {
  return loadConfig();
}

export function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (e) {
    console.error('保存配置失败:', e.message);
    return false;
  }
}

export async function configureApiKey() {
  const config = loadConfig();
  
  console.log(chalk.bold('\n⚙️ API配置\n'));
  
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: '选择AI服务商:',
      choices: [
        { name: 'OpenAI (GPT-4)', value: 'openai' },
        { name: 'Anthropic (Claude)', value: 'anthropic' },
        { name: 'Google (Gemini)', value: 'google' },
        { name: 'Minimax', value: 'minimax' }
      ],
      default: config.apiProvider
    },
    {
      type: 'input',
      name: 'apiKey',
      message: '输入API Key:',
      default: config.apiKey,
      validate: (input) => input.length > 10 || '请输入有效的API Key'
    },
    {
      type: 'input',
      name: 'model',
      message: '模型 (直接回车使用默认):',
      default: config.model || 'gpt-4'
    }
  ]);

  const newConfig = {
    ...config,
    apiProvider: answers.provider,
    apiKey: answers.apiKey,
    model: answers.model || 'gpt-4'
  };

  if (saveConfig(newConfig)) {
    console.log(chalk.green('\n✓ 配置已保存\n'));
  }
}
