/**
 * @fileoverview 操作历史模块 - 用户操作持久化记录
 * @module src/utils/history
 *
 * @description
 * 记录和查询用户操作历史
 * - 操作类型分类
 * - 模糊搜索
 * - 统计报表
 * - 历史导出
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { format } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 历史记录目录
 */
const HISTORY_DIR = path.join(__dirname, '../../history');

/**
 * 历史记录文件
 */
const HISTORY_FILE = path.join(HISTORY_DIR, 'operations.jsonl');

/**
 * 索引文件
 */
const INDEX_FILE = path.join(HISTORY_DIR, 'index.json');

/**
 * 操作类型枚举
 */
export const OperationType = {
  CHAT: 'chat',
  SEARCH: 'search',
  WORKFLOW: 'workflow',
  CONFIG: 'config',
  AGENT_SWITCH: 'agent_switch',
  COMMAND: 'command',
  ERROR: 'error'
};

/**
 * 初始化历史模块
 */
function initHistory() {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }

  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, '');
  }

  if (!fs.existsSync(INDEX_FILE)) {
    fs.writeFileSync(INDEX_FILE, JSON.stringify({ lastId: 0, types: {} }));
  }
}

/**
 * 生成唯一ID
 * @returns {number} 唯一ID
 */
function generateId() {
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8') || '{"lastId":0}');
  index.lastId++;
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index));
  return index.lastId;
}

/**
 * 记录操作
 * @param {string} type - 操作类型
 * @param {string} description - 操作描述
 * @param {Object} data - 操作数据
 * @param {Object} context - 上下文信息
 * @returns {Object} 记录对象
 */
export function record(type, description, data = {}, context = {}) {
  initHistory();

  const record = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    type,
    description,
    data,
    context: {
      agentId: context.agentId || null,
      userId: context.userId || 'default',
      sessionId: context.sessionId || null,
      ...context
    }
  };

  try {
    fs.appendFileSync(HISTORY_FILE, JSON.stringify(record) + '\n');
  } catch (e) {
    console.error('记录操作失败:', e.message);
  }

  return record;
}

/**
 * 记录聊天
 * @param {string} message - 用户消息
 * @param {string} response - AI回复
 * @param {Object} context - 上下文
 */
export function recordChat(message, response, context = {}) {
  return record(OperationType.CHAT, message.slice(0, 100), {
    message: message.slice(0, 500),
    response: response.slice(0, 500),
    messageLength: message.length,
    responseLength: response.length
  }, context);
}

/**
 * 记录搜索
 * @param {string} query - 搜索词
 * @param {Array} results - 搜索结果
 * @param {Object} context - 上下文
 */
export function recordSearch(query, results, context = {}) {
  return record(OperationType.SEARCH, query, {
    query,
    resultCount: Array.isArray(results) ? results.length : 0
  }, context);
}

/**
 * 记录工作流执行
 * @param {string} workflowId - 工作流ID
 * @param {Object} params - 参数
 * @param {Object} result - 结果
 * @param {Object} context - 上下文
 */
export function recordWorkflow(workflowId, params, result, context = {}) {
  return record(OperationType.WORKFLOW, `执行工作流: ${workflowId}`, {
    workflowId,
    params,
    success: result !== null
  }, context);
}

/**
 * 记录错误
 * @param {Error} error - 错误对象
 * @param {Object} context - 上下文
 */
export function recordError(error, context = {}) {
  return record(OperationType.ERROR, error.message, {
    name: error.name,
    message: error.message,
    stack: error.stack
  }, context);
}

/**
 * 读取历史记录
 * @param {Object} options - 查询选项
 * @returns {Array} 历史记录
 */
