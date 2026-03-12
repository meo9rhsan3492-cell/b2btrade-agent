/**
 * B2Btrade-agent 主入口
 * 外贸B2B智能Agent
 */
import chalk from 'chalk';
import { agents, selectAgent, listAgents, getAgent } from './agents/index.js';
import { listTools, searchCustomer, searchLinkedIn } from './tools/search.js';
import { listWorkflows, workflowFindAndEmail, workflowRFQ, workflowMarketResearch } from './workflows/index.js';
import { chatWithAI } from './ai.js';
import { loadConfig, configureApiKey } from './config.js';

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
║     🤖 8位外贸专家 | 🔧 工具集成 | ⚡ 工作流自动化              ║
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
  help              显示帮助

示例:
  b2b chat                    # 启动对话
  b2b chat content             # 与内容专家对话
  b2b list                     # 查看所有Agent
  b2b run find-email           # 执行客户挖掘工作流
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

    default:
      // 尝试作为直接命令执行
      await quickCommand(command + ' ' + args.slice(1).join(' '));
  }
}

// 交互模式
async function interactiveMode(initialAgentId) {
  const config = loadConfig();
  
  if (!config.apiKey) {
    console.log(chalk.yellow('⚠️ 请先配置API Key\n'));
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
      
    default:
      console.log(chalk.red(`未知工作流: ${wfId}`));
  }
}

main().catch(console.error);
