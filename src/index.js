/**
 * B2Btrade-agent 主入口
 * 外贸B2B智能Agent
 */
import chalk from 'chalk';
import { homedir } from 'os';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { agents, selectAgent, listAgents, getAgent } from './agents/index.js';
import { listTools, searchCustomer, searchLinkedIn } from './tools/search.js';
import { listWorkflows, workflowFindAndEmail, workflowRFQ, workflowMarketResearch, workflowCompetitorMonitor } from './workflows/index.js';
import { chatWithAI } from './ai.js';
import { loadConfig, configureApiKey } from './config.js';
import { initLogger, info, warn, error, logAction } from './utils/logger.js';
import { recordChat, recordSearch, recordWorkflow, queryHistory, getRecent, cleanHistory, OperationType } from './utils/history.js';
import { getLimiter, apiLimiter, getAllLimitersStatus } from './utils/rateLimiter.js';
import { setLocale, getLocale, getSupportedLocales, t, SupportedLocales } from './utils/i18n.js';
import {
  getClients, getClient, addClient, updateClient, deleteClient, archiveClient,
  addInteraction, getInteractions, addReminder, getReminders, completeReminder, deleteReminder,
  getDashboard as getCRM, printClients, TIER, STAGE
} from './utils/crm.js';
import {
  listSequences, createSequence, getSequence, exportSequenceCSV, exportSequenceJSON,
  SEQUENCE_TEMPLATES
} from './utils/emailSequence.js';
import {
  createShow, getShow, getShowDashboard, addLead, getLeads, exportShowLeadsCSV,
  getPostShowTasks, getBadgeScanTemplate, getShow as getShowById
} from './utils/tradeShow.js';

// 初始化日志系统
initLogger();

const VERSION = '1.0.0';