export function queryHistory(options = {}) {
  initHistory();

  const {
    type = null,
    limit = 100,
    offset = 0,
    startDate = null,
    endDate = null,
    search = null
  } = options;

  try {
    const lines = fs.readFileSync(HISTORY_FILE, 'utf8')
      .split('\n')
      .filter(Boolean)
      .reverse();

    let results = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // 类型过滤
    if (type) {
      results = results.filter(r => r.type === type);
    }

    // 日期过滤
    if (startDate) {
      results = results.filter(r => new Date(r.timestamp) >= new Date(startDate));
    }
    if (endDate) {
      results = results.filter(r => new Date(r.timestamp) <= new Date(endDate));
    }

    // 搜索
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(r =>
        r.description.toLowerCase().includes(searchLower) ||
        JSON.stringify(r.data).toLowerCase().includes(searchLower)
      );
    }

    // 分页
    return results.slice(offset, offset + limit);
  } catch (e) {
    return [];
  }
}

/**
 * 获取最近N条记录
 * @param {number} count - 数量
 * @param {string} type - 类型过滤
 * @returns {Array} 记录列表
 */
export function getRecent(count = 20, type = null) {
  return queryHistory({ type, limit: count });
}

/**
 * 获取统计数据
 * @param {number} days - 统计天数
 * @returns {Object} 统计信息
 */
export function getStats(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const records = queryHistory({
    startDate: startDate.toISOString(),
    limit: 10000
  });

  const stats = {
    total: records.length,
    byType: {},
    byDay: {},
    averageMessageLength: 0,
    topSearches: [],
    topAgents: {}
  };

  let totalLength = 0;

  records.forEach(r => {
    // 按类型统计
    stats.byType[r.type] = (stats.byType[r.type] || 0) + 1;

    // 按天统计
    const day = r.timestamp.split('T')[0];
    stats.byDay[day] = (stats.byDay[day] || 0) + 1;

    // 消息长度
    if (r.type === OperationType.CHAT && r.data.messageLength) {
      totalLength += r.data.messageLength;
    }

    // Top搜索词
    if (r.type === OperationType.SEARCH) {
      stats.topSearches.push(r.data.query);
    }

    // Top Agent
    if (r.context && r.context.agentId) {
      stats.topAgents[r.context.agentId] = (stats.topAgents[r.context.agentId] || 0) + 1;
    }
  });

  // 计算平均消息长度
  const chatRecords = records.filter(r => r.type === OperationType.CHAT);
  if (chatRecords.length > 0) {
    stats.averageMessageLength = Math.round(totalLength / chatRecords.length);
  }

  // Top搜索词
  const searchCounts = {};
  stats.topSearches.forEach(q => {
    searchCounts[q] = (searchCounts[q] || 0) + 1;
  });
  stats.topSearches = Object.entries(searchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }));

  return stats;
}

/**
 * 导出历史记录
 * @param {string} format - 导出格式 (json | csv)
 * @param {Object} options - 查询选项
 * @returns {string} 导出内容
 */
export function exportHistory(format = 'json', options = {}) {
  const records = queryHistory(options);

  if (format === 'csv') {
    const headers = ['ID', 'Timestamp', 'Type', 'Description'];
    const rows = records.map(r => [
      r.id,
      r.timestamp,
      r.type,
      `"${r.description.replace(/"/g, '""')}"`
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  return JSON.stringify(records, null, 2);
}

/**
 * 清理历史记录
 * @param {number} days - 保留天数
 * @returns {number} 删除数量
 */
export function cleanHistory(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const records = queryHistory({ limit: 100000 });
  const toKeep = records.filter(r => new Date(r.timestamp) >= cutoff);

  const deleted = records.length - toKeep.length;

  // 重写文件
  fs.writeFileSync(HISTORY_FILE, toKeep.map(r => JSON.stringify(r)).join('\n') + '\n');

  return deleted;
}

export default {
  record,
  recordChat,
  recordSearch,
  recordWorkflow,
  recordError,
  queryHistory,
  getRecent,
  getStats,
  exportHistory,
  cleanHistory,
  OperationType
};
