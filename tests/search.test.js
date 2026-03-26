import { jest } from '@jest/globals';
import { listTools, searchCustomer, searchLinkedIn, getDemoResults } from '../src/tools/search.js';

describe('搜索工具', () => {
  test('listTools 返回工具列表', () => {
    const tools = listTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0]).toHaveProperty('name');
    expect(tools[0]).toHaveProperty('status');
  });

  test('getDemoResults 为沙特返回演示数据', () => {
    const results = getDemoResults('沙特', '钻机');
    expect(results.companies).toBeDefined();
    expect(results.companies.length).toBeGreaterThan(0);
    expect(results.companies[0]).toHaveProperty('name');
    expect(results.companies[0]).toHaveProperty('url');
  });

  test('searchCustomer 返回公司列表', async () => {
    // 使用演示数据（网络不可用时降级）
    const results = await searchCustomer('沙特', '钻机', { method: 'ddg' });
    expect(results).toBeDefined();
    expect(results.companies).toBeDefined();
  }, 15000);

  test('searchLinkedIn 返回搜索URL', async () => {
    const results = await searchLinkedIn('Saudi Aramco', 'procurement');
    expect(results).toBeDefined();
    expect(results.searchUrl || results.googleSearchUrl).toBeDefined();
  }, 15000);
});
