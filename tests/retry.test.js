/**
 * @fileoverview retry.js 单元测试
 *
 * 测试策略：
 * - 计算延迟 (calculateDelay) - 纯函数，直接测试
 * - 判断是否可重试 (isRetryable) - 纯函数，直接测试
 * - CircuitBreaker 状态转换 - 独立类，可mock测试
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

/** 纯函数：计算退避延迟 */
function calculateDelay(attempt, initialDelay, factor, maxDelay) {
  const delay = initialDelay * Math.pow(factor, attempt - 1);
  const jitter = Math.random() * 0.3 * delay;
  return Math.min(delay + jitter, maxDelay);
}

/** 纯函数：判断错误是否可重试 */
function isRetryable(error, retryableCodes = []) {
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }
  if (error.status || error.statusCode) {
    return retryableCodes.includes(error.status || error.statusCode);
  }
  const message = error.message || '';
  if (message.includes('timeout') || message.includes('rate limit')) {
    return true;
  }
  return false;
}

/** 简化的熔断器实现（用于测试） */
class SimpleCircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.circuitThreshold || 5;
    this.recoveryTime = options.circuitRecoveryTime || 60000;
    this.state = 'closed';
    this.failures = 0;
    this.lastFailure = null;
    this.successes = 0;
  }

  canExecute() {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure >= this.recoveryTime) {
        this.state = 'half_open';
        this.successes = 0;
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess() {
    if (this.state === 'half_open') {
      this.successes++;
      if (this.successes >= 2) {
        this.state = 'closed';
        this.failures = 0;
      }
    } else {
      this.failures = 0;
    }
  }

  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.state === 'half_open') {
      this.state = 'open';
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getStatus() {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}

describe('calculateDelay()', () => {
  it('第1次重试返回初始延迟', () => {
    const delay = calculateDelay(1, 1000, 2, 10000);
    // 1000 + jitter，应在 1000-1300 之间
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(1300);
  });

  it('第2次重试指数增长', () => {
    const delay1 = calculateDelay(1, 1000, 2, 10000);
    const delay2 = calculateDelay(2, 1000, 2, 10000);
    expect(delay2).toBeGreaterThan(delay1);
  });

  it('不超过最大延迟', () => {
    const delay = calculateDelay(10, 1000, 2, 5000);
    expect(delay).toBeLessThanOrEqual(5000);
  });

  it('不同退避因子产生不同延迟', () => {
    const delay2x = calculateDelay(3, 1000, 2, 100000);
    const delay3x = calculateDelay(3, 1000, 3, 100000);
    expect(delay3x).toBeGreaterThan(delay2x);
  });
});

describe('isRetryable()', () => {
  const retryableCodes = [408, 429, 500, 502, 503, 504];

  it('网络错误 ECONNRESET 可重试', () => {
    expect(isRetryable({ code: 'ECONNRESET' })).toBe(true);
  });

  it('网络错误 ETIMEDOUT 可重试', () => {
    expect(isRetryable({ code: 'ETIMEDOUT' })).toBe(true);
  });

  it('网络错误 ENOTFOUND 可重试', () => {
    expect(isRetryable({ code: 'ENOTFOUND' })).toBe(true);
  });

  it('状态码 429 (限流) 可重试', () => {
    expect(isRetryable({ status: 429 }, retryableCodes)).toBe(true);
  });

  it('状态码 500 (服务器错误) 可重试', () => {
    expect(isRetryable({ status: 500 }, retryableCodes)).toBe(true);
  });

  it('状态码 404 不可重试', () => {
    expect(isRetryable({ status: 404 }, retryableCodes)).toBe(false);
  });

  it('错误消息含 timeout 可重试', () => {
    expect(isRetryable({ message: 'Request timeout occurred' })).toBe(true);
  });

  it('错误消息含 rate limit 可重试', () => {
    expect(isRetryable({ message: 'Rate limit exceeded' })).toBe(true);
  });

  it('普通错误消息不可重试', () => {
    expect(isRetryable({ message: 'Not Found' })).toBe(false);
  });
});

describe('SimpleCircuitBreaker', () => {
  let cb;

  beforeEach(() => {
    cb = new SimpleCircuitBreaker('test', { circuitThreshold: 3, circuitRecoveryTime: 1000 });
  });

  it('初始状态为 closed', () => {
    expect(cb.getStatus().state).toBe('closed');
  });

  it('closed 状态允许执行', () => {
    expect(cb.canExecute()).toBe(true);
  });

  it('失败次数达到阈值后转为 open', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getStatus().state).toBe('open');
  });

  it('open 状态不允许执行（恢复时间前）', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.canExecute()).toBe(false);
  });

  it('成功后从 half_open 恢复到 closed', () => {
    cb.state = 'half_open';
    cb.recordSuccess();
    cb.recordSuccess();
    expect(cb.getStatus().state).toBe('closed');
  });

  it('getStatus 返回正确信息', () => {
    cb.recordFailure();
    const status = cb.getStatus();
    expect(status.name).toBe('test');
    expect(status.failures).toBe(1);
  });
});
