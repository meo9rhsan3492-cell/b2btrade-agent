/**
 * B2Btrade-agent LinkedIn 数据抓取工具
 * 功能：抓取公开 LinkedIn 主页基本信息 + Google 搜索补充
 *
 * ⚠️ 合规声明：
 * - 不登录、不绕过认证、不自动化操作
 * - 仅抓取公开可见信息
 * - 通过 Google 搜索补充公开数据
 */

import { info, warn, error, debug } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { web_search, web_fetch } from 'openclaw'; // 内置搜索工具
import chalk from 'chalk';

/**
 * LinkedIn 公开信息字段
 * @typedef {Object} LinkedInProfile
 * @property {string} name           - 姓名
 * @property {string} title         - 职位
 * @property {string} company       - 公司
 * @property {string} location      - 地区
 * @property {string} summary       - 个人简介
 * @property {string} sourceUrl     - 来源 URL
 * @property {Array}  experience    - 工作经验
 * @property {Array}  education     - 教育背景
 * @property {Array}  skills        - 技能
 * @property {Object} recentActivity - 最近动态
 * @property {string} linkedinId    - LinkedIn ID
 * @property {number} scrapedAt     - 抓取时间戳
 */

/**
 * LinkedIn 公司页面字段
 * @typedef {Object} LinkedInCompany
 * @property {string} name          - 公司名称
 * @property {string} industry      - 行业
 * @property {string} size          - 公司规模
 * @property {string} location     - 总部地区
 * @property {string} description   - 公司描述
 * @property {string} website       - 公司网站
 * @property {string} sourceUrl     - 来源 URL
 * @property {number} scrapedAt     - 抓取时间戳
 */

// ========================
// 公开信息抓取（无登录）
// ========================

/**
 * 通过 web_fetch 直接抓取 LinkedIn 公开页面
 * 适用于抓取不需要登录即可查看的公开信息
 *
 * @param {string} profileUrl - LinkedIn 个人主页 URL
 * @returns {Promise<LinkedInProfile>}
 */
export async function scrapeLinkedInProfile(profileUrl) {
  if (!profileUrl || typeof profileUrl !== 'string') {
    throw new Error('无效的 LinkedIn URL');
  }

  // 标准化 URL
  const normalizedUrl = normalizeLinkedInUrl(profileUrl, 'profile');

  info('LinkedInScrape', `抓取个人主页: ${normalizedUrl}`);

  try {
    // 尝试直接抓取（公开信息）
    const html = await withRetry(
      () => web_fetch(normalizedUrl, { extractMode: 'markdown', maxChars: 15000 }),
      {
        maxRetries: 2,
        timeout: 15000,
        circuitBreakerName: 'linkedin-fetch',
      }
    );

    // 解析 HTML 中的公开信息
    const profile = parseLinkedInProfileHtml(html, normalizedUrl);

    // 如果直接抓取数据不足，通过 Google 补充
    if (!profile.name && !profile.title) {
      warn('LinkedInScrape', '直接抓取数据不足，尝试 Google 补充...');
      const googleData = await searchLinkedInViaGoogle(normalizedUrl);
      return mergeProfileData(profile, googleData);
    }

    return profile;

  } catch (err) {
    debug('LinkedInScrape', `直接抓取失败: ${err.message}`);
    // 回退到 Google 搜索
    return await searchLinkedInViaGoogle(normalizedUrl);
  }
}

/**
 * 抓取 LinkedIn 公司页面
 *
 * @param {string} companyUrl - LinkedIn 公司页面 URL
 * @returns {Promise<LinkedInCompany>}
 */
