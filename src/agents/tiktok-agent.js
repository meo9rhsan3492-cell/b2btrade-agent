/**
 * TikTok Shop Agent - TikTok Shop API 集成
 *
 * 配置说明 (config.js 中添加):
 * tiktok: {
 *   clientKey: 'your_client_key',         // TikTok App Client Key
 *   clientSecret: 'your_client_secret',   // TikTok App Client Secret
 *   shopId: 'your_shop_id',              // TikTok Shop ID
 *   accessToken: 'your_access_token'      // Shop API Access Token
 * }
 *
 * 获取方式:
 * 1. TikTok Shop Seller Center → Partner Platform → 创建应用
 * 2. 申请所需权限 (product:write, order:read 等)
 * 3. 获取 Client Key + Secret，通过 OAuth 获取 Access Token
 * 4. 填写 Shop ID (Seller Center → 账户设置 → 基本信息)
 *
 * API 文档: https://partner.tiktokshop.com/
 */

const USE_MOCK = process.env.TIKTOK_MOCK_MODE === 'true';

class TikTokClient {
  constructor(config) {
    this.clientKey = config?.tiktok?.clientKey;
    this.clientSecret = config?.tiktok?.clientSecret;
    this.shopId = config?.tiktok?.shopId;
    this.accessToken = config?.tiktok?.accessToken;
    this.baseUrl = 'https://open.tiktokshop.com';
  }

  get headers() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'x-tts-access-token': this.accessToken || '',
      'x-tts-shop-id': this.shopId || ''
    };
  }

  async request(endpoint, options = {}) {
    if (!this.clientKey || !this.accessToken) {
      throw new Error('TikTok Shop 未配置。请在 config.js 中设置 tiktok.clientKey 和 tiktok.accessToken');
    }
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: { ...this.headers, ...options.headers }
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`TikTok Shop API Error ${res.status}: ${err}`);
    }
    return res.json();
  }

  async getProducts(params = {}) {
    return this.request('/api/v2/product/list', { method: 'GET', query: { ...params } });
  }

  async getProduct(productId) {
    return this.request(`/api/v2/product/detail?product_id=${productId}`);
  }

  async getOrders(params = {}) {
    return this.request('/api/v2/order/list', {
      method: 'GET',
      query: { page_size: 50, ...params }
    });
  }

  async getOrder(orderId) {
    return this.request(`/api/v2/order/detail?order_id=${orderId}`);
  }
}

const mockProducts = [
  { id: 'p700001', title: 'Mini Portable Electric Drill Set', price: 24.99, status: 'active', stock: 500, sales: 2340, rating: 4.6 },
  { id: 'p700002', title: 'LED Ring Light 18 inch for Live', price: 35.99, status: 'active', stock: 200, sales: 1850, rating: 4.8 },
  { id: 'p700003', title: 'Wireless Bluetooth Earbuds Pro', price: 29.99, status: 'active', stock: 800, sales: 5200, rating: 4.5 },
  { id: 'p700004', title: 'Portable Handheld Steamer', price: 38.99, status: 'draft', stock: 0, sales: 0, rating: 0 },
  { id: 'p700005', title: 'Smart Fitness Tracker Band', price: 22.99, status: 'active', stock: 350, sales: 980, rating: 4.3 },
];

const mockOrders = [
  { id: 'o500001', create_time: '2026-03-22T08:30:00Z', status: 'to_ship', total_amount: 59.98, item_count: 2, buyer: 'user_***' },
  { id: 'o500002', create_time: '2026-03-22T11:15:00Z', status: 'shipped', total_amount: 24.99, item_count: 1, buyer: 'user_***' },
  { id: 'o500003', create_time: '2026-03-23T09:00:00Z', status: 'pending', total_amount: 89.97, item_count: 3, buyer: 'user_***' },
  { id: 'o500004', create_time: '2026-03-23T14:30:00Z', status: 'to_ship', total_amount: 35.99, item_count: 1, buyer: 'user_***' },
  { id: 'o500005', create_time: '2026-03-24T07:45:00Z', status: 'delivered', total_amount: 64.98, item_count: 2, buyer: 'user_***' },
];

