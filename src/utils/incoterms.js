/**
 * B2Btrade-agent Incoterms 2020 成本计算器
 * 计算FOB/CIF/CFR/DDP等贸易术语下的完整成本
 */

// Incoterms 2020 各术语费用边界
const INCOTERMS = {
  EXW: {
    name: 'EXW - Ex Works / 工厂交货',
    seller: '仅在卖方工厂交货，不含任何费用',
    buyer: '承担全部运输、保险、报关费用',
    risk: '卖方交货即完成，风险随货物转移',
    fees: ['提货费', '国内运输', '报关费', '海运费', '保险费', '目的港费用', '送货费']
  },
  FOB: {
    name: 'FOB - Free on Board / 装运港船上交货',
    seller: '货物装上船前所有费用，含起运港费用',
    buyer: '装船后运费+保险+目的港+清关+送货',
    risk: '货物装上船时风险转移',
    fees: ['内陆运输', '报关费', '起运港费用(THC)', '订舱费', '海运费', '保险费', '目的港费用', '清关费', '送货费']
  },
  CFR: {
    name: 'CFR - Cost and Freight / 成本加运费',
    seller: 'FOB+海运费（含起运港装船费）',
    buyer: '海运费由卖方付，保险+目的港+清关+送货',
    risk: '货物装上船时风险转移',
    fees: ['内陆运输', '报关费', '起运港费用', '海运费', '保险费', '目的港费用', '清关费', '送货费']
  },
  CIF: {
    name: 'CIF - Cost Insurance Freight / 成本保险费加运费',
    seller: 'FOB+海运费+海运保险（最低保额110%）',
    buyer: '目的港清关+送货',
    risk: '货物装上船时风险转移',
    fees: ['内陆运输', '报关费', '起运港费用', '海运费', '海运保险费', '目的港费用', '清关费', '送货费']
  },
  DAP: {
    name: 'DAP - Delivered at Place / 目的地交货',
    seller: '承担到目的地的一切费用（不含卸货/清关）',
    buyer: '卸货费（如有）+ 清关 + 关税',
    risk: '目的地交货前，风险由卖方承担',
    fees: ['内陆运输', '报关费', '海运费', '目的港费用', '送货费']
  },
  DDP: {
    name: 'DDP - Delivered Duty Paid / 完税后交货',
    seller: '承担到买方指定目的地的一切费用（含税）',
    buyer: '仅负责卸货（如需）',
    risk: '买方指定目的地交货前，风险由卖方承担',
    fees: ['内陆运输', '报关费', '海运费', '目的港费用', '清关费', '关税/进口税', '送货费']
  }
};

// 估算费用参数（可配置）
const DEFAULT_RATES = {
  exchangeRate: 7.25,     // USD→CNY
  container20GP: 1800,     // 20GP海运费(USD)
  container40GP: 2800,     // 40GP海运费(USD)
  container40HQ: 3200,     // 40HQ海运费(USD)
  thcOrigin: 550,          // 起运港THC(CNY)
  documentation: 300,      // 单证费(CNY)
  lclCbm: 120,            // LCL每立方米(USD)
  insuranceRate: 0.005,    // 海运保险费率(FOB价×0.5%)
  customsFee: 500,         // 报关基本费(CNY)
  destPortCharge: 2500,   // 目的港基本费用(CNY/TEU)
  destHandling: 80,        // 目的港装卸费(CNY/吨)
  dutyRate: 0,            // 进口关税（需按HS查询）
  vatRate: 0.13,          // 进口增值税
  inlandTransport: 50,     // 国内运输(CNY/立方米)
  courierRate: 0,          // 空运/kg(USD)
};

/**
 * 计算任意贸易术语下的完整成本
 * @param {Object} params
 * @param {number} params.fobPrice - FOB单价(USD)
 * @param {number} params.quantity - 数量
 * @param {string} params.incoterm - 贸易术语 (EXW/FOB/CFR/CIF/DAP/DDP)
 * @param {string} params.container - 柜型 (20GP/40GP/40HQ/LCL)
 * @param {string} params.destination - 目的港/国
 * @param {string} params.hsCode - HS编码（用于关税计算）
 * @param {Object} params.customRates - 自定义费率覆盖
 */
