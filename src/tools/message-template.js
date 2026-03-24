/**
 * B2Btrade-agent 消息模板引擎
 * 支持变量替换、多语言、语气控制
 */

import chalk from 'chalk';

/**
 * 支持的语言
 */
export const SUPPORTED_LANGUAGES = {
  zh: '中文',
  en: 'English',
  ar: 'العربية (阿拉伯语)',
  es: 'Español (西班牙语)',
  fr: 'Français (法语)',
  pt: 'Português (葡萄牙语)',
  ru: 'Русский (俄语)',
  de: 'Deutsch (德语)',
  ja: '日本語',
  ko: '한국어'
};

/**
 * 支持的语气
 */
export const TONES = {
  formal: '正式',
  friendly: '友好',
  concise: '简洁'
};

/**
 * 默认变量
 */
const DEFAULT_VARS = {
  name: '',
  company: '',
  product: '',
  language: 'zh',
  sender_name: '',
  sender_company: '',
  sender_email: '',
  sender_phone: '',
  date: new Date().toLocaleDateString('zh-CN'),
  year: new Date().getFullYear().toString()
};

/**
 * WhatsApp 消息模板库
 */
const whatsappTemplates = {
  formal: {
    zh: [
      '您好 {{name}}，我是{{sender_name}}，来自{{sender_company}}。我们专注于{{product}}领域多年，希望能与贵司{{company}}建立合作关系。如您方便，欢迎添加我的WhatsApp详谈。',
      'Dear {{name}}, This is {{sender_name}} from {{sender_company}}. We have been specialized in {{product}} for many years. We would be honored to establish a business relationship with {{company}}. Looking forward to your reply.'
    ],
    en: [
      'Dear {{name}}, This is {{sender_name}} from {{sender_company}}. We specialize in {{product}} and have been serving clients globally for many years. We would be honored to explore business cooperation with {{company}}. Please feel free to add me on WhatsApp for further discussion.',
      'Hello {{name}}, {{sender_name}} from {{sender_company}} reaching out. We noticed {{company}} may have needs in {{product}}. Our company has 10+ years experience in this field. I would love to connect and share how we can add value to your business.'
    ],
    ar: [
      'مرحباً {{name}}، أنا {{sender_name}} من {{sender_company}}. متخصصون في {{product}} منذ سنوات عديدة. يسعدنا التعاون مع شركة {{company}}. يرجى التواصل عبر الواتساب لمناقشة التفاصيل.',
      'السلام عليكم {{name}}، أنا {{sender_name}} من شركة {{sender_company}}. نتطلع إلى التعاون مع شركة {{company}} في مجال {{product}}. نتطلع لردكم.'
    ],
    es: [
      'Estimado/a {{name}}, soy {{sender_name}} de {{sender_company}}. Nos especializamos en {{product}} durante muchos años. Sería un honor establecer una relación comercial con {{company}}. No dude en contactarme por WhatsApp.',
      'Hola {{name}}, soy {{sender_name}} de {{sender_company}}. He notado que {{company}} podría estar interesado/a en {{product}}. Me gustaría conectar y explorar cómo podemos cooperar.'
    ],
    fr: [
      'Bonjour {{name}}, je suis {{sender_name}} de {{sender_company}}. Nous sommes spécialisés dans {{product}} depuis de nombreuses années. Ce serait un honneur d\'établir une relation commerciale avec {{company}}. N\'hésitez pas à me contacter sur WhatsApp.',
      'Bonjour {{name}}, {{sender_name}} de {{sender_company}} vous contacte. Notre entreprise a une longue expérience dans {{product}} et nous serions ravis de collaborer avec {{company}}. Sur WhatsApp pour plus de détails.'
    ],
    pt: [
      'Caro/a {{name}}, sou {{sender_name}} da {{sender_company}}. Especializamo-nos em {{product}} por muitos anos. Seria uma honra estabelecer uma relação comercial com {{company}}. Sinta-se à vontade para me contatar no WhatsApp.'
    ],
    ru: [
      'Уважаемый/ая {{name}}, я {{sender_name}} из {{sender_company}}. Мы специализируемся на {{product}} уже много лет. Буду рад сотрудничеству с {{company}}. Свяжитесь со мной в WhatsApp для обсуждения деталей.'
    ],
    de: [
      'Sehr geehrte/r {{name}}, mein Name ist {{sender_name}} von {{sender_company}}. Wir sind seit vielen Jahren auf {{product}} spezialisiert. Es wäre uns eine Ehre, eine Geschäftsbeziehung mit {{company}} aufzubauen. Kontaktieren Sie mich gerne auf WhatsApp.'
    ],
    ja: [
      '{{name}}様、初めまして。{{sender_company}}の{{sender_name}}と申します。私たちは{{product}}の専門分野において長年の経験がございます。{{company}}様とのビジネスパートナーシップを築戴きたく、ご連絡いたしました。WhatsAppにて詳細をご確認ください。'
    ],
    ko: [
      '안녕하세요 {{name}}님, 저는 {{sender_company}}의 {{sender_name}}입니다. 우리 회사는 {{product}} 분야에서 다년간의 경험을 보유하고 있습니다. {{company}}사와 비즈니스 관계를 수립하게 되어 기쁘게 생각합니다. WhatsApp으로 자세히 이야기 나눠요.'
    ]
  },
  friendly: {
    zh: [
      '嗨 {{name}}！我是{{sender_name}} 😊 {{company}}最近还好吗？我们是做{{product}}的，想说如果有需要可以聊聊，说不定能帮上忙！加我WhatsApp吧～',
      '{{name}}你好呀！看到{{company}}在找供应商？我们专做{{product}}，质量和价格都很不错哦～加我WhatsApp给你发详细资料！'
    ],
    en: [
      'Hey {{name}}! This is {{sender_name}} from {{sender_company}}. I noticed {{company}} and thought — hey, we might be a great fit! We do {{product}} and would love to show you what we\'ve got. Let\'s chat on WhatsApp!',
      'Hi {{name}}! Hope you\'re doing well! Just wanted to reach out — we\'re specialists in {{product}} and think {{company}} could benefit from what we offer. WhatsApp? 😊'
    ],
    ar: [
      'مرحباً {{name}}! أنا {{sender_name}} من {{sender_company}}. أتمنى أن تكون بخير! لاحظت شركة {{company}} وفكرت أنه يمكننا التعاون! نحن متخصصون في {{product}}. هيا نتحدث على الواتساب!'
    ],
    es: [
      '¡Hola {{name}}! Soy {{sender_name}} de {{sender_company}}. ¡Espero que estés bien! Vi a {{company}} y pensé que podríamos ser un gran equipo. Somos especialistas en {{product}}. ¿Hablamos por WhatsApp? 😊'
    ],
    fr: [
      'Salut {{name}}! Je suis {{sender_name}} de {{sender_company}}. J\'espère que tu vas bien ! On s\'est dit que {{company}} et nous, ça pourrait bien matcher ! On fait {{product}}. On se capte sur WhatsApp ? 😊'
    ],
    pt: [
      'Oi {{name}}! Sou {{sender_name}} da {{sender_company}}. Espero que você esteja bem! Vi {{company}} e pensei que poderíamos ser um ótimo encaixe! Somos especialistas em {{product}}. Vamos conversar no WhatsApp? 😊'
    ],
    ru: [
      'Привет {{name}}! Я {{sender_name}} из {{sender_company}}. Надеюсь, у тебя всё хорошо! Увидел {{company}} и подумал — мы могли бы отлично сработаться! Мы специализируемся на {{product}}. Давай обсудим в WhatsApp? 😊'
    ],
    de: [
      'Hey {{name}}! Ich bin {{sender_name}} von {{sender_company}}. Ich hoffe, es geht dir gut! Ich habe {{company}} gesehen und dachte — wir könnten ein großartiges Team sein! Wir sind spezialisiert auf {{product}}. Lass uns auf WhatsApp chatten! 😊'
    ],
    ja: [
      'やあ{{name}}！{{sender_company}}の{{sender_name}}です！お元気にしていますか？{{company}}さんを見て我们需要合作できるかも！{{product}}が得意なんです。WhatsAppでチャットしましょう！😊'
    ],
    ko: [
      '안녕 {{name}}! {{sender_company}}의 {{sender_name}}이에요! 잘 지내고 계신가요? {{company}}를 보고 우리는 잘 맞을 것 같다는 생각이 들었어요! 우리가 {{product}} 전문이거든요. WhatsApp에서 이야기해요! 😊'
    ]
  },
  concise: {
    zh: [
      '{{name}}，我是{{sender_name}}，做{{product}}的。加WhatsApp详谈。',
      'Hi {{name}}，{{company}}，我们有{{product}}，加我WhatsApp详谈。'
    ],
    en: [
      '{{name}} here from {{sender_company}}. We do {{product}}. Quick WhatsApp chat?',
      'Hi {{name}}, {{sender_name}} @ {{sender_company}} — {{product}} specialist. WhatsApp for quick intro.'
    ],
    ar: [
      '{{name}}، أنا {{sender_name}} من {{sender_company}}. متخصصون في {{product}}. الواتساب؟'
    ],
    es: [
      '{{name}} de {{sender_company}}. Especialistas en {{product}}. ¿WhatsApp?'
    ],
    fr: [
      '{{name}}, {{sender_company}}. Spécialistes en {{product}}. WhatsApp ?'
    ],
    pt: [
      '{{name}} da {{sender_company}}. Especialistas em {{product}}. WhatsApp?'
    ],
    ru: [
      '{{name}} из {{sender_company}}. Специализируемся на {{product}}. WhatsApp?'
    ],
    de: [
      '{{name}} von {{sender_company}}. Spezialisiert auf {{product}}. WhatsApp?'
    ],
    ja: [
      '{{name}}、{{sender_company}}の{{sender_name}}です。{{product}}の件、WhatsAppで話しましょう。'
    ],
    ko: [
      '{{name}}님, {{sender_company}}의 {{sender_name}}입니다. {{product}}専門です。WhatsApp으로 말씀해 주세요.'
    ]
  }
};

