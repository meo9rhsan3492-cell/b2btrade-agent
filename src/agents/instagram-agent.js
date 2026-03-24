/**
 * Instagram Agent - Instagram Graph API 集成
 *
 * 配置说明 (config.js 中添加):
 * instagram: {
 *   accessToken: 'your_facebook_page_access_token',  // Facebook Page Access Token
 *   instagramAccountId: 'your_instagram_account_id',  // Instagram Business Account ID
 *   facebookPageId: 'your_facebook_page_id'          // Facebook Page ID
 * }
 *
 * 获取方式:
 * 1. Facebook Developers → 创建应用 (类型: Business)
 * 2. 添加 Instagram Graph API 产品
 * 3. 配置 Instagram 商业账户绑定到 Facebook Page
 * 4. 在 Facebook Graph API Explorer 获取 Page Access Token
 * 5. 请求权限: pages_read_engagement, instagram_basic, instagram_content_publish, instagram_manage_comments
 *
 * API 文档: https://developers.facebook.com/docs/instagram-api/
 */

const USE_MOCK = process.env.INSTAGRAM_MOCK_MODE === 'true';

class InstagramClient {
  constructor(config) {
    this.accessToken = config?.instagram?.accessToken;
    this.igAccountId = config?.instagram?.instagramAccountId;
    this.pageId = config?.instagram?.facebookPageId;
    this.baseUrl = 'https://graph.facebook.com/v18.0';
  }

  async request(endpoint, params = {}) {
    if (!this.accessToken || !this.igAccountId) {
      throw new Error('Instagram 未配置。请在 config.js 中设置 instagram.accessToken 和 instagram.instagramAccountId');
    }
    const query = new URLSearchParams({ access_token: this.accessToken, ...params }).toString();
    const res = await fetch(`${this.baseUrl}${endpoint}?${query}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Instagram API Error: ${JSON.stringify(err)}`);
    }
    return res.json();
  }

  // 获取商业账户信息
  async getAccountInfo() {
    return this.request(`/${this.igAccountId}`, { fields: 'id,name,username,followers_count,follows_count,media_count,biography,website' });
  }

  // 获取媒体列表
  async getMedia(params = {}) {
    return this.request(`/${this.igAccountId}/media`, {
      fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
      limit: '20',
      ...params
    });
  }

  // 获取单条媒体详情
  async getMediaDetail(mediaId) {
    return this.request(`/${mediaId}`, {
      fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,username'
    });
  }

  // 获取 Insights
  async getInsights(mediaId) {
    return this.request(`/${mediaId}/insights`, { metric: 'impressions,reach,saved,video_views' });
  }

  // 获取评论
  async getComments(mediaId) {
    return this.request(`/${mediaId}/comments`, { fields: 'id,text,hidden,timestamp,username,like_count' });
  }

  // 发布图片 (需 Instagram Content Publishing API 审批)
  async publishImage(imageUrl, caption) {
    return this.request(`/${this.igAccountId}/media`, {
      image_url: imageUrl,
      caption,
      access_token: this.accessToken
    });
  }
}

// 模拟数据
const mockInsights = { impressions: 12500, reach: 9800, saved: 245, engagement: 3.2 };
const mockMedia = [
  { id: 'm1001', caption: 'Factory direct industrial tools! 🏭 Best quality at wholesale prices. DM for inquiries! #B2B #wholesale #tools', media_type: 'IMAGE', media_url: 'https://example.com/img1.jpg', permalink: 'https://instagram.com/p/m1001', timestamp: '2026-03-20T10:00:00Z', like_count: 234, comments_count: 18 },
  { id: 'm1002', caption: 'New arrival! Hydraulic pump units now in stock. Limited quantity available. 💪 #industrial #machinery #factory', media_type: 'IMAGE', media_url: 'https://example.com/img2.jpg', permalink: 'https://instagram.com/p/m1002', timestamp: '2026-03-18T14:30:00Z', like_count: 189, comments_count: 12 },
  { id: 'm1003', caption: 'Behind the scenes: Our QC team inspecting every unit before shipping. ✅ Quality is our top priority.', media_type: 'IMAGE', media_url: 'https://example.com/img3.jpg', permalink: 'https://instagram.com/p/m1003', timestamp: '2026-03-15T09:15:00Z', like_count: 312, comments_count: 25 },
  { id: 'm1004', caption: 'Thank you for 5000 followers! 🎉 To celebrate, we are offering 15% OFF all orders this week. Use code FOLLOW15!', media_type: 'IMAGE', media_url: 'https://example.com/img4.jpg', permalink: 'https://instagram.com/p/m1004', timestamp: '2026-03-10T16:00:00Z', like_count: 567, comments_count: 43 },
  { id: 'm1005', caption: 'Export shipment ready! Containers heading to Germany 🇩🇪 and UK 🇬🇧. Your trust drives us forward!', media_type: 'IMAGE', media_url: 'https://example.com/img5.jpg', permalink: 'https://instagram.com/p/m1005', timestamp: '2026-03-05T11:45:00Z', like_count: 298, comments_count: 21 },
];

