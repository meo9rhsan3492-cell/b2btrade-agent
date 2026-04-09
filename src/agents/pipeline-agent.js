/**
 * Pipeline Agent - 一键工作流编排
 */

import chalk from 'chalk';
import { classifyInquiry, formatInquiryResult } from './inquiry-intel-agent.js';
import { generateReply, formatReplyResult } from './reply-agent.js';
import { createFollowupPlan, formatFollowupPlan, saveFollowupPlan } from './followup-agent.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PIPELINE_FILE = path.join(os.homedir(), '.b2btrade-pipeline.json');

function savePipeline(data) {
  fs.writeFileSync(PIPELINE_FILE, JSON.stringify(data, null, 2));
}

export async function runPipeline(inquiry, opts = {}) {
  const { autoConfirm = false } = opts;
  const results = { inquiry, classification: null, reply: null, followup: null, executed_at: new Date().toISOString() };

  console.log(chalk.bold('\n🚀 Pipeline 启动\n'));
  console.log(`  客户: ${inquiry.name || '未知'} @ ${inquiry.company || '未知'}`);
  console.log(`  需求: ${inquiry.message || '无'}\n`);

  // Step 1: 询盘分类
  console.log(chalk.cyan('📋 Step 1: 询盘分类...\n'));
  results.classification = await classifyInquiry(inquiry);
  console.log(formatInquiryResult(results.classification));

  if (results.classification.category === 'spam') {
    console.log(chalk.yellow('\n⚠️ 垃圾询盘，跳过\n'));
    return results;
  }

  // Step 2: 生成邮件
  console.log(chalk.cyan('\n📧 Step 2: 生成邮件...\n'));
  results.reply = await generateReply(inquiry);
  console.log(formatReplyResult(results.reply));

  // Step 3: 跟进计划
  console.log(chalk.cyan('\n📆 Step 3: 跟进计划...\n'));
  results.followup = await createFollowupPlan(inquiry);
  console.log(formatFollowupPlan(results.followup, inquiry));

  // 保存
  const id = Date.now().toString(36);
  savePipeline([...(JSON.parse(fs.readFileSync(PIPELINE_FILE, 'utf8') || '[]')), { id, ...results }]);

  console.log(chalk.green(`\n✅ Pipeline 完成 (ID: ${id})\n`));
  return results;
}

export const pipelineAgent = {
  id: 'pipeline',
  name: '🚀 Pipeline',
  role: '一键工作流编排',
  description: '串联 分类→邮件→跟进 全流程',

  async run(args) {
    let inquiry;
    const raw = args.join(' ').replace(/--auto-confirm/g, '');
    const match = raw.match(/--inquiry\s+"([^"]+)"/) || raw.match(/--inquiry\s+(\S+)/);
    if (match) {
      const parts = match[1].split(',').map(s => s.trim());
      inquiry = { name: parts[0], company: parts[1], email: parts[2], message: parts.slice(3).join(', ') };
    } else {
      const parts = raw.trim().split(',').map(s => s.trim());
      inquiry = parts.length >= 2 ? { name: parts[0], company: parts[1], email: '', message: parts.slice(2).join(', ') } : { name: raw, company: '', message: '' };
    }

    if (!inquiry || (!inquiry.message && !inquiry.company)) {
      console.log(chalk.yellow('⚠️ 用法: pipeline "John, ABC Corp, need excavators"'));
      return;
    }

    await runPipeline(inquiry, { autoConfirm: true });
  }
};

export default pipelineAgent;