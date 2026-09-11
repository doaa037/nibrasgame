/* ═══════════════════════════════════════════════════════════════════
   economy.js — المحرّك الاقتصادي
   ───────────────────────────────────────────────────────────────────
   كل دالة هنا خالصة (Pure): تأخذ أرقاماً وتُعيد أرقاماً، بلا حالة
   ولا لمس للواجهة. هذا يجعل المنطق المالي قابلاً للاختبار والمراجعة
   من معلّم أو خبير مالي دون قراءة كود اللعبة إطلاقاً.
   ═══════════════════════════════════════════════════════════════════ */

import { ECONOMY, CAR, TIME, SCORING } from '../content/config.js';

/* ─────────────── أدوات ─────────────── */
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const round = (v, d = 0) => { const p = 10 ** d; return Math.round(v * p) / p; };

/* ═══════════════════════════════════════════════════════════════
   1) قسيمة الراتب — من الـ ברוטו إلى الـ נטו
   ═══════════════════════════════════════════════════════════════ */

/**
 * ضريبة الدخل الشهرية بالشرائح التصاعدية.
 * كل شريحة تُطبَّق على الجزء الواقع داخلها فقط — وهذا أشهر سوء فهم
 * لدى الطلاب: «الترقية ترفعني لشريحة أعلى فأخسر». لا تخسر أبداً.
 */
export function incomeTax(gross, creditPoints = 0) {
  let remaining = gross, prev = 0, tax = 0;
  for (const b of ECONOMY.TAX_BRACKETS) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, b.upTo - prev);
    tax += slice * b.rate;
    remaining -= slice;
    prev = b.upTo;
  }
  /* نقاط التزكية تُخصم من الضريبة نفسها لا من الدخل الخاضع لها */
  return Math.max(0, tax - creditPoints * ECONOMY.CREDIT_POINT);
}

/** نسبة بشطرين: منخفض تحت عتبة 60% من الأجر المتوسّط ومرتفع فوقها */
function twoTier(gross, low, high) {
  return gross <= ECONOMY.NI_THRESHOLD
    ? gross * low
    : ECONOMY.NI_THRESHOLD * low + (gross - ECONOMY.NI_THRESHOLD) * high;
}

/**
 * قسيمة راتب كاملة. تُعيد كل بند منفصلاً حتى تستطيع الواجهة عرض
 * القسيمة كما يراها العامل في الحقيقة، لا رقماً نهائياً مبهماً.
 * بدل المواصلات يُضاف إلى الصافي ولا يخضع لخصم المعاش.
 */
export function payslip(gross, creditPoints = 2.25, travelAllowance = 0) {
  const tax     = incomeTax(gross, creditPoints);
  const ni      = twoTier(gross, ECONOMY.NI_LOW, ECONOMY.NI_HIGH);
  const health  = twoTier(gross, ECONOMY.HEALTH_LOW, ECONOMY.HEALTH_HIGH);
  const pension = gross * ECONOMY.PENSION_EMPLOYEE;
  const net     = gross - tax - ni - health - pension + travelAllowance;
  return {
    gross: round(gross), tax: round(tax), ni: round(ni), health: round(health),
    pension: round(pension), travelAllowance: round(travelAllowance),
    totalDeductions: round(tax + ni + health + pension),
    net: round(net),
    /* لا تُخصم من الراتب لكنّها جزء من قيمة العامل الحقيقية */
    employerPension:   round(gross * ECONOMY.PENSION_EMPLOYER),
    employerSeverance: round(gross * ECONOMY.SEVERANCE_EMPLOYER)
  };
}

/* ═══════════════════════════════════════════════════════════════
   2) القروض والفوائد
   ═══════════════════════════════════════════════════════════════ */

/** القسط الشهري بالاستهلاك المتساوي (שפיצר): PMT = P·i / (1 − (1+i)^−n) */
export function pmt(principal, annualRate, months) {
  const i = annualRate / 12;
  if (i === 0) return principal / months;
  return principal * i / (1 - (1 + i) ** -months);
}

/** كلفة القرض الكاملة — الفوائد هي الفرق بين ما تدفعه وما اقترضته */
export function loanCost(principal, annualRate, months) {
  const monthly = pmt(principal, annualRate, months);
  const total = monthly * months;
  return {
    principal: round(principal), months, rate: annualRate,
    monthly: round(monthly), total: round(total), interest: round(total - principal)
  };
}

