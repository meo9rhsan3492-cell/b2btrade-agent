/**
 * B2Btrade-agent HS编码查询与退税率
 * 内置中国海关HS数据库（常用品类子集）
 */
import chalk from 'chalk';
import https from 'https';

// 内置HS编码库（外贸常见商品）
const HS_DATABASE = {
  // 机械类
  '8430':  { desc: '泥土、矿物或矿石的其他钻探机械', unit: '台', exportRebate: 13, duty: 0, control: '' },
  '8431':  { desc: '专用于品目8425-8430的零件', unit: '千克', exportRebate: 13, duty: 0, control: '' },
  '8430.50': { desc: '钻机（石油/天然气钻探）', unit: '台', exportRebate: 13, duty: 0, control: '出口许可证' },
  '8429':  { desc: '推土机、铲运机、平地机', unit: '台', exportRebate: 13, duty: 0, control: '' },
  '8701':  { desc: '牵引车（拖拉机）', unit: '辆', exportRebate: 13, duty: 0, control: '' },
  '8708':  { desc: '汽车零件及附件', unit: '千克', exportRebate: 13, duty: 10, control: '' },

  // 电子/电气
  '8471':  { desc: '自动数据处理设备及其部件', unit: '台/千克', exportRebate: 13, duty: 0, control: '' },
  '8517':  { desc: '电话机、智能手机', unit: '台', exportRebate: 0, duty: 0, control: '' },
  '8528':  { desc: '监视器及投影机', unit: '台', exportRebate: 13, duty: 0, control: '' },
  '8542':  { desc: '集成电路', unit: '个', exportRebate: 0, duty: 0, control: '出口许可证（特定）' },

  // 纺织品
  '6204':  { desc: '女式服装', unit: '件', exportRebate: 13, duty: 17, control: '' },
  '6203':  { desc: '男式服装', unit: '件', exportRebate: 13, duty: 17, control: '' },
  '6309':  { desc: '旧衣物', unit: '千克', exportRebate: 0, duty: 10, control: '禁止出口' },

  // 五金/建材
  '7308':  { desc: '钢铁结构体及部件', unit: '千克', exportRebate: 13, duty: 0, control: '' },
  '7318':  { desc: '钢铁制螺丝螺母螺栓', unit: '千克', exportRebate: 13, duty: 0, control: '' },
  '9403':  { desc: '其他家具及其零件', unit: '千克', exportRebate: 13, duty: 0, control: '' },

  // 化工
  '2804':  { desc: '氢、稀有气体等', unit: '立方米', exportRebate: 0, duty: 5, control: '出口许可证' },
  '2905':  { desc: '无环醇及其衍生物', unit: '千克', exportRebate: 13, duty: 5.5, control: '' },

  // 太阳能/新能源
  '8541':  { desc: '二极管/晶体管/光敏半导体', unit: '个', exportRebate: 13, duty: 0, control: '' },
  '8501':  { desc: '电机及发电机', unit: '台', exportRebate: 13, duty: 0, control: '' },
  '8502':  { desc: '发电机组', unit: '台', exportRebate: 13, duty: 0, control: '' },

  // 通用前缀匹配
  '84':    { desc: '核反应堆/锅炉/机械器具', unit: '', exportRebate: 13, duty: 0, control: '部分需要出口许可证' },
  '85':    { desc: '电机/电气设备', unit: '', exportRebate: 13, duty: 0, control: '部分需要出口许可证' },
  '87':    { desc: '车辆（铁路/汽动道除外）', unit: '', exportRebate: 13, duty: 0, control: '' },
  '73':    { desc: '钢铁制品', unit: '', exportRebate: 13, duty: 0, control: '' },
  '62':    { desc: '服装（纺织）', unit: '', exportRebate: 13, duty: 12, control: '' },
};

// 出口管制分类（简表）
const EXPORT_CONTROL_CATEGORIES = {
  '军事用品': ['9301-9307'], // 武器弹药
  '核材料': ['2804', '2844'], // 特殊敏感
  '化学品': ['2901-2942'], // 可能需要两用物项许可
  '加密设备': ['8543.70', '8517'], // 需额外审查
  '无人机': ['8802'], // 中国对特定无人机出口管制
  '石油钻探': ['8430'], // 部分需许可证
};

// 常见退税率参考
const REBATE_RATES = [0, 3, 5, 6, 9, 10, 11, 13, 15];

/**
 * HS编码查询
 */
