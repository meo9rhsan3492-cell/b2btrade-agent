/**
 * Shopify Agent - Shopify Admin API 集成
 * 
 * 配置说明 (config.js 中添加):
 * shopify: {
 *   storeUrl: 'your-store.myshopify.com',   // Shopify 店铺域名
 *   accessToken: 'shpat_xxxxx'               // Admin API Access Token
 * }
 * 
 * 获取方式:
 * 1. Shopify Admin > Settings > Apps and sales channels > Develop apps
 * 2. 创建 App > 配置 Admin API scopes (orders, products, customers 等)
 * 3. 安装 App > 获取 Access Token
 */

import crypto from 'crypto';

// 模拟数据模式 - API 不可用时使用
const USE_MOCK = process.env.SHOPIFY_MOCK_MODE === 'true';

/**
 * Shopify API 客户端
 */
class ShopifyClient {
  constructor(config) {
    this.storeUrl = config?.shopify?.storeUrl;
    this.accessToken = config?.shopify?.accessToken;
    this.baseUrl = this.storeUrl ? `https://${this.storeUrl}/admin/api/2024-01` : null;
  }

  get headers() {
    return {
      'X-Shopify-Access-Token': this.accessToken,
      'Content-Type': 'application/json'
    };
  }

  async request(endpoint, options = {}) {
    if (!this.baseUrl || !this.accessToken) {
      throw new Error('Shopify 未配置。请在 config.js 中设置 shopify.storeUrl 和 shopify.accessToken');
    }
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: { ...this.headers, ...options.headers }
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Shopify API Error ${res.status}: ${err}`);
    }
    return res.json();
  }

  // 订单操作
  async getOrders(params = {}) {
    const query = new URLSearchParams({
      status: 'any',
      limit: '50',
      ...params
    }).toString();
    return this.request(`/orders.json?${query}`);
  }

  async getOrder(id) {
    return this.request(`/orders/${id}.json`);
  }

  async updateOrder(id, data) {
    return this.request(`/orders/${id}.json`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // 商品操作
  async getProducts(params = {}) {
    const query = new URLSearchParams({ limit: '50', ...params }).toString();
    return this.request(`/products.json?${query}`);
  }

  async getProduct(id) {
    return this.request(`/products/${id}.json`);
  }

  // 客户操作
  async getCustomers(params = {}) {
    const query = new URLSearchParams({ limit: '50', ...params }).toString();
    return this.request(`/customers.json?${query}`);
  }

  async getCustomer(id) {
    return this.request(`/customers/${id}.json`);
  }

  // 物流追踪
  async getFulfillment(orderId, fulfillmentId) {
    return this.request(`/orders/${orderId}/fulfillments/${fulfillmentId}.json`);
  }

  async createFulfillment(orderId, trackingNumber, trackingCompany) {
    return this.request(`/orders/${orderId}/fulfillments.json`, {
      method: 'POST',
      body: JSON.stringify({
        fulfillment: {
          tracking_number: trackingNumber,
          tracking_company: trackingCompany || 'custom',
          notify_customer: true
        }
      })
    });
  }
}

// 模拟数据
const mockOrders = [
  { id: 1001, name: '#1001', email: 'john@example.com', created_at: '2026-03-20T10:00:00Z', total_price: '250.00', currency: 'USD', financial_status: 'paid', fulfillment_status: null, line_items: [{ title: 'Industrial Drill Bits', quantity: 10, price: '25.00' }] },
  { id: 1002, name: '#1002', email: 'sarah@company.co.uk', created_at: '2026-03-21T14:30:00Z', total_price: '1800.00', currency: 'USD', financial_status: 'paid', fulfillment_status: null, line_items: [{ title: 'Hydraulic Pump Unit', quantity: 2, price: '900.00' }] },
  { id: 1003, name: '#1003', email: 'client@enterprise.de', created_at: '2026-03-22T09:15:00Z', total_price: '560.00', currency: 'USD', financial_status: 'pending', fulfillment_status: null, line_items: [{ title: 'Steel Bearings Pack', quantity: 5, price: '112.00' }] },
  { id: 1004, name: '#1004', email: 'buyer@factory.asia', created_at: '2026-03-23T16:45:00Z', total_price: '3200.00', currency: 'USD', financial_status: 'paid', fulfillment_status: null, line_items: [{ title: 'CNC Machine Parts Set', quantity: 1, price: '3200.00' }] },
];

const mockProducts = [
  { id: 2001, title: 'Industrial Drill Bits', variants: [{ price: '25.00', inventory_quantity: 500 }] },
  { id: 2002, title: 'Hydraulic Pump Unit', variants: [{ price: '900.00', inventory_quantity: 20 }] },
  { id: 2003, title: 'Steel Bearings Pack', variants: [{ price: '112.00', inventory_quantity: 150 }] },
  { id: 2004, title: 'CNC Machine Parts Set', variants: [{ price: '3200.00', inventory_quantity: 5 }] },
];

/**
 * 生成发货通知
 */
export function generateShippingNotification(order, trackingInfo) {
  return `📦 发货通知 / Shipping Notification

订单号 / Order: ${order.name}
客户邮箱 / Email: ${order.email}

✅ 已发货商品 / Shipped Items:
${order.line_items.map(item => `• ${item.title} × ${item.quantity}`).join('\n')}

🚚 追踪信息 / Tracking:
• 快递公司: ${trackingInfo.company}
• 追踪号: ${trackingInfo.number}
• 链接: ${trackingInfo.url || '请至快递公司官网查询'}

⏰ 预计到达: ${trackingInfo.estimatedDays ? `${trackingInfo.estimatedDays} 天/days` : '请查询快递公司'}

如有任何问题，请回复此邮件。
For any questions, please reply to this email.`;
}

/**
 * 生成询盘处理建议
 */
export function analyzeOrderForInquiries(order) {
  const isB2B = parseFloat(order.total_price) > 500;
  const isBulk = order.line_items.some(item => item.quantity > 10);
  
  let priority = 'normal';
  if (isB2B && isBulk) priority = 'high';
  else if (isB2B || isBulk) priority = 'medium';

  return {
    orderId: order.id,
    orderName: order.name,
    email: order.email,
    total: `${order.currency} ${order.total_price}`,
    priority,
    signals: {
      isHighValue: isB2B,
      isBulk: isBulk,
      hasFulfilled: !!order.fulfillment_status
    },
    recommendation: priority === 'high' 
      ? '优先处理：大批量B2B订单，建议主动联系确认需求'
      : priority === 'medium'
      ? '正常跟进：建议发货后发送满意度调查'
      : '标准处理：自动发货通知即可'
  };
}

/**
 * 订单状态摘要
 */
export function summarizeOrders(orders) {
  const total = orders.reduce((sum, o) => sum + parseFloat(o.total_price), 0);
  const paid = orders.filter(o => o.financial_status === 'paid');
  const pending = orders.filter(o => o.financial_status === 'pending');
  const fulfilled = orders.filter(o => o.fulfillment_status === 'fulfilled');
  
  return {
    totalOrders: orders.length,
    totalRevenue: total.toFixed(2),
    paidCount: paid.length,
    pendingCount: pending.length,
    fulfilledCount: fulfilled.length,
    unfulfilledCount: orders.length - fulfilled.length
  };
}

// Agent 定义
export const shopifyAgent = {
  id: 'shopify',
  name: '🛒 Shopify 助手',
  role: 'Shopify 店铺运营',
  description: 'Shopify 订单管理、发货通知、询盘处理',
  systemPrompt: `# 角色：Shopify 店铺运营专家

你专精于 Shopify 店铺管理：

## 核心功能
1. **订单管理** — 获取订单列表、查看订单详情、处理退款
2. **发货通知** — 生成专业发货邮件、批量通知
3. **询盘处理** — 分析 B2B 订单、识别高价值客户
4. **商品管理** — 查看商品列表、库存状态

## API 配置
需在 config.js 中配置：
{
  shopify: {
    storeUrl: 'your-store.myshopify.com',
    accessToken: 'shpat_xxxxx'
  }
}

## 工作流程
1. 获取订单 → 分析订单 → 生成通知/建议
2. 识别 B2B 订单 → 评估优先级 → 制定跟进策略

## 输出要求
- 订单信息清晰呈现
- 发货通知格式专业
- 询盘分析有具体建议`,
  
  // Agent 执行函数
  async execute(task, config) {
    const client = new ShopifyClient(config);
    const isMock = USE_MOCK || !config?.shopify?.accessToken;
    const orders = isMock ? mockOrders : null;

    // 意图识别
    const lower = task.toLowerCase();

    if (lower.includes('订单') || lower.includes('order')) {
      const status = lower.includes('待处理') || lower.includes('pending') ? 'pending' : 'any';
      let result;
      if (isMock) {
        result = { orders: status === 'pending' ? mockOrders.filter(o => o.financial_status === 'pending') : mockOrders };
      } else {
        result = await client.getOrders({ status });
      }
      const summary = summarizeOrders(result.orders || result);
      return {
        action: 'getOrders',
        data: result.orders || result,
        summary
      };
    }

    if (lower.includes('发货') || lower.includes('shipping') || lower.includes('追踪')) {
      const sampleOrder = orders ? orders[0] : await client.getOrders({ limit: 1 }).then(r => r.orders[0]);
      const tracking = {
        company: 'DHL',
        number: '1234567890',
        url: 'https://www.dhl.com/track',
        estimatedDays: 5
      };
      return {
        action: 'shippingNotification',
        notification: generateShippingNotification(sampleOrder, tracking),
        order: sampleOrder
      };
    }

    if (lower.includes('询盘') || lower.includes('inquiry') || lower.includes('分析')) {
      const toAnalyze = orders || mockOrders;
      const analyses = toAnalyze.map(o => analyzeOrderForInquiries(o));
      return {
        action: 'analyzeInquiries',
        analyses,
        highPriority: analyses.filter(a => a.priority === 'high'),
        summary: {
          total: analyses.length,
          highPriority: analyses.filter(a => a.priority === 'high').length,
          mediumPriority: analyses.filter(a => a.priority === 'medium').length
        }
      };
    }

    if (lower.includes('商品') || lower.includes('product')) {
      const products = isMock ? mockProducts : (await client.getProducts()).products;
      return {
        action: 'getProducts',
        products,
        count: products.length
      };
    }

    return {
      action: 'help',
      availableCommands: ['订单列表', '发货通知', '询盘分析', '商品列表'],
      note: '配置 shopify.accessToken 后可连接真实店铺'
    };
  }
};

export default shopifyAgent;
