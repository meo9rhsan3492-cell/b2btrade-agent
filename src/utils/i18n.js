/**
 * @fileoverview 国际化模块 - 中英文切换
 * @module src/utils/i18n
 *
 * @description
 * 提供多语言支持
 * - 中英文切换
 * - 翻译函数
 * - 格式化支持
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 支持的语言
 */
export const SupportedLocales = {
  zh_CN: '简体中文',
  en_US: 'English'
};

/**
 * 默认语言
 */
let currentLocale = 'zh_CN';

/**
 * 翻译字典
 */
const translations = {
  zh_CN: {
    // 欢迎信息
    'welcome.title': 'B2Btrade-agent 外贸智能助手',
    'welcome.version': '版本',
    'welcome.subtitle': '外贸B2B智能Agent - 开箱即用',
    'welcome.features': '12位外贸专家 | 工具集成 | 工作流自动化',

    // 帮助信息
    'help.usage': '用法',
    'help.command': '命令',
    'help.example': '示例',
    'help.quickStart': '快速开始',

    // 命令
    'cmd.chat': '启动对话模式',
    'cmd.list': '列出所有Agent',
    'cmd.use': '切换Agent',
    'cmd.workflow': '列出工作流',
    'cmd.run': '执行工作流',
    'cmd.search': '搜索客户',
    'cmd.tools': '查看可用工具',
    'cmd.config': '配置API Key',
    'cmd.help': '显示帮助',
    'cmd.health': '健康检查',
    'cmd.lang': '切换语言',
    'cmd.history': '查看历史',

    // Agent相关
    'agent.switched': '已切换到',
    'agent.unknown': '未知Agent',
    'agent.list': '可用Agent',

    // 工作流相关
    'workflow.list': '可用工作流',
    'workflow.running': '正在执行',
    'workflow.complete': '执行完成',
    'workflow.unknown': '未知工作流',

    // 错误信息
    'error.apiKeyMissing': 'API Key未配置，请先运行 b2b config 配置',
    'error.searchQuery': '请输入搜索关键词',
    'error.workflowId': '请指定工作流ID',
    'error.network': '网络错误',
    'error.timeout': '请求超时',
    'error.rateLimit': '请求过于频繁，请稍后再试',
    'error.unknown': '未知错误',

    // 成功信息
    'success.configSaved': '配置已保存',
    'success.exit': '下次见',
    'success.copied': '已复制',

    // 状态信息
    'status.configured': '已配置',
    'status.notConfigured': '未配置',
    'status.loading': '加载中',
    'status.saving': '保存中',

    // 健康检查
    'health.title': '健康检查报告',
    'health.system': '系统状态',
    'health.api': 'API配置',
    'health.session': '会话状态',
    'health.logs': '日志状态',
    'health.ok': '正常',
    'health.warning': '警告',
    'health.error': '错误',

    // 欢迎向导
    'wizard.title': '首次使用向导',
    'wizard.step1': '步骤1: 配置API',
    'wizard.step2': '步骤2: 选择Agent',
    'wizard.step3': '步骤3: 开始使用',
    'wizard.configure': '立即配置',
    'wizard.skip': '稍后',
    'wizard.next': '下一步',
    'wizard.complete': '完成',

    // 工具
    'tools.list': '可用工具',
    'tools.available': '可用',
    'tools.unavailable': '未安装',

    // 进度
    'progress.loading': '加载中',
    'progress.saving': '保存中',
    'progress.searching': '搜索中',
    'progress.processing': '处理中',
    'progress.complete': '完成'
  },

  en_US: {
    // Welcome
    'welcome.title': 'B2Btrade-agent - Foreign Trade AI Assistant',
    'welcome.version': 'Version',
    'welcome.subtitle': 'B2B Trade Intelligent Agent - Ready to Use',
    'welcome.features': '12 Trade Experts | Tool Integration | Workflow Automation',

    // Help
    'help.usage': 'Usage',
    'help.command': 'Commands',
    'help.example': 'Examples',
    'help.quickStart': 'Quick Start',

    // Commands
    'cmd.chat': 'Start chat mode',
    'cmd.list': 'List all Agents',
    'cmd.use': 'Switch Agent',
    'cmd.workflow': 'List workflows',
    'cmd.run': 'Run workflow',
    'cmd.search': 'Search customers',
    'cmd.tools': 'View available tools',
    'cmd.config': 'Configure API Key',
    'cmd.help': 'Show help',
    'cmd.health': 'Health check',
    'cmd.lang': 'Switch language',
    'cmd.history': 'View history',

    // Agent
    'agent.switched': 'Switched to',
    'agent.unknown': 'Unknown Agent',
    'agent.list': 'Available Agents',

    // Workflow
    'workflow.list': 'Available Workflows',
    'workflow.running': 'Running',
    'workflow.complete': 'Complete',
    'workflow.unknown': 'Unknown workflow',

    // Errors
    'error.apiKeyMissing': 'API Key not configured. Please run "b2b config" first',
    'error.searchQuery': 'Please enter search keywords',
    'error.workflowId': 'Please specify workflow ID',
    'error.network': 'Network error',
    'error.timeout': 'Request timeout',
    'error.rateLimit': 'Rate limit exceeded, please try again later',
    'error.unknown': 'Unknown error',

    // Success
    'success.configSaved': 'Configuration saved',
    'success.exit': 'Goodbye',
    'success.copied': 'Copied',

    // Status
    'status.configured': 'Configured',
    'status.notConfigured': 'Not configured',
    'status.loading': 'Loading',
    'status.saving': 'Saving',

    // Health check
    'health.title': 'Health Check Report',
    'health.system': 'System Status',
    'health.api': 'API Configuration',
    'health.session': 'Session Status',
    'health.logs': 'Log Status',
    'health.ok': 'OK',
    'health.warning': 'Warning',
    'health.error': 'Error',

    // Wizard
    'wizard.title': 'First-time Setup Wizard',
    'wizard.step1': 'Step 1: Configure API',
    'wizard.step2': 'Step 2: Choose Agent',
    'wizard.step3': 'Step 3: Start Using',
    'wizard.configure': 'Configure Now',
    'wizard.skip': 'Skip',
    'wizard.next': 'Next',
    'wizard.complete': 'Complete',

    // Tools
    'tools.list': 'Available Tools',
    'tools.available': 'Available',
    'tools.unavailable': 'Not installed',

    // Progress
    'progress.loading': 'Loading',
    'progress.saving': 'Saving',
    'progress.searching': 'Searching',
    'progress.processing': 'Processing',
    'progress.complete': 'Complete'
  }
};

