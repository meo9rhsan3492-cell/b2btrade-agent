# Changelog

All notable changes to **B2Btrade Agent** are documented here.

## [1.1.0] - 2026-03-25

### 🎉 Major New Features

#### CRM 客户关系管理
- Full CRUD operations for clients (add/get/update/delete/archive)
- Interaction tracking (call/email/meeting/wechat)
- Reminder system with overdue detection and next-action scheduling
- Dashboard with pipeline revenue, stage distribution, A/B/C tier breakdown
- Data persisted to `~/.b2btrade-agent/crm/`

**New CLI commands:**
```
b2b crm list/add/get/update/interact/remind/reminders/dashboard
```

#### Email Sequence 邮件跟进序列
- 4 built-in templates: Cold Outreach / RFQ Follow-up / Trade Show / LinkedIn
- AI-powered email content generation for each sequence
- Day-based scheduling (Day1/3/7/14/25)
- CSV export for Gmail/email marketing tools
- Send log tracking

**New CLI commands:**
```
b2b sequence list/create/gen/export
```

#### Trade Show 展会全流程管理
- Pre-show competitive research (AI-generated)
- Badge/business card lead capture with quality rating (1-5)
- Post-show 72h task checklist
- Auto-create follow-up sequence from collected leads
- CSV export of all leads

**New CLI commands:**
```
b2b show list/add/lead/leads/export/scan/tasks
```

### ⚙️ Improvements

#### AI Layer (src/ai.js)
- Fixed rate limiter parameter bug in OpenAI calls
- Added request timeout (30s) with AbortController
- Added automatic retry on HTTP 429 (rate limit)
- Added `chatBatch()` for bulk parallel requests
- Added `fetchWithTimeout()` utility

#### Workflow Engine (src/workflows/index.js)
- Added 4th workflow: `competitor` (竞品监控 + 差异化策略 + 销售话术)
- Added progress bar animations
- Added Markdown file persistence to `~/.b2btrade-agent/output/`
- Better structured prompts with table formats

#### Compliance Module (src/utils/compliance.js) - NEW
- OFAC SDN sanctions screening (online + offline)
- High-risk country alerts (Iran/North Korea/Syria/Crimea/etc.)
- Risk verdicts: BLOCK / REVIEW / CAUTION / CLEAR
- Next-step recommendations per risk level

#### HS Code Module (src/utils/hscode.js) - NEW
- Built-in HS code database (30+ common codes)
- Export rebate rate lookup (出口退税率)
- Export duty rate lookup
- Control/restriction notes (出口许可证提示)
- Declaration element builder (申报要素)

#### Incoterms Calculator (src/utils/incoterms.js) - NEW
- Full Incoterms 2020 support: EXW/FOB/CFR/CIF/DAP/DDP
- Real freight estimates (20GP/40GP/40HQ/LCL)
- Insurance calculation (FOB × 0.5%)
- Duty and VAT estimation for DDP
- Per-unit price breakdown for each term

#### Quote Generator (src/utils/quote.js) - NEW
- Professional Proforma Invoice (PI) generation
- Markdown and HTML output formats
- Multi-product line items with HS codes
- Payment terms and delivery conditions
- Valid-until date

#### Search Tools (src/tools/search.js)
- Real DuckDuckGo search (no API key needed)
- Tavily AI search support (requires API key)
- LinkedIn profile search
- Demo data fallback when search unavailable

#### Configuration (src/config.js)
- `.env` file support with auto-load
- Environment variable override for JSON config
- Better API key setup prompts with provider-specific URLs

#### CLI (src/index.js)
- New command: `b2b status` - shows config, rate limiter status, output stats
- Updated banner: 19 agents
- Better help text with all new commands

#### Tests
- 27 unit tests now passing
- New search.test.js with real network tests

### 🐛 Bug Fixes
- `listAgents()` now properly exports all agent fields
- dotenv ESM import fixed for Node.js 18+
- Rate limiter `limiter` parameter now correctly passed to API calls
- `getDemoResults` properly exported for test suite

### 📦 Dependencies
- Added jest v29 (devDependency)
- Added dotenv v16 (dependency)

---

## [1.0.0] - 2026-03-23

Initial release.

- 19 Expert Agents (intelligence/content/growth/seo/social/rfq/sales/support/logistics/customs/negotiation/finance/linkedin/whatsapp/email/shopify/ali1688/tiktok/instagram)
- 3 Workflows (find-email / rfq-quote / market-research)
- Multi-model support (OpenAI / Anthropic Claude / Google Gemini / MiniMax)
- Rate limiting with token bucket algorithm
- Session history and statistics
- i18n support (zh_CN / en_US)
- MIT License