/** فائدة السحب المكشوف الشهرية — تُحتسب على الرصيد السالب فقط */
export function overdraftInterest(balance) {
  return balance >= 0 ? 0 : round(Math.abs(balance) * ECONOMY.OVERDRAFT_RATE / 12, 2);
}

/* ═══════════════════════════════════════════════════════════════
   3) التضخّم والقيمة الحقيقية
   ═══════════════════════════════════════════════════════════════ */

/** القوّة الشرائية لمبلغ بعد سنوات من التضخّم */
export function realValue(amount, years, inflation = ECONOMY.INFLATION_ANNUAL) {
  return round(amount / (1 + inflation) ** years);
}

/** النموّ بالفائدة المركّبة — يُستخدم لشرح كلفة الفرصة البديلة */
export function compound(amount, annualRate, years) {
  return round(amount * (1 + annualRate) ** years);
}

/**
 * سعر الوقود لشهر معيّن: اتّجاه تضخّمي ثابت + تذبذب شبه عشوائي.
 * نستخدم دالة جيبية بدل Math.random حتى يكون السعر ثابتاً لنفس الشهر
 * مهما أُعيد حسابه — فالطالب يجب أن يرى نفس السعر طوال الشهر.
 */
export function fuelPrice(monthIndex) {
  const trend = ECONOMY.FUEL_BASE_PRICE * (1 + ECONOMY.INFLATION_ANNUAL / 12) ** monthIndex;
  const wave  = Math.sin(monthIndex * 1.7) * ECONOMY.FUEL_VOLATILITY * ECONOMY.FUEL_BASE_PRICE;
  return round(trend + wave, 2);
}

/* ═══════════════════════════════════════════════════════════════
   4) مقارنة وسائل التنقّل — قلب الربط بين المواصلات والميزانية
   ═══════════════════════════════════════════════════════════════ */

/**
 * الكلفة الشهرية الحقيقية لكل وسيلة تنقّل، لمسافة شهرية معطاة.
 * الهدف التربوي: إظهار أنّ سعر السيارة ليس كلفتها — الوقود والتأمين
 * والصيانة والفحص والقسط كلّها جزء من «كلفة الملكية الإجمالية».
 */
export function transportCosts({ kmPerMonth, tripsPerMonth, monthIndex,
                                 carConsumption = CAR.CONSUMPTION_PER_KM,
                                 insuranceMonthly = 0, loanMonthly = 0,
                                 hasPass = false }) {
  const litre = fuelPrice(monthIndex);

  const walking = { id: 'walk', monthly: 0, perKm: 0 };

  const busPayPerRide = round(tripsPerMonth * ECONOMY.BUS_TICKET);
  const bus = {
    id: 'bus',
    monthly: hasPass ? ECONOMY.BUS_PASS_MONTHLY : busPayPerRide,
    payPerRide: busPayPerRide,
    pass: ECONOMY.BUS_PASS_MONTHLY,
    /* نقطة التعادل: عدد الرحلات التي يتساوى عندها الاشتراك مع الدفع المفرد */
    breakEvenTrips: Math.ceil(ECONOMY.BUS_PASS_MONTHLY / ECONOMY.BUS_TICKET)
  };

  const fuelCost = round(kmPerMonth * carConsumption * litre);
  const carMonthly = fuelCost + insuranceMonthly + loanMonthly
                   + ECONOMY.CAR_MAINTENANCE_MONTHLY + round(ECONOMY.CAR_TEST / 12);
  const car = {
    id: 'car', monthly: round(carMonthly), fuel: fuelCost,
    insurance: insuranceMonthly, loan: loanMonthly,
    maintenance: ECONOMY.CAR_MAINTENANCE_MONTHLY,
    testMonthly: round(ECONOMY.CAR_TEST / 12),
    perKm: kmPerMonth > 0 ? round(carMonthly / kmPerMonth, 2) : 0,
    litrePrice: litre
  };

  return { walking, bus, car, litrePrice: litre };
}

/** تحويل مسافة العالم ثلاثي الأبعاد إلى كيلومترات محاكاة */
export function unitsToKm(units) { return units / CAR.UNITS_PER_KM; }