export function lookupHS(code) {
  const code4 = code.replace(/\D/g, '').slice(0, 10);

  // 精确匹配
  if (HS_DATABASE[code]) return buildResult(code, HS_DATABASE[code]);

  // 4位章节匹配
  const chapter4 = code4.slice(0, 4);
  if (HS_DATABASE[chapter4]) return buildResult(code, HS_DATABASE[chapter4]);

  // 2位大类匹配
  const chapter2 = code4.slice(0, 2);
  if (HS_DATABASE[chapter2]) return buildResult(code, HS_DATABASE[chapter2]);

  return null;
}

function buildResult(code, data) {
  return {
    hsCode: code,
    description: data.desc,
    unit: data.unit,
    exportRebate: data.exportRebate, // 出口退税率 %
    exportDuty: data.duty,          // 出口税率 %
    controlNote: data.control,        // 管制说明
    rebateAmount: null,              // 退税金额（需配合价格计算）
    notes: []
  };
}

/**
 * 完整HS编码报告
 */
export function hsReport(code, price, currency = 'USD', destination = '') {
  const lookup = lookupHS(code);

  if (!lookup) {
    return {
      hsCode: code,
      description: '未找到匹配记录',
      suggestion: '请到海关总署官网确认准确HS编码: http://www.customs.gov.cn',
      warning: 'HS编码错误可能导致出口退税损失或清关延误'
    };
  }

  const report = { ...lookup };

  // 计算退税
  if (price > 0 && lookup.exportRebate > 0) {
    const priceCNY = currency === 'USD' ? price * 7.25 : price;
    report.rebateAmount = (priceCNY / 1.13 * (lookup.exportRebate / 100)).toFixed(2);
    report.rebateNote = `含税价￥${priceCNY.toFixed(2)} → 退税金额约￥${report.rebateAmount}（退税率${lookup.exportRebate}%）`;
  }

  // 管制提示
  if (lookup.controlNote) {
    report.notes.push(`⚠️ ${lookup.controlNote}，需提前办理出口许可证`);
  }

  // 目的国提示
  const destWarnings = getDestWarning(destination);
  if (destWarnings) report.notes.push(destWarnings);

  // 申报要素
  report.declaration = buildDeclaration(lookup);

  return report;
}

function getDestWarning(dest) {
  if (!dest) return null;
  const warnings = {
    '美国': '出口至美国注意EAR/ITAR管制，部分商品需申请BIS许可',
    '欧盟': '出口至欧盟注意EU出口管制条例，部分商品需成员国许可',
    '伊朗': '向伊朗出口需获取OFAC特别许可（SNP），大多数商品禁止',
    '俄罗斯': '向俄罗斯出口注意OFAC 俄语指令，商品须无军事用途',
  };
  for (const [country, warning] of Object.entries(warnings)) {
    if (dest.includes(country)) return warning;
  }
  return null;
}

function buildDeclaration(lookup) {
  return {
    品名: lookup.description,
    HS编码: lookup.hsCode,
    申报单位: lookup.unit || '千克',
    法定单位: lookup.unit || '千克',
    监管条件: lookup.controlNote || '无特殊监管',
    出口退税率: `${lookup.exportRebate}%`,
    出口税率: `${lookup.exportDuty}%`
  };
}

/**
 * 搜索HS编码（模糊匹配描述）
 */
export function searchHS(keyword) {
  const results = [];
  for (const [code, data] of Object.entries(HS_DATABASE)) {
    if (data.desc.includes(keyword) || keyword.includes(code.replace('.', ''))) {
      results.push({ hsCode: code, ...data });
    }
  }
  return results.slice(0, 20);
}

/**
 * 常用外贸HS编码速查表
 */
export function commonHSCheatsheet() {
  return [
    { category: '机械/设备', examples: '钻机(8430) 发电机(8502) 变压器(8504) 空压机(8414)' },
    { category: '汽车配件', examples: '车轮(8708) 发动机(8407) 车灯(8512)' },
    { category: '电子电气', examples: '手机(8517) 电脑(8471) PCB板(8534) 电池(8507)' },
    { category: '纺织品', examples: '服装(6203/6204) 鞋类(6403) 面料(5208-5212)' },
    { category: '建材五金', examples: '钢管(7304-7308) 紧固件(7318) 锁(8301)' },
    { category: '新能源', examples: '光伏组件(8541) 锂电池(8507) 逆变器(8504)' },
  ];
}
