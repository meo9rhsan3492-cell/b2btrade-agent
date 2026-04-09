/**
 * LinkedIn Outreach Agent - 智能LinkedIn外展
 */

import chalk from 'chalk';
import { llmCall, cleanThinking } from './orchestrator.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const OUTREACH_FILE = path.join(os.homedir(), '.b2btrade-linkedin.json');

function loadOutreach() {
  try { if (fs.existsSync(OUTREACH_FILE)) return JSON.parse(fs.readFileSync(OUTREACH_FILE, 'utf8')); } catch {}
  return { targets: [], campaigns: [] };
}

function saveOutreach(data) {
  fs.writeFileSync(OUTREACH_FILE, JSON.stringify(data, null, 2));
}

export function searchTargets(query) {
  const prompt = `你是LinkedIn招聘专家，找到目标公司的决策者。

搜索：${query}
返回JSON数组：
[{"name":"姓名","company":"公司","role":"职位","reason":"原因","priority":"high/medium/low"}]`;

  try {
    const result = llmCall(prompt, { retries: 2, timeout: 60000, temperature: 0.5 });
    return result;
  } catch (e) {
    console.log(chalk.yellow(`⚠️ 搜索失败: ${e.message}`));
    return [];
  }
}

export function addTarget(target) {
  const data = loadOutreach();
  const id = Date.now().toString(36);
  data.targets.push({ id, ...target, status: 'pending', created_at: new Date().toISOString() });
  saveOutreach(data);
  return id;
}

export const linkedinAgent = {
  id: 'linkedin',
  name: '💼 LinkedIn外展',
  role: '智能LinkedIn外展',
  description: '精准LinkedIn决策者外展',

  async run(args) {
    const command = args[0];
    if (command === '--search' || command === 'search') {
      const queryMatch = args.join(' ').match(/--search\s+"([^"]+)"/) || args.join(' ').match(/--search\s+(\S+)/);
      const query = queryMatch?.[1] || 'excavator buyer';
      console.log(chalk.bold(`\n🔍 搜索: ${query}\n`));
      try {
        const result = await llmCall(`找到采购挖掘机的决策者，返回JSON数组：${query}\n\n[{"name":"","company":"","role":"职位","reason":"原因","priority":"high"}]`, {
          retries: 2,
          timeout: 60000,
          temperature: 0.4,
        });
        const cleaned = cleanThinking(result);
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        const targets = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        if (Array.isArray(targets)) {
          targets.forEach((t, i) => {
            const pri = t.priority === 'high' ? chalk.green('★') : '☆';
            console.log(`${i + 1}. ${pri} ${t.name} @ ${t.company}`);
            console.log(`   ${t.role}`);
            console.log(chalk.gray(`   ${t.reason}\n`));
          });
          if (targets.filter(t => t.priority !== 'low').length > 0) {
            console.log(chalk.green(`✓ 已添加 ${targets.filter(t => t.priority !== 'low').length} 个目标`));
          }
        }
      } catch (e) {
        console.log(chalk.yellow(`⚠️ 搜索失败: ${e.message}`));
      }
    } else if (command === '--outreach' || command === 'outreach') {
      const nameMatch = args.join(' ').match(/--name\s+"([^"]+)"/) || args.join(' ').match(/--name\s+(\S+)/);
      const companyMatch = args.join(' ').match(/--company\s+"([^"]+)"/) || args.join(' ').match(/--company\s+(\S+)/);
      if (nameMatch && companyMatch) {
        console.log(chalk.bold(`\n💼 生成消息 for ${nameMatch[1]}\n`));
        try {
          const result = await llmCall(`为以下LinkedIn连接请求生成消息（英文30-50词，不提推销）：${nameMatch[1]} @ ${companyMatch[1]}\n\nJSON: {"message":"连接消息","why_connect":"为什么连接","next_action":"下一步"}`, {
            retries: 2,
            timeout: 60000,
            temperature: 0.4,
          });
          const cleaned = cleanThinking(result);
          const parsed = JSON.parse(cleaned);
          console.log(`  消息: "${parsed.message}"`);
          console.log(`  为什么: ${parsed.why_connect}`);
          console.log(`  下一步: ${parsed.next_action}`);
          const id = addTarget({ name: nameMatch[1], company: companyMatch[1], ...parsed });
          console.log(chalk.green(`\n✓ 已保存 (ID: ${id})`));
        } catch (e) {
          console.log(chalk.yellow(`⚠️ 生成失败: ${e.message}`));
        }
      } else {
        console.log(chalk.yellow('⚠️ 用法: --outreach "John" --company "ABC Corp"'));
      }
    } else {
      this.printHelp();
    }
  },

  printHelp() {
    console.log(chalk.bold('\n💼 LinkedIn外展\n'));
    console.log('  node src/index.js linkedin --search "excavator buyer"');
    console.log('  node src/index.js linkedin --outreach "John" --company "ABC"');
  }
};

export default linkedinAgent;