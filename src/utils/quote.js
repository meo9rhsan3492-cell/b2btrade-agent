/**
 * B2Btrade-agent PI/报价单生成器
 * 输出专业格式，含PDF-friendly Markdown
 */
import chalk from 'chalk';
import { hsReport } from './hscode.js';
import { calculateIncoterms } from './incoterms.js';

// 货币符号
const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', CNY: '¥', JPY: '¥', AUD: 'A$'
};

// 国家/地区时区和语言
const LOCALE_HINT = {
  '中东': { currency: 'USD', language: 'en', payment: 'T/T 30%+70%' },
  '欧洲': { currency: 'EUR', language: 'en', payment: 'T/T 30%+70% or L/C' },
  '美国': { currency: 'USD', language: 'en', payment: 'T/T 50%+50%' },
  '东南亚': { currency: 'USD', language: 'en', payment: 'T/T 30%+70%' },
  '非洲': { currency: 'USD', language: 'en', payment: 'T/T 30%+70%' },
  '南美': { currency: 'USD', language: 'en/es', payment: 'L/C preferred' },
  '俄罗斯': { currency: 'CNY', language: 'en', payment: 'T/T 100% prepayment' },
};

/**
 * 生成Proforma Invoice / 形式发票
 */
export function generatePI(params) {
  const {
    buyer = {},
    products = [],
    terms = {},
    seller = {},
    extras = {}
  } = params;

  const locale = LOCALE_HINT[terms.destinationRegion] || LOCALE_HINT['东南亚'];
  const currency = terms.currency || locale.currency || 'USD';
  const sym = CURRENCY_SYMBOLS[currency] || '$';

  // 计算汇总
  let subtotal = 0;
  const productLines = products.map((p, i) => {
    const total = p.unitPrice * p.quantity;
    subtotal += total;
    return { ...p, lineTotal: total, seq: i + 1 };
  });

  const discount = terms.discount || 0;
  const subtotalAfterDiscount = subtotal * (1 - discount / 100);
  const freight = terms.freightCost || 0;
  const insurance = terms.insuranceCost || 0;
  const grandTotal = subtotalAfterDiscount + freight + insurance;

  const pi = {
    piNumber: terms.piNumber || `PI-${Date.now().toString().slice(-8)}`,
    date: new Date().toISOString().slice(0, 10),
    validUntil: terms.validUntil || addDays(30),
    incoterms: terms.incoterms || 'FOB',
    destination: terms.destination || '',
    departure: terms.departure || 'Shanghai, China',
    payment: terms.payment || locale.payment,
    currency,
    productLines,
    subtotal: subtotal.toFixed(2),
    discount,
    subtotalAfterDiscount: subtotalAfterDiscount.toFixed(2),
    freight: freight.toFixed(2),
    insurance: insurance.toFixed(2),
    grandTotal: grandTotal.toFixed(2),
    grandTotalCNY: (grandTotal * 7.25).toFixed(2),
    buyer,
    seller,
    extras
  };

  return pi;
}

/**
 * 输出为Markdown格式（可复制到邮件/PDF）
 */
