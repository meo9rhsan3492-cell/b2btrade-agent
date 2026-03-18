/**
 * @fileoverview 会话持久化模块 - 对话历史断点续传
 * @module src/utils/session
 *
 * @description
 * 提供会话管理和对话历史持久化
 * - 多会话支持
 * - 对话历史自动保存
 * - 会话恢复
 * - 会话元数据管理
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 会话目录
 */
const SESSION_DIR = path.join(__dirname, '../../history/sessions');

/**
 * 默认会话配置
 */
const DEFAULT_SESSION_CONFIG = {
  /** 最大会话数 */
  maxSessions: 10,
  /** 会话过期时间（毫秒） */
  sessionTTL: 7 * 24 * 60 * 60 * 1000, // 7天
  /** 自动保存间隔（毫秒） */
  autoSaveInterval: 30000,
  /** 最大消息数 */
  maxMessages: 1000
};

/**
 * 会话配置
 */
let sessionConfig = { ...DEFAULT_SESSION_CONFIG };

/**
 * 初始化会话目录
 */
function initSessionDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

/**
 * 生成会话ID
 * @returns {string}
 */
function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 获取会话文件路径
 * @param {string} sessionId - 会话ID
 * @returns {string}
 */
function getSessionFilePath(sessionId) {
  return path.join(SESSION_DIR, `${sessionId}.json`);
}

/**
 * 会话类
 */
export class Session {
  /**
   * @param {string} id - 会话ID
   * @param {Object} data - 初始数据
   */
  constructor(id, data = {}) {
    this.id = id;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.agentId = data.agentId || 'default';
    this.messages = data.messages || [];
    this.metadata = data.metadata || {};
    this.isDirty = false;

    // 自动保存定时器
    this.autoSaveTimer = null;
  }

  /**
   * 添加消息
   * @param {Object} message - 消息对象
   */
  addMessage(message) {
    const msg = {
      id: crypto.randomBytes(8).toString('hex'),
      timestamp: new Date().toISOString(),
      ...message
    };

    this.messages.push(msg);
    this.updatedAt = new Date().toISOString();
    this.isDirty = true;

    // 限制消息数量
    if (this.messages.length > sessionConfig.maxMessages) {
      this.messages = this.messages.slice(-sessionConfig.maxMessages);
    }

    return msg;
  }

  /**
   * 添加用户消息
   * @param {string} content - 消息内容
   * @returns {Object} 消息对象
   */
  addUserMessage(content) {
    return this.addMessage({
      role: 'user',
      content
    });
  }

  /**
   * 添加助手消息
   * @param {string} content - 消息内容
   * @returns {Object} 消息对象
   */
  addAssistantMessage(content) {
    return this.addMessage({
      role: 'assistant',
      content
    });
  }

  /**
   * 获取对话历史（用于API调用）
   * @param {string} systemPrompt - 系统提示
   * @returns {Array} 消息数组
   */
  getHistory(systemPrompt = null) {
    const history = [];

    if (systemPrompt) {
      history.push({ role: 'system', content: systemPrompt });
    }

    history.push(...this.messages.map(m => ({
      role: m.role,
      content: m.content
    })));

    return history;
  }

  /**
   * 保存会话到文件
   */
  save() {
    if (!this.isDirty) return;

    initSessionDir();

    const data = {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      agentId: this.agentId,
      messages: this.messages,
      metadata: this.metadata
    };

    try {
      fs.writeFileSync(
        getSessionFilePath(this.id),
        JSON.stringify(data, null, 2)
      );
      this.isDirty = false;
    } catch (e) {
      console.error('保存会话失败:', e.message);
    }
  }