/* ═══════════════════════════════════════════════════════════════
   5) التأمين — كم يدفع اللاعب فعلياً عند وقوع الضرر؟
   ═══════════════════════════════════════════════════════════════ */

/**
 * يحسب ما يخرج من جيب اللاعب عند حادث/عطل.
 *   kind: 'ownCar' ضرر لسيارتك | 'thirdParty' ضرر لطرف ثالث
 * القاعدة: التأمين لا يعني «صفر دفع» — هناك اشتراك تحمّلي
 * (השתתפות עצמית) يدفعه المؤمَّن قبل أن تدخل شركة التأمين.
 */
export function insurancePayout(plan, damage, kind = 'ownCar') {
  const covered = kind === 'ownCar' ? plan.coversOwnCar : plan.coversThirdParty;
  if (!covered) return { outOfPocket: round(damage), covered: 0, deductible: 0 };
  const outOfPocket = Math.min(damage, plan.deductible);
  return {
    outOfPocket: round(outOfPocket),
    covered: round(damage - outOfPocket),
    deductible: plan.deductible
  };
}

/* ═══════════════════════════════════════════════════════════════
   6) المؤشّرات المركّبة
   ═══════════════════════════════════════════════════════════════ */

/** صافي الثروة = ما تملكه ناقص ما عليك */
export function netWorth(s) { return round(s.balance + s.savings - s.debt); }

/**
 * مؤشّر الأمان المالي (0–100) — تركيب من أربعة عوامل حقيقية:
 *   السيولة   : كم شهراً تستطيع الصمود بلا دخل (صندوق الطوارئ)
 *   عبء الدَّين: نسبة الأقساط من الدخل الصافي (القاعدة: تحت 30%)
 *   الائتمان  : موقعك في تقرير الائتمان
 *   الملاءة   : هل صافي ثروتك موجب؟
 */
export function safetyIndex(s) {
  const monthlyNeed = ECONOMY.RENT + ECONOMY.BILLS + ECONOMY.FOOD_PER_DAY * 30;
  const liquidity = clamp((s.balance + s.savings) / monthlyNeed * 33, 0, 100);

  const income = s.job ? payslip(s.job.gross, s.job.creditPoints, s.job.travelAllowance).net : 0;
  /* من لا التزامات عليه لا عبء عليه — حتى لو لم يبدأ العمل بعد.
     الخلط بين «بلا دخل» و«عبء أقصى» يعطي الطالب إشارة خاطئة في
     أوّل دقيقة من اللعب، قبل أن يتّخذ أيّ قرار. */
  const burden = s.monthlyCommit === 0 ? 0
               : income > 0 ? s.monthlyCommit / income : 1;
  const debtScore = clamp(100 - burden * 250, 0, 100);   /* 40% عبء ⇒ صفر */

  const creditScore = clamp(
    (s.credit - ECONOMY.CREDIT_MIN) / (ECONOMY.CREDIT_MAX - ECONOMY.CREDIT_MIN) * 100, 0, 100);

  const solvency = clamp(50 + netWorth(s) / 200, 0, 100);

  return round(liquidity * 0.3 + debtScore * 0.3 + creditScore * 0.2 + solvency * 0.2);
}

/** تصنيف تقرير الائتمان إلى نطاق مفهوم للطالب */
export function creditBand(credit) {
  if (credit >= 800) return 'excellent';
  if (credit >= 700) return 'good';
  if (credit >= 600) return 'fair';
  return 'weak';
}

/* ═══════════════════════════════════════════════════════════════
   7) التقييم النهائي
   ═══════════════════════════════════════════════════════════════ */

/**
 * النتيجة = 70% جودة القرارات التربوية + 30% الصحّة المالية الناتجة.
 * الوزن مقصود: الهدف التعلّمي هو جودة التفكير المالي، لا الحظّ في
 * عرض العمل أو في الأحداث العشوائية.
 */
export function evaluate(s) {
  let quality = 0;
  if (s.decisions.length) {
    quality = s.decisions.reduce((sum, d) => sum + (SCORING.QUALITY[d.quality] || 0), 0)
            / s.decisions.length;
  }
  const health = safetyIndex(s);
  const total = round(quality * SCORING.WEIGHT_DECISIONS + health * SCORING.WEIGHT_HEALTH);
  return { total, quality: round(quality), health, netWorth: netWorth(s), grade: gradeFor(total) };
}