/**
 * 设置当前语言
 * @param {string} locale - 语言代码
 */
export function setLocale(locale) {
  if (translations[locale]) {
    currentLocale = locale;
    return true;
  }
  return false;
}

/**
 * 获取当前语言
 * @returns {string}
 */
export function getLocale() {
  return currentLocale;
}

/**
 * 获取所有支持的语言
 * @returns {Object}
 */
export function getSupportedLocales() {
  return { ...SupportedLocales };
}

/**
 * 翻译函数
 * @param {string} key - 翻译键
 * @param {...any} args - 格式化参数
 * @returns {string} 翻译后的文本
 */
export function t(key, ...args) {
  const dict = translations[currentLocale] || translations.zh_CN;
  let text = dict[key] || translations.zh_CN[key] || key;

  // 格式化
  if (args.length > 0) {
    text = text.replace(/\{(\d+)\}/g, (match, index) => {
      return args[index] !== undefined ? args[index] : match;
    });
  }

  return text;
}

/**
 * 格式化数字
 * @param {number} num - 数字
 * @param {Object} options - 选项
 * @returns {string}
 */
export function formatNumber(num, options = {}) {
  return new Intl.NumberFormat(currentLocale, options).format(num);
}

/**
 * 格式化日期
 * @param {Date|string} date - 日期
 * @param {Object} options - 选项
 * @returns {string}
 */
export function formatDate(date, options = {}) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(currentLocale, options).format(d);
}

/**
 * 格式化相对时间
 * @param {Date|string} date - 日期
 * @returns {string}
 */
export function formatRelativeTime(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now - d;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (currentLocale === 'zh_CN') {
    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    if (seconds > 0) return `${seconds}秒前`;
    return '刚刚';
  } else {
    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    if (minutes > 0) return `${minutes} minutes ago`;
    if (seconds > 0) return `${seconds} seconds ago`;
    return 'just now';
  }
}

/**
 * 获取本地化文本（根据语言自动选择）
 * @param {Object} obj - 多语言对象 { zh_CN: '中文', en_US: 'English' }
 * @returns {string}
 */
export function localeText(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (obj[currentLocale]) return obj[currentLocale];
  if (obj.zh_CN) return obj.zh_CN;
  if (obj.en_US) return obj.en_US;
  return Object.values(obj)[0] || '';
}

export default {
  SupportedLocales,
  setLocale,
  getLocale,
  getSupportedLocales,
  t,
  formatNumber,
  formatDate,
  formatRelativeTime,
  localeText
};