function showBanner() {
  console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ██████╗ ███████╗████████╗██████╗  ██████╗                 ║
║     ██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗                ║
║     ██████╔╝█████╗     ██║   ██████╔╝██║   ██║                ║
║     ██╔══██╗██╔══╝     ██║   ██╔══██╗██║   ██║                ║
║     ██║  ██║███████╗   ██║   ██║  ██║╚██████╔╝                ║
║     ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝                 ║
║                                                               ║
║     B2Btrade-agent v${VERSION}                                    ║
║     外贸B2B智能Agent - 开箱即用                                  ║
║                                                               ║
║     🤖 12位外贸专家 | 🔧 工具集成 | ⚡ 工作流自动化              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `));
}

function showHelp() {
  console.log(chalk.gray(`
用法:
  b2b <命令> [参数]

命令:
  chat [agent]      启动对话模式
  list              列出所有Agent
  use <agent>       切换Agent
  workflow          列出工作流
  run <workflow>    执行工作流
  search <query>    搜索客户
  tools             查看可用工具
  config            配置API Key
  status            查看运行状态
  help              显示帮助

示例:
  b2b chat                    # 启动对话
  b2b chat content             # 与内容专家对话
  b2b list                     # 查看所有Agent
  b2b run find-email           # 执行客户挖掘工作流
  b2b run competitor 三一重工 钻机  # 竞品监控
  b2b status                   # 查看状态统计
  b2b crm                       # CRM客户管理
  b2b sequence                  # 邮件序列管理
  b2b show                      # 展会全流程管理
  b2b search 沙特 钻机         # 搜索客户

快速开始:
  1. b2b config               # 配置API Key
  2. b2b chat                 # 开始对话
  `));
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // 加载配置
  const config = loadConfig();

  // 显示banner
  if (!command || command === 'chat' || command === '-h' || command === '--help') {
    showBanner();
  }

  // 无参数
  if (!command) {
    showHelp();
    return;
  }

  switch (command) {
    case '-h':
    case '--help':
      showHelp();
      break;

    case 'chat':
      const agentId = args[1] || null;
      if (agentId && !agents[agentId]) {
        console.log(chalk.red(`未知Agent: ${agentId}`));
        console.log(chalk.gray('使用 b2b list 查看所有Agent'));
        return;
      }
      await interactiveMode(agentId);
      break;

    case 'list':
    case 'ls':
      console.log(chalk.bold('\n🤖 可用Agent:\n'));
      listAgents().forEach(agent => {
        console.log(`  ${chalk.green(agent.id.padEnd(15))} ${agent.name} - ${agent.description}`);
      });
      console.log();
      break;

    case 'workflow':
    case 'wf':
      console.log(chalk.bold('\n⚡ 可用工作流:\n'));
      listWorkflows().forEach(wf => {
        console.log(`  ${chalk.green(wf.id.padEnd(15))} ${wf.name}`);
        console.log(chalk.gray(`     ${wf.description}`));
        console.log(chalk.gray(`     参数: ${wf.params.join(', ')}\n`));
      });
      break;

    case 'run':
      const wfId = args[1];
      if (!wfId) {
        console.log(chalk.red('请指定工作流ID'));
        console.log(chalk.gray('使用 b2b workflow 查看所有工作流'));
        return;
      }
      await runWorkflow(wfId, args.slice(2));
      break;

    case 'search':
      if (!args[1]) {
        console.log(chalk.red('请输入搜索关键词'));
        return;
      }
      const query = args.slice(1).join(' ');
      await quickSearch(query);
      break;

    case 'tools':
      console.log(chalk.bold('\n🔧 可用工具:\n'));
      listTools().forEach(t => {
        console.log(`  ${t.name.padEnd(15)} ${t.status}`);
      });
      console.log();
      break;

    case 'config':
      await configureApiKey();
      break;

    case 'status':
      showStatus();
      break;

    case 'crm':
      await runCRM(args.slice(1));
      break;

    case 'sequence':
      await runSequence(args.slice(1));
      break;

    case 'show':
      await runShow(args.slice(1));
      break;

    default:
      // 尝试作为直接命令执行
      await quickCommand(command + ' ' + args.slice(1).join(' '));
  }
}

// 交互模式
async function interactiveMode(initialAgentId) {
  const config = loadConfig();
  
  if (!config.apiKey) {
    console.log(chalk.yellow('⚠️ API Key未配置，请先运行 b2b config 配置\n'));
    await configureApiKey();
  }

  let currentAgentId = initialAgentId || 'default';
  
  console.log(chalk.green(`\n✓ 进入对话模式 (${agents[currentAgentId].name})\n`));
  console.log(chalk.gray('输入 /help 查看命令，exit 退出\n'));

  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = () => {
    rl.question(chalk.cyan('\n> '), async (input) => {
      const trimmed = input.trim();
      
      if (!trimmed || trimmed === 'exit' || trimmed === 'q') {
        console.log(chalk.gray('\n👋 下次见!\n'));
        rl.close();
        return;
      }

      if (trimmed === '/help') {
        console.log(chalk.gray(`
/list     - 查看Agent列表
/agent <id> - 切换Agent
/workflow - 查看工作流
/tools   - 查看工具
/exit    - 退出
        `));
        ask();
        return;
      }

      if (trimmed === '/list') {
        listAgents().forEach(a => {
          console.log(`  ${a.id.padEnd(15)} ${a.name}`);
        });
        ask();
        return;
      }

      if (trimmed.startsWith('/agent ')) {
        const id = trimmed.split(' ')[1];
        if (agents[id]) {
          currentAgentId = id;
          console.log(chalk.green(`✓ 已切换到: ${agents[id].name}`));
        } else {
          console.log(chalk.red(`未知Agent: ${id}`));
        }
        ask();
        return;
      }

      // 智能选择Agent
      if (!initialAgentId) {
        const autoAgent = selectAgent(trimmed);
        if (autoAgent.id !== currentAgentId) {
          currentAgentId = autoAgent.id;
          console.log(chalk.gray(`  [自动切换到 ${autoAgent.name}]`));
        }
      }

      try {
        const response = await chatWithAI(trimmed, currentAgentId);
        console.log(chalk.white('\n' + response));
      } catch (e) {
        console.log(chalk.red(`\n错误: ${e.message}`));
      }

      ask();
    });
  };

  ask();
}

// 快速命令 - 直接执行
async function quickCommand(input) {
  const config = loadConfig();
  if (!config.apiKey) {
    console.log(chalk.yellow('⚠️ 请先配置API Key: node src/index.js config'));
    return;
  }

  try {
    const response = await chatWithAI(input, selectAgent(input).id);
    console.log(chalk.white(response));
  } catch (e) {
    console.log(chalk.red(`错误: ${e.message}`));
  }
}

// 快速搜索
async function quickSearch(query) {
  console.log(chalk.blue(`\n🔍 搜索: ${query}\n`));
  
  try {
    const response = await chatWithAI(`
      搜索以下关键词，找出B2B潜在客户：
      关键词: ${query}
      
      返回格式：
      1. 公司名 - 官网 - 主要产品
      2. ...
    `, 'intelligence');
    
    console.log(chalk.white(response));
  } catch (e) {
    console.log(chalk.red(`搜索出错: ${e.message}`));
  }
}

// 执行工作流
async function runWorkflow(wfId, params) {
  const config = loadConfig();
  if (!config.apiKey) {
    console.log(chalk.yellow('⚠️ 请先配置API Key: b2b config'));
    return;
  }

  const aiChat = (prompt, agentId) => chatWithAI(prompt, agentId);

  switch (wfId) {
    case 'find-email':
      const country = params[0] || '沙特阿拉伯';
      const product = params[1] || '水井钻机';
      await workflowFindAndEmail(country, product, aiChat);
      break;
      
    case 'rfq-quote':
      const rfqText = params.join(' ') || '客户想要5台200米深度的钻机';
      await workflowRFQ(rfqText, aiChat);
      break;
      
    case 'market-research':
      const mCountry = params[0] || '中东';
      const mProduct = params[1] || '钻机';
      await workflowMarketResearch(mCountry, mProduct, aiChat);
      break;

    case 'competitor':
      const compName = params[0] || '';
      const compProduct = params[1] || '';
      if (!compName || !compProduct) {
        console.log(chalk.red('请提供竞品名称和产品：b2b run competitor 竞品名称 产品'));
        return;
      }
      await workflowCompetitorMonitor(compName, compProduct, aiChat);
      break;

    default:
      console.log(chalk.red(`未知工作流: ${wfId}`));
  }
}

// ===== CRM 命令 =====
async function runCRM(args) {
  const sub = args[0];
  switch (sub) {
    case undefined:
    case 'list':
    case undefined: {
      const clients = getClients({ status: 'active' });
      console.log(chalk.bold('\n👥 CRM 客户列表\n'));
      console.log(chalk.gray('  ID       公司                   等级   阶段        下次跟进\n'));
      printClients(clients);
      console.log(chalk.gray(`\n  共 ${clients.length} 个客户 | 使用 b2b crm add <公司> 添加`));
      break;
    }
    case 'add': {
      const name = args.slice(1).join(' ').trim();
      if (!name) { console.log(chalk.red('请输入客户公司名: b2b crm add <公司名>')); return; }
      const c = addClient({ company: name });
      console.log(chalk.green(`\n✅ 客户已添加: ${c.id} | ${c.company}`));
      break;
    }
    case 'get': {
      const id = args[1];
      if (!id) { console.log(chalk.red('请提供客户ID: b2b crm get <id>')); return; }
      const client = getClient(id);
      if (!client) { console.log(chalk.red('客户不存在')); return; }
      console.log(chalk.bold(`\n👤 ${client.company}`));
      console.log(chalk.gray(`  国家: ${client.country} | 等级: ${TIER[client.tier]} | 阶段: ${STAGE[client.stage]}`));
      console.log(`  邮箱: ${client.email || '-'} | 电话: ${client.phone || '-'}`);
      console.log(`  产品: ${client.products?.join(', ') || '-'}`);
      console.log(`  预估订单: $${client.revenue || 0}`);
      console.log(`  来源: ${client.source || '-'}`);
      const next = client.nextActionDate ? new Date(client.nextActionDate).toISOString().slice(0, 10) : '未设置';
      console.log(`  下次跟进: ${next}`);
      const interactions = getInteractions(client.id);
      if (interactions.length > 0) {
        console.log(chalk.cyan('\n  最近跟进:'));
        interactions.slice(0, 5).forEach(i => {
          console.log(chalk.gray(`  ${i.timestamp.slice(0,10)} [${i.type}] ${i.subject || i.content?.slice(0,50) || ''}`));
        });
      }
      break;
    }
    case 'update': {
      const [id, ...rest] = args.slice(1);
      if (!id || rest.length === 0) { console.log(chalk.red('用法: b2b crm update <id> <field=value> ...')); return; }
      const updates = {};
      rest.forEach(r => { const [k,v] = r.split('='); if(k&&v) updates[k]=v; });
      const updated = updateClient(id, updates);
      if (updated) console.log(chalk.green('✅ 已更新')); else console.log(chalk.red('客户不存在'));
      break;
    }
    case 'interact': {
      const [id, type, ...rest] = args.slice(1);
      if (!id || !type) { console.log(chalk.red('用法: b2b crm interact <id> <call|email|meeting|wechat> <内容>')); return; }
      const c = addInteraction(id, { type, subject: rest.join(' '), outcome: 'positive' });
      console.log(chalk.green('✅ 跟进记录已添加'));
      break;
    }
    case 'remind': {
      const [id, content, days] = args.slice(1);
      if (!id || !content) { console.log(chalk.red('用法: b2b crm remind <id> <内容> [天数]')); return; }
      const client = getClient(id);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (parseInt(days) || 3));
      const r = addReminder({ clientId: id, clientName: client?.company || id, content, dueDate: dueDate.toISOString() });
      console.log(chalk.green(`✅ 提醒已添加: ${r.dueDate.slice(0,10)} - ${content}`));
      break;
    }
    case 'reminders': {
      const pending = getReminders('pending');
      const overdue = pending.filter(r => r.overdue);
      const upcoming = pending.filter(r => !r.overdue);
      console.log(chalk.bold('\n🔔 待办提醒\n'));
      if (overdue.length) {
        console.log(chalk.red(`\n⚠️  已逾期 (${overdue.length}):`));
        overdue.forEach(r => console.log(`  🔴 ${r.dueDate.slice(0,10)} ${r.clientName} - ${r.content.slice(0,40)}`));
      }
      if (upcoming.length) {
        console.log(chalk.green(`\n📅 即将到期 (${upcoming.length}):`));
        upcoming.slice(0, 10).forEach(r => console.log(`  ${r.dueDate.slice(0,10)} ${r.clientName} - ${r.content.slice(0,40)}`));
      }
      if (!pending.length) console.log(chalk.gray('  没有待处理提醒'));
      break;
    }
    case 'dashboard': {
      const d = getCRM();
      console.log(chalk.bold('\n📊 CRM 仪表盘\n'));
      console.log(`  总客户: ${d.total} | 活跃: ${d.active} | A级: ${d.tierA}`);
      console.log(`  管道金额: $${d.pipelineRevenue.toLocaleString()} | 已成交: $${d.totalRevenue.toLocaleString()}`);
      console.log(`  逾期提醒: ${d.overdueReminders > 0 ? chalk.red(d.overdueReminders) : 0} | 待处理: ${d.pendingReminders}`);
      console.log(chalk.cyan('\n  各阶段客户:'));
      Object.entries(d.stageStats).forEach(([k,v]) => console.log(`    ${STAGE[k]}: ${v}`));
      break;
    }
    default:
      console.log(chalk.gray('CRM 子命令:'));
      console.log('  b2b crm list            # 客户列表');
      console.log('  b2b crm add <公司>     # 添加客户');
      console.log('  b2b crm get <id>       # 查看详情');
      console.log('  b2b crm update <id> <field=value>  # 更新字段');
      console.log('  b2b crm interact <id> <call|email|meeting> <内容>  # 添加跟进');
      console.log('  b2b crm remind <id> <内容> [天数]  # 添加提醒');
      console.log('  b2b crm reminders       # 查看所有提醒');
      console.log('  b2b crm dashboard       # CRM仪表盘');
  }
}

// ===== 邮件序列命令 =====
async function runSequence(args) {
  const sub = args[0];
  switch (sub) {
    case undefined:
    case 'list': {
      const seqs = listSequences();
      console.log(chalk.bold('\n📧 邮件序列列表\n'));
      if (!seqs.length) { console.log(chalk.gray('  暂无序列 | 使用 b2b sequence create 创建')); break; }
      seqs.forEach(s => {
        const statusColor = s.status === 'running' ? chalk.green : s.status === 'draft' ? chalk.yellow : chalk.gray;
        console.log(`  ${chalk.cyan(s.id)} ${s.name}`);
        console.log(chalk.gray(`    模板: ${s.template} | 收件人: ${s.total} | 已发送: ${s.sent} | 回复: ${s.replies} | 状态: `) + statusColor(s.status));
      });
      break;
    }
    case 'create': {
      // b2b sequence create cold_outreach "产品名" "国家"
      const [template, product, country] = args.slice(1);
      if (!template) {
        console.log(chalk.bold('\n📋 可用序列模板:\n'));
        Object.entries(SEQUENCE_TEMPLATES).forEach(([id, tpl]) => {
          console.log(`  ${chalk.green(id.padEnd(20))} ${tpl.name}`);
          console.log(chalk.gray(`    ${tpl.description} (${tpl.emails.length}封邮件/${tpl.duration}天)`));
        });
        console.log();
        console.log(chalk.gray('用法: b2b sequence create <template> [产品] [国家]\n'));
        break;
      }
      if (!SEQUENCE_TEMPLATES[template]) { console.log(chalk.red(`未知模板: ${template}`)); return; }
      const tpl = SEQUENCE_TEMPLATES[template];
      const recipients = (product || country) ? [{ name: '', email: product || 'demo@example.com', company: country || '' }] : [];
      const seq = createSequence({ template, targetProduct: product, targetCountry: country, recipients });
      console.log(chalk.green(`\n✅ 序列已创建: ${seq.id}`));
      console.log(`  模板: ${tpl.name}`);
      console.log(`  邮件数: ${tpl.emails.length}`);
      console.log(`  使用 b2b sequence gen ${seq.id} 生成内容`);
      break;
    }
    case 'gen': {
      const id = args[1];
      if (!id) { console.log(chalk.red('请提供序列ID: b2b sequence gen <id>')); return; }
      const seq = getSequence(id);
      if (!seq) { console.log(chalk.red('序列不存在')); return; }
      console.log(chalk.blue(`\n🤖 正在生成序列内容...`));
      // 动态import避免循环
      const { generateSequenceContent } = await import('./utils/emailSequence.js');
      await generateSequenceContent(id, (p, a) => chatWithAI(p, a));
      console.log(chalk.green('\n✅ 内容生成完成！'));
      console.log(`  使用 b2b sequence export ${id} 导出CSV`);
      break;
    }
    case 'export': {
      const [id, format] = args.slice(1);
      if (!id) { console.log(chalk.red('请提供序列ID: b2b sequence export <id> [csv|json]')); return; }
      const outFile = format === 'json' ? exportSequenceJSON(id) : exportSequenceCSV(id);
      console.log(chalk.green(`\n✅ 已导出: ${outFile}`));
      break;
    }
    default:
      console.log(chalk.gray('序列子命令:'));
      console.log('  b2b sequence list              # 查看所有序列');
      console.log('  b2b sequence create [模板]    # 创建序列（无参数查看模板）');
      console.log('  b2b sequence gen <id>          # AI生成序列内容');
      console.log('  b2b sequence export <id> [csv] # 导出为CSV/JSON');
  }
}

// ===== 展会命令 =====
async function runShow(args) {
  const sub = args[0];
  switch (sub) {
    case undefined:
    case 'list': {
      const { getShowDashboard } = await import('./utils/tradeShow.js');
      const dash = getShowDashboard();
      console.log(chalk.bold('\n🏛️  展会管理\n'));
      console.log(`  总展会: ${dash.total} | 即将: ${dash.upcoming} | 进行中: ${dash.current} | 已结束: ${dash.past}`);
      console.log(`  累计线索: ${dash.stats.totalLeads} | 优质线索: ${dash.stats.totalQualified} | 收入: $${dash.stats.totalRevenue}`);
      if (dash.upcomingShows.length) {
        console.log(chalk.cyan('\n  即将举办:'));
        dash.upcomingShows.forEach(s => console.log(`    ${s.name} | ${s.dates} | ${s.venue}`));
      }
      if (dash.currentShows.length) {
        console.log(chalk.green('\n  进行中:'));
        dash.currentShows.forEach(s => console.log(`    ${s.name} | ${s.dates} | 线索: ${s.stats.totalLeads}`));
      }
      console.log();
      console.log(chalk.gray('用法: b2b show add <展会名> <日期> <地点>'));
      break;
    }
    case 'add': {
      const [name, dates, venue, ...rest] = args.slice(1);
      if (!name) { console.log(chalk.red('用法: b2b show add <展会名> <日期> <地点>')); return; }
      const show = createShow({ name, dates: dates || '', venue: venue || '', products: rest });
      console.log(chalk.green(`\n✅ 展会已创建: ${show.id}`));
      console.log(`  ${name} | ${dates} | ${venue}`);
      console.log(`  使用 b2b show lead ${show.id} 添加线索`);
      break;
    }
    case 'lead': {
      const [id, ...leadData] = args.slice(1);
      if (!id) { console.log(chalk.red('用法: b2b show lead <showId> [name=xxx email=xxx company=xxx country=xxx quality=3]...')); return; }
      const lead = {};
      leadData.forEach(r => { const [k,v] = r.split('='); if(k) lead[k] = v; });
      lead.leadQuality = parseInt(lead.leadQuality) || 3;
      const record = addLead(id, lead);
      console.log(chalk.green(`\n✅ 线索已收录: ${record.id}`));
      console.log(`  ${record.name || '-'} @ ${record.company || '-'}`);
      console.log(`  质量: ${record.leadQuality}/5 | 邮箱: ${record.email || '-'}`);
      break;
    }
    case 'leads': {
      const showId = args[1];
      if (!showId) { console.log(chalk.red('用法: b2b show leads <showId>')); return; }
      const leads = getLeads(showId);
      console.log(chalk.bold(`\n📋 展会线索 (${leads.length})\n`));
      if (!leads.length) { console.log(chalk.gray('  暂无线索')); break; }
      leads.forEach(l => {
        const qualityEmoji = l.leadQuality >= 4 ? '🔴' : l.leadQuality >= 3 ? '🟡' : '⚪';
        console.log(`  ${qualityEmoji} ${l.name || '-'} @ ${l.company || '-'} (${l.country || '-'})`);
        console.log(chalk.gray(`     邮箱: ${l.email || '-'} | 意向: ${l.interest || '-'}`));
      });
      console.log(chalk.gray(`\n  使用 b2b show export ${showId} 导出CSV`));
      break;
    }
    case 'export': {
      const showId = args[1];
      if (!showId) { console.log(chalk.red('用法: b2b show export <showId>')); return; }
      const f = exportShowLeadsCSV(showId);
      console.log(chalk.green(`\n✅ 已导出: ${f}`));
      break;
    }
    case 'scan': {
      console.log(chalk.bold('\n📱 名片扫描模板\n'));
      const tpl = getBadgeScanTemplate();
      tpl.fields.forEach(f => console.log(`  ${f.name.padEnd(20)} ${f.label} ${f.required ? chalk.red('*') : ''}`));
      console.log(chalk.gray('\n用法: b2b show lead <showId> name=张三 email=z@example.com company=ABC company=xxx country=中国 quality=4'));
      break;
    }
    case 'tasks': {
      const showId = args[1];
      if (!showId) { console.log(chalk.red('用法: b2b show tasks <showId>')); return; }
      const tasks = getPostShowTasks(showId);
      console.log(chalk.bold(`\n📋 展后72h任务清单\n`));
      const priorityColor = { critical: chalk.red, high: chalk.yellow, normal: chalk.green, low: chalk.gray };
      tasks.forEach(t => {
        const color = priorityColor[t.priority] || chalk.white;
        const statusColor = t.status === 'done' ? chalk.green : chalk.gray;
        console.log(`  ${color('[' + t.priority.toUpperCase().padEnd(8) + ']')} ${t.task}`);
        console.log(chalk.gray(`     负责人: ${t.assignTo} | ${statusColor(t.status)} ${t.note ? '| ' + t.note : ''}`));
      });
      break;
    }
    default:
      console.log(chalk.gray('展会子命令:'));
      console.log('  b2b show list               # 展会仪表盘');
      console.log('  b2b show add <名> <日期> <地点> [产品]  # 创建展会');
      console.log('  b2b show lead <id> [字段=值]  # 收集名片线索');
      console.log('  b2b show leads <id>        # 查看展会线索');
      console.log('  b2b show export <id>        # 导出线索CSV');
      console.log('  b2b show scan               # 查看名片扫描模板');
      console.log('  b2b show tasks <id>          # 展后72h任务清单');
  }
}

// 状态显示
function showStatus() {
  const config = loadConfig();
  const outputDir = join(homedir(), '.b2btrade-agent', 'output');

  console.log(chalk.bold('\n📊 B2Btrade Agent 状态\n'));

  // 配置状态
  console.log(chalk.cyan('⚙️  配置'));
  console.log(`   Provider:  ${config.apiProvider || 'openai'}`);
  console.log(`   Model:     ${config.model || '(默认)'}`);
  console.log(`   API Key:   ${config.apiKey ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`   Locale:    ${config.locale || 'zh'}`);

  // 限流状态
  const limiterStatus = getAllLimitersStatus();
  if (limiterStatus.length > 0) {
    console.log(chalk.cyan('\n🚦 限流器'));
    limiterStatus.forEach(l => {
      const pct = Math.round((l.tokens / l.limit) * 100);
      const color = pct > 60 ? chalk.green : pct > 30 ? chalk.yellow : chalk.red;
      console.log(`   ${l.name.padEnd(12)} ${color(`${l.tokens}/${l.limit} (${pct}%)`)}  总请求: ${l.stats.total}  等待: ${l.queueLength}`);
    });
  }

  // 输出文件统计
  if (existsSync(outputDir)) {
    const files = readdirSync(outputDir).filter(f => f.endsWith('.md'));
    const today = new Date().toISOString().slice(0, 10);
    const todayFiles = files.filter(f => f.includes(today));
    const totalSize = files.reduce((sum, f) => {
      try { return sum + statSync(join(outputDir, f)).size; } catch { return sum; }
    }, 0);

    console.log(chalk.cyan('\n📁 输出文件'));
    console.log(`   今日:      ${todayFiles.length} 个`);
    console.log(`   总计:      ${files.length} 个`);
    console.log(`   总大小:    ${(totalSize / 1024).toFixed(1)} KB`);
    if (files.length > 0) {
      console.log(chalk.gray('\n   最近文件:'));
      files.slice(-3).reverse().forEach(f => {
        console.log(chalk.gray(`   - ${f}`));
      });
    }
  } else {
    console.log(chalk.cyan('\n📁 输出文件'));
    console.log(chalk.gray('   暂无输出文件'));
  }

  // Agent 数量
  console.log(chalk.cyan('\n🤖 Agent'));
  const agentCount = Object.keys(agents).length;
  console.log(`   已注册:    ${agentCount} 个`);
  console.log(`   工作流:    ${listWorkflows().length} 个`);

  console.log();
}

main().catch(console.error);