function generateProductDescription(product, locale = 'en') {
  const en = {
    short: `✨ ${product.title}\n💰 Price: $${product.price}\n📦 Free Shipping\n⭐ Rating: ${product.rating}/5.0 (${product.sales}+ sold)`,
    full: `✨ ${product.title}\n\n🔥 Why You'll Love It:\n• Premium quality materials\n• Easy to use, perfect for beginners\n• Great value for money\n\n💰 Price: $${product.price}\n📦 Free Shipping\n⭐ ${product.rating}/5.0 (${product.sales}+ happy customers)\n\n🛒 Order Now! Limited Stock!`,
    livestream: `🔥 LIVE SPECIAL 🔥\n\n${product.title}\n\n💰 JUST $${product.price}!\n\n⏰ Running out fast!\n💬 Comment "BUY" to order!\n\nThis is going fast! Don't miss out! 🛒`
  };
  const zh = {
    short: `✨ ${product.title}\n💰 价格: $${product.price}\n📦 免费配送\n⭐ 评分: ${product.rating}/5.0 (${product.sales}+ 已售)`,
    full: `✨ ${product.title}\n\n🔥 推荐理由:\n• 优质材料，耐用实用\n• 操作简单，适合新手\n• 性价比超高\n\n💰 价格: $${product.price}\n📦 免费配送\n⭐ ${product.rating}/5.0 (${product.sales}+ 好评)\n\n🛒 立即下单！库存有限！`,
    livestream: `🔥 直播专属价 🔥\n\n${product.title}\n\n💰 仅需 $${product.price}！\n\n⏰ 库存告急！\n💬 留言"想要"立即抢购！\n\n手慢无！快来下单吧！🛒`
  };
  return { ...en, ...zh }[locale] || en;
}

function formatOrder(order) {
  const statusMap = {
    pending: '⏳ 待处理', to_ship: '📦 待发货',
    shipped: '🚚 已发货', delivered: '✅ 已送达', cancelled: '❌ 已取消'
  };
  return `${statusMap[order.status] || order.status} 订单 #${order.id}\n💰 金额: $${order.total_amount}\n📦 件数: ${order.item_count}\n🛒 买家: ${order.buyer}\n📅 时间: ${new Date(order.create_time).toLocaleDateString()}`;
}

export const tiktokAgent = {
  id: 'tiktok',
  name: '🎵 TikTok Shop 助手',
  role: 'TikTok Shop 运营',
  description: 'TikTok Shop 商品管理、订单处理、产品描述生成',

  systemPrompt: `# 角色：TikTok Shop 运营专家

你专精于 TikTok Shop 电商运营：

## 核心功能
1. **商品管理** — 获取商品列表、查看库存、监控销售
2. **订单处理** — 查看订单状态、批量发货、异常处理
3. **内容生成** — 生成产品描述、直播话术、推广文案
4. **数据分析** — 订单统计、销售排行

## API 配置
需在 config.js 中配置：
{
  tiktok: {
    clientKey: 'your_client_key',
    clientSecret: 'your_client_secret',
    shopId: 'your_shop_id',
    accessToken: 'your_access_token'
  }
}

## 输出要求
- 数据清晰呈现
- 文案适合TikTok风格（简洁、有冲击力）
- 给出具体行动建议`,

  async execute(task, config) {
    const client = new TikTokClient(config);
    const isMock = USE_MOCK || !config?.tiktok?.clientKey;
    const lower = task.toLowerCase();

    if (lower.includes('商品') || lower.includes('product')) {
      const products = isMock ? mockProducts : (await client.getProducts()).data?.products || mockProducts;
      return {
        action: 'getProducts',
        products,
        summary: {
          total: products.length,
          active: products.filter(p => p.status === 'active').length,
          draft: products.filter(p => p.status === 'draft').length,
          totalSales: products.reduce((s, p) => s + p.sales, 0)
        }
      };
    }

    if (lower.includes('订单') || lower.includes('order')) {
      const orders = isMock ? mockOrders : (await client.getOrders()).data?.orders || mockOrders;
      const statusCounts = {};
      let totalRevenue = 0;
      orders.forEach(o => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
        totalRevenue += parseFloat(o.total_amount);
      });
      return {
        action: 'getOrders',
        orders: orders.map(o => ({ ...o, formatted: formatOrder(o) })),
        summary: { statusCounts, totalRevenue: totalRevenue.toFixed(2), orderCount: orders.length }
      };
    }

    if (lower.includes('描述') || lower.includes('文案') || lower.includes('推广')) {
      const product = mockProducts[0];
      const locale = lower.includes('中文') ? 'zh' : 'en';
      return {
        action: 'generateDescription',
        product,
        descriptions: {
          short: generateProductDescription(product, locale),
          full: generateProductDescription(product, locale),
          livestream: generateProductDescription(product, locale)
        },
        tips: [
          '短描述用于商品卡片，15字以内为佳',
          '完整描述用于详情页，可包含卖点和使用场景',
          '直播话术要简洁有力，营造紧迫感'
        ]
      };
    }

    if (lower.includes('直播') || lower.includes('脚本')) {
      const products = mockProducts.filter(p => p.status === 'active');
      return {
        action: 'generatePromoContent',
        products,
        scripts: products.map(p => ({
          product: p.title,
          price: `$${p.price}`,
          script: generateProductDescription(p, 'en').livestream
        })),
        suggestions: [
          '直播开场先介绍主打爆款',
          '每10分钟换一款产品讲解',
          '库存紧张时使用倒计时促销',
          '结尾呼吁关注和分享'
        ]
      };
    }

    return {
      action: 'help',
      availableCommands: ['商品列表', '订单列表', '生成描述', '直播文案'],
      note: '配置 tiktok.clientKey 后可连接真实 TikTok Shop API'
    };
  }
};

export default tiktokAgent;
