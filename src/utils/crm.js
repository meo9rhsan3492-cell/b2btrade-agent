/**
 * B2Btrade-agent CRM 模块
 * 轻量级客户关系管理，支持跟进记录 + 下次联系提醒
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

// ===== 数据目录 =====
const DATA_DIR = () => path.join(os.homedir(), '.b2btrade-agent', 'crm');
const CLIENTS_FILE = () => path.join(DATA_DIR(), 'clients.json');
const INTERACTIONS_FILE = () => path.join(DATA_DIR(), 'interactions.jsonl');
const REMINDERS_FILE = () => path.join(DATA_DIR(), 'reminders.json');

function ensureDir() {
  const dir = DATA_DIR();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ===== 客户分级 =====
const TIER = { A: '🔥 A级', B: '📈 B级', C: '📉 C级', D: '❄️ 休眠' };
const STAGE = {
  lead: '🦷 线索',
  prospect: '🎯 意向',
  negotiation: '🤝 谈判中',
  contract: '📝 合同',
  done: '✅ 已成交',
  lost: '❌ 流失'
};

// ===== 初始化 =====
function initDB() {
  ensureDir();
  if (!fs.existsSync(CLIENTS_FILE())) {
    fs.writeFileSync(CLIENTS_FILE(), JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(REMINDERS_FILE())) {
    fs.writeFileSync(REMINDERS_FILE(), JSON.stringify([], null, 2), 'utf8');
  }
}

// ===== CRUD =====
export function addClient(client) {
  initDB();
  const clients = JSON.parse(fs.readFileSync(CLIENTS_FILE(), 'utf8'));
  const newClient = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: client.name || '',
    company: client.company || '',
    country: client.country || '',
    tier: client.tier || 'B',
    stage: client.stage || 'lead',
    products: client.products || [],       // 意向产品
    source: client.source || '',            // 来源：展会/Google/LinkedIn/推荐
    website: client.website || '',
    email: client.email || '',
    phone: client.phone || '',
    linkedin: client.linkedin || '',
    revenue: client.revenue || 0,         // 预估订单金额(USD)
    notes: client.notes || '',
    tags: client.tags || [],
    // 跟进专用
    lastContact: client.lastContact || null,
    nextAction: client.nextAction || null,
    nextActionDate: client.nextActionDate || null,
    status: 'active'  // active | archived
  };
  clients.push(newClient);
  fs.writeFileSync(CLIENTS_FILE(), JSON.stringify(clients, null, 2), 'utf8');
  return newClient;
}

export function getClients(filters = {}) {
  initDB();
  let clients = JSON.parse(fs.readFileSync(CLIENTS_FILE(), 'utf8'));

  if (filters.tier) clients = clients.filter(c => c.tier === filters.tier);
  if (filters.stage) clients = clients.filter(c => c.stage === filters.stage);
  if (filters.country) clients = clients.filter(c => c.country.includes(filters.country));
  if (filters.source) clients = clients.filter(c => c.source === filters.source);
  if (filters.status) clients = clients.filter(c => c.status === filters.status);
  if (filters.tag) clients = clients.filter(c => c.tags?.includes(filters.tag));
  if (filters.search) {
    const q = filters.search.toLowerCase();
    clients = clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q)
    );
  }

  // 按更新时间倒序
  clients.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return clients;
}

export function getClient(id) {
  initDB();
  const clients = JSON.parse(fs.readFileSync(CLIENTS_FILE(), 'utf8'));
  return clients.find(c => c.id === id) || null;
}

export function updateClient(id, updates) {
  initDB();
  const clients = JSON.parse(fs.readFileSync(CLIENTS_FILE(), 'utf8'));
  const idx = clients.findIndex(c => c.id === id);
  if (idx === -1) return null;
  clients[idx] = { ...clients[idx], ...updates, updatedAt: new Date().toISOString() };
  fs.writeFileSync(CLIENTS_FILE(), JSON.stringify(clients, null, 2), 'utf8');
  return clients[idx];
}

export function deleteClient(id) {
  initDB();
  const clients = JSON.parse(fs.readFileSync(CLIENTS_FILE(), 'utf8'));
  const filtered = clients.filter(c => c.id !== id);
  if (filtered.length === clients.length) return false;
  fs.writeFileSync(CLIENTS_FILE(), JSON.stringify(filtered, null, 2), 'utf8');
  return true;
}

export function archiveClient(id) {
  return updateClient(id, { status: 'archived' });
}

// ===== 跟进记录 =====
export function addInteraction(clientId, interaction) {
  initDB();
  const record = {
    id: generateId(),
    clientId,
    timestamp: new Date().toISOString(),
    type: interaction.type || 'call',  // call/email/meeting/wechat/other
    subject: interaction.subject || '',
    content: interaction.content || '',
    outcome: interaction.outcome || '',  // positive/negative/neutral
    nextAction: interaction.nextAction || '',
    nextActionDate: interaction.nextActionDate || '',
    agent: interaction.agent || 'unknown',
  };

  const line = JSON.stringify(record) + '\n';
  fs.appendFileSync(INTERACTIONS_FILE(), line, 'utf8');

  // 更新客户最后联系时间
  updateClient(clientId, {
    lastContact: record.timestamp,
    nextAction: record.nextAction,
    nextActionDate: record.nextActionDate
  });

  return record;
}

export function getInteractions(clientId = null) {
  initDB();
  if (!fs.existsSync(INTERACTIONS_FILE())) return [];
  const lines = fs.readFileSync(INTERACTIONS_FILE(), 'utf8').split('\n').filter(Boolean);
  const records = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  if (clientId) return records.filter(r => r.clientId === clientId);
  return records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// ===== 提醒 =====
export function addReminder(reminder) {
  initDB();
  const reminders = JSON.parse(fs.readFileSync(REMINDERS_FILE(), 'utf8'));
  const newReminder = {
    id: generateId(),
    clientId: reminder.clientId || null,
    clientName: reminder.clientName || '',
    content: reminder.content || '',
    dueDate: reminder.dueDate || new Date().toISOString(),
    priority: reminder.priority || 'normal',  // high/normal/low
    status: 'pending',  // pending/done
    createdAt: new Date().toISOString()
  };
  reminders.push(newReminder);
  fs.writeFileSync(REMINDERS_FILE(), JSON.stringify(reminders, null, 2), 'utf8');
  return newReminder;
}

export function getReminders(status = null) {
  initDB();
  let reminders = JSON.parse(fs.readFileSync(REMINDERS_FILE(), 'utf8'));
  if (status) reminders = reminders.filter(r => r.status === status);

  const now = new Date();
  reminders.forEach(r => {
    const due = new Date(r.dueDate);
    r.overdue = due < now && r.status === 'pending';
    r.overdueDays = r.overdue ? Math.ceil((now - due) / 86400000) : 0;
  });

  reminders.sort((a, b) => {
    if (a.overdue !== b.overdue) return b.overdue ? 1 : -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  return reminders;
}

export function completeReminder(id) {
  initDB();
  const reminders = JSON.parse(fs.readFileSync(REMINDERS_FILE(), 'utf8'));
  const idx = reminders.findIndex(r => r.id === id);
  if (idx !== -1) {
    reminders[idx].status = 'done';
    fs.writeFileSync(REMINDERS_FILE(), JSON.stringify(reminders, null, 2), 'utf8');
    return reminders[idx];
  }
  return null;
}

export function deleteReminder(id) {
  initDB();
  const reminders = JSON.parse(fs.readFileSync(REMINDERS_FILE(), 'utf8'));
  const filtered = reminders.filter(r => r.id !== id);
  fs.writeFileSync(REMINDERS_FILE(), JSON.stringify(filtered, null, 2), 'utf8');
  return filtered.length < reminders.length;
}

// ===== 仪表盘 =====
export function getDashboard() {
  initDB();
  const clients = JSON.parse(fs.readFileSync(CLIENTS_FILE(), 'utf8') || '[]');
  const reminders = getReminders();

  const active = clients.filter(c => c.status === 'active');
  const tierA = active.filter(c => c.tier === 'A');
  const overdueReminders = reminders.filter(r => r.overdue && r.status === 'pending');
  const pendingReminders = reminders.filter(r => r.status === 'pending');

  const stageStats = {};
  Object.keys(STAGE).forEach(k => { stageStats[k] = active.filter(c => c.stage === k).length; });

  const revenueByStage = {};
  Object.keys(STAGE).forEach(k => {
    revenueByStage[k] = active.filter(c => c.stage === k).reduce((sum, c) => sum + (c.revenue || 0), 0);
  });

  return {
    total: clients.length,
    active: active.length,
    tierA: tierA.length,
    tierB: active.filter(c => c.tier === 'B').length,
    tierC: active.filter(c => c.tier === 'C').length,
    stageStats,
    pipelineRevenue: active.filter(c => ['lead', 'prospect', 'negotiation'].includes(c.stage))
      .reduce((sum, c) => sum + (c.revenue || 0), 0),
    totalRevenue: active.filter(c => c.stage === 'done')
      .reduce((sum, c) => sum + (c.revenue || 0), 0),
    overdueReminders: overdueReminders.length,
    pendingReminders: pendingReminders.length,
    upcoming: reminders.filter(r => !r.overdue && r.status === 'pending').slice(0, 5),
    overdue: overdueReminders.slice(0, 10),
  };
}

// ===== 工具函数 =====
function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ===== CLI展示 =====
export function printClients(clients) {
  if (!clients.length) {
    console.log(chalk.yellow('  暂无客户记录'));
    return;
  }
  clients.forEach(c => {
    const stageLabel = STAGE[c.stage] || c.stage;
    const tierLabel = TIER[c.tier] || c.tier;
    const nextDate = c.nextActionDate ? new Date(c.nextActionDate).toISOString().slice(0, 10) : '';
    console.log(`  ${chalk.cyan(c.id.slice(-6))}  ${c.company || c.name}  ${tierLabel}  ${stageLabel}  ${nextDate ? '📅' + nextDate : ''}`);
    if (c.country) console.log(chalk.gray(`    ${c.country} | ${c.email || c.phone || '-'}`));
  });
}

export { TIER, STAGE };
