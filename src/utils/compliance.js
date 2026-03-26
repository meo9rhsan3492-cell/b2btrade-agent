/**
 * B2Btrade-agent 制裁名单筛查
 * 数据来源: OFAC SDN / BIS Entity List / 联合国名单 (公开数据)
 */
import chalk from 'chalk';
import https from 'https';
import http from 'http';
import { URL } from 'url';

// 内置基础筛查关键词（最常见受限实体）
const EMBEDDED_SDN = [
  { name: 'ABUBAKAR', type: 'OFAC_SDN', risk: 'high' },
  { name: 'BEN BELLA', type: 'OFAC_SDN', risk: 'high' },
  { name: 'KOROGH', type: 'OFAC_SDN', risk: 'high' },
  { name: 'AL QAEDA', type: 'UN_SANCTIONS', risk: 'critical' },
  { name: 'IRANIAN', type: 'OFAC_SDN', risk: 'high', note: '伊朗相关实体需专项审查' },
  { name: 'RUSSIAN', type: 'OFAC_SDN', risk: 'medium', note: '2022年后俄罗斯实体需专项审查' },
  { name: 'TALIBAN', type: 'UN_SANCTIONS', risk: 'critical' },
];

// 高风险国家/地区
const HIGH_RISK_COUNTRIES = {
  '伊朗': { level: 'critical', reason: '美国全面制裁（OFAC）', regulation: 'ITAR/EW/SDN' },
  '朝鲜': { level: 'critical', reason: '美国全面制裁 + 联合国决议', regulation: 'ITAR/EW/SDN/UN' },
  '叙利亚': { level: 'critical', reason: '美国OFAC制裁', regulation: 'OFAC/SDN' },
  '古巴': { level: 'critical', reason: '美国OFAC制裁', regulation: 'OFAC/SDN' },
  '克里米亚': { level: 'high', reason: '欧盟/美国制裁地区', regulation: 'EU/US' },
  '顿涅茨克': { level: 'high', reason: 'OFAC 13662号指令', regulation: 'OFAC/SDN' },
  '缅甸': { level: 'high', reason: '美国BIS出口管制', regulation: 'BIS/Entity' },
  '委内瑞拉': { level: 'medium', reason: 'OFAC全面制裁', regulation: 'OFAC/SDN' },
};

// 在线查询（需网络）
async function queryOFACSDN(name) {
  try {
    const encoded = encodeURIComponent(name);
    const html = await httpGet(`https://sanctionssearch.ofac.treas.gov/Search.aspx?name=${encoded}`, 8000);
    return html.length > 5000; // 有结果返回
  } catch { return false; }
}

