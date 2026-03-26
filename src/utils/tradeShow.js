/**
 * B2Btrade-agent 展会全流程管理模块
 * 展前调研 → 展中接待 → 展后72h跟进
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { existsSync, mkdirSync } from 'fs';

// ===== 数据目录 =====
const DATA_DIR = () => path.join(os.homedir(), '.b2btrade-agent', 'trade-shows');
const SHOWS_FILE = () => path.join(DATA_DIR(), 'shows.json');
const LEADS_FILE = () => path.join(DATA_DIR(), 'leads.jsonl');

function ensureDir() {
  const d = DATA_DIR();
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

// ===== 展会管理 =====
export function createShow(show) {
  ensureDir();
  const shows = loadShows();

  const newShow = {
    id: Math.random().toString(36).slice(2, 10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: show.name || '',
    venue: show.venue || '',
    country: show.country || '',
    dates: show.dates || '',       // "2026-04-15 to 2026-04-18"
    boothNo: show.boothNo || '',
    products: show.products || [],   // 参展产品
    targetMarket: show.targetMarket || '',
    objective: show.objective || '', // 参展目标
    // 展前状态
    preShow: {
      status: 'planning',  // planning/prepared/ready
      tasks: show.preShowTasks || [],
      competitors: [],     // 竞品名单
      materials: [],       // 宣传物料
      briefingDone: false
    },
    // 展中数据
    duringShow: {
      status: 'not_started',  // not_started/in_progress/closed
      leadsCollected: 0,
      badgeScanCount: 0,
      visitors: [],         // 访客记录
      demosGiven: 0,
      cardsCollected: 0
    },
    // 展后数据
    postShow: {
      status: 'pending',  // pending/in_progress/completed
      leadsToFollow: 0,
      sequenceStarted: false,
      sequenceId: null,
      tasksCompleted: 0
    },
    // 统计数据
    stats: {
      totalLeads: 0,
      qualifiedLeads: 0,
      followUpStarted: 0,
      dealsClosed: 0,
      revenueGenerated: 0
    }
  };

  shows.push(newShow);
  fs.writeFileSync(SHOWS_FILE(), JSON.stringify(shows, null, 2), 'utf8');
  return newShow;
}

export function loadShows() {
  ensureDir();
  if (!existsSync(SHOWS_FILE())) return [];
  try {
    return JSON.parse(fs.readFileSync(SHOWS_FILE(), 'utf8'));
  } catch { return []; }
}

export function getShow(id) {
  return loadShows().find(s => s.id === id) || null;
}

export function updateShow(id, updates) {
  const shows = loadShows();
  const idx = shows.findIndex(s => s.id === id);
  if (idx === -1) return null;
  shows[idx] = { ...shows[idx], ...updates, updatedAt: new Date().toISOString() };
  fs.writeFileSync(SHOWS_FILE(), JSON.stringify(shows, null, 2), 'utf8');
  return shows[idx];
}

// ===== 展前：竞品分析 =====
export async function preShowResearch(showId, aiChat) {
  const show = getShow(showId);
  if (!show) throw new Error('Show not found');

  console.log(chalk.cyan(`\n🔍 展前调研: ${show.name}\n`));

  const prompt = `为即将参加 ${show.name} (${show.dates}) 的参展商做展前调研。

**展会信息：**
- 展会名称: ${show.name}
- 地点: ${show.venue}, ${show.country}
- 参展产品: ${show.products.join(', ')}
- 目标市场: ${show.targetMarket}

**请输出以下内容：**

## 1. 展会概况
- 预计展商数量和观众数量
- 主要参展商（已确认的TOP10）
- 往届数据（如有）

## 2. 竞品分析
列出可能参展的5-10家直接竞品，每家包含：
- 公司名
- 主打产品
- 预估展位位置
- 价格区间（推测）
- 优劣势分析

## 3. 我们的差异化策略
- 产品差异化
- 价格策略
- 服务差异化
- 展位设计建议

## 4. 参展话术（针对竞品）
针对3个最强竞品，给出应对话术：
- 如果客户提到竞品A，如何回应？
- 如果客户拿竞品A和我们比较，如何处理？

## 5. 展前准备清单
- 产品知识要点
- 常见问题Q&A
- 展会前1周必做事项`;

  try {
    const result = await aiChat(prompt, 'intelligence');
    show.preShow.competitors = extractCompetitors(result);
    show.preShow.status = 'prepared';
    show.preShow.research = result;
    updateShow(showId, { preShow: show.preShow });
    return result;
  } catch (e) {
    throw new Error(`展前调研失败: ${e.message}`);
  }
}

function extractCompetitors(text) {
  // 简单从文本中提取竞品名
  const lines = text.split('\n');
  return lines.filter(l => l.match(/^[A-Z][A-Za-z\s&]+$/) && l.length < 50).slice(0, 10);
}

// ===== 展前：名片收集模板 =====
export function getBadgeScanTemplate() {
  return {
    fields: [
      { name: 'name', label: '姓名/Name', required: true },
      { name: 'company', label: '公司/Company', required: true },
      { name: 'title', label: '职位/Title', required: false },
      { name: 'email', label: '邮箱/Email', required: true },
      { name: 'phone', label: '电话/Phone', required: false },
      { name: 'country', label: '国家/Country', required: true },
      { name: 'interest', label: '感兴趣产品/Interest', required: false },
      { name: 'budget', label: '预算范围/Budget', required: false },
      { name: 'timeline', label: '采购时间/Timeline', required: false },
      { name: 'notes', label: '备注/Notes', required: false },
      { name: 'leadQuality', label: '线索质量(1-5)', required: true },
      { name: 'competitorMentioned', label: '提到哪些竞品', required: false }
    ]
  };
}

// ===== 展中：收集线索 =====
export function addLead(showId, lead) {
  const show = getShow(showId);
  if (!show) throw new Error('Show not found');

  ensureDir();
  const record = {
    id: Math.random().toString(36).slice(2, 10),
    showId,
    showName: show.name,
    collectedAt: new Date().toISOString(),
    // 基本信息
    name: lead.name || '',
    company: lead.company || '',
    title: lead.title || '',
    email: lead.email || '',
    phone: lead.phone || '',
    country: lead.country || '',
    // 需求
    interest: lead.interest || '',
    budget: lead.budget || '',
    timeline: lead.timeline || '',
    notes: lead.notes || '',
    // 质量评级
    leadQuality: lead.leadQuality || 3,  // 1-5
    competitorMentioned: lead.competitorMentioned || '',
    // 跟进
    followUpRequired: lead.leadQuality >= 3,
    followUpSequence: lead.leadQuality >= 4 ? 'trade_show' : 'cold_outreach',
    followUpDay: lead.leadQuality >= 4 ? 1 : 3,
    followUpStatus: 'pending',
    followUpSent: 0,
    followUpReplied: false,
    // 来源
    source: 'trade_show',
    boothNo: show.boothNo
  };

  // 追加到leads.jsonl
  fs.appendFileSync(LEADS_FILE(), JSON.stringify(record) + '\n', 'utf8');

  // 更新展会统计
  show.duringShow.leadsCollected++;
  show.duringShow.badgeScanCount++;
  show.stats.totalLeads++;
  if (record.leadQuality >= 4) show.stats.qualifiedLeads++;
  updateShow(showId, { duringShow: show.duringShow, stats: show.stats });

  return record;
}

export function getLeads(showId = null) {
  ensureDir();
  if (!existsSync(LEADS_FILE())) return [];
  const lines = fs.readFileSync(LEADS_FILE(), 'utf8').split('\n').filter(Boolean);
  const leads = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  if (showId) return leads.filter(l => l.showId === showId);
  return leads.sort((a, b) => new Date(b.collectedAt) - new Date(a.collectedAt));
}

// ===== 展后：从线索创建邮件序列 =====
export async function createPostShowSequence(showId, aiChat) {
  const show = getShow(showId);
  if (!show) throw new Error('Show not found');
  const leads = getLeads(showId).filter(l => l.followUpRequired && l.email);

  if (leads.length === 0) {
    throw new Error('没有可跟进的线索（需要email且leadQuality>=3）');
  }

  console.log(chalk.blue(`\n📧 为 ${show.name} 创建展会跟进序列（${leads.length} 个线索）\n`));

  // 创建序列
  const { createSequence } = await import('./emailSequence.js');
  const seq = createSequence({
    name: `展后跟进 - ${show.name}`,
    template: 'trade_show',
    subject: show.products.join(' + '),
    targetCountry: show.country,
    targetProduct: show.products.join(', '),
    recipients: leads.map(l => ({
      name: l.name,
      email: l.email,
      company: l.company,
      source: '展会名片'
    }))
  });

  // AI生成内容
  await generateSequenceContent(seq.id, aiChat);

  // 更新展会记录
  show.postShow.sequenceId = seq.id;
  show.postShow.leadsToFollow = leads.length;
  show.postShow.status = 'in_progress';
  updateShow(showId, { postShow: show.postShow });

  return { sequence: seq, leadsCount: leads.length };
}

// 需要单独import这个函数
async function generateSequenceContent(sequenceId, aiChat) {
  const { generateSequenceContent: gen } = await import('./emailSequence.js');
  return gen(sequenceId, aiChat);
}

// ===== 展后72h跟进任务清单 =====
export function getPostShowTasks(showId) {
  const show = getShow(showId);
  if (!show) throw new Error('Show not found');
  const leads = getLeads(showId);
  const highQuality = leads.filter(l => l.leadQuality >= 4);

  return [
    {
      id: 1,
      priority: 'critical',
      task: '发送感谢邮件（展会当天或次日）',
      assignTo: 'content',
      status: leads.filter(l => l.followUpSent >= 1).length > 0 ? 'done' : 'pending',
      note: `${leads.filter(l => l.followUpSent >= 1).length}/${leads.length} 已发送`
    },
    {
      id: 2,
      priority: 'high',
      task: 'VIP线索（LeadQuality>=4）优先跟进',
      assignTo: 'sales',
      status: 'pending',
      note: `${highQuality.length} 个高质量线索待跟进`
    },
    {
      id: 3,
      priority: 'high',
      task: '整理展会数据，录入CRM',
      assignTo: 'crm',
      status: 'pending',
      note: `${leads.length} 个线索录入CRM`
    },
    {
      id: 4,
      priority: 'normal',
      task: '启动展后跟进序列（trade_show模板）',
      assignTo: 'email',
      status: show.postShow.sequenceStarted ? 'done' : 'pending',
      note: show.postShow.sequenceId ? `序列ID: ${show.postShow.sequenceId}` : '尚未创建'
    },
    {
      id: 5,
      priority: 'normal',
      task: '展后客户分级（A/B/C级）',
      assignTo: 'crm',
      status: 'pending'
    },
    {
      id: 6,
      priority: 'normal',
      task: '展后总结报告',
      assignTo: 'content',
      status: 'pending',
      note: '含：线索数量/质量/转化预估/下次展会建议'
    },
    {
      id: 7,
      priority: 'low',
      task: '竞品动态整理（展会上观察到的）',
      assignTo: 'intelligence',
      status: 'pending'
    }
  ];
}

// ===== 展会仪表盘 =====
export function getShowDashboard() {
  const shows = loadShows();
  const upcoming = shows.filter(s => new Date(s.dates.split(' to ')[0]) > new Date());
  const current = shows.filter(s => {
    const [start, end] = s.dates.split(' to ');
    const now = new Date();
    return now >= new Date(start) && now <= new Date(end);
  });
  const past = shows.filter(s => {
    const [, end] = s.dates.split(' to ');
    return new Date(end) < new Date();
  });

  return {
    total: shows.length,
    upcoming: upcoming.length,
    current: current.length,
    past: past.length,
    stats: {
      totalLeads: shows.reduce((sum, s) => sum + s.stats.totalLeads, 0),
      totalQualified: shows.reduce((sum, s) => sum + s.stats.qualifiedLeads, 0),
      totalRevenue: shows.reduce((sum, s) => sum + s.stats.revenueGenerated, 0)
    },
    upcomingShows: upcoming.slice(0, 3),
    currentShows: current,
    pastShows: past.slice(0, 3)
  };
}

// ===== 导出展会线索CSV =====
export function exportShowLeadsCSV(showId) {
  const leads = getLeads(showId);
  if (!leads.length) throw new Error('No leads to export');

  const headers = ['name', 'company', 'title', 'email', 'phone', 'country', 'interest', 'budget', 'timeline', 'leadQuality', 'competitorMentioned', 'notes', 'collectedAt'];
  const rows = leads.map(l => headers.map(h => `"${(l[h] || '').toString().replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');

  ensureDir();
  const outFile = path.join(DATA_DIR(), `leads-${showId}-${Date.now()}.csv`);
  fs.writeFileSync(outFile, '\ufeff' + csv, 'utf8');
  return outFile;
}