const mockAccount = {
  id: 'ig178293746501',
  name: 'Industrial Tools Export Co.',
  username: 'industrial_export_co',
  followers_count: 5234,
  follows_count: 412,
  media_count: 5,
  biography: 'Factory direct B2B industrial tools 🏭\nExport worldwide 📦\nDM for wholesale inquiries',
  website: 'https://example.com'
};

/**
 * 生成图片描述 (AI增强)
 */
export function generateImageCaption(imageDescription, context = {}) {
  const hashtags = '#B2B #wholesale #manufacturing #export #factory #madeinchina #industrial #machinery';
  return {
    short: `${imageDescription}\n\n${hashtags.split(' ').slice(0, 5).join(' ')}`,
    engaging: `${imageDescription}\n\n🔥 Why this matters for your business:\n• Cost-effective sourcing solution\n• Quality guaranteed by QC team\n• Fast shipping worldwide\n\n${hashtags}`,
    professional: `${imageDescription}\n\nProduct Specifications:\n${context.specs || 'Contact us for detailed specifications.'}\n\nBusiness inquiries: DM or email info@example.com\n${hashtags}`
  };
}

/**
 * 生成推广文案
 */
export function generatePromotionText(product, locale = 'en') {
  const templates = {
    en: {
      banner: `🏭 ${product}\n\nDirect from factory | Wholesale prices\n📦 MOQ: varies\n💬 DM for catalog & pricing\n\n#B2B #wholesale #factory #export`,
      carousel: `🧵 Product Showcase: ${product}\n\nSlide 1️⃣ : Product overview\nSlide 2️⃣ : Quality inspection\nSlide 3️⃣ : Packaging\nSlide 4️⃣ : Shipping\nSlide 5️⃣ : Customer feedback\n\n💬 DM "CATALOG" for full product list!`,
      story: `📣 B2B Alert!\n\nLimited time: 10% OFF all inquiries this week!\n\n${product}\n\nComment "INFO" or DM us! 🚀`
    },
    zh: {
      banner: `🏭 ${product}\n\n工厂直供 | 批发价格\n📦 起订量: 按产品\n💬 私信获取目录和报价\n\n#B2B #批发 #工厂 #出口`,
      carousel: `🧵 产品展示: ${product}\n\n第1页: 产品概览\n第2页: 质检流程\n第3页: 包装\n第4页: 发货\n第5页: 客户反馈\n\n💬 回复"目录"获取完整产品列表！`,
      story: `📣 B2B商机提醒!\n\n本周特惠: 询盘即享9折!\n\n${product}\n\n留言"详情"或私信我们！🚀`
    }
  };
  return templates[locale] || templates.en;
}

/**
 * 格式化媒体数据
 */
export function formatMedia(media) {
  const date = new Date(media.timestamp).toLocaleDateString();
  const typeIcon = media.media_type === 'VIDEO' ? '🎬' : '🖼️';
  return `${typeIcon} ${date}\n❤️ ${media.like_count} 💬 ${media.comments_count}\n${media.caption?.slice(0, 80)}${media.caption?.length > 80 ? '...' : ''}\n🔗 ${media.permalink}`;
}

/**
 * 社交媒体报告
 */
export function generateSocialReport(account, media) {
  const totalLikes = media.reduce((s, m) => s + m.like_count, 0);
  const totalComments = media.reduce((s, m) => s + m.comments_count, 0);
  const avgEngagement = ((totalLikes + totalComments) / account.followers_count * 100).toFixed(1);
  return {
    followers: account.followers_count,
    posts: account.media_count,
    totalLikes,
    totalComments,
    avgEngagement: `${avgEngagement}%`,
    topPost: media.sort((a, b) => b.like_count - a.like_count)[0]
  };
}

