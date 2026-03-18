/**
 * B2Btrade-agent 工具模块
 * 浏览器搜索能力
 */

import { execSync } from 'child_process';
import chalk from 'chalk';

// 检查工具是否可用
export function checkTools() {
  const tools = {
    'agent-browser': false,
    'tavily': false,
    'felo': false
  };

  try {
    execSync('where agent-browser', { stdio: 'ignore' });
    tools['agent-browser'] = true;
  } catch (e) {
    // Windows上where命令可能匹配.cmd文件，尝试带扩展名的检测
    try {
      execSync('where agent-browser.cmd', { stdio: 'ignore' });
      tools['agent-browser'] = true;
    } catch (e2) {}
  }

  return tools;
}

// 使用 agent-browser 搜索
export async function browserSearch(query) {
  console.log(chalk.blue(`🌐 正在搜索: ${query}`));
  
  try {
    // 打开浏览器搜索 Google
    execSync(`agent-browser open "https://www.google.com/search?q=${encodeURIComponent(query)}"`, {
      stdio: 'inherit'
    });
    
    // 获取页面快照
    const result = execSync('agent-browser snapshot -i', { encoding: 'utf8' });
    
    execSync('agent-browser close', { stdio: 'ignore' });
    
    return result;
  } catch (e) {
    return `搜索出错: ${e.message}`;
  }
}

// 使用 tavily 搜索（AI优化搜索）
export async function tavilySearch(query) {
  console.log(chalk.blue(`🔍 AI搜索: ${query}`));
  
  try {
    // 使用 tavily-search 技能（如果有的话）
    const result = execSync('tavily search "' + query + '" --max-results 5', { 
      encoding: 'utf8',
      timeout: 30000
    });
    return result;
  } catch (e) {
    return `搜索出错: ${e.message}`;
  }
}

// 搜索客户（海关数据 + Google）
export async function searchCustomer(country, product) {
  console.log(chalk.blue(`🎯 挖掘目标客户: ${country} - ${product}`));
  
  const results = {
    companies: [],
    contacts: [],
    insights: []
  };

  // 1. 搜索进口商
  try {
    const query = `${product} importers ${country} 2024`;
    console.log(chalk.gray(`  查询: ${query}`));
    // 这里可以调用真实的搜索
  } catch (e) {}

  // 2. 搜索行业新闻
  try {
    const newsQuery = `${product} market ${country} news`;
    console.log(chalk.gray(`  行业动态: ${newsQuery}`));
  } catch (e) {}

  return results;
}

// LinkedIn 搜索
export async function searchLinkedIn(company, role = 'procurement') {
  console.log(chalk.blue(`👔 LinkedIn搜索: ${company} - ${role}`));
  
  const query = `site:linkedin.com ${company} ${role}`;
  
  try {
    // 返回搜索URL
    return {
      searchUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      tip: '请用浏览器打开，手动筛选联系人'
    };
  } catch (e) {
    return { error: e.message };
  }
}

// 导出可用工具列表
export function listTools() {
  const available = checkTools();
  return Object.entries(available).map(([name, ok]) => ({
    name,
    status: ok ? '✅ 可用' : '❌ 未安装'
  }));
}
