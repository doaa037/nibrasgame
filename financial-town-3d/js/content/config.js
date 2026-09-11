/* ═══════════════════════════════════════════════════════════════════
   config.js — كل الثوابت في مكان واحد
   ───────────────────────────────────────────────────────────────────
   قاعدة المشروع: لا رقم سحري داخل منطق اللعبة. أي قيمة اقتصادية أو
   عالمية تُعرَّف هنا، فتحديثها السنوي (ضرائب، أسعار وقود، إيجار)
   يتمّ من ملف واحد دون المساس بالكود.
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────────── إعدادات العالم ثلاثي الأبعاد ─────────────── */
export const WORLD = {
  SIZE: 240,              /* طول ضلع البلدة بالوحدات (متر تقريبي) */
  BLOCK: 60,              /* المسافة بين محاور الشوارع */
  ROAD_WIDTH: 11,
  SIDEWALK: 2.2,
  FOG_NEAR: 70,
  FOG_FAR: 260,
  SKY: 0x9ec9e8,
  GROUND: 0xa8a084,
  ASPHALT: 0x3a3f47,
  SHADOW_MAP: 2048,
  MAX_PIXEL_RATIO: 1.75   /* سقف كثافة البكسل — يحمي أجهزة المدرسة الضعيفة */
};

/* ─────────────── اللاعب والكاميرا ─────────────── */
export const PLAYER = {
  RADIUS: 0.45,
  HEIGHT: 1.75,
  WALK_SPEED: 4.4,        /* م/ث */
  RUN_SPEED: 8.0,
  TURN_LERP: 0.18,        /* نعومة دوران الشخصية نحو اتجاه الحركة */
  /* الكاميرا: مسافة وارتفاع يكشفان الشارع والمباني معاً. كاميرا
     منخفضة تُظهر الأسفلت أكثر ممّا تُظهر البلدة، فيضيع الطالب. */
  CAM_DISTANCE: 11.5,
  CAM_HEIGHT: 5.4,
  CAM_LERP: 0.10,
  INTERACT_RANGE: 4.5     /* المدى الذي يظهر فيه تلميح «اضغط E» */
};

/* ─────────────── السيارة ─────────────── */
export const CAR = {
  ACCEL: 14, BRAKE: 22, MAX_SPEED: 17, REVERSE_SPEED: 6,
  TURN_RATE: 1.7, FRICTION: 3.2,
  FUEL_TANK: 45,                /* لتر */
  CONSUMPTION_PER_KM: 0.075,    /* 7.5 لتر/100كم */
  UNITS_PER_KM: 100             /* 100 وحدة عالمية = 1 كم في المحاكاة */
};

/* ─────────────── الزمن ─────────────── */
export const TIME = {
  DAY_START: 8,           /* تبدأ الحياة الساعة 08:00 */
  DAY_END: 23,            /* ينتهي اليوم إجبارياً الساعة 23:00 */
  MINUTES_PER_SECOND: 3,  /* دقيقة لعب لكل ثانية حقيقية */
  DAYS_PER_MONTH: 6,      /* شهر مضغوط ليكتمل داخل حصّة صفّية */
  SALARY_DAY: 1,          /* يوم إيداع الراتب */
  RENT_DAY: 3,            /* يوم استحقاق الإيجار */
  BILLS_DAY: 5            /* يوم الفواتير (كهرباء، ماء، خلوي) */
};

/* ═══════════════════════════════════════════════════════════════
   الثوابت الاقتصادية
   قيم تقريبية مبنية على المعطيات الإسرائيلية المعتادة، الهدف منها
   التدريب على المنطق الحسابي لا التدقيق الضريبي.
   ═══════════════════════════════════════════════════════════════ */
