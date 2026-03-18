/**
 * @fileoverview 日志系统 - 企业级日志记录模块
 * @module src/utils/logger
 *
 * @description
 * 提供分级日志记录、日志轮转、日志归档功能
 * - 日志级别: DEBUG, INFO, WARN, ERROR, FATAL
 * - 日志输出: 控制台 + 文件
 * - 日志轮转: 按大小和日期自动轮转
 * - 日志归档: 压缩历史日志
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 日志级别枚举
 * @enum {string}
 */
export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  FATAL: 'FATAL'
};

/**
 * 日志级别优先级
 */
const LOG_PRIORITY = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.FATAL]: 4
};

/**
 * 日志配置
 */
const LOG_CONFIG = {
  level: LogLevel.INFO,
  console: true,
  file: true,
  dir: path.join(__dirname, '../../logs'),
  maxSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 7,
  format: 'json' // 'json' | 'text'
};

/**
 * 内存日志缓冲区
 */
let logBuffer = [];

/**
 * 日志文件当前大小
 */
let currentLogSize = 0;

/**
 * 当前日志文件名
 */
let currentLogFile = '';

/**
 * 初始化日志系统
 * @param {Object} config - 日志配置
 */
export function initLogger(config = {}) {
  Object.assign(LOG_CONFIG, config);

  // 确保日志目录存在
  if (!fs.existsSync(LOG_CONFIG.dir)) {
    fs.mkdirSync(LOG_CONFIG.dir, { recursive: true });
  }

  // 获取今天的日志文件名
  currentLogFile = getLogFileName();
  const logPath = path.join(LOG_CONFIG.dir, currentLogFile);

  // 检查现有日志文件大小
  if (fs.existsSync(logPath)) {
    const stats = fs.statSync(logPath);
    currentLogSize = stats.size;
  }

  // 定时刷新缓冲区到文件
  setInterval(() => {
    flushBuffer();
  }, 5000);

  info('Logger', '日志系统初始化完成');
}

/**
 * 获取日志文件名
 * @returns {string} 日志文件名
 */
function getLogFileName() {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  return `b2btrade-${date}.log`;
}

/**
 * 检查日志文件是否需要轮转
 * @param {number} size - 写入大小
 */
function checkRotation(size = 0) {
  if (currentLogSize + size > LOG_CONFIG.maxSize) {
    rotateLog();
  }
}

/**
 * 轮转日志
 */
function rotateLog() {
  flushBuffer();

  if (currentLogFile && fs.existsSync(path.join(LOG_CONFIG.dir, currentLogFile))) {
    // 重命名旧日志
    const timestamp = Date.now();
    const oldFile = path.join(LOG_CONFIG.dir, currentLogFile);
    const newFile = path.join(LOG_CONFIG.dir, `${currentLogFile.replace('.log', '')}-${timestamp}.log`);

    try {
      fs.renameSync(oldFile, newFile);
      // 压缩历史日志
      compressLog(newFile);
      // 清理旧日志
      cleanOldLogs();
    } catch (e) {
      console.error('日志轮转失败:', e.message);
    }
  }

  currentLogSize = 0;
  currentLogFile = getLogFileName();
}

/**
 * 压缩日志文件（简单XOR加密，扩展名为.enc）
 * @param {string} filePath - 日志文件路径
 */
function compressLog(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    const key = crypto.scryptSync('b2btrade-log', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([iv, cipher.update(content), cipher.final()]);
    fs.writeFileSync(filePath + '.enc', encrypted);
    fs.unlinkSync(filePath);
  } catch (e) {
    // 压缩失败不影响主流程
  }
}

/**
 * 清理过期日志
 */
