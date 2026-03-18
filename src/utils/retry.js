/**
 * @fileoverview 重试与超时模块 - API调用可靠性保障
 * @module src/utils/retry
 *
 * @description
 * 提供智能重试和超时控制
 * - 指数退避算法
 * - 可配置重试条件
 * - 超时控制
 * - 熔断器模式
 */

import { warn, error, info } from './logger.js';

/**
 * 重试配置
 */
const DEFAULT_OPTIONS = {
  /** 最大重试次数 */
  maxRetries: 3,
  /** 初始延迟（毫秒） */
  initialDelay: 1000,
  /** 最大延迟（毫秒） */
  maxDelay: 10000,
  /** 退避因子 */
  backoffFactor: 2,
  /** 可重试的错误状态码 */
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  /** 超时时间（毫秒） */
  timeout: 30000,
  /** 是否启用熔断器 */
  enableCircuitBreaker: true,
  /** 熔断器阈值 */
  circuitThreshold: 5,
  /** 熔断器恢复时间（毫秒） */
  circuitRecoveryTime: 60000
};

/**
 * 熔断器状态
 */
const CircuitState = {
  CLOSED: 'closed',      // 正常
  OPEN: 'open',          // 熔断
  HALF_OPEN: 'half_open' // 半开
};

/**
 * 熔断器
 */
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.circuitThreshold || 5;
    this.recoveryTime = options.circuitRecoveryTime || 60000;

    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailure = null;
    this.successes = 0;
  }

  /**
   * 是否允许请求
   */
  canExecute() {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // 检查是否超过恢复时间
      if (Date.now() - this.lastFailure >= this.recoveryTime) {
        this.state = CircuitState.HALF_OPEN;
        this.successes = 0;
        info('Retry', `${this.name} 熔断器进入半开状态`);
        return true;
      }
      return false;
    }

    // 半开状态，允许一个请求测试
    return true;
  }

  /**
   * 记录成功
   */
  recordSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= 2) {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        info('Retry', `${this.name} 熔断器已恢复`);
      }
    } else {
      this.failures = 0;
    }
  }

  /**
   * 记录失败
   */
  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      warn('Retry', `${this.name} 熔断器再次打开`);
    } else if (this.failures >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      warn('Retry', `${this.name} 熔断器已打开`);
    }
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure
    };
  }

  /**
   * 重置
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = null;
  }
}

// 全局熔断器
const circuitBreakers = new Map();

/**
 * 获取熔断器
 * @param {string} name - 名称
 * @param {Object} options - 配置
 * @returns {CircuitBreaker}
 */
function getCircuitBreaker(name, options = {}) {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, options));
  }
  return circuitBreakers.get(name);
}

/**
 * 计算延迟
 * @param {number} attempt - 当前尝试次数
 * @param {number} initialDelay - 初始延迟
 * @param {number} factor - 退避因子
 * @param {number} maxDelay - 最大延迟
 * @returns {number} 延迟时间
 */
function calculateDelay(attempt, initialDelay, factor, maxDelay) {
  const delay = initialDelay * Math.pow(factor, attempt - 1);
  // 添加随机抖动
  const jitter = Math.random() * 0.3 * delay;
  return Math.min(delay + jitter, maxDelay);
}

/**
 * 判断是否可重试
 * @param {Error|Response} error - 错误或响应
 * @param {Array} retryableCodes - 可重试状态码
 * @returns {boolean}
 */
function isRetryable(error, retryableCodes = []) {
  // 网络错误总是可重试
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }

  // 检查状态码
  if (error.status || error.statusCode) {
    return retryableCodes.includes(error.status || error.statusCode);
  }

  // 检查错误消息
  const message = error.message || '';
  if (message.includes('timeout') || message.includes('rate limit')) {
    return true;
  }

  return false;
}

/**
 * 带重试的请求
 * @param {Function} fn - 要执行的异步函数
 * @param {Object} options - 配置选项
 * @returns {Promise} 执行结果
 */
export async function withRetry(fn, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const circuitBreaker = opts.enableCircuitBreaker
    ? getCircuitBreaker(opts.circuitBreakerName || 'default', opts)
    : null;

  // 检查熔断器
  if (circuitBreaker && !circuitBreaker.canExecute()) {
    const err = new Error(`Circuit breaker is open for ${circuitBreaker.name}`);
    err.code = 'CIRCUIT_BREAKER_OPEN';
    throw err;
  }

  let lastError;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      // 执行带超时的函数
      const result = await withTimeout(fn, opts.timeout);

      if (circuitBreaker) {
        circuitBreaker.recordSuccess();
      }

      return result;
    } catch (err) {
      lastError = err;

      // 检查是否是可重试的错误
      if (!isRetryable(err, opts.retryableStatusCodes)) {
        error('Retry', `不可重试的错误: ${err.message}`);
        throw err;
      }

      // 已经是最后一次尝试
      if (attempt > opts.maxRetries) {
        error('Retry', `已达到最大重试次数 ${opts.maxRetries}`);
        if (circuitBreaker) {
          circuitBreaker.recordFailure();
        }
        throw err;
      }

      // 计算延迟
      const delay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.backoffFactor,
        opts.maxDelay
      );

      warn('Retry', `请求失败，${delay}ms后重试 (${attempt}/${opts.maxRetries}): ${err.message}`);

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * 带超时的Promise
 * @param {Promise} promise - Promise
 * @param {number} ms - 超时毫秒
 * @returns {Promise} 结果或超时错误
 */
export function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`操作超时 (${ms}ms)`);
      err.code = 'TIMEOUT';
      reject(err);
    }, ms);

    Promise.resolve(promise)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * 睡眠
 * @param {number} ms - 毫秒
 * @returns {Promise}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试装饰器
 * @param {Object} options - 配置
 * @returns {Function} 装饰器
 */
export function retryable(options = {}) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * 获取所有熔断器状态
 * @returns {Array} 状态列表
 */
export function getAllCircuitBreakersStatus() {
  return Array.from(circuitBreakers.values()).map(cb => cb.getStatus());
}

/**
 * 重置所有熔断器
 */
export function resetAllCircuitBreakers() {
  circuitBreakers.forEach(cb => cb.reset());
  info('Retry', '所有熔断器已重置');
}

export default {
  withRetry,
  withTimeout,
  retryable,
  getCircuitBreaker,
  getAllCircuitBreakersStatus,
  resetAllCircuitBreakers,
  CircuitState
};
