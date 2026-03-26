/**
 * B2Btrade-agent 配置管理
 * 支持: JSON配置文件 + .env环境变量 + 交互式配置
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import chalk from 'chalk';
// dotenv auto-load .env
try {
  const dotenv = await import('dotenv');
  dotenv.default.config({ path: envPath });
} catch { /* ignore */ }

// 加载 .env（项目根目录）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

function getConfigFile() {
  return process.env.B2BTRADE_CONFIG_FILE || path.join(os.homedir(), '.b2btrade-agent.json');
}

const defaultConfig = {
  apiProvider: 'openai',
  apiKey: '',
  model: '',
  locale: 'zh',

  // Shopify
  shopify: { storeUrl: '', accessToken: '' },
  // Ali1688
  ali1688: { appKey: '', appSecret: '', accessToken: '' },
  // TikTok
  tiktok: { clientKey: '', clientSecret: '', shopId: '', accessToken: '' },
  // Instagram
  instagram: { accessToken: '', instagramAccountId: '', facebookPageId: '' },
  // LinkedIn
  linkedin: { maxBatchSize: 20, defaultTone: 'professional', defaultLanguage: 'zh-CN', enableCache: false },
  // WhatsApp
  whatsapp: { defaultLanguage: 'zh', defaultTone: 'formal', enableAIEnhance: true },
  // Email
  email: { defaultLanguage: 'zh', defaultTone: 'formal', enableHtml: true, sender: { name: '', company: '', email: '', phone: '', city: '' } }
};

export function loadConfig() {
  // 1. 优先读取环境变量
  const envConfig = {
    apiProvider: process.env.B2B_API_PROVIDER || '',
    apiKey: process.env.B2B_API_KEY || '',
    model: process.env.B2B_MODEL || '',
    locale: process.env.B2B_LOCALE || 'zh'
  };

  // 2. 合并 JSON 配置文件
  try {
    if (fs.existsSync(getConfigFile())) {
      const data = fs.readFileSync(getConfigFile(), 'utf8');
      const fileConfig = JSON.parse(data);
      // 去掉空字符串的环境变量（让文件配置优先）
      Object.keys(envConfig).forEach(k => { if (!envConfig[k]) delete envConfig[k]; });
      return { ...defaultConfig, ...envConfig, ...fileConfig };
    }
  } catch (e) {
    // ignore
  }

  // 只有环境变量
  Object.keys(envConfig).forEach(k => { if (!envConfig[k]) delete envConfig[k]; });
  return { ...defaultConfig, ...envConfig };
}

export function getConfig() {
  return loadConfig();
}

export function saveConfig(config) {
  try {
    const dir = path.dirname(getConfigFile());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

export async function configureApiKey() {
  const config = loadConfig();

  console.log(chalk.bold('\n⚙️  API 配置向导\n'));
  console.log(chalk.gray('支持 OpenAI / Anthropic Claude / Google Gemini / MiniMax\n'));

  const choices = [
    { name: '1. OpenAI (GPT-4 / GPT-4o)', value: 'openai' },
    { name: '2. Anthropic (Claude 3.5)', value: 'anthropic' },
    { name: '3. Google (Gemini 2.0)', value: 'google' },
    { name: '4. MiniMax (M2.5)', value: 'minimax' }
  ];

  const defaults = {
    openai: { model: 'gpt-4o-mini', url: 'https://platform.openai.com/api-keys' },
    anthropic: { model: 'claude-3-5-haiku-20241022', url: 'https://console.anthropic.com/settings/keys' },
    google: { model: 'gemini-2.0-flash', url: 'https://aistudio.google.com/app/apikey' },
    minimax: { model: 'MiniMax-M2.5', url: 'https://platform.minimax.chat/' }
  };

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: '选择AI服务商:',
      choices,
      default: choices.findIndex(c => c.value === config.apiProvider)
    },
    {
      type: 'input',
      name: 'apiKey',
      message: '输入API Key:',
      default: config.apiKey,
      validate: (input) => input.length > 5 || 'API Key不能为空'
    },
    {
      type: 'input',
      name: 'model',
      message: '模型（直接回车使用推荐值）:',
      default: defaults[answers?.provider || config.apiProvider || 'openai'].model
    }
  ]);

  const modelDefaults = { openai: 'gpt-4o-mini', anthropic: 'claude-3-5-haiku-20241022', google: 'gemini-2.0-flash', minimax: 'MiniMax-M2.5' };

  const newConfig = {
    ...config,
    apiProvider: answers.provider,
    apiKey: answers.apiKey,
    model: answers.model || modelDefaults[answers.provider] || ''
  };

  if (saveConfig(newConfig)) {
    console.log(chalk.green('\n✅ 配置已保存到 ~/.b2btrade-agent.json'));
    console.log(chalk.gray('  也可以直接编辑 .env 文件\n'));
  }

  console.log(chalk.cyan(`\n📖 获取 Key: ${defaults[newConfig.apiProvider].url}\n`));
}

export default { loadConfig, getConfig, saveConfig, configureApiKey };
