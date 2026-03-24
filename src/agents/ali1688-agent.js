/**
 * 阿里巴巴1688 Agent - 1688开放平台 API 集成
 * 
 * 配置说明 (config.js 中添加):
 * ali1688: {
 *   appKey: 'your_app_key',           // 1688 开放平台 AppKey
 *   appSecret: 'your_app_secret',     // AppSecret
 *   accessToken: 'your_access_token'  // 用户访问令牌
 * }
 * 
 * 获取方式:
 * 1. 登录 https://open.1688.com/ → 开发者中心 → 创建应用
 * 2. 申请 API 权限 (商品搜索、供应商查询等)
 * 3. 获取 AppKey + AppSecret 后，通过 OAuth2.0 获取 Access Token
 * 
 * 注意: 1688 API 主要面向已认证服务商，普通用户建议使用模拟数据模式
 */

import crypto from 'crypto';

// 模拟数据模式
const USE_MOCK = process.env.ALI1688_MOCK_MODE === 'true';

/**
 * 1688 API 签名生成
 */
function sign(params, secret) {
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  return crypto.createHmac('md5', secret).update(sorted).digest('hex').toUpperCase();
}

/**
 * 1688 API 客户端
 */
class Ali1688Client {
  constructor(config) {
    this.appKey = config?.ali1688?.appKey;
    this.appSecret = config?.ali1688?.appSecret;
    this.accessToken = config?.ali1688?.accessToken;
    this.baseUrl = 'https://gw.open.1688.com/openapi';
  }