export async function scrapeLinkedInCompany(companyUrl) {
  if (!companyUrl || typeof companyUrl !== 'string') {
    throw new Error('无效的 LinkedIn 公司页面 URL');
  }

  const normalizedUrl = normalizeLinkedInUrl(companyUrl, 'company');

  info('LinkedInScrape', `抓取公司页面: ${normalizedUrl}`);

  try {
    const html = await withRetry(
      () => web_fetch(normalizedUrl, { extractMode: 'markdown', maxChars: 15000 }),
      {
        maxRetries: 2,
        timeout: 15000,
        circuitBreakerName: 'linkedin-company-fetch',
      }
    );

    const company = parseLinkedInCompanyHtml(html, normalizedUrl);

    if (!company.name) {
      warn('LinkedInScrape', '公司页面数据不足，尝试 Google 补充...');
      const googleData = await searchLinkedInCompanyViaGoogle(normalizedUrl);
      return mergeCompanyData(company, googleData);
    }

    return company;

  } catch (err) {
    debug('LinkedInScrape', `公司页面抓取失败: ${err.message}`);
    return await searchLinkedInCompanyViaGoogle(normalizedUrl);
  }
}

// ========================
// Google 搜索补充
// ========================

/**
 * 通过 Google 搜索补充 LinkedIn 个人主页信息
 * 适用于无法直接访问 LinkedIn 页面的情况
 *
 * @param {string} profileUrl - LinkedIn 个人主页 URL
 * @returns {Promise<LinkedInProfile>}
 */
export async function searchLinkedInViaGoogle(profileUrl) {
  const nameOrId = extractIdentifierFromUrl(profileUrl);

  info('LinkedInScrape', `Google 搜索补充: ${nameOrId}`);

  const searchQueries = [
    // 精确 LinkedIn URL 搜索
    `"${nameOrId}" site:linkedin.com/in/`,
    // 姓名 + 职位搜索
    `${nameOrId.replace(/[^a-zA-Z0-9\s]/g, ' ')} professional site:linkedin.com`,
    // 简化的搜索
    `${nameOrId} linkedin profile`,
  ];

  const results = {
    name: '',
    title: '',
    company: '',
    location: '',
    summary: '',
    sourceUrl: profileUrl,
    experience: [],
    education: [],
    skills: [],
    recentActivity: null,
    linkedinId: extractLinkedInId(profileUrl),
    scrapedAt: Date.now(),
    source: 'google',
  };

  try {
    // 搜索精确 LinkedIn 页面
    const exactResult = await withRetry(
      () => web_search({ query: searchQueries[0], count: 3 }),
      { maxRetries: 2, timeout: 15000 }
    );

    if (exactResult?.results?.length > 0) {
      const firstResult = exactResult.results[0];
      // 尝试从标题/snippet 中提取信息
      const extracted = extractInfoFromSearchResult(firstResult);
      Object.assign(results, extracted);

      // 尝试获取更多信息
      if (firstResult.url) {
        const detail = await fetchLinkedInSnippet(firstResult.url);
        if (detail) {
          Object.assign(results, detail);
        }
      }
    }

    // 如果仍缺少关键信息，搜索职位相关
    if (!results.title || !results.company) {
      const titleResult = await withRetry(
        () => web_search({ query: searchQueries[1], count: 5 }),
        { maxRetries: 1, timeout: 10000 }
      );

      if (titleResult?.results?.length > 0) {
        for (const r of titleResult.results) {
          const extracted = extractInfoFromSearchResult(r);
          if (extracted.title && !results.title) results.title = extracted.title;
          if (extracted.company && !results.company) results.company = extracted.company;
          if (extracted.location && !results.location) results.location = extracted.location;
        }
      }
    }

    debug('LinkedInScrape', `Google 补充完成: name=${results.name}, title=${results.title}`);

    // 如果完全无法获取数据，返回基本信息
    if (!results.name && !results.title) {
      results.name = nameOrId;
      warn('LinkedInScrape', '无法从 Google 获取完整信息，仅返回 URL');
    }

    return results;

  } catch (err) {
    error('LinkedInScrape', `Google 搜索失败: ${err.message}`);
    // 返回基本信息，不抛出异常
    return {
      ...results,
      name: nameOrId,
      error: err.message,
    };
  }
}

