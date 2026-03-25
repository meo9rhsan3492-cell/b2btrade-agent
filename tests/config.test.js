/**
 * @fileoverview config.js 单元测试
 */
import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadConfig, saveConfig, getConfig } from '../src/config.js';

const TEST_CONFIG_FILE = path.join(os.tmpdir(), '.b2btrade-agent-test.json');

describe('配置管理模块', () => {
  const originalConfigFile = process.env.B2BTRADE_CONFIG_FILE;

  beforeAll(() => {
    // 清理残留文件，确保测试隔离
    if (fs.existsSync(TEST_CONFIG_FILE)) {
      fs.unlinkSync(TEST_CONFIG_FILE);
    }
    process.env.B2BTRADE_CONFIG_FILE = TEST_CONFIG_FILE;
  });

  afterAll(() => {
    if (fs.existsSync(TEST_CONFIG_FILE)) {
      fs.unlinkSync(TEST_CONFIG_FILE);
    }
    if (originalConfigFile) {
      process.env.B2BTRADE_CONFIG_FILE = originalConfigFile;
    }
  });

  describe('loadConfig()', () => {
    it('配置文件不存在时返回默认配置', () => {
      const config = loadConfig();
      expect(config.apiProvider).toBe('openai');
      expect(config.model).toBe('gpt-4');
      expect(config.apiKey).toBe('');
      expect(config.defaultAgent).toBe('default');
    });

    it('配置文件存在时返回合并后的配置', () => {
      const testData = { apiProvider: 'anthropic', model: 'claude-3-sonnet' };
      fs.writeFileSync(TEST_CONFIG_FILE, JSON.stringify(testData));

      const config = loadConfig();
      expect(config.apiProvider).toBe('anthropic');
      expect(config.model).toBe('claude-3-sonnet');
      expect(config.apiKey).toBe(''); // 未设置，使用默认值
    });

    it('损坏的JSON文件返回默认配置', () => {
      fs.writeFileSync(TEST_CONFIG_FILE, '{ invalid json }');
      const config = loadConfig();
      expect(config.apiProvider).toBe('openai');
    });
  });

  describe('saveConfig()', () => {
    it('成功保存配置到文件', () => {
      const testConfig = {
        apiProvider: 'google',
        apiKey: 'test-key-123',
        model: 'gemini-pro'
      };
      const result = saveConfig(testConfig);
      expect(result).toBe(true);
      expect(fs.existsSync(TEST_CONFIG_FILE)).toBe(true);

      const saved = JSON.parse(fs.readFileSync(TEST_CONFIG_FILE, 'utf8'));
      expect(saved.apiProvider).toBe('google');
      expect(saved.apiKey).toBe('test-key-123');
    });
  });

  describe('getConfig()', () => {
    it('返回当前配置快照', () => {
      const config = getConfig();
      expect(config).toHaveProperty('apiProvider');
      expect(config).toHaveProperty('apiKey');
      expect(config).toHaveProperty('model');
    });
  });
});