function cleanOldLogs() {
  try {
    const files = fs.readdirSync(LOG_CONFIG.dir)
      .filter(f => f.endsWith('.enc') || f.endsWith('.log'))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(LOG_CONFIG.dir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    // 保留最近的maxFiles个
    files.slice(LOG_CONFIG.maxFiles).forEach(f => {
      try {
        fs.unlinkSync(path.join(LOG_CONFIG.dir, f.name));
      } catch (e) {}
    });
  } catch (e) {}
}

/**
 * 格式化日志消息
 * @param {string} level - 日志级别
 * @param {string} module - 模块名
 * @param {string} message - 日志消息
 * @param {Object} meta - 额外数据
 * @returns {string} 格式化后的日志
 */
function formatLog(level, module, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    module,
    message,
    pid: process.pid,
    ...meta
  };

  if (LOG_CONFIG.format === 'json') {
    return JSON.stringify(logEntry);
  }

  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.padEnd(5)}] [${module}] ${message}${metaStr}`;
}

/**
 * 写入日志到缓冲区
 * @param {string} level - 日志级别
 * @param {string} module - 模块名
 * @param {string} message - 日志消息
 * @param {Object} meta - 额外数据
 */
function writeLog(level, module, message, meta = {}) {
  if (LOG_PRIORITY[level] < LOG_PRIORITY[LOG_CONFIG.level]) {
    return;
  }

  const formatted = formatLog(level, module, message, meta);

  // 输出到控制台
  if (LOG_CONFIG.console) {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m',
      [LogLevel.INFO]: '\x1b[32m',
      [LogLevel.WARN]: '\x1b[33m',
      [LogLevel.ERROR]: '\x1b[31m',
      [LogLevel.FATAL]: '\x1b[35m'
    };
    const color = colors[level] || '';
    const reset = '\x1b[0m';
    console.log(`${color}${formatted}${reset}`);
  }

  // 写入缓冲区
  logBuffer.push(formatted);
  currentLogSize += Buffer.byteLength(formatted, 'utf8');

  // 检查是否需要轮转
  if (LOG_CONFIG.file) {
    checkRotation();
  }
}

/**
 * 刷新缓冲区到文件
 */
function flushBuffer() {
  if (logBuffer.length === 0 || !LOG_CONFIG.file) return;

  const logPath = path.join(LOG_CONFIG.dir, currentLogFile);
  const content = logBuffer.join('\n') + '\n';

  try {
    fs.appendFileSync(logPath, content);
    currentLogSize += Buffer.byteLength(content, 'utf8');
    logBuffer = [];
  } catch (e) {
    console.error('写入日志文件失败:', e.message);
  }
}

/**
 * 调试日志
 * @param {string} module - 模块名
 * @param {string} message - 日志消息
 * @param {Object} meta - 额外数据
 */
export function debug(module, message, meta = {}) {
  writeLog(LogLevel.DEBUG, module, message, meta);
}

/**
 * 信息日志
 * @param {string} module - 模块名
 * @param {string} message - 日志消息
 * @param {Object} meta - 额外数据
 */
export function info(module, message, meta = {}) {
  writeLog(LogLevel.INFO, module, message, meta);
}

/**
 * 警告日志
 * @param {string} module - 模块名
 * @param {string} message - 日志消息
 * @param {Object} meta - 额外数据
 */
export function warn(module, message, meta = {}) {
  writeLog(LogLevel.WARN, module, message, meta);
}

/**
 * 错误日志
 * @param {string} module - 模块名
 * @param {string} message - 日志消息
 * @param {Object} meta - 额外数据
 */
export function error(module, message, meta = {}) {
  writeLog(LogLevel.ERROR, module, message, meta);
}

/**
 * 致命错误日志
 * @param {string} module - 模块名
 * @param {string} message - 日志消息
 * @param {Object} meta - 额外数据
 */
export function fatal(module, message, meta = {}) {
  writeLog(LogLevel.FATAL, module, message, meta);
}

/**
 * 记录操作日志
 * @param {string} action - 操作类型
 * @param {string} details - 操作详情
 * @param {Object} context - 上下文信息
 */
export function logAction(action, details, context = {}) {
  info('Action', `${action}: ${details}`, {
    context,
    type: 'user_action'
  });
}

/**
 * 导出日志条目（供Web界面使用）
 * @param {number} lines - 最近N行
 * @returns {Array} 日志条目数组
 */
export function getRecentLogs(lines = 100) {
  const logPath = path.join(LOG_CONFIG.dir, currentLogFile);

  try {
    if (!fs.existsSync(logPath)) return [];

    const content = fs.readFileSync(logPath, 'utf8');
    const entries = content.trim().split('\n').filter(Boolean);

    return entries.slice(-lines).map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { timestamp: '', level: 'INFO', message: line };
      }
    });
  } catch (e) {
    return [];
  }
}

/**
 * 获取日志统计信息
 * @returns {Object} 统计信息
 */
export function getLogStats() {
  const stats = {
    level: LOG_CONFIG.level,
    file: currentLogFile,
    size: currentLogSize,
    bufferSize: logBuffer.length,
    totalFiles: 0
  };

  try {
    const files = fs.readdirSync(LOG_CONFIG.dir)
      .filter(f => f.endsWith('.log') || f.endsWith('.enc'));
    stats.totalFiles = files.length;
    stats.files = files;
  } catch (e) {}

  return stats;
}

export default {
  initLogger,
  debug,
  info,
  warn,
  error,
  fatal,
  logAction,
  getRecentLogs,
  getLogStats,
  LogLevel
};
