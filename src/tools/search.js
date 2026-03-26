/**
 * B2Btrade-agent 搜索工具
 * 支持: DuckDuckGo / Tavily / Agent-Browser / 内置演示数据
 */
import { execSync } from 'child_process';
import chalk from 'chalk';
import https from 'https';
import http from 'http';
import { URL } from 'url';

// ===== 通用 HTTP GET =====
function httpGet(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 B2Btrade-Agent/1.1' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(httpGet(res.headers.location, timeout));
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

// ===== DuckDuckGo 搜索 =====
async function duckduckgoSearch(query, maxResults = 10) {
  try {
    // 使用 DuckDuckGo HTML Lite 界面（无需 API Key）
    const encoded = encodeURIComponent(query);
    const html = await httpGet(`https://lite.duckduckgo.com/10/?q=${encoded}&ia=web`, 8000);
    const results = [];
    // 简单解析：提取 <a> 标签中的链接和标题
    const matches = html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>(?:<[^>]*>)*([^<]+)/gi);
    let count = 0;
    const seen = new Set();
    for (const m of matches) {
      const url = m[1];
      const title = m[2].replace(/<[^>]+>/g, '').trim();
      if (url && title && title.length > 5 && !seen.has(url) && !url.includes('duckduckgo') && !url.includes('yahoo') && !url.includes('bing')) {
        seen.add(url);
        results.push({ title, url });
        if (++count >= maxResults) break;
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

// ===== Tavily 搜索（需 API Key）=====
async function tavilySearch(query, apiKey, maxResults = 5) {
  if (!apiKey) return [];
  try {
    const body = JSON.stringify({ query, max_results: maxResults });
    const res = await new Promise((resolve, reject) => {
      const req = https.request('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    return (res.results || []).map(r => ({ title: r.title, url: r.url, snippet: r.content }));
  } catch (e) {
    return [];
  }
}

// ===== Agent-Browser 搜索 =====
async function agentBrowserSearch(query) {
  try {
    execSync(`agent-browser open "https://www.google.com/search?q=${encodeURIComponent(query)}"`, { stdio: 'ignore', timeout: 15000 });
    return { success: true, url: `https://www.google.com/search?q=${encodeURIComponent(query)}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ===== 主搜索接口 =====
export async function searchCustomer(country, product, options = {}) {
  const { apiKey = '', method = 'ddg', maxResults = 10 } = options;
  console.log(chalk.blue(`\n🔍 搜索: ${product} buyers in ${country}`));

  const query = `${product} importer distributor buyer ${country} B2B`;
  let results = [];

  if (method === 'tavily' && apiKey) {
    results = await tavilySearch(query, apiKey, maxResults);
  } else {
    results = await duckduckgoSearch(query, maxResults);
  }

  if (results.length === 0) {
    console.log(chalk.yellow('  ⚠️  直接搜索未获取到结果，使用演示数据'));
    return getDemoResults(country, product);
  }

  return {
    companies: results.map((r, i) => ({
      rank: i + 1,
      name: r.title.slice(0, 60),
      url: r.url,
      snippet: r.snippet || '',
      source: method === 'tavily' ? 'Tavily AI' : 'DuckDuckGo'
    }))
  };
}

// ===== LinkedIn 搜索 =====
export async function searchLinkedIn(company, role = 'procurement') {
  const query = `site:linkedin.com/in "${company}" "${role}" OR "buyer" OR "purchasing"`;
  console.log(chalk.blue(`\n👔 LinkedIn 搜索: ${company} - ${role}`));

  const results = await duckduckgoSearch(query, 8);
  if (results.length === 0) {
    return {
      searchUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      tip: 'Google 搜索URL，请浏览器打开手动筛选'
    };
  }

  return {
    query,
    profiles: results.map(r => ({
      name: r.title.split('|')[0].trim(),
      url: r.url,
      source: 'LinkedIn'
    })),
    googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`
  };
}

// ===== 海关数据搜索（演示）=====
export async function searchCustomsData(country, product) {
  console.log(chalk.blue(`\n📊 海关数据分析: ${country} - ${product}`));
  return {
    note: '海关数据需要付费订阅（ImportGenius / Panjiva / Datahub）',
    alternatives: [
      '贸促会统计 (http://report.ccpit.org)',
      '中国海关总署统计数据',
      '联合国商品贸易统计 (comtrade.un.org)'
    ],
    freeTip: '可搜索出口管制清单和进口许可目录来评估市场准入'
  };
}

// ===== 演示数据（搜索无结果时的降级）=====
export function getDemoResults(country, product) {
  const demos = {
    '沙特': [
      { rank: 1, name: 'Almatar for Drilling & Water Well Co.', url: 'https://www.almatar.com.sa', snippet: '专业钻井公司，长期采购钻机设备', source: '演示数据' },
      { rank: 2, name: 'Saudi Arabian Oil Company (Aramco)', url: 'https://www.aramco.com', snippet: '全球最大石油公司，设备采购量巨大', source: '演示数据' },
      { rank: 3, name: 'SAVCO - Saudi Vacuum Services', url: 'https://www.savco.com.sa', snippet: '油田服务公司，采购钻井配套设备', source: '演示数据' }
    ],
    '中东': [
      { rank: 1, name: 'Al-Futtaim Group Trading', url: 'https://www.alfuttaim.com', snippet: '阿联酋多元化集团，设备采购商', source: '演示数据' },
      { rank: 2, name: 'Al Habtoor Group LLC', url: 'https://www.habtoor.com', snippet: '阿联酋建筑集团，采购工程设备', source: '演示数据' }
    ]
  };
  const key = Object.keys(demos).find(k => country.includes(k));
  return { companies: demos[key] || demos['中东'] };
}

// ===== 导出工具列表 =====
export function listTools() {
  const tools = [
    { name: 'DuckDuckGo Search', status: '✅ 内置可用', desc: '无需API Key，实时网络搜索' },
    { name: 'Tavily AI Search', status: '⚠️ 需配置API Key', desc: 'AI优化的搜索结果（需 Tavily API Key）' },
    { name: 'Agent-Browser', status: '❌ 需安装', desc: 'OpenClaw agent-browser 工具' }
  ];
  return tools;
}
