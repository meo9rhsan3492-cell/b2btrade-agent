/**
 * B2Btrade-agent 工作流
 * 预设的外贸业务流程
 */

import chalk from 'chalk';

// 工作流1：客户挖掘 → 生成开发信
export async function workflowFindAndEmail(targetCountry, product, aiChat) {
  console.log(chalk.cyan('\n📋 工作流：客户挖掘 → 开发信\n'));
  
  const steps = [
    { name: '🎯 挖掘目标客户', status: 'pending' },
    { name: '🔍 获取联系方式', status: 'pending' },
    { name: '✍️ 生成开发信', status: 'pending' }
  ];

  // Step 1: 挖掘客户
  steps[0].status = 'running';
  console.log(chalk.blue('  1/3 🎯 挖掘目标客户...'));
  
  const customerPrompt = `给我5个${targetCountry}的${product}潜在采购商公司名，包含官网`;
  const customers = await aiChat(customerPrompt, 'intelligence');
  
  steps[0].status = 'done';
  console.log(chalk.green('  ✓ 客户列表已生成\n'));

  // Step 2: 获取联系方式
  steps[1].status = 'running';
  console.log(chalk.blue('  2/3 🔍 获取联系方式...'));
  
  const contactPrompt = `从上述5个公司中，选择2个，给出决策人名字和LinkedIn资料`;
  const contacts = await aiChat(contactPrompt, 'intelligence');
  
  steps[1].status = 'done';
  console.log(chalk.green('  ✓ 联系方式已生成\n'));

  // Step 3: 生成开发信
  steps[2].status = 'running';
  console.log(chalk.blue('  3/3 ✍️ 生成开发信...'));
  
  const emailPrompt = `为上述客户生成3封不同风格（技术导向/价格导向/关系导向）的开发信`;
  const emails = await aiChat(emailPrompt, 'content');
  
  steps[2].status = 'done';
  console.log(chalk.green('  ✓ 开发信已生成\n'));

  return { customers, contacts, emails };
}

// 工作流2：询盘分析 → 报价
export async function workflowRFQ(rfqText, aiChat) {
  console.log(chalk.cyan('\n📋 工作流：询盘分析 → 报价\n'));
  
  // Step 1: 分析询盘
  console.log(chalk.blue('  1/2 🔍 分析询盘...'));
  const analysis = await aiChat(`
    分析以下询盘，给出：
    1. 客户类型判断
    2. 需求真实度评估
    3. 报价策略建议
    4. 需要确认的问题
    
    询盘内容：${rfqText}
  `, 'rfq');

  console.log(chalk.green('  ✓ 询盘分析完成\n'));

  // Step 2: 生成报价
  console.log(chalk.blue('  2/2 💰 生成报价...'));
  const quote = await aiChat(`
    基于以上分析，生成一份专业报价单，包含：
    1. 产品规格
    2. 价格（FOB/CIF）
    3. 交期
    4. 付款方式
    5. 有效期
  `, 'rfq');

  console.log(chalk.green('  ✓ 报价单生成完成\n'));

  return { analysis, quote };
}

// 工作流3：市场调研
export async function workflowMarketResearch(country, product, aiChat) {
  console.log(chalk.cyan('\n📋 工作流：市场调研\n'));
  
  const report = await aiChat(`
    调研${country}的${product}市场，包含：
    1. 市场规模和增长趋势
    2. 主要玩家和竞争格局
    3. 关税和政策
    4. 准入认证要求
    5. 最佳进入时机建议
  `, 'intelligence');

  return report;
}

// 可用工作流列表
export function listWorkflows() {
  return [
    {
      id: 'find-email',
      name: '客户挖掘 → 开发信',
      description: '从0找到客户并生成开发信',
      params: ['目标国家', '产品']
    },
    {
      id: 'rfq-quote',
      name: '询盘分析 → 报价',
      description: '分析询盘并生成专业报价单',
      params: ['询盘内容']
    },
    {
      id: 'market-research',
      name: '市场调研报告',
      description: '调研目标市场的全面报告',
      params: ['目标国家', '产品']
    }
  ];
}