/**
 * 通过 Google 搜索补充 LinkedIn 公司页面信息
 *
 * @param {string} companyUrl - LinkedIn 公司页面 URL
 * @returns {Promise<LinkedInCompany>}
 */
export async function searchLinkedInCompanyViaGoogle(companyUrl) {
  const companyName = extractCompanyFromUrl(companyUrl);

  info('LinkedInScrape', `Google 搜索公司: ${companyName}`);

  const searchQueries = [
    `"${companyName}" site:linkedin.com/company/`,
    `${companyName} LinkedIn company profile`,
  ];

  const results = {
    name: companyName,
    industry: '',
    size: '',
    location: '',
    description: '',
    website: '',
    sourceUrl: companyUrl,
    scrapedAt: Date.now(),
    source: 'google',
  };

  try {
    const searchResult = await withRetry(
      () => web_search({ query: searchQueries[0], count: 3 }),
      { maxRetries: 2, timeout: 15000 }
    );

    if (searchResult?.results?.length > 0) {
      const firstResult = searchResult.results[0];
      const extracted = extractCompanyInfoFromSearchResult(firstResult);
      Object.assign(results, extracted);
    }

    // 补充公司官网
    if (!results.website && results.name) {
      const webResult = await withRetry(
        () => web_search({ query: `${results.name} official website`, count: 1 }),
        { maxRetries: 1, timeout: 10000 }
      );

      if (webResult?.results?.length > 0) {
        results.website = webResult.results[0].url;
      }
    }

    return results;

  } catch (err) {
    error('LinkedInScrape', `Google 公司搜索失败: ${err.message}`);
    return {
      ...results,
      error: err.message,
    };
  }
}

/**
 * 批量抓取多个 LinkedIn 目标
 *
 * @param {Array<string>} urls - LinkedIn URL 列表
 * @param {Object} options - 批量选项
 * @returns {Promise<Array>}
 */
export async function batchScrape(urls, options = {}) {
  const { concurrency = 3, delayMs = 1000 } = options;
  const results = [];

  info('LinkedInScrape', `批量抓取 ${urls.length} 个目标，并发数 ${concurrency}`);

  // 分批处理
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchPromises = batch.map(async (url) => {
      try {
        const isCompany = url.includes('/company/') || url.includes('/school/');
        if (isCompany) {
          return await scrapeLinkedInCompany(url);
        }
        return await scrapeLinkedInProfile(url);
      } catch (err) {
        error('LinkedInScrape', `批量抓取失败 [${url}]: ${err.message}`);
        return { sourceUrl: url, error: err.message };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message }));

    // 批次间延迟
    if (i + concurrency < urls.length) {
      await sleep(delayMs);
    }
  }

  const success = results.filter(r => !r.error).length;
  info('LinkedInScrape', `批量抓取完成: ${success}/${urls.length} 成功`);

  return results;
}

// ========================
// 候选人搜索（通过搜索工具）
// ========================

/**
 * 搜索候选人信息
 * 通过关键词搜索符合条件的 LinkedIn 候选人
 *
 * @param {Object} criteria - 搜索条件
 * @param {string} criteria.name        - 姓名（可选）
 * @param {string} criteria.title       - 职位关键词
 * @param {string} criteria.company    - 公司名称
 * @param {string} criteria.location   - 地区
 * @param {string} criteria.industry   - 行业
 * @param {number} criteria.limit      - 结果数量限制
 * @returns {Promise<Array<LinkedInProfile>>}
 */