export function calculateIncoterms(params) {
  const {
    fobPrice = 0,
    quantity = 0,
    incoterm = 'FOB',
    container = '20GP',
    destination = '',
    hsCode = '',
    customRates = {}
  } = params;

  const rates = { ...DEFAULT_RATES, ...customRates };
  const term = INCOTERMS[incoterm] || INCOTERMS.FOB;

  const totalFOB = fobPrice * quantity;

  // 体积/重量估算
  const volumeCbm = quantity * 0.01; // 假设每件0.01立方米
  const weightKg = quantity * 10;   // 假设每件10公斤

  // 基础费用
  const inland = Math.max(inlandCBM(volumeCbm, rates), inlandWeight(weightKg, rates));
  const customs = rates.customsFee;
  const thc = rates.thcOrigin;

  // 运输费用
  const ocean = getOceanFreight(container, volumeCbm, rates);
  const insurance = totalFOB * rates.insuranceRate;

  // 目的港费用
  const destPort = getDestPortCharge(container, volumeCbm, rates);

  // 进口税费（DDP专用）
  const duty = totalFOB * rates.exchangeRate * rates.dutyRate / rates.exchangeRate;
  const vat = (totalFOB * rates.exchangeRate * (1 + rates.dutyRate)) * rates.vatRate / rates.exchangeRate;

  // 按术语汇总
  const breakdown = {
    inlandTransport: inland,       // 内陆运输
    exportCustoms: customs,          // 出口报关
    thcOrigin: thc,                 // 起运港THC
    oceanFreight: ocean,             // 海运费
    marineInsurance: insurance,      // 海运保险
    destPortCharge: destPort,      // 目的港费用
    importDuty: duty,               // 进口关税
    importVat: vat,                 // 进口增值税
  };

  const totalCNY = calcTermTotal(incoterm, breakdown);
  const totalUSD = totalCNY / rates.exchangeRate;

  // 各术语单价
  const unitPrice = {};
  for (const t of Object.keys(INCOTERMS)) {
    const tBreakdown = getTermBreakdown(t, breakdown, totalFOB);
    unitPrice[t] = (tBreakdown.total / quantity).toFixed(2);
  }

  return {
    incoterm,
    termName: term.name,
    fobPrice: fobPrice.toFixed(2),
    quantity,
    totalFOB: totalFOB.toFixed(2),
    unitCostUSD: (totalFOB / quantity).toFixed(2),
    breakdown,
    totalCostCNY: totalCNY.toFixed(2),
    totalCostUSD: totalUSD.toFixed(2),
    margin: ((fobPrice - totalUSD / quantity) / fobPrice * 100).toFixed(1),
    unitPrice,
    exchangeRate: rates.exchangeRate,
    container,
    destination,
    hsCode,
    tip: getTip(incoterm, totalCNY, rates),
  };
}

function inlandCBM(cbm, rates) {
  return Math.ceil(cbm) * rates.inlandTransport;
}
function inlandWeight(kg, rates) {
  return Math.ceil(kg / 1000) * rates.inlandTransport * 2;
}
function getOceanFreight(container, volumeCbm, rates) {
  const containerFreight = rates[`container${container}`] || rates.container20GP;
  if (container === 'LCL') {
    return Math.ceil(volumeCbm) * rates.lclCbm;
  }
  // 整柜：按体积或柜型取大
  return Math.min(containerFreight, Math.ceil(volumeCbm / 30) * containerFreight);
}
function getDestPortCharge(container, volumeCbm, rates) {
  if (container === 'LCL') {
    return Math.ceil(volumeCbm) * rates.destHandling;
  }
  const teus = container === '20GP' ? 1 : 2;
  return teus * rates.destPortCharge;
}
function calcTermTotal(incoterm, breakdown) {
  switch (incoterm) {
    case 'EXW': return breakdown.inlandTransport + breakdown.exportCustoms;
    case 'FOB': return breakdown.inlandTransport + breakdown.exportCustoms + breakdown.thcOrigin + breakdown.oceanFreight + breakdown.destPortCharge;
    case 'CFR': return breakdown.inlandTransport + breakdown.exportCustoms + breakdown.thcOrigin + breakdown.oceanFreight + breakdown.destPortCharge;
    case 'CIF': return breakdown.inlandTransport + breakdown.exportCustoms + breakdown.thcOrigin + breakdown.oceanFreight + breakdown.insurance + breakdown.destPortCharge;
    case 'DAP': return breakdown.inlandTransport + breakdown.exportCustoms + breakdown.thcOrigin + breakdown.oceanFreight + breakdown.destPortCharge;
    case 'DDP': return breakdown.inlandTransport + breakdown.exportCustoms + breakdown.thcOrigin + breakdown.oceanFreight + breakdown.insurance + breakdown.destPortCharge + breakdown.importDuty + breakdown.importVat;
    default: return 0;
  }
}
function getTermBreakdown(incoterm, breakdown, totalFOB) {
  const total = calcTermTotal(incoterm, breakdown);
  return { incoterm, total };
}
function getTip(incoterm, totalCNY, rates) {
  const tips = {
    EXW: 'EXW术语下卖方风险最小，但买家可能压价。建议FOB/CIF报价。',
    FOB: 'FOB是最常用术语。建议配合CIF价给买家参考，降低买家风险感知。',
    CFR: 'CFR适合买家无保险需求时，比CIF便宜保险费。',
    CIF: 'CIF包含保险，让买家更放心。保险建议按发票金额的110%投保。',
    DAP: 'DAP卖方承担费用多，适合高价值货物或买家清关能力弱时。',
    DDP: 'DDP是最大包服务，适合竞争激烈时用总包价格吸引客户。',
  };
  return tips[incoterm] || '';
}

export function listIncoterms() {
  return Object.entries(INCOTERMS).map(([code, t]) => ({
    code,
    name: t.name,
    seller: t.seller,
    buyer: t.buyer,
    risk: t.risk,
    fees: t.fees
  }));
}
