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
  defaultAgent: 'default'
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