export async function searchCandidates(criteria = {}) {
  const {
    name,
    title,
    company,
    location,
    industry,
    limit = 10,
  } = criteria;

  info('LinkedInScrape', `搜索候选人: title=${title}, company=${company}, location=${location}`);

  // 构建搜索查询
  const queryParts = [];
  if (title) queryParts.push(`"${title}"`);
  if (company) queryParts.push(`"${company}"`);
  if (location) queryParts.push(location);
  if (industry) queryParts.push(industry);

  const query = queryParts.length > 0
    ? `${queryParts.join(' ')} site:linkedin.com/in/`
    : 'site:linkedin.com/in/';

  const candidates = [];

  try {
    const searchResult = await withRetry(
      () => web_search({ query, count: Math.min(limit, 10) }),
      { maxRetries: 2, timeout: 20000 }
    );

    if (searchResult?.results?.length > 0) {
      for (const result of searchResult.results.slice(0, limit)) {
        try {
          const extracted = extractInfoFromSearchResult(result);
          const profile = {
            ...extracted,
            sourceUrl: result.url || extracted.sourceUrl,
            linkedinId: extractLinkedInId(result.url),
            scrapedAt: Date.now(),
            source: 'google-candidate-search',
            matchScore: calculateMatchScore(extracted, criteria),
          };
          candidates.push(profile);
        } catch (e) {
          debug('LinkedInScrape', `解析候选人结果失败: ${e.message}`);
        }
      }
    }

    // 按匹配度排序
    candidates.sort((a, b) => b.matchScore - a.matchScore);

    info('LinkedInScrape', `找到 ${candidates.length} 个候选人`);

    return candidates.slice(0, limit);

  } catch (err) {
    error('LinkedInScrape', `候选人搜索失败: ${err.message}`);
    return [];
  }
}

// ========================
// 解析工具函数
// ========================

/**
 * 标准化 LinkedIn URL
 */
function normalizeLinkedInUrl(url, type = 'profile') {
  if (!url) return '';

  let normalized = url.trim();

  // 确保是完整 URL
  if (!normalized.startsWith('http')) {
    normalized = `https://linkedin.com${normalized.startsWith('/') ? '' : '/'}${normalized}`;
  }

  // 移除查询参数
  if (normalized.includes('?')) {
    normalized = normalized.split('?')[0];
  }

  return normalized;
}

/**
 * 从 URL 提取标识符
 */
function extractIdentifierFromUrl(url) {
  if (!url) return '';

  // 从 LinkedIn URL 提取用户名
  const match = url.match(/\/in\/([^\/\?]+)/);
  if (match) {
    return decodeURIComponent(match[1].replace(/-/g, ' '));
  }

  // 尝试直接使用路径最后一段
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1] || url;
}

/**
 * 从 URL 提取 LinkedIn ID
 */
function extractLinkedInId(url) {
  if (!url) return '';

  const match = url.match(/\/in\/([^\/\?]+)/);
  return match ? match[1] : '';
}

/**
 * 从 URL 提取公司名称
 */
function extractCompanyFromUrl(url) {
  if (!url) return '';

  const match = url.match(/\/company\/([^\/\?]+)/);
  if (match) {
    return decodeURIComponent(match[1].replace(/-/g, ' '));
  }

  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1] || url;
}

/**
 * 解析 LinkedIn 个人主页 HTML
 * 注意：LinkedIn 对未登录用户返回的信息非常有限
 */
function parseLinkedInProfileHtml(html, sourceUrl) {
  const result = {
    name: '',
    title: '',
    company: '',
    location: '',
    summary: '',
    sourceUrl,
    experience: [],
    education: [],
    skills: [],
    recentActivity: null,
    linkedinId: extractLinkedInId(sourceUrl),
    scrapedAt: Date.now(),
    source: 'direct',
  };

  if (!html || typeof html !== 'string') return result;

  try {
    // 尝试从 Markdown 文本中提取信息
    const lines = html.split('\n').filter(l => l.trim());

    for (const line of lines) {
      // 姓名（通常是第一个或最长的纯文本行）
      if (!result.name && line.length > 2 && line.length < 80 && /^[A-Za-z\s]+$/.test(line.trim())) {
        result.name = line.trim();
      }

      // 职位关键词
      if (!result.title && /^(CEO|CTO|CFO|COO|Director|Manager|Engineer|Sales|Marketing|Lead|Head|Vice)/i.test(line)) {
        result.title = line.trim();
      }

      // 公司名称（包含 @ 或类似模式）
      if (!result.company && /@[A-Z]/.test(line)) {
        const companyMatch = line.match(/@([A-Z][^@\n]+)/);
        if (companyMatch) result.company = companyMatch[1].trim();
      }

      // 地区
      if (!result.location && /(Area|Region|City|Country)/i.test(line)) {
        result.location = line.trim();
      }
    }

    // 提取 summary（较长的文本段落）
    const longParagraphs = lines.filter(l => l.length > 100 && l.length < 500);
    if (longParagraphs.length > 0) {
      result.summary = longParagraphs[0].trim().slice(0, 300);
    }

  } catch (err) {
    debug('LinkedInScrape', `HTML 解析异常: ${err.message}`);
  }

  return result;
}