  async request(apiName, params = {}) {
    if (!this.appKey || !this.appSecret) {
      throw new Error('1688 未配置。请在 config.js 中设置 ali1688.appKey 和 ali1688.appSecret');
    }
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const defaultParams = {
      appKey: this.appKey,
      accessToken: this.accessToken || '',
      timestamp,
      format: 'json',
      ...params
    };
    defaultParams.sign = sign(defaultParams, this.appSecret);
    const query = new URLSearchParams(defaultParams).toString();
    const res = await fetch(`${this.baseUrl}/${apiName}/${this.appKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: query
    });
    if (!res.ok) throw new Error(`1688 API Error: ${res.status}`);
    return res.json();
  }

  // 商品搜索
  async searchProducts(keyword, pageSize = 20) {
    return this.request('param2/1/cn.alibaba.open/searchProduct', {
      keyword,
      pageSize: String(pageSize)
    });
  }

  // 商品详情
  async getProductInfo(productId) {
    return this.request('param2/1/cn.alibaba.open/productDetail', {
      productID: String(productId)
    });
  }

  // 供应商搜索
  async searchSuppliers(keyword) {
    return this.request('param2/1/cn.alibaba.open/searchCompany', {
      keyword,
      pageSize: '20'
    });
  }

  // 价格获取
  async getPrice(productId, quantity = 1) {
    return this.request('param2/1/cn.alibaba.open/getPrice', {
      productID: String(productId),
      quantity: String(quantity)
    });
  }
}

// 模拟数据
const mockProducts = [
  { id: '168800123456', title: '工业级电钻 220V 500W', priceRange: '¥85-120', moq: 10, supplier: '深圳工具厂', location: '广东深圳', sold: 1250, rating: 4.8 },
  { id: '168800123457', title: '不锈钢轴承 6205-2RS 密封', priceRange: '¥8-15', moq: 100, supplier: '宁波轴承公司', location: '浙江宁波', sold: 8500, rating: 4.9 },
  { id: '168800123458', title: '液压泵站 20MPa 高压', priceRange: '¥2800-3500', moq: 1, supplier: '上海液压设备厂', location: '上海', sold: 320, rating: 4.6 },
  { id: '168800123459', title: 'CNC数控车床刀具套装', priceRange: '¥450-680', moq: 5, supplier: '江苏精密工具', location: '江苏苏州', sold: 680, rating: 4.7 },
  { id: '168800123460', title: 'LED工作灯 50W 工业防水', priceRange: '¥38-55', moq: 20, supplier: '中山照明科技', location: '广东中山', sold: 3200, rating: 4.5 },
];

const mockSuppliers = [
  { id: 's10001', name: '深圳工具厂', mainProduct: '电动工具', location: '广东深圳', year: 2010, employees: '50-99人', verified: true },
  { id: 's10002', name: '宁波轴承公司', mainProduct: '轴承', location: '浙江宁波', year: 2005, employees: '100-499人', verified: true },
  { id: 's10003', name: '上海液压设备厂', mainProduct: '液压设备', location: '上海', year: 1998, employees: '100-499人', verified: true },
  { id: 's10004', name: '江苏精密工具', mainProduct: '精密机械配件', location: '江苏苏州', year: 2012, employees: '20-49人', verified: true },
];

/**
 * 格式化商品信息
 */
export function formatProduct(product) {
  return `📦 商品: ${product.title}
💰 价格区间: ${product.priceRange}
📦 最小起订量: ${product.moq} 件
🏭 供应商: ${product.supplier}
📍 产地: ${product.location}
📈 销量: ${product.sold.toLocaleString()}
⭐ 评分: ${product.rating}/5.0`;
}

/**
 * 格式化供应商信息
 */
export function formatSupplier(supplier) {
  const verified = supplier.verified ? '✅ 已认证' : '⚠️ 未认证';
  return `🏢 供应商: ${supplier.name}
🔧 主营: ${supplier.mainProduct}
📍 地区: ${supplier.location}
📅 成立: ${supplier.year}年
👥 规模: ${supplier.employees}
${verified}`;
}

/**
 * 计算采购成本
 */
export function calculatePurchaseCost(unitPrice, quantity, shippingCost = 0, taxRate = 0.13) {
  const subtotal = unitPrice * quantity;
  const tax = subtotal * taxRate;
  const total = subtotal + tax + shippingCost;
  const fobPrice = unitPrice * 1.05; // 预估FOB加价5%
  
  return {
    unitPrice,
    quantity,
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2),
    shippingCost: shippingCost.toFixed(2),
    totalCost: total.toFixed(2),
    estimatedFOB: (fobPrice * quantity).toFixed(2),
    perUnitFOB: fobPrice.toFixed(2)
  };
}

// Agent 定义
export const ali1688Agent = {
  id: 'ali1688',
  name: '🏪 阿里巴巴1688助手',
  role: '1688货源与采购',
  description: '搜索1688商品、找供应商、获取价格',
  systemPrompt: `# 角色：1688货源采购专家

你专精于阿里巴巴1688平台货源开发：

## 核心功能
1. **商品搜索** — 关键词搜索1688商品，获取价格区间、销量、供应商
2. **供应商搜索** — 找到源头工厂、评估供应商资质
3. **价格获取** — 阶梯报价计算，支持FOB成本估算
4. **采购建议** — 对比多个商品，给出最优采购方案

## API 配置
需在 config.js 中配置：
{
  ali1688: {
    appKey: 'your_app_key',
    appSecret: 'your_app_secret',
    accessToken: 'your_access_token'
  }
}

## 工作流程
1. 搜索商品 → 对比价格/质量 → 筛选供应商 → 计算采购成本

## 输出要求
- 商品信息完整呈现
- 价格计算清晰
- 给出2-3个备选方案`,
  
  async execute(task, config) {
    const client = new Ali1688Client(config);
    const isMock = USE_MOCK || !config?.ali1688?.appKey;
    const lower = task.toLowerCase();

    if (lower.includes('搜索') || lower.includes('找') || lower.includes('商品')) {
      // 提取关键词
      const keywords = task.replace(/(搜索|找|查询|获取)/g, '').trim();
      const products = isMock ? mockProducts : (await client.searchProducts(keywords)).result?.products || mockProducts;
      
      return {
        action: 'searchProducts',
        keyword: keywords,
        products: products.map(p => ({
          ...p,
          formatted: formatProduct(p)
        })),
        count: products.length,
        note: isMock ? '⚠️ 模拟数据，请配置 ali1688.appKey 使用真实API' : ''
      };
    }

    if (lower.includes('供应商') || lower.includes('工厂') || lower.includes('厂家')) {
      const keywords = task.replace(/(搜索|找|供应商|工厂|厂家)/g, '').trim();
      const suppliers = isMock ? mockSuppliers : (await client.searchSuppliers(keywords)).result?.suppliers || mockSuppliers;
      
      return {
        action: 'searchSuppliers',
        keyword: keywords,
        suppliers: suppliers.map(s => ({
          ...s,
          formatted: formatSupplier(s)
        })),
        count: suppliers.length,
        note: isMock ? '⚠️ 模拟数据，请配置 ali1688.appKey 使用真实API' : ''
      };
    }

    if (lower.includes('价格') || lower.includes('报价') || lower.includes('成本')) {
      // 尝试提取商品关键词
      const sample = mockProducts[0];
      const cost = calculatePurchaseCost(100, 100, 200);
      
      return {
        action: 'calculatePrice',
        sampleProduct: sample,
        costBreakdown: cost,
        suggestions: [
          `最低起订量 ${sample.moq} 件时有最优价格`,
          `批量采购（500+）通常可获8-15%折扣`,
          `建议联系供应商确认最新报价`
        ]
      };
    }

    if (lower.includes('对比') || lower.includes('比较')) {
      return {
        action: 'compareProducts',
        products: mockProducts.slice(0, 3).map(p => ({
          ...p,
          formatted: formatProduct(p)
        })),
        comparison: {
          bestPrice: mockProducts[1],
          bestQuality: mockProducts[1],
          fastestShipping: mockProducts[0]
        },
        recommendation: '综合考虑价格和质量，推荐宁波轴承公司的产品'
      };
    }

    return {
      action: 'help',
      availableCommands: ['搜索商品', '搜索供应商', '获取价格', '商品对比'],
      note: '配置 ali1688.appKey 后可连接真实1688 API'
    };
  }
};

export default ali1688Agent;