  /**
   * 加载会话
   * @param {string} sessionId - 会话ID
   * @returns {Session|null}
   */
  static load(sessionId) {
    initSessionDir();

    const filePath = getSessionFilePath(sessionId);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return new Session(sessionId, data);
    } catch (e) {
      console.error('加载会话失败:', e.message);
      return null;
    }
  }

  /**
   * 删除会话
   * @param {string} sessionId - 会话ID
   * @returns {boolean}
   */
  static delete(sessionId) {
    const filePath = getSessionFilePath(sessionId);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        return true;
      } catch (e) {
        console.error('删除会话失败:', e.message);
      }
    }

    return false;
  }

  /**
   * 列出所有会话
   * @returns {Array} 会话列表
   */
  static list() {
    initSessionDir();

    try {
      const files = fs.readdirSync(SESSION_DIR)
        .filter(f => f.endsWith('.json'));

      return files.map(f => {
        try {
          const data = JSON.parse(
            fs.readFileSync(path.join(SESSION_DIR, f), 'utf8')
          );
          return {
            id: data.id,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            agentId: data.agentId,
            messageCount: data.messages ? data.messages.length : 0,
            preview: data.messages && data.messages.length > 0
              ? data.messages[data.messages.length - 1].content.slice(0, 50)
              : ''
          };
        } catch {
          return null;
        }
      }).filter(Boolean)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (e) {
      return [];
    }
  }

  /**
   * 创建新会话
   * @param {Object} options - 配置
   * @returns {Session}
   */
  static create(options = {}) {
    const id = options.id || generateSessionId();
    const session = new Session(id, {
      agentId: options.agentId,
      metadata: options.metadata
    });

    // 清理旧会话
    Session.cleanup(sessionConfig.maxSessions);

    return session;
  }

  /**
   * 清理过期会话
   * @param {number} keep - 保留数量
   */
  static cleanup(keep = 10) {
    const sessions = Session.list();

    if (sessions.length > keep) {
      sessions.slice(keep).forEach(s => {
        Session.delete(s.id);
      });
    }
  }

  /**
   * 获取最近的会话
   * @param {number} count - 数量
   * @returns {Array}
   */
  static getRecent(count = 5) {
    return Session.list().slice(0, count);
  }

  /**
   * 启动自动保存
   */
  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(() => {
      this.save();
    }, sessionConfig.autoSaveInterval);
  }

  /**
   * 停止自动保存
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
}

/**
 * 当前会话实例
 */
let currentSession = null;

/**
 * 获取当前会话
 * @returns {Session}
 */
export function getCurrentSession() {
  if (!currentSession) {
    // 尝试加载最近的会话
    const recent = Session.getRecent(1);
    if (recent.length > 0) {
      currentSession = Session.load(recent[0].id);
    }

    if (!currentSession) {
      currentSession = Session.create();
    }
  }

  return currentSession;
}

/**
 * 设置当前会话
 * @param {Session|string} session - 会话或会话ID
 */
export function setCurrentSession(session) {
  if (typeof session === 'string') {
    currentSession = Session.load(session);
    if (!currentSession) {
      currentSession = Session.create({ id: session });
    }
  } else {
    currentSession = session;
  }

  return currentSession;
}

/**
 * 创建新会话
 * @param {Object} options - 配置
 * @returns {Session}
 */
export function createSession(options = {}) {
  currentSession = Session.create(options);
  currentSession.startAutoSave();
  return currentSession;
}

/**
 * 保存当前会话
 */
export function saveCurrentSession() {
  if (currentSession) {
    currentSession.save();
  }
}

/**
 * 获取会话统计
 * @returns {Object}
 */
export function getSessionStats() {
  const sessions = Session.list();

  return {
    totalSessions: sessions.length,
    currentSessionId: currentSession ? currentSession.id : null,
    totalMessages: sessions.reduce((sum, s) => sum + s.messageCount, 0),
    oldestSession: sessions.length > 0 ? sessions[sessions.length - 1].updatedAt : null,
    newestSession: sessions.length > 0 ? sessions[0].updatedAt : null
  };
}

/**
 * 配置会话模块
 * @param {Object} config - 配置
 */
export function configureSession(config) {
  sessionConfig = { ...sessionConfig, ...config };
}

export default {
  Session,
  getCurrentSession,
  setCurrentSession,
  createSession,
  saveCurrentSession,
  getSessionStats,
  configureSession
};