export const ECONOMY = {
  /* ضريبة الدخل: شرائح شهرية تصاعدية (מדרגות מס הכנסה) */
  TAX_BRACKETS: [
    { upTo: 7010,     rate: 0.10 },
    { upTo: 10060,    rate: 0.14 },
    { upTo: 16150,    rate: 0.20 },
    { upTo: 22440,    rate: 0.31 },
    { upTo: 46690,    rate: 0.35 },
    { upTo: Infinity, rate: 0.47 }
  ],
  CREDIT_POINT: 242,        /* قيمة نقطة التزكية الشهرية (נקודת זיכוי) */

  /* التأمين الوطني وضريبة الصحّة: شطر منخفض تحت العتبة ومرتفع فوقها.
     العتبة = 60% من الأجر المتوسّط في الاقتصاد. */
  NI_THRESHOLD: 7522,
  NI_LOW: 0.004,  NI_HIGH: 0.07,
  HEALTH_LOW: 0.031, HEALTH_HIGH: 0.05,

  /* المعاش */
  PENSION_EMPLOYEE: 0.06,
  PENSION_EMPLOYER: 0.065,
  SEVERANCE_EMPLOYER: 0.0833,

  /* أسعار الفائدة السنوية */
  OVERDRAFT_RATE: 0.15,     /* السحب المكشوف (بريمة + هامش) — الأغلى */
  LOAN_RATE: 0.09,          /* قرض استهلاكي بنكي */
  DEALER_LOAN_RATE: 0.125,  /* تمويل من معرض السيارات — أغلى عادةً */
  SAVINGS_RATE: 0.04,       /* وديعة / صندوق نقدي */

  /* التضخّم */
  INFLATION_ANNUAL: 0.032,
  FUEL_BASE_PRICE: 7.35,    /* ₪ لليتر عند بداية اللعبة */
  FUEL_VOLATILITY: 0.06,    /* تذبذب شهري إضافي فوق التضخّم */

  /* المصروفات الثابتة الشهرية */
  RENT: 2300,
  BILLS: 640,               /* كهرباء + ماء + أرنونا + خلوي */
  FOOD_PER_DAY: 48,

  /* المواصلات العامّة */
  BUS_TICKET: 5.90,
  BUS_PASS_MONTHLY: 99,     /* «חופשי חודשי» — يوفّر عند تجاوز 17 رحلة */

  /* كلفة تشغيل السيارة السنوية (خارج الوقود) */
  CAR_TEST: 550,            /* טסט + אגרת רישוי */
  CAR_MAINTENANCE_MONTHLY: 190,

  /* تقرير الائتمان (דוח נתוני אשראי) */
  CREDIT_MIN: 300, CREDIT_MAX: 1000, CREDIT_START: 700
};

/* ─────────────── مسارات التأمين على المركبة ─────────────── */
export const INSURANCE = [
  {
    id: 'mandatory', monthly: 145, deductible: 0,
    coversOwnCar: false, coversThirdParty: false, coversInjury: true
  },
  {
    id: 'third', monthly: 235, deductible: 1200,
    coversOwnCar: false, coversThirdParty: true, coversInjury: true
  },
  {
    id: 'comprehensive', monthly: 430, deductible: 1800,
    coversOwnCar: true, coversThirdParty: true, coversInjury: true
  }
];

/* ─────────────── سيارات المعرض ─────────────── */
export const CARS_FOR_SALE = [
  { id: 'cityMini', price: 18500, year: 2011, consumption: 0.062,
    reliability: 0.62, color: 0xc94f4f },
  { id: 'family',   price: 32000, year: 2016, consumption: 0.075,
    reliability: 0.82, color: 0x3f6fa8 },
  { id: 'newHybrid',price: 68000, year: 2022, consumption: 0.042,
    reliability: 0.95, color: 0xe0e4e8 }
];

/* ─────────────── عروض العمل في مركز التشغيل ─────────────── */
export const JOBS = [
  { id: 'warehouse', gross: 6200, creditPoints: 2.25, travelAllowance: 250, hours: 'שישה ימים' },
  { id: 'retail',    gross: 7400, creditPoints: 2.25, travelAllowance: 320, hours: 'משמרות' },
  { id: 'techSupp',  gross: 9100, creditPoints: 2.25, travelAllowance: 0,   hours: 'משרה מלאה' }
];

/* أوزان التقييم النهائي: جودة القرار التربوية تتقدّم على النتيجة المالية */
export const SCORING = {
  QUALITY: { good: 100, mid: 60, bad: 15 },
  WEIGHT_DECISIONS: 0.7,
  WEIGHT_HEALTH: 0.3
};