// Agent 定义
export const instagramAgent = {
  id: 'instagram',
  name: '📸 Instagram 助手',
  role: 'Instagram 社媒运营',
  description: 'Instagram商业账户数据、图片描述、推广文案生成',

  systemPrompt: `# 角色：Instagram 社媒运营专家

你专精于 Instagram B2B 商业账户运营：

## 核心功能
1. **账户数据** — 获取粉丝数、发帖数据、Insights
2. **图片描述** — 基于图片内容生成多种风格的英文/中文描述
3. **推广文案** — Banner、Carousel、Story 等多种格式推广内容
4. **内容分析** — 识别高互动帖子、给出优化建议

## API 配置
需在 config.js 中配置：
{
  instagram: {
    accessToken: 'your_facebook_page_access_token',
    instagramAccountId: 'your_instagram_account_id',
    facebookPageId: 'your_facebook_page_id'
  }
}

## 权限说明
需申请以下权限：
- instagram_basic (读取账户信息)
- instagram_content_publish (发布内容)
- instagram_manage_comments (管理评论)

## 输出要求
- 文案有多种风格变体
- 包含合适的 hashtag
- 适合 B2B 工业品调性`,
  
  async execute(task, config) {
    const client = new InstagramClient(config);
    const isMock = USE_MOCK || !config?.instagram?.accessToken;
    const lower = task.toLowerCase();

    if (lower.includes('数据') || lower.includes('账户') || lower.includes('粉丝')) {
      const account = isMock ? mockAccount : await client.getAccountInfo();
      const media = isMock ? mockMedia : (await client.getMedia()).data || mockMedia;
      const report = generateSocialReport(account, media);
      return {
        action: 'getAccountData',
        account,
        media: media.map(m => ({ ...m, formatted: formatMedia(m) })),
        report,
        note: isMock ? '⚠️ 模拟数据' : ''
      };
    }

    if (lower.includes('描述') || lower.includes('caption') || lower.includes('文案')) {
      const sampleImage = 'Industrial drill bits set, stainless steel, various sizes, professional grade tools for manufacturing';
      const locale = lower.includes('中文') ? 'zh' : 'en';
      return {
        action: 'generateCaption',
        imageDescription: sampleImage,
        captions: generateImageCaption(sampleImage, { specs: 'Material: HSS | Sizes: 3-12mm | Coating: Titanium' }),
        tips: [
          '前125个字符最关键，会被截断显示',
          '使用相关 hashtag 增加曝光',
          'CTA (行动号召) 放在开头或结尾'
        ]
      };
    }

    if (lower.includes('推广') || lower.includes('promo') || lower.includes('营销')) {
      const product = 'CNC Machine Spare Parts';
      const locale = lower.includes('中文') ? 'zh' : 'en';
      return {
        action: 'generatePromotion',
        product,
        templates: generatePromotionText(product, locale),
        suggestions: [
          'Banner 格式适合 Feed 帖子',
          'Carousel 适合产品展示系列',
          'Story 格式适合限时促销',
          '建议配合限时优惠使用'
        ]
      };
    }

    if (lower.includes('帖子') || lower.includes('分析') || lower.includes('post')) {
      const media = mockMedia;
      const sorted = [...media].sort((a, b) => (b.like_count + b.comments_count) - (a.like_count + a.comments_count));
      return {
        action: 'analyzePosts',
        topPosts: sorted.slice(0, 3).map(m => formatMedia(m)),
        insights: {
          avgLikes: Math.round(media.reduce((s, m) => s + m.like_count, 0) / media.length),
          avgComments: Math.round(media.reduce((s, m) => s + m.comments_count, 0) / media.length),
          topHashtags: ['#B2B', '#wholesale', '#factory', '#export', '#manufacturing']
        },
        recommendations: [
          '发帖时间建议: 周二-四 9-11点 (目标市场时区)',
          '包含产品使用场景的帖子互动率更高',
          '定期发布工厂/质检内容增加信任感',
          '使用 8-15 个相关 hashtag'
        ]
      };
    }

    return {
      action: 'help',
      availableCommands: ['账户数据', '生成描述', '推广文案', '帖子分析'],
      note: '配置 instagram.accessToken 后可连接真实 Instagram API'
    };
  }
};

export default instagramAgent;