const GRADES = [
  { min: 90, letter: 'A+' }, { min: 75, letter: 'A' }, { min: 60, letter: 'B' },
  { min: 40, letter: 'C' },  { min: 0,  letter: 'D' }
];
function gradeFor(pct) { return GRADES.find(g => pct >= g.min) || GRADES.at(-1); }

/** توزيع الأداء على مجالات الكفاية وفق OECD/PISA */
export function competencyBreakdown(s, competencyKeys) {
  const acc = Object.fromEntries(competencyKeys.map(k => [k, { sum: 0, n: 0 }]));
  for (const d of s.decisions) {
    if (!acc[d.competency]) continue;
    acc[d.competency].sum += SCORING.QUALITY[d.quality] || 0;
    acc[d.competency].n += 1;
  }
  return competencyKeys.map(k => ({
    key: k,
    pct: acc[k].n ? Math.round(acc[k].sum / acc[k].n) : 0,
    count: acc[k].n
  }));
}

/** نقاط لوحة المتصدّرين — تجمع المعرفة بالنتيجة المالية */
export function leaderboardScore(s) {
  return Math.max(0, Math.round(s.iq * 4 + evaluate(s).total * 3 + netWorth(s) / 60));
}

/* ═══════════════════════════════════════════════════════════════
   8) دورة نهاية الشهر
   ═══════════════════════════════════════════════════════════════ */

/**
 * تُطبَّق حين يتجاوز عدّاد الأيام DAYS_PER_MONTH.
 * الترتيب مقصود ويحاكي الواقع: يدخل الراتب أوّلاً، ثمّ تُخصم
 * الالتزامات، ثمّ تُحتسب الفوائد على ما تبقّى — فمن ينفق قبل أن
 * يخصّص يجد نفسه يدفع فائدة على استهلاكه.
 */
export function monthlyCycle(s) {
  const lines = [];
  const add = (key, amount) => { lines.push({ key, amount: round(amount) }); };

  if (s.job) {
    const slip = payslip(s.job.gross, s.job.creditPoints, s.job.travelAllowance);
    s.balance += slip.net;
    add('salaryIn', slip.net);
  }

  s.balance -= ECONOMY.RENT;   add('rentDue', -ECONOMY.RENT);
  s.balance -= ECONOMY.BILLS;  add('billsDue', -ECONOMY.BILLS);

  if (s.monthlyCommit > 0) {
    s.balance -= s.monthlyCommit;
    add('loanPayment', -s.monthlyCommit);
  }

  const odi = overdraftInterest(s.balance);
  if (odi > 0) { s.balance -= odi; add('overdraftCost', -odi); s.flags.everOverdraft = true; }

  if (s.debt > 0) {
    const interest = round(s.debt * ECONOMY.LOAN_RATE / 12, 2);
    s.debt += interest;
    add('debtInterest', -interest);
    const paid = Math.min(s.debt, s.monthlyCommit);
    s.debt = Math.max(0, s.debt - paid);
  }

  if (s.savings > 0) {
    const y = round(s.savings * ECONOMY.SAVINGS_RATE / 12, 2);
    s.savings += y;
    add('savingsYield', y);
  }

  /* التضخّم يرفع تكلفة المعيشة حتى لو لم يتغيّر سلوك اللاعب إطلاقاً */
  const inflationHit = round(
    (ECONOMY.RENT + ECONOMY.BILLS) * ECONOMY.INFLATION_ANNUAL / 12, 2);
  add('inflationHit', -inflationHit);

  s.credit = clamp(s.credit + (s.balance >= 0 ? 8 : -14),
                   ECONOMY.CREDIT_MIN, ECONOMY.CREDIT_MAX);

  s.month += 1;
  s.day = 1;
  lines.push({ key: 'endBalance', amount: round(s.balance), isSum: true });
  return lines;
}

/** أيام الشهر المتبقّية — يستعملها متتبّع المهام */
export function daysLeftInMonth(s) { return Math.max(0, TIME.DAYS_PER_MONTH - s.day + 1); }