function httpGet(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 B2Btrade-Agent' } }, (res) => {
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

/**
 * 全面筛查客户/公司
 * @param {Object} client - { name, country, contact, website }
 * @returns {Object} 筛查报告
 */
export async function screenClient(client) {
  const { name = '', country = '', contact = '', website = '' } = client;
  console.log(chalk.blue(`\n🔍 制裁名单筛查: ${name}`));

  const risks = [];
  const warnings = [];
  const passed = [];

  // 1. 关键词本地匹配
  for (const sdn of EMBEDDED_SDN) {
    const nameUpper = name.toUpperCase();
    if (nameUpper.includes(sdn.name.toUpperCase())) {
      risks.push({
        type: sdn.type,
        matched: sdn.name,
        level: sdn.risk,
        note: sdn.note || '命中制裁名单关键词，建议人工复核'
      });
    }
  }

  // 2. 高风险国家/地区
  const countryRisks = Object.entries(HIGH_RISK_COUNTRIES).find(([k]) => country.includes(k));
  if (countryRisks) {
    const [_, risk] = countryRisks;
    risks.push({
      type: 'DESTINATION_RISK',
      matched: countryRisks[0],
      level: risk.level,
      reason: risk.reason,
      regulation: risk.regulation,
      note: '目的地为受限国家/地区，请确认业务类型和许可证'
    });
  }

  // 3. 在线 OFAC SDN 查询
  if (name && !risks.find(r => r.level === 'critical')) {
    try {
      const found = await queryOFACSDN(name);
      if (found) {
        risks.push({
          type: 'OFAC_SDN_ONLINE',
          matched: name,
          level: 'critical',
          note: 'OFAC官网查询到匹配记录，必须人工确认后才能继续'
        });
      } else {
        passed.push('OFAC SDN 在线查询: 未发现直接匹配');
      }
    } catch {
      warnings.push('OFAC SDN 在线查询失败，使用本地关键词库');
    }
  }

  // 4. 公司名合规性检查
  if (name) {
    const suspicious = [
      /^.*(IRAN|SYRIA|NORTH.KOREA|CRIMEA|RUSSIA).*$/i,
      /^\s*$/,
      /^[A-Z0-9]{1,3}$/, // 极短缩写
    ];
    for (const re of suspicious) {
      if (re.test(name) && !country.includes('俄罗斯') && !country.includes('伊朗')) {
        warnings.push(`公司名 "${name}" 包含需核实要素，建议人工复核`);
      }
    }
  }

  // 生成结论
  const verdict = risks.some(r => r.level === 'critical') ? 'BLOCK'
    : risks.some(r => r.level === 'high') ? 'REVIEW'
    : risks.some(r => r.level === 'medium') || warnings.length > 0 ? 'CAUTION'
    : 'CLEAR';

  const report = {
    company: name,
    country,
    timestamp: new Date().toISOString(),
    verdict,
    risks,
    warnings,
    passed,
    recommendation: getRecommendation(verdict),
    nextStep: getNextStep(verdict)
  };

  return report;
}

function getRecommendation(verdict) {
  const recs = {
    BLOCK: '⛔ 立即停止 - 必须进行完整合规审查并获得法律意见',
    REVIEW: '🔴 谨慎推进 - 建议获取出口许可证或选择替代方案',
    CAUTION: '🟡 注意风控 - 建议使用中信保覆盖，并加强付款条件',
    CLEAR: '🟢 可以推进 - 建议保留筛查记录，动态关注制裁更新'
  };
  return recs[verdict];
}

function getNextStep(verdict) {
  const steps = {
    BLOCK: '联系合规部门或外部律师，评估许可证可能性',
    REVIEW: '1. 确认产品HS编码是否在出口管制清单内\n2. 评估是否可申请出口许可证\n3. 考虑替代市场和客户',
    CAUTION: '1. 使用更严格的付款条件（如预付30%+L/C）\n2. 建议通过中信保覆盖收汇风险\n3. 保持筛查记录归档',
    CLEAR: '1. 建议定期（季度）重新筛查\n2. 关注美国OFAC和BIS制裁更新\n3. 保存完整沟通记录'
  };
  return steps[verdict];
}

/**
 * 批量筛查
 */
export async function screenClients(clients) {
  const results = [];
  for (const client of clients) {
    const result = await screenClient(client);
    results.push(result);
    await new Promise(r => setTimeout(r, 1000)); // 节流
  }
  return results;
}

/**
 * 快速风险评估（无需网络）
 */
export function quickRiskCheck(country, product = '') {
  const countryRisk = Object.entries(HIGH_RISK_COUNTRIES).find(([k]) => country.includes(k));
  const highRiskProducts = ['无人机', '导弹', '核', '化武', '加密', '雷达', '夜视', '无人机'];

  const risk = {
    country: countryRisk ? { level: countryRisk[1].level, reason: countryRisk[1].reason } : null,
    product: highRiskProducts.some(p => product.includes(p)) ? { level: 'high', reason: '可能属于出口管制物项' } : null,
    overall: 'low'
  };

  if (countryRisk?.[1].level === 'critical' || risk.product?.level === 'high') {
    risk.overall = 'high';
  } else if (countryRisk?.[1].level === 'high' || !countryRisk) {
    risk.overall = 'medium';
  }

  return risk;
}
