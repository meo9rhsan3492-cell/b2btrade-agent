/**
 * @fileoverview 请求限流模块 - 企业级API调用保护
 * @module src/utils/rateLimiter
 *
 * @description
 * 基于令牌桶算法的请求限流器
 * - 支持多API服务商独立限流
 * - 自适应限流策略
 * - 请求队列和优先级
 */

import { info, warn } from './logger.js';

/**
 * 限流配置
 */
const DEFAULT_CONFIG = {
  // 每时间窗口的最大请求数
  maxRequests: 60,
  // 时间窗口（毫秒）
  windowMs: 60000,
  // 超出限流后的最大等待时间
  maxWait: 30000,
  // 是否启用自适应限流
  adaptive: true,
  // 连续限流后降低速率的比例
  backoffFactor: 0.9
};

/**
 * 限流器实例
 */
const limiters = new Map();

/**
 * 限流器类
 */
class RateLimiter {
  /**
   * @param {string} name - 限流器名称
   * @param {Object} config - 配置
   */
  constructor(name, config = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 令牌桶
    this.tokens = this.config.maxRequests;
    this.lastRefill = Date.now();

    // 统计信息
    this.stats = {
      total: 0,
      passed: 0,
      rejected: 0,
      queued: 0,
      waiting: 0
    };

    // 等待队列
    this.queue = [];

    // 自适应限流状态
    this.consecutiveRejections = 0;
    this.currentLimit = this.config.maxRequests;
  }

  /**
   * 补充令牌
   */
  refillTokens() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed >= this.config.windowMs) {
      // 时间窗口过期，重置令牌
      this.tokens = this.config.maxRequests;
      this.lastRefill = now;
    } else if (this.tokens < this.config.maxRequests) {
      // 按比例补充令牌
      const refill = Math.floor(
        (elapsed / this.config.windowMs) * this.config.maxRequests
      );
      this.tokens = Math.min(this.config.maxRequests, this.tokens + refill);
      this.lastRefill = now;
    }
  }

  /**
   * 获取令牌
   * @returns {Promise<boolean>} 是否获取成功
   */
  async acquire() {
    this.refillTokens();
    this.stats.total++;

    if (this.tokens > 0) {
      this.tokens--;
      this.stats.passed++;
      this.consecutiveRejections = 0;
      return true;
    }

    // 尝试加入队列等待
    if (this.config.maxWait > 0) {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.removeFromQueue(resolve);
          this.stats.rejected++;
          this.stats.waiting--;
          resolve(false);
        }, this.config.maxWait);

        this.queue.push(resolve);
        this.stats.waiting++;
        this.stats.queued++;

        // 超时处理
        const originalResolve = resolve;
        resolve = (result) => {
          clearTimeout(timeout);
          this.removeFromQueue(originalResolve);
          originalResolve(result);
        };
      });
    }

    this.stats.rejected++;
    this.consecutiveRejections++;

    // 自适应限流
    if (this.config.adaptive && this.consecutiveRejections > 3) {
      this.adaptiveBackoff();
    }

    return false;
  }

  /**
   * 从队列中移除
   * @param {Function} resolve - Promise resolve
   */
  removeFromQueue(resolve) {
    const index = this.queue.indexOf(resolve);
    if (index > -1) {
      this.queue.splice(index, 1);
    }
  }

  /**
   * 自适应退避
   */
  adaptiveBackoff() {
    if (this.currentLimit > 10) {
      this.currentLimit = Math.floor(this.currentLimit * this.config.backoffFactor);
      warn('RateLimiter', `${this.name} 自适应限流: ${this.currentLimit} req/${this.config.windowMs / 1000}s`);
    }
  }

  /**
   * 处理队列中的请求
   */
  processQueue() {
    this.refillTokens();

    while (this.queue.length > 0 && this.tokens > 0) {
      const resolve = this.queue.shift();
      this.tokens--;
      this.stats.passed++;
      this.stats.waiting--;
      resolve(true);
    }
  }

  /**
   * 获取状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    this.refillTokens();
    return {
      name: this.name,
      tokens: this.tokens,
      limit: this.config.maxRequests,
      currentLimit: this.currentLimit,
      queueLength: this.queue.length,
      stats: { ...this.stats }
    };
  }

  /**
   * 重置限流器
   */
  reset() {
    this.tokens = this.config.maxRequests;
    this.lastRefill = Date.now();
    this.queue = [];
    this.stats = {
      total: 0,
      passed: 0,
      rejected: 0,
      queued: 0,
      waiting: 0
    };
    this.consecutiveRejections = 0;
    this.currentLimit = this.config.maxRequests;
  }
}

/**
 * 获取或创建限流器
 * @param {string} name - 限流器名称
 * @param {Object} config - 配置
 * @returns {RateLimiter} 限流器实例
 */
export function getLimiter(name, config = {}) {
  if (!limiters.has(name)) {
    limiters.set(name, new RateLimiter(name, config));
    info('RateLimiter', `创建限流器: ${name}`);
  }
  return limiters.get(name);
}

/**
 * 获取所有限流器状态
 * @returns {Object[]} 所有限流器状态
 */
export function getAllLimitersStatus() {
  return Array.from(limiters.values()).map(limiter => limiter.getStatus());
}

/**
 * 限流装饰器
 * @param {string} name - 限流器名称
 * @param {Object} config - 配置
 * @returns {Function} 装饰器函数
 */
export function rateLimit(name, config = {}) {
  const limiter = getLimiter(name, config);

  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      const acquired = await limiter.acquire();

      if (!acquired) {
        const error = new Error(`Rate limit exceeded for ${name}`);
        error.code = 'RATE_LIMIT_EXCEEDED';
        throw error;
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * 通用API限流器
 */
export const apiLimiter = getLimiter('api', {
  maxRequests: 60,
  windowMs: 60000,
  maxWait: 10000
});

/**
 * OpenAI专用限流器
 */
export const openaiLimiter = getLimiter('openai', {
  maxRequests: 50,
  windowMs: 60000,
  maxWait: 15000
});

/**
 * Anthropic专用限流器
 */
export const anthropicLimiter = getLimiter('anthropic', {
  maxRequests: 30,
  windowMs: 60000,
  maxWait: 15000
});

/**
 * Google专用限流器
 */
export const googleLimiter = getLimiter('google', {
  maxRequests: 60,
  windowMs: 60000,
  maxWait: 15000
});

/**
 * 获取对应服务商的限流器
 * @param {string} provider - API服务商
 * @returns {RateLimiter} 限流器
 */
export function getProviderLimiter(provider) {
  switch (provider) {
    case 'openai':
      return openaiLimiter;
    case 'anthropic':
      return anthropicLimiter;
    case 'google':
      return googleLimiter;
    default:
      return apiLimiter;
  }
}

export default {
  getLimiter,
  getAllLimitersStatus,
  rateLimit,
  apiLimiter,
  openaiLimiter,
  anthropicLimiter,
  googleLimiter,
  getProviderLimiter
};