/**
 * 解析 LinkedIn 公司页面 HTML
 */
function parseLinkedInCompanyHtml(html, sourceUrl) {
  const result = {
    name: '',
    industry: '',
    size: '',
    location: '',
    description: '',
    website: '',
    sourceUrl,
    scrapedAt: Date.now(),
    source: 'direct',
  };

  if (!html || typeof html !== 'string') return result;

  try {
    const lines = html.split('\n').filter(l => l.trim());

    for (const line of lines) {
      // 公司名称
      if (!result.name && line.length > 2 && line.length < 100) {
        result.name = line.trim();
      }

      // 行业
      if (!result.industry && /Industry/i.test(line)) {
        result.industry = line.replace(/Industry/gi, '').trim();
      }

      // 规模
      if (!result.size && /(Company Size|employees|staff)/i.test(line)) {
        const sizeMatch = line.match(/(\d+[\-–]\d+|\d+\+)/);
        if (sizeMatch) result.size = sizeMatch[1];
      }

      // 网站
      if (!result.website && /www\./i.test(line)) {
        const webMatch = line.match(/(https?:\/\/[^\s]+)/);
        if (webMatch) result.website = webMatch[1];
      }
    }

    // 描述（最长的段落）
    const longParagraphs = lines.filter(l => l.length > 100);
    if (longParagraphs.length > 0) {
      result.description = longParagraphs[0].trim().slice(0, 500);
    }

  } catch (err) {
    debug('LinkedInScrape', `公司 HTML 解析异常: ${err.message}`);
  }

  return result;
}

/**
 * 从搜索结果中提取 LinkedIn 信息
 */
function extractInfoFromSearchResult(result) {
  const { title = '', snippet = '', url = '' } = result;

  const text = `${title} ${snippet}`.trim();

  return {
    name: extractNameFromText(text),
    title: extractTitleFromText(text),
    company: extractCompanyFromText(text),
    location: extractLocationFromText(text),
    sourceUrl: url,
    linkedinId: extractLinkedInId(url),
  };
}

/**
 * 从文本提取公司信息
 */
function extractCompanyInfoFromSearchResult(result) {
  const { title = '', snippet = '' } = result;
  const text = `${title} ${snippet}`;

  return {
    name: extractCompanyFromText(text),
    industry: extractIndustryFromText(text),
    size: extractSizeFromText(text),
    location: extractLocationFromText(text),
    description: snippet.slice(0, 300),
    sourceUrl: result.url,
  };
}

/**
 * 从文本提取姓名
 */
function extractNameFromText(text) {
  // 常见的 "Name - Title at Company" 模式
  const match = text.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[-–|]/);
  if (match) return match[1];

  // 从标题中提取
  const titleMatch = text.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/);
  if (titleMatch) return titleMatch[1];

  return '';
}

/**
 * 从文本提取职位
 */
function extractTitleFromText(text) {
  const patterns = [
    /[-–|]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:at|@|of)\s+[^\n|]+)?)/,
    /((?:CEO|CTO|CFO|COO|Chief|Director|Manager|Lead|Head|Vice President|Senior|Junior)\s+[^\n|]{0,50})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return '';
}

/**
 * 从文本提取公司
 */
