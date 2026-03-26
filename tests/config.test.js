import { jest } from '@jest/globals';
import { loadConfig, saveConfig, getConfig } from '../src/config.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TEST_CONFIG_FILE = path.join(os.tmpdir(), '.b2btrade-agent-test.json');

afterAll(() => {
  if (fs.existsSync(TEST_CONFIG_FILE)) fs.unlinkSync(TEST_CONFIG_FILE);
});

describe('配置管理', () => {
  test('loadConfig 返回默认配置', () => {
    const config = loadConfig();
    expect(config).toBeDefined();
    expect(typeof config.apiProvider).toBe('string');
    expect(typeof config.apiKey).toBe('string');
  });

  test('saveConfig 保存并读取配置', () => {
    const testData = { apiProvider: 'openai', apiKey: 'sk-test-123456', model: 'gpt-4o-mini' };
    const result = saveConfig(testData);
    expect(result).toBe(true);
  });

  test('getConfig 返回与 loadConfig 相同结果', () => {
    const a = loadConfig();
    const b = getConfig();
    expect(a.apiProvider).toBe(b.apiProvider);
  });

  test('配置包含所有平台字段', () => {
    const config = loadConfig();
    expect(config).toHaveProperty('shopify');
    expect(config).toHaveProperty('ali1688');
    expect(config).toHaveProperty('tiktok');
    expect(config).toHaveProperty('instagram');
    expect(config).toHaveProperty('linkedin');
    expect(config).toHaveProperty('whatsapp');
    expect(config).toHaveProperty('email');
  });
});
