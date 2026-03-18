/**
 * @fileoverview 进度条模块 - CLI进度显示
 * @module src/utils/progress
 *
 * @description
 * 提供多种进度条样式
 * - 加载动画
 * - 进度条
 * - 步骤指示器
 * - 统计显示
 */

import chalk from 'chalk';
import readline from 'readline';

/**
 * 进度条类型
 */
export const ProgressType = {
  SPINNER: 'spinner',
  BAR: 'bar',
  STEPS: 'steps',
  PERCENT: 'percent'
};

/**
 * 加载动画帧
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * 加载动画颜色
 */
const SPINNER_COLORS = ['cyan', 'blue', 'magenta', 'cyanBright', 'blueBright'];

/**
 * 进度条类
 */
class Progress {
  /**
   * @param {Object} options - 配置
   */
  constructor(options = {}) {
    this.type = options.type || ProgressType.SPINNER;
    this.text = options.text || '';
    this.total = options.total || 100;
    this.current = options.current || 0;
    this.width = options.width || 40;
    this.showPercent = options.showPercent !== false;
    this.frameIndex = 0;
    this.colorIndex = 0;
    this.interval = null;
    this.startTime = null;
    this.paused = false;
  }

  /**
   * 开始显示
   * @param {string} text - 初始文本
   */
  start(text = '') {
    if (text) this.text = text;
    this.startTime = Date.now();
    this.current = 0;

    if (this.type === ProgressType.SPINNER) {
      this.interval = setInterval(() => {
        if (!this.paused) {
          this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;
          this.colorIndex = (this.colorIndex + 1) % SPINNER_COLORS.length;
          this.render();
        }
      }, 80);
    } else {
      this.render();
    }

    return this;
  }

  /**
   * 更新进度
   * @param {number} current - 当前值
   * @param {string} text - 文本
   */
  update(current, text = '') {
    this.current = Math.min(Math.max(current, 0), this.total);
    if (text) this.text = text;
    this.render();
  }

  /**
   * 增加进度
   * @param {number} delta - 增加量
   * @param {string} text - 文本
   */
  increment(delta = 1, text = '') {
    this.current = Math.min(this.current + delta, this.total);
    if (text) this.text = text;
    this.render();
  }

  /**
   * 暂停
   */
  pause() {
    this.paused = true;
  }

  /**
   * 恢复
   */
  resume() {
    this.paused = false;
  }

  /**
   * 完成
   * @param {string} text - 完成文本
   */
  stop(text = '') {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (text) this.text = text;
    this.current = this.total;
    this.render();

    // 清除行
    this.clear();
  }

  /**
   * 成功完成
   * @param {string} text - 文本
   */
  succeed(text = '') {
    this.stop(text || this.text);
    this.clear();
    console.log(chalk.green('✓ ') + (text || this.text));
  }

  /**
   * 失败完成
   * @param {string} text - 文本
   */
  fail(text = '') {
    this.stop(text || this.text);
    this.clear();
    console.log(chalk.red('✗ ') + (text || this.text));
  }

  /**
   * 渲染进度条
   */
  render() {
    if (this.type === ProgressType.SPINNER) {
      this.renderSpinner();
    } else if (this.type === ProgressType.BAR) {
      this.renderBar();
    } else if (this.type === ProgressType.STEPS) {
      this.renderSteps();
    } else if (this.type === ProgressType.PERCENT) {
      this.renderPercent();
    }
  }

  /**
   * 渲染加载动画
   */
  renderSpinner() {
    const frame = SPINNER_FRAMES[this.frameIndex];
    const color = SPINNER_COLORS[this.colorIndex];
    const text = this.text ? ` ${this.text}` : '';
    process.stdout.write(`\r${chalk[color](frame)}${text}`);
  }

  /**
   * 渲染进度条
   */
  renderBar() {
    const percent = Math.round((this.current / this.total) * 100);
    const filled = Math.round((this.current / this.total) * this.width);
    const empty = this.width - filled;

    const bar = chalk.green('█').repeat(filled) + chalk.gray('░').repeat(empty);
    const percentText = this.showPercent ? ` ${percent}%` : '';
    const timeText = this.getElapsedTime();

    process.stdout.write(
      `\r[${bar}]${percentText} ${this.text}${timeText ? ' ' + timeText : ''}`
    );
  }

  /**
   * 渲染步骤指示器
   */
  renderSteps() {
    const total = this.total;
    const current = this.current;

    let steps = '';
    for (let i = 0; i < total; i++) {
      if (i < current) {
        steps += chalk.green('●');
      } else if (i === current) {
        steps += chalk.yellow('○');
      } else {
        steps += chalk.gray('○');
      }
    }

    process.stdout.write(`\r${steps} ${this.text}`);
  }

  /**
   * 渲染百分比
   */
  renderPercent() {
    const percent = Math.round((this.current / this.total) * 100);
    process.stdout.write(`\r${this.text}: ${percent}%`);
  }

  /**
   * 获取耗时
   * @returns {string}
   */
  getElapsedTime() {
    if (!this.startTime) return '';
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);

    if (elapsed < 60) {
      return `(${elapsed}s)`;
    }

    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `(${minutes}m ${seconds}s)`;
  }

  /**
   * 清除行
   */
  clear() {
    process.stdout.write('\r' + ' '.repeat(100) + '\r');
  }
}

/**
 * 创建加载动画
 * @param {string} text - 文本
 * @returns {Progress}
 */
export function spinner(text = '') {
  const p = new Progress({ type: ProgressType.SPINNER });
  p.start(text);
  return p;
}

/**
 * 创建进度条
 * @param {Object} options - 配置
 * @returns {Progress}
 */
export function progress(options = {}) {
  return new Progress({ type: ProgressType.BAR, ...options });
}

/**
 * 创建步骤指示器
 * @param {number} total - 总步骤
 * @param {string} text - 文本
 * @returns {Progress}
 */
export function steps(total, text = '') {
  return new Progress({ type: ProgressType.STEPS, total, text }).start(text);
}

/**
 * 多行进度管理器
 */
export class MultiProgress {
  constructor() {
    this.items = [];
    this.currentLine = 0;
  }

  /**
   * 添加进度项
   * @param {Progress} item - 进度实例
   */
  add(item) {
    this.items.push(item);
    return item;
  }

  /**
   * 渲染所有
   */
  renderAll() {
    this.items.forEach((item, index) => {
      process.stdout.write(`\r${index + 1}. ${item.text}`);
    });
  }

  /**
   * 清除所有
   */
  clearAll() {
    process.stdout.write('\r' + ' '.repeat(100).repeat(this.items.length));
  }
}

/**
 * 统计进度
 * @param {string} label - 标签
 * @param {number} current - 当前
 * @param {number} total - 总数
 * @param {Object} options - 选项
 */
export function stats(label, current, total, options = {}) {
  const percent = Math.round((current / total) * 100);
  const barWidth = options.width || 20;
  const filled = Math.round((current / total) * barWidth);

  const bar = chalk.green('█').repeat(filled) + chalk.gray('░').repeat(barWidth - filled);
  const symbol = current === total ? chalk.green('✓') : '○';

  process.stdout.write(
    `\r${symbol} ${label}: [${bar}] ${percent}% (${current}/${total})`
  );

  if (current === total) {
    process.stdout.write('\n');
  }
}

export default {
  Progress,
  ProgressType,
  spinner,
  progress,
  steps,
  MultiProgress,
  stats
};