/**
 * Email 消息模板库
 */
const emailTemplates = {
  formal: {
    zh: [
      {
        subject: '关于{{product}}的合作咨询 - {{company}}',
        body: `尊敬的 {{name}}，

您好！

我是 {{sender_name}}，来自 {{sender_company}}。我们专注于{{product}}领域多年，致力于为全球客户提供优质的产品和服务。

贵司{{company}}在业内享有良好声誉，我们非常希望能与贵司建立长期稳定的合作关系。

如您方便，我希望能安排一次电话沟通或视频会议，详细介绍我们的产品线和合作方案。

期待您的回复。

此致
敬礼

{{sender_name}}
{{sender_company}}
邮箱：{{sender_email}}
{{date}}`
      }
    ],
    en: [
      {
        subject: 'Business Inquiry: {{product}} Cooperation with {{company}}',
        body: `Dear {{name}},

I hope this email finds you well.

My name is {{sender_name}}, representing {{sender_company}}. We have been specializing in {{product}} for many years and have established long-term partnerships with clients globally.

We have been impressed by {{company}}'s reputation in the industry and believe that a collaboration would be mutually beneficial.

I would be delighted to arrange a call or video meeting at your convenience to discuss our product range and cooperation opportunities in detail.

Looking forward to your response.

Best regards,

{{sender_name}}
{{sender_company}}
Email: {{sender_email}}
Date: {{date}}`
      }
    ],
    ar: [
      {
        subject: 'استفسار تجاري: التعاون في {{product}} مع {{company}}',
        body: `السيد/ة {{name}} المحترم/ة،

تحية طيبة وبعد،

اسمي {{sender_name}} من شركة {{sender_company}}. نتخصص في مجال {{product}} منذ سنوات عديدة.

تعرفنا على شركة {{company}} ونرى أن التعاون سيكون مفيداً للطرفين. نرجو تحديد موعد لاتصال هاتفي أو اجتماع فيديو.

نتطلع لردكم.

مع التقدير،

{{sender_name}}
{{sender_company}}
البريد الإلكتروني: {{sender_email}}
التاريخ: {{date}}`
      }
    ],
    es: [
      {
        subject: 'Consulta Comercial: Cooperación en {{product}} con {{company}}',
        body: `Estimado/a {{name}},

Reciba un cordial saludo.

Mi nombre es {{sender_name}}, representante de {{sender_company}}. Nos especializamos en {{product}} durante muchos años.

Hemos conocido la reputación de {{company}} en la industria y creemos que una colaboración sería mutuamente beneficiosa.

Quedo atento/a a su respuesta.

Atentamente,

{{sender_name}}
{{sender_company}}
Correo electrónico: {{sender_email}}
Fecha: {{date}}`
      }
    ],
    fr: [
      {
        subject: 'Demande de coopération: {{product}} avec {{company}}',
        body: `Monsieur/Madame {{name}},

Je vous prie d'agréer mes salutations distinguées.

Je m'appelle {{sender_name}}, représentant {{sender_company}}. Nous sommes spécialisés dans {{product}} depuis de nombreuses années.

La réputation de {{company}} dans l'industrie nous a impressionnés et nous croyons qu'une collaboration serait mutuellement bénéfique.

Dans l'attente de votre réponse.

Cordialement,

{{sender_name}}
{{sender_company}}
E-mail: {{sender_email}}
Date: {{date}}`
      }
    ],
    pt: [
      {
        subject: 'Consulta Comercial: Cooperação em {{product}} com {{company}}',
        body: `Prezado/a {{name}},

Cumprimentos.

Meu nome é {{sender_name}}, representante da {{sender_company}}. Especializamo-nos em {{product}} por muitos anos.

Conhecemos a reputação da {{company}} no setor e acreditamos que uma colaboração seria mutuamente benéfica.

Aguardo seu retorno.

Atenciosamente,

{{sender_name}}
{{sender_company}}
E-mail: {{sender_email}}
Data: {{date}}`
      }
    ],
    ru: [
      {
        subject: 'Деловой запрос: Сотрудничество по {{product}} с {{company}}',
        body: `Уважаемый/ая {{name}},

Меня зовут {{sender_name}}, представляю компанию {{sender_company}}. Мы специализируемся на {{product}} уже много лет.

Репутация компании {{company}} в отрасли произвела на нас впечатление, и мы верим, что сотрудничество будет взаимовыгодным.

С нетерпением жду вашего ответа.

С уважением,

{{sender_name}}
{{sender_company}}
E-mail: {{sender_email}}
Дата: {{date}}`
      }
    ],
    de: [
      {
        subject: 'Geschäftliche Anfrage: Zusammenarbeit bei {{product}} mit {{company}}',
        body: `Sehr geehrte/r {{name}},

ich heiße {{sender_name}} und vertrete {{sender_company}}. Wir sind seit vielen Jahren auf {{product}} spezialisiert.

Der Ruf von {{company}} in der Branche hat uns beeindruckt, und wir glauben, dass eine Zusammenarbeit für beide Seiten von Vorteil wäre.

Ich freue mich auf Ihre Antwort.

Mit freundlichen Grüßen,

{{sender_name}}
{{sender_company}}
E-mail: {{sender_email}}
Datum: {{date}}`
      }
    ],
    ja: [
      {
        subject: '{{product}}に関する{{company}}様との事業提携について',
        body: `{{name}}様

お世話になっております。

{{sender_company}}の{{sender_name}}と申します。私たちは{{product}}の専門において長年の経験がございます。

{{company}}様の業界的評価を見聞きし、ぜひお手伝いしたいと考えております。お電話またはテレビ会議にて詳しくご提案できれば幸いです。

ご検討のほど、よろしくお願いいたします。

{{sender_name}}
{{sender_company}}
メール：{{sender_email}}
{{date}}`
      }
    ],
    ko: [
      {
        subject: '{{product}} 관련 {{company}}사와의 사업 협력 문의',
        body: `{{name}}님께

안녕하십니까.

{{sender_company}}의 {{sender_name}}입니다. 저희는 {{product}} 분야에서 다년간의 풍부한 경험을 보유하고 있습니다.

{{company}}님의 업계 내 평판을 잘 알고 있으며, 협력 관계를 맺었으면 합니다. 전화 통화나 화상 회의 시간을 정해 상세한 이야기를 나누고 싶습니다.

감사합니다.

{{sender_name}}
{{sender_company}}
이메일: {{sender_email}}
{{date}}`
      }
    ]
  },
  friendly: {
    zh: [
      {
        subject: '【合作机会】{{product}}供应商推荐 - {{company}}',
        body: `嗨 {{name}}！

希望这封邮件让你的一天更美好 😊

我是{{sender_name}}，来自{{sender_company}}。我们做{{product}}已经很多年了，一直在帮各种规模的公司找到靠谱的供应商。

看到{{company}}在这个领域做得很好，就想着——说不定我们能帮上忙呢！

我们的一些优势：
• 工厂直销，价格有竞争力
• 质量认证齐全（CE/ISO/UL等）
• 支持小批量定制

不强制回复，但如果感兴趣的话，随时加我微信或者回复这封邮件都行！

祝好！
{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    en: [
      {
        subject: 'A Quick Note About {{product}} — Great Fit for {{company}}?',
        body: `Hey {{name}}!

Hope you're having an awesome day! 🎉

I'm {{sender_name}} from {{sender_company}}. We've been in the {{product}} game for years, helping companies like yours find exactly what they need — without the usual headaches.

When I came across {{company}}, I thought — this could be a great match!

What makes us different:
✓ Factory-direct pricing
✓ Full quality certifications (CE, ISO, UL...)
✓ Small MOQ available, flexible customization

No pressure at all — just thought it'd be worth a quick chat. Reply here or WhatsApp me anytime!

Cheers,
{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    ar: [
      {
        subject: 'فرصة تعاون: {{product}} — هل {{company}} مهتمة؟',
        body: `مرحباً {{name}}!

نتمنى لك يوماً رائعاً! 🎉

أنا {{sender_name}} من {{sender_company}}. نتخصص في {{product}} منذ سنوات.

عندما علمت عن {{company}}، فكرت أنها ستكون مناسبة كبيرة!

مميزاتنا:
✓ أسعار مباشرة من المصنع
✓ شهادات جودة كاملة
✓ طلب مينيموم مرن

لا ضغط على الإطلاق. راسلني على الواتساب!

تحياتي،
{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    es: [
      {
        subject: '¡Una Oportunidad de Cooperación en {{product}}!',
        body: `¡Hola {{name}}!

¡Espero que tengas un día increíble! 🎉

Soy {{sender_name}} de {{sender_company}}. Llevamos años en el mundo de {{product}}, ayudando a empresas como la tuya.

Cuando conocí {{company}}, pensé que podríamos ser un gran match!

Lo que nos diferencia:
✓ Precios directos de fábrica
✓ Certificaciones de calidad completas
✓ MOQ flexible disponible

Sin compromiso — simplemente pensé que valía la pena una conversación rápida. ¡Escríbeme aquí o por WhatsApp!

¡Saludos!
{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    fr: [
      {
        subject: 'Une Opportunité de Coopération en {{product}}!',
        body: `Salut {{name}}!

J'espère que tu passes une super journée! 🎉

Je suis {{sender_name}} de {{sender_company}}. On est dans le domaine du {{product}} depuis des années, en aidant des entreprises comme la tienne.

Quand j'ai connu {{company}}, j'ai pensé que ça pourrait bien matcher!

Ce qui nous distingue:
✓ Prix directs-usine
✓ Certifications qualité complètes
✓ MOQ flexible disponible

Sans engagement — je me suis dit que ça valait le coup d'en discuter. Réponds-moi ici ou sur WhatsApp!

À bientôt,
{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    pt: [
      {
        subject: 'Uma Oportunidade de Cooperação em {{product}}!',
        body: `Olá {{name}}!

Espero que esteja tendo um dia incrível! 🎉

Sou {{sender_name}} da {{sender_company}}. Estamos no ramo de {{product}} há anos.

Quando conheci a {{company}}, pensei que poderia ser uma ótima combinação!

O que nos diferencia:
✓ Preços direto da fábrica
✓ Certificações de qualidade completas
✓ MOQ flexível disponível

Sem compromisso — só achei que valia a pena uma conversa rápida. Me escreva aqui ou no WhatsApp!

Abraços,
{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    ru: [
      {
        subject: 'Возможность сотрудничества: {{product}}',
        body: `Привет {{name}}!

Надеюсь, у тебя отличный день! 🎉

Я {{sender_name}} из {{sender_company}}. Мы работаем в сфере {{product}} уже много лет.

Когда я узнал о {{company}}, подумал — это могло бы быть отличным совпадением!

Чем мы отличаемся:
✓ Цены напрямую от завода
✓ Полные сертификаты качества
✓ Гибкий минимальный заказ

Без обязательств — просто подумал, что стоит поговорить. Напишите мне здесь или в WhatsApp!

С уважением,
{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    de: [
      {
        subject: 'Eine Kooperationsmöglichkeit: {{product}}!',
        body: `Hey {{name}}!

Hoffe, du hast einen tollen Tag! 🎉

Ich bin {{sender_name}} von {{sender_company}}. Wir sind seit Jahren im Bereich {{product}} tätig.

Als ich von {{company}} erfuhr, dachte ich — das könnte ein tolles Match sein!

Was uns auszeichnet:
✓ Direkte Preise ab Werk
✓ Vollständige Qualitätszertifizierungen
✓ Flexible Mindestbestellmenge

Unverbindlich — ich dachte nur, es lohnt sich ein kurzes Gespräch. Schreibe mir hier oder auf WhatsApp!

Viele Grüße,
{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    ja: [
      {
        subject: '【ご提案】{{product}}の協力機会',
        body: `こんにちは {{name}}さん！

いい一日を過ごしていますか？🎉

{{sender_company}}の{{sender_name}}です。{{product}}の專業で何年も活动和しています。

{{company}}さんとお手伝いできるかもしれないと思い、ご連絡いたしました！

私たちの強み：
✓ 工場直送、价格競争力
✓ 品質認証取得済み
✓ 小ロット対応可

 부담 없이 WhatsApp或者はこのメールに返信してくださいね！

よろしくお願いいたします、
{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    ko: [
      {
        subject: '【제안】{{product}} 협력 기회',
        body: `안녕하세요 {{name}}님!

오늘 좋은 하루 보내고 계신가요? 🎉

{{sender_company}}의 {{sender_name}}입니다. {{product}} 분야에서 여러 해 동안 활동해 왔습니다.

{{company}}님과 도움을 드릴 수 있을 것 같아 연락드립니다!

우리의 강점：
✓ 공장 직송 가격 경쟁력
✓ 품질 인증齐全
✓ 소량 주문 가능

 부담 없이 WhatsApp이나 이 메일로 편하게 연락주세요!

감사합니다,
{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
{{date}}`
      }
    ]
  },
  concise: {
    zh: [
      {
        subject: '{{product}}供应商 - {{company}}',
        body: `{{name}}，

{{sender_name}}，{{sender_company}}，专做{{product}}。
如有需要可加微信或回复邮件。
期待合作！
{{sender_name}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    en: [
      {
        subject: '{{product}} Supplier for {{company}}',
        body: `{{name}},

{{sender_name}} from {{sender_company}} — specialists in {{product}}.

If you have any needs, feel free to reply or add me on WhatsApp.

Best,
{{sender_name}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    ar: [
      {
        subject: 'مورد {{product}} لشركة {{company}}',
        body: `{{name}}،

{{sender_name}} من {{sender_company}} — متخصصون في {{product}}.

إذا كانت لديكم أي احتياجات، لا تتردد في الرد.

مع التحية،
{{sender_name}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    es: [
      {
        subject: 'Proveedor de {{product}} para {{company}}',
        body: `{{name}},

{{sender_name}} de {{sender_company}} — especialistas en {{product}}.

Si tiene alguna necesidad, no dude en responder.

Saludos,
{{sender_name}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    fr: [
      {
        subject: 'Fournisseur de {{product}} pour {{company}}',
        body: `{{name}},

{{sender_name}} de {{sender_company}} — spécialistes de {{product}}.

Si vous avez des besoins, n'hésitez pas à répondre.

Cordialement,
{{sender_name}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    pt: [
      {
        subject: 'Fornecedor de {{product}} para {{company}}',
        body: `{{name}},

{{sender_name}} da {{sender_company}} — especialistas em {{product}}.

Se tiver alguma necessidade, não hesite em responder.

Atenciosamente,
{{sender_name}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    ru: [
      {
        subject: 'Поставщик {{product}} для {{company}}',
        body: `{{name}},

{{sender_name}} из {{sender_company}} — специалисты по {{product}}.

Если у вас есть потребности, не стесняйтесь отвечать.

С уважением,
{{sender_name}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    de: [
      {
        subject: '{{product}}-Lieferant für {{company}}',
        body: `{{name}},

{{sender_name}} von {{sender_company}} — Spezialisten für {{product}}.

Bei Bedarf können Sie sich gerne melden.

Mit freundlichen Grüßen,
{{sender_name}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    ja: [
      {
        subject: '{{product}}サプライヤー — {{company}}様へ',
        body: `{{name}}様

{{sender_company}}の{{sender_name}}です。{{product}}のサプライヤーです。
必要がある場合は、お気軽にお問い合わせください。
よろしくお願いいたします。
{{sender_name}}
📧 {{sender_email}}
{{date}}`
      }
    ],
    ko: [
      {
        subject: '{{product}} 공급업체 — {{company}}님께',
        body: `{{name}}님

{{sender_company}}의 {{sender_name}}입니다. {{product}} 공급업체입니다.
필요하시면 편하게 연락주세요.
감사합니다.
{{sender_name}}
📧 {{sender_email}}
{{date}}`
      }
    ]
  }
};

/**
 * 跟进邮件模板库
 */
const followUpTemplates = {
  zh: {
    formal: {
      subject: '关于{{product}}合作 - 跟进邮件',
      body: `尊敬的 {{name}}，

您好！

前几日曾向贵司发送关于{{product}}合作事宜的邮件，不知您是否有机会查阅。

我们深知您日常工作繁忙，因此仅占用您几分钟时间：如您对此合作感兴趣，我们可以安排一次简短的沟通；若暂时无需求，也烦请告知，我们将不再打扰。

期待您的回复。

此致
敬礼

{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
{{date}}`
    },
    friendly: {
      subject: '【跟进】之前发的邮件 — {{product}}合作',
      body: `嗨 {{name}}！

前几天给您发了封关于{{product}}的邮件，不知道您看到没 😊

其实就是想说——如果您有需要，我们很乐意帮忙；如果暂时不需要，也完全理解！

有任何问题随时回复这封邮件就好。

祝好！
{{sender_name}}
📧 {{sender_email}}
{{date}}`
    },
    concise: {
      subject: '跟进：{{product}}',
      body: `{{name}}，前封邮件不知您是否看到，简短跟进一步。如有需要可回复。- {{sender_name}}`
    }
  },
  en: {
    formal: {
      subject: 'Following Up: {{product}} Cooperation',
      body: `Dear {{name}},

I hope this email finds you well.

I am following up on my previous email regarding {{product}} cooperation with {{company}}.

I understand that your schedule is busy. If this is of interest, we would be happy to arrange a brief call. If not, please let me know and I will not follow up further.

Looking forward to your response.

Best regards,
{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
{{date}}`
    },
    friendly: {
      subject: 'Quick Follow-Up: {{product}} for {{company}} 😊',
      body: `Hey {{name}}!

Just following up on my previous email about {{product}} — wanted to make sure it didn't get buried in your inbox! 😊

No pressure at all. If it's relevant, great! If not, no worries at all!

Cheers,
{{sender_name}}
📧 {{sender_email}}
{{date}}`
    },
    concise: {
      subject: 'Quick follow-up: {{product}}',
      body: `{{name}}, following up on my last email re {{product}}. Happy to chat if interested. - {{sender_name}}`
    }
  }
};

/**
 * 报价邮件模板库
 */
const quoteTemplates = {
  zh: {
    formal: {
      subject: '{{product}}报价单 - {{company}}',
      body: `尊敬的 {{name}}，

您好！

感谢贵司{{company}}对{{product}}的兴趣。根据您的需求，我们特此提供以下报价，供参考：

【产品报价】
• 产品名称：{{product}}
• 单价：USD $XXX/台（FOB {{sender_city}}/CIF {{client_city}}）
• 最小起订量：XXX台
• 交货周期：XX天

【价格条款】
• 报价有效期：30天
• 付款方式：T/T 30%+70%

以上为初步报价，具体价格可根据订单数量商议。如有任何疑问，欢迎随时联系。

期待与贵司合作！

此致
敬礼

{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
📞 {{sender_phone}}
{{date}}`
    },
    friendly: {
      subject: '【报价】{{product}}给您参考 😊',
      body: `嗨 {{name}}！

感谢{{company}}的兴趣！根据你们的需求，我整理了一份初步报价 😊

📦 产品：{{product}}
💰 单价：USD $XXX/台
📦 最小起订量：XXX台
⏱️ 交货周期：XX天

价格是参考价，大批量可以再聊～ 有任何问题随时问我！

祝好！
{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
📞 {{sender_phone}}
{{date}}`
    },
    concise: {
      subject: '{{product}}报价单',
      body: `{{name}}，{{product}}初步报价：USD $XXX/台，MOQ XXX台，交期XX天。有效期30天。详情请回复。- {{sender_name}}`
    }
  },
  en: {
    formal: {
      subject: 'Quotation for {{product}} - {{company}}',
      body: `Dear {{name}},

Thank you for your interest in {{product}}.

Please find our quotation below for your reference:

【Quotation】
• Product: {{product}}
• Unit Price: USD $XXX/unit (FOB {{sender_city}}/CIF {{client_city}})
• MOQ: XXX units
• Delivery: XX days

【Terms】
• Valid: 30 days
• Payment: T/T 30%+70%

This is a preliminary quotation. Final pricing can be discussed based on order quantity.

Looking forward to your response.

Best regards,
{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
📞 {{sender_phone}}
{{date}}`
    },
    friendly: {
      subject: 'Quote for {{product}} - {{company}} 😊',
      body: `Hey {{name}}!

Thanks for your interest! Here's our preliminary quote for {{product}} 😊

📦 Product: {{product}}
💰 Price: USD $XXX/unit
📦 MOQ: XXX units
⏱️ Lead time: XX days

This is for reference — bigger orders = better pricing! Let me know if you have questions.

Cheers,
{{sender_name}}
{{sender_company}}
📧 {{sender_email}}
📞 {{sender_phone}}
{{date}}`
    },
    concise: {
      subject: 'Quote: {{product}}',
      body: `{{name}}, quote for {{product}}: USD $XXX/unit, MOQ XXX, delivery XX days. Valid 30 days. Reply for details. - {{sender_name}}`
    }
  }
};

/**
 * 变量替换
 * @param {string} text - 模板文本
 * @param {Object} vars - 变量对象
 * @returns {string}
 */
export function interpolate(text, vars = {}) {
  const merged = { ...DEFAULT_VARS, ...vars };
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return merged[key] !== undefined ? merged[key] : match;
  });
}

/**
 * 获取 WhatsApp 消息
 * @param {Object} params
 * @param {string} params.name - 客户姓名
 * @param {string} params.company - 客户公司
 * @param {string} params.product - 产品
 * @param {string} params.language - 语言代码 (zh/en/ar/es/fr/pt/ru/de/ja/ko)
 * @param {string} params.tone - 语气 (formal/friendly/concise)
 * @param {Object} params.sender - 发件人信息
 * @param {number} params.templateIndex - 模板索引 (默认0)
 * @returns {string} 渲染后的消息
 */
export function getWhatsAppMessage(params = {}) {
  const {
    name = '',
    company = '',
    product = '',
    language = 'zh',
    tone = 'formal',
    sender = {},
    templateIndex = 0
  } = params;

  const templates = whatsappTemplates[tone]?.[language] || whatsappTemplates[tone]?.zh || whatsappTemplates.formal.zh;
  const raw = templates[templateIndex] || templates[0];

  return interpolate(raw, {
    ...sender,
    name,
    company,
    product,
    language
  });
}

/**
 * 获取 Email 消息
 * @param {Object} params
 * @param {string} params.name - 客户姓名
 * @param {string} params.company - 客户公司
 * @param {string} params.product - 产品
 * @param {string} params.language - 语言代码
 * @param {string} params.tone - 语气
 * @param {Object} params.sender - 发件人信息
 * @param {number} params.templateIndex - 模板索引
 * @param {string} params.emailType - email类型 (cold/followup/quote)
 * @returns {Object} { subject, body }
 */
export function getEmailMessage(params = {}) {
  const {
    name = '',
    company = '',
    product = '',
    language = 'zh',
    tone = 'formal',
    sender = {},
    templateIndex = 0,
    emailType = 'cold'
  } = params;

  let templates;
  switch (emailType) {
    case 'followup':
      templates = followUpTemplates[language]?.[tone] || followUpTemplates.zh[tone];
      return {
        subject: interpolate(templates.subject, { ...sender, name, company, product }),
        body: interpolate(templates.body, { ...sender, name, company, product })
      };
    case 'quote':
      templates = quoteTemplates[language]?.[tone] || quoteTemplates.zh[tone];
      return {
        subject: interpolate(templates.subject, { ...sender, name, company, product }),
        body: interpolate(templates.body, { ...sender,
        body: interpolate(templates.body, { ...sender, name, company, product })
      };
    default:
      templates = emailTemplates[tone]?.[language] || emailTemplates[tone]?.zh || emailTemplates.formal.zh;
      const tpl = templates[templateIndex] || templates[0];
      return {
        subject: interpolate(tpl.subject, { ...sender, name, company, product }),
        body: interpolate(tpl.body, { ...sender, name, company, product })
      };
  }
}

/**
 * ???? WhatsApp ??
 * @param {Array} contacts - ?????
 * @param {Object} options - ????
 * @returns {Array} ????
 */
export function batchGenerateWhatsApp(contacts = [], options = {}) {
  const { language = 'zh', tone = 'formal', sender = {} } = options;
  return contacts.map((contact, index) => {
    const message = getWhatsAppMessage({
      name: contact.name || '',
      company: contact.company || '',
      product: contact.product || options.product || '',
      language: contact.language || language,
      tone: contact.tone || tone,
      sender,
      templateIndex: contact.templateIndex || 0
    });
    return {
      index: index + 1,
      phone: contact.phone || '',
      name: contact.name || '',
      company: contact.company || '',
      message,
      language: contact.language || language,
      tone: contact.tone || tone
    };
  });
}

/**
 * ???? Email ??
 * @param {Array} contacts - ?????
 * @param {Object} options - ????
 * @returns {Array} ????
 */
export function batchGenerateEmail(contacts = [], options = {}) {
  const { language = 'zh', tone = 'formal', sender = {}, emailType = 'cold' } = options;
  return contacts.map((contact, index) => {
    const { subject, body } = getEmailMessage({
      name: contact.name || '',
      company: contact.company || '',
      product: contact.product || options.product || '',
      language: contact.language || language,
      tone: contact.tone || tone,
      sender,
      templateIndex: contact.templateIndex || 0,
      emailType: contact.emailType || emailType
    });
    return {
      index: index + 1,
      email: contact.email || '',
      name: contact.name || '',
      company: contact.company || '',
      subject,
      body,
      language: contact.language || language,
      tone: contact.tone || tone
    };
  });
}

/**
 * ?????????
 * @param {Object} params
 * @returns {Array} ????????
 */
export function suggestAttachmentFilenames(params = {}) {
  const { product = '??', company = '??', language = 'zh' } = params;
  const nameMap = {
    zh: {
      catalog: '????',
      quotation: '???',
      certificate: '????',
      company: '????'
    },
    en: {
      catalog: 'Product_Catalog',
      quotation: 'Quotation',
      certificate: 'Certificates',
      company: 'Company_Profile'
    }
  };
  const names = nameMap[language] || nameMap.zh;
  return [
    ${names.catalog}__.pdf,
    ${names.quotation}__.pdf,
    ${names.certificate}.pdf,
    ${names.company}.pdf
  ];
}

/**
 * ?????(CLI??)
 */
export function formatWhatsAppOutput(results) {
  let output = chalk.bold('\n?? WhatsApp ????\n') + '?'.repeat(50) + '\n';
  for (const r of results) {
    output += chalk.cyan([]  ()) + '\n';
    output += chalk.gray(    ??:  | ??: ) + '\n';
    if (r.phone) output += chalk.gray(    ??: ) + '\n';
    output += chalk.white(    ) + '\n';
    output += '-'.repeat(50) + '\n';
  }
  return output;
}

export function formatEmailOutput(results) {
  let output = chalk.bold('\n?? Email ????\n') + '?'.repeat(50) + '\n';
  for (const r of results) {
    output += chalk.cyan([]  () <>) + '\n';
    output += chalk.gray(    ??:  | ??: ) + '\n';
    output += chalk.yellow(    ??: ) + '\n';
    output += chalk.white(    ...) + '\n';
    output += '-'.repeat(50) + '\n';
  }
  return output;
}

export default {
  SUPPORTED_LANGUAGES,
  TONES,
  interpolate,
  getWhatsAppMessage,
  getEmailMessage,
  batchGenerateWhatsApp,
  batchGenerateEmail,
  suggestAttachmentFilenames,
  formatWhatsAppOutput,
  formatEmailOutput
};