function extractCompanyFromText(text) {
  const patterns = [
    /(?:at|@|of)\s+([A-Z][A-Za-z\s&]+?)(?:\s*[-–|]|$)/,
    /(?:works?\s+(?:at|for|in)\s+)([A-Z][A-Za-z\s&]+?)(?:\s*[-–|]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return '';
}

/**
 * 从文本提取地区
 */
function extractLocationFromText(text) {
  const match = text.match(/(?:in|at)\s+([A-Za-z\s,]+?)(?:\s*[-–|]|$|\s+\d)/);
  return match ? match[1].trim() : '';
}

/**
 * 从文本提取行业
 */
function extractIndustryFromText(text) {
  const match = text.match(/(?:industry|sector):\s*([^\n|]+)/i);
  return match ? match[1].trim() : '';
}

/**
 * 从文本提取公司规模
 */
function extractSizeFromText(text) {
  const match = text.match(/(\d+[\-–]\d+\s*(?:employees?|people|staff)?)/i);
  return match ? match[1].trim() : '';
}

/**
 * 获取 LinkedIn 片段详情
 */
async function fetchLinkedInSnippet(url) {
  try {
    const content = await withRetry(
      () => web_fetch(url, { extractMode: 'text', maxChars: 5000 }),
      { maxRetries: 1, timeout: 10000 }
    );

    return parseLinkedInProfileHtml(content, url);
  } catch (err) {
    return null;
  }
}

/**
 * 合并 profile 数据
 */
function mergeProfileData(primary, secondary) {
  return {
    name: primary.name || secondary.name || '',
    title: primary.title || secondary.title || '',
    company: primary.company || secondary.company || '',
    location: primary.location || secondary.location || '',
    summary: primary.summary || secondary.summary || '',
    sourceUrl: primary.sourceUrl || secondary.sourceUrl || '',
    experience: primary.experience?.length ? primary.experience : secondary.experience || [],
    education: primary.education?.length ? primary.education : secondary.education || [],
    skills: primary.skills?.length ? primary.skills : secondary.skills || [],
    recentActivity: primary.recentActivity || secondary.recentActivity || null,
    linkedinId: primary.linkedinId || secondary.linkedinId || '',
    scrapedAt: Date.now(),
    source: primary.sourceUrl !== secondary.sourceUrl ? 'merged' : (primary.source || secondary.source),
  };
}

/**
 * 合并公司数据
 */
function mergeCompanyData(primary, secondary) {
  return {
    name: primary.name || secondary.name || '',
    industry: primary.industry || secondary.industry || '',
    size: primary.size || secondary.size || '',
    location: primary.location || secondary.location || '',
    description: primary.description || secondary.description || '',
    website: primary.website || secondary.website || '',
    sourceUrl: primary.sourceUrl || secondary.sourceUrl || '',
    scrapedAt: Date.now(),
    source: primary.sourceUrl !== secondary.sourceUrl ? 'merged' : (primary.source || secondary.source),
  };
}

/**
 * 计算候选人匹配度
 */
function calculateMatchScore(profile, criteria) {
  let score = 0;

  if (criteria.title && profile.title) {
    if (profile.title.toLowerCase().includes(criteria.title.toLowerCase())) {
      score += 40;
    }
  }

  if (criteria.company && profile.company) {
    if (profile.company.toLowerCase().includes(criteria.company.toLowerCase())) {
      score += 30;
    }
  }

  if (criteria.location && profile.location) {
    if (profile.location.toLowerCase().includes(criteria.location.toLowerCase())) {
      score += 20;
    }
  }

  if (criteria.industry && profile.industry) {
    if (profile.industry.toLowerCase().includes(criteria.industry.toLowerCase())) {
      score += 10;
    }
  }

  return score;
}

/**
 * 睡眠工具函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================
// 导出
// ========================

export default {
  scrapeLinkedInProfile,
  scrapeLinkedInCompany,
  searchLinkedInViaGoogle,
  searchLinkedInCompanyViaGoogle,
  searchCandidates,
  batchScrape,
};