export function toMarkdown(pi) {
  const sym = CURRENCY_SYMBOLS[pi.currency] || '$';
  const lines = [];

  lines.push(`# PROFORMA INVOICE`);
  lines.push('');
  lines.push(`| **PI No.:** ${pi.piNumber} | **Date:** ${pi.date} | **Valid Until:** ${pi.validUntil} |`);
  lines.push('|---|---|---|');
  lines.push('');
  lines.push('## SELLER (卖方)');
  lines.push(`| Field | Value |');
  lines.push(`|---|---|`);
  lines.push(`| Company | ${pi.seller.company || '[Your Company Name]'}|`);
  lines.push(`| Address | ${pi.seller.address || '[Full Address]'}|`);
  lines.push(`| Tel | ${pi.seller.tel || '[Phone]'}|`);
  lines.push(`| Email | ${pi.seller.email || '[Email]'}|`);
  lines.push('');
  lines.push('## BUYER (买方)');
  lines.push(`| Field | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Company | ${pi.buyer.company || '[Buyer Company]'}|`);
  lines.push(`| Address | ${pi.buyer.address || '[Buyer Address]'}|`);
  lines.push(`| Tel | ${pi.buyer.tel || '[Phone]'}|`);
  lines.push(`| Email | ${pi.buyer.email || '[Email]'}|`);
  lines.push('');
  lines.push('## 商品明细 / Product Details');
  lines.push('');
  lines.push(`| # | 品名 Description | HS Code | 数量 QTY | 单位 Unit | 单价 Unit Price | 总价 Amount |`);
  lines.push(`|---|---|---|---|---|---|---|`);

  for (const p of pi.productLines) {
    lines.push(`| ${p.seq} | ${p.name || p.description} ${p.spec || ''} | ${p.hsCode || ''} | ${p.quantity} | ${p.unit || 'PCS'} | ${sym}${p.unitPrice.toFixed(2)} | ${sym}${p.lineTotal.toFixed(2)} |`);
  }

  lines.push('');
  lines.push('## 价格汇总 / Price Summary');
  lines.push(`| 项目 | 金额 |`);
  lines.push(`|---|---|`);
  lines.push(`| 小计 Subtotal | ${sym}${pi.subtotal} |`);
  if (pi.discount > 0) {
    lines.push(`| 折扣 Discount (${pi.discount}%) | -${sym}${pi.discount > 0 ? (parseFloat(pi.subtotal) * pi.discount / 100).toFixed(2) : '0.00'} |`);
  }
  lines.push(`| 小计（含折扣）Subtotal | ${sym}${pi.subtotalAfterDiscount} |`);
  if (parseFloat(pi.freight) > 0) {
    lines.push(`| 运费 Freight (${pi.incoterms}) | ${sym}${pi.freight} |`);
  }
  if (parseFloat(pi.insurance) > 0) {
    lines.push(`| 保险 Insurance | ${sym}${pi.insurance} |`);
  }
  lines.push(`| **合同总价 Grand Total** | **${sym}${pi.grandTotal}** |`);
  lines.push('');
  lines.push('## 贸易条款 / Trade Terms');
  lines.push(`| 项目 | 内容 |`);
  lines.push(`|---|---|`);
  lines.push(`| 贸易术语 Incoterms | ${pi.incoterms} |`);
  lines.push(`| 目的地 Destination | ${pi.destination} |`);
  lines.push(`| 出发港 Departure | ${pi.departure} |`);
  lines.push(`| 付款方式 Payment | ${pi.payment} |`);
  lines.push(`| 货币 Currency | ${pi.currency} |`);
  lines.push('');
  lines.push('## 交货与包装 / Delivery & Packing');
  lines.push(`| 项目 | 内容 |`);
  lines.push(`|---|---|`);
  lines.push(`| 交货期 Lead Time | ${pi.extras.leadTime || '30-45 days after deposit received'}|`);
  lines.push(`| 包装 Packing | ${pi.extras.packing || 'Standard export packing'}|`);
  lines.push(`| 数量误差 QTY Tolerance | ±5% allowed |`);
  lines.push('');

  if (pi.extras.notes) {
    lines.push('## 备注 Notes');
    lines.push(pi.extras.notes);
    lines.push('');
  }

  lines.push('---');
  lines.push(`*This PI is valid until ${pi.validUntil}. Prices are subject to change after expiration.*`);
  lines.push(`*Generated by B2Btrade Agent | ${new Date().toISOString()}*`);

  return lines.join('\n');
}

/**
 * 输出为HTML格式（可直接打印/发送邮件）
 */
export function toHTML(pi) {
  const sym = CURRENCY_SYMBOLS[pi.currency] || '$';
  const rows = pi.productLines.map(p =>
    `<tr><td>${p.seq}</td><td>${p.name || p.description} ${p.spec || ''}</td><td>${p.hsCode || '-'}</td><td>${p.quantity}</td><td>${p.unit || 'PCS'}</td><td>${sym}${p.unitPrice.toFixed(2)}</td><td>${sym}${p.lineTotal.toFixed(2)}</td></tr>`
  ).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>PI ${pi.piNumber}</title>
<style>
  body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;font-size:14px;color:#333}
  h1{text-align:center;color:#1a5f7a;border-bottom:2px solid #1a5f7a;padding-bottom:10px}
  table{width:100%;border-collapse:collapse;margin:15px 0}
  th,td{border:1px solid #ddd;padding:8px;text-align:left}
  th{background:#1a5f7a;color:white}
  tr:nth-child(even){background:#f9f9f9}
  .total-row td{font-weight:bold;background:#f0f0f0}
  .meta{display:flex;justify-content:space-between;margin:20px 0}
  .meta>div{width:48%}
  .section-title{font-size:12px;color:#888;margin:15px 0 5px}
  .footer{text-align:center;font-size:11px;color:#888;margin-top:30px;border-top:1px solid #eee;padding-top:10px}
</style></head><body>
<h1>PROFORMA INVOICE</h1>
<div class="meta">
  <div><div class="section-title">SELLER</div>
    <p><strong>${pi.seller.company || '[Your Company]'}</strong><br>${pi.seller.address || ''}<br>Tel: ${pi.seller.tel || ''}<br>Email: ${pi.seller.email || ''}</p>
  </div>
  <div><div class="section-title">BUYER</div>
    <p><strong>${pi.buyer.company || '[Buyer Company]'}</strong><br>${pi.buyer.address || ''}<br>Tel: ${pi.buyer.tel || ''}<br>Email: ${pi.buyer.email || ''}</p>
  </div>
</div>
<div class="meta">
  <div><div class="section-title">PI DETAILS</div>
    <p><strong>PI No:</strong> ${pi.piNumber}<br><strong>Date:</strong> ${pi.date}<br><strong>Valid Until:</strong> ${pi.validUntil}</p>
  </div>
  <div><div class="section-title">TRADE TERMS</div>
    <p><strong>Incoterms:</strong> ${pi.incoterms}<br><strong>Destination:</strong> ${pi.destination}<br><strong>Payment:</strong> ${pi.payment}<br><strong>Currency:</strong> ${pi.currency}</p>
  </div>
</div>
<table><thead><tr><th>#</th><th>Description</th><th>HS Code</th><th>QTY</th><th>Unit</th><th>Unit Price</th><th>Amount</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot>
<tr><td colspan=6>Subtotal</td><td>${sym}${pi.subtotal}</td></tr>
${pi.discount > 0 ? `<tr><td colspan=6>Discount (${pi.discount}%)</td><td>-${sym}${(parseFloat(pi.subtotal) * pi.discount / 100).toFixed(2)}</td></tr>` : ''}
<tr><td colspan=6>Subtotal after Discount</td><td>${sym}${pi.subtotalAfterDiscount}</td></tr>
${parseFloat(pi.freight) > 0 ? `<tr><td colspan=6>Freight (${pi.incoterms})</td><td>${sym}${pi.freight}</td></tr>` : ''}
${parseFloat(pi.insurance) > 0 ? `<tr><td colspan=6>Insurance</td><td>${sym}${pi.insurance}</td></tr>` : ''}
<tr class="total-row"><td colspan=6>GRAND TOTAL</td><td>${sym}${pi.grandTotal}</td></tr>
</tfoot></table>
<div class="meta">
  <div><div class="section-title">DELIVERY</div>
    <p><strong>Lead Time:</strong> ${pi.extras.leadTime || '30-45 days'}<br><strong>Packing:</strong> ${pi.extras.packing || 'Export standard'}<br><strong>Qty Tolerance:</strong> ±5%</p>
  </div>
</div>
${pi.extras.notes ? `<p><strong>Notes:</strong> ${pi.extras.notes}</p>` : ''}
<div class="footer">This PI is valid until ${pi.validUntil}. Generated by B2Btrade Agent.</div>
</body></html>`;
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
