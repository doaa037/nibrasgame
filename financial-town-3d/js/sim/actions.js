/* ═══════════════════════════════════════════════════════════════════
   actions.js — تنفيذ الإجراءات
   ───────────────────────────────────────────────────────────────────
   كل خيار في حوار أو خدمة قد يحمل اسم إجراء (action). هنا تُنفَّذ.
   الفصل مقصود: ملفّات المحتوى تقول «ماذا يحدث» بلغة تربوية، وهذا
   الملفّ يقول «كيف يحدث» بلغة برمجية — فيستطيع معلّم تعديل النصوص
   والقيم دون أن يلمس منطق اللعبة.

   كل إجراء يأخذ (game, data) ويعيد اختيارياً { toast } لعرض إشعار.
   ═══════════════════════════════════════════════════════════════════ */

import { ECONOMY, INSURANCE, CARS_FOR_SALE, JOBS, CAR, TIME } from '../content/config.js';
import { payslip, loanCost, fuelPrice, insurancePayout, round } from './economy.js';
import { charge, hasBusPass, canAfford } from './state.js';
import { t } from '../content/i18n.js';

export function createActions(game) {
  const S = () => game.state;

  return {
    /* لا شيء — تُستخدم لأزرار العرض فقط */
    none: () => {},

    /* ═══════════════════════════════════════════════════════════
       العمل
       ═══════════════════════════════════════════════════════════ */
    takeJob: (_, data) => {
      const job = JOBS.find(j => j.id === data.jobId);
      const s = S();
      s.job = { ...job };
      s.flags.hasJob = true;
      const slip = payslip(job.gross, job.creditPoints, job.travelAllowance);
      return { toast: { icon: '💼',
        title: { ar: 'حصلت على الوظيفة', he: 'התקבלת לעבודה' },
        body:  { ar: `صافي متوقّع: ${slip.net} ₪ شهرياً`,
                 he: `נטו צפוי: ${slip.net} ₪ לחודש` } } };
    },

    openPayslip: () => {
      S().flags.payslipRead = true;
      game.ui.panels.showPayslip(S());
    },

    /* ═══════════════════════════════════════════════════════════
       السيارة: اختيار ← دفع ← تأمين
       ───────────────────────────────────────────────────────────
       نفصل الاختيار عن الدفع لأنّ الدرس التربوي في الفصل نفسه:
       «أيّ سيارة أريد؟» و«كيف أموّلها؟» سؤالان مختلفان تماماً.
       ═══════════════════════════════════════════════════════════ */
    pickCar: (_, data) => {
      game.pendingCar = CARS_FOR_SALE.find(c => c.id === data.carId);
    },

    payCar: (_, data) => {
      const s = S();
      const car = game.pendingCar || CARS_FOR_SALE[0];
      const method = data.method;

      if (method === 'cash') {
        /* الدفع نقداً يسحب من الادّخار أوّلاً ثمّ من الحساب الجاري */
        const fromSavings = Math.min(s.savings, car.price);
        s.savings -= fromSavings;
        charge(s, car.price - fromSavings);
      } else {
        const rate = method === 'dealerLoan' ? ECONOMY.DEALER_LOAN_RATE : ECONOMY.LOAN_RATE;
        /* تمويل المعرض «بلا فوائد» يبيع السيارة أغلى بـ2,500 ₪ */
        const principal = method === 'dealerLoan' ? car.price + 2500 : car.price;
        const loan = loanCost(principal, rate, 48);
        s.debt += loan.principal;
        s.monthlyCommit += loan.monthly;
        s.flags.hasCarLoan = true;
      }

      s.car = { ...car, odometerKm: 0 };
      s.fuel = CAR.FUEL_TANK * 0.35;      /* المعرض يسلّم بخزّان جزئي */
      game.deliverCar(car);

      return { toast: { icon: '🚗',
        title: { ar: 'تسلّمت المركبة', he: 'קיבלת את הרכב' },
        body:  { ar: 'اضغط F للركوب حين تقترب منها', he: 'לחצו F לכניסה כשתתקרבו' } } };
    },

    buyInsurance: (_, data) => {
      const s = S();
      const plan = INSURANCE.find(p => p.id === data.planId);
      /* استبدال مسار قائم: نطرح القسط القديم قبل إضافة الجديد */
      if (s.insurance) {
        const old = INSURANCE.find(p => p.id === s.insurance);
        if (old) s.monthlyCommit = Math.max(0, s.monthlyCommit - old.monthly);
      }
      s.insurance = plan.id;
      s.monthlyCommit += plan.monthly;
      return { toast: { icon: '🛡️',
        title: { ar: 'فُعِّل التأمين', he: 'הביטוח הופעל' },
        body:  { ar: `${plan.monthly} ₪ شهرياً`, he: `${plan.monthly} ₪ לחודש` } } };
    },

    openInsurancePanel: () => game.ui.panels.showInsurance(S(), game),

    /* ═══════════════════════════════════════════════════════════
       البنك
       ═══════════════════════════════════════════════════════════ */
    openLoanPanel:    () => game.ui.panels.showLoans(S(), game),
    openCreditReport: () => game.ui.panels.showCreditReport(S()),
    openBudget:       () => game.ui.panels.showBudget(S(), game),

    depositSavings: () => {
      const s = S();
      const amount = Math.min(500, Math.max(0, s.balance));
      if (amount <= 0) return { toast: notEnough() };
      s.balance -= amount;
      s.savings += amount;
      return { toast: { icon: '🏦',
        title: { ar: 'أُودِع في الادّخار', he: 'הופקד לחיסכון' },
        body:  { ar: `${amount} ₪ · العائد 4% سنوياً`, he: `${amount} ₪ · תשואה 4% שנתית` } } };
    },

    withdrawSavings: () => {
      const s = S();
      const amount = Math.min(500, s.savings);
      if (amount <= 0) return { toast: notEnough() };
      s.savings -= amount;
      s.balance += amount;
      return { toast: { icon: '↩️',
        title: { ar: 'سُحِب من الادّخار', he: 'נמשך מהחיסכון' },
        body:  { ar: `${amount} ₪`, he: `${amount} ₪` } } };
    },

    payDebt: () => {
      const s = S();
      const amount = Math.min(1000, s.debt, Math.max(0, s.balance));
      if (amount <= 0) return { toast: notEnough() };
      charge(s, amount);
      s.debt -= amount;
      s.credit = Math.min(ECONOMY.CREDIT_MAX, s.credit + 6);
      /* سداد الأصل يخفّف القسط الشهري بنسبة ما سُدِّد */
      if (s.debt <= 0) { s.monthlyCommit = Math.max(0, s.monthlyCommit - (s.carLoanMonthly || 0)); }
      return { toast: { icon: '⚡',
        title: { ar: 'سداد مبكّر', he: 'פירעון מוקדם' },
        body:  { ar: `${amount} ₪ — وفّرت فائدتها كلّها`, he: `${amount} ₪ — חסכת את מלוא הריבית` } } };
    },

    takeLoan: (_, data) => {
      const s = S();
      const loan = loanCost(data.amount, ECONOMY.LOAN_RATE, data.months);
      s.balance += loan.principal;
      s.debt += loan.principal;
      s.monthlyCommit += loan.monthly;
      return { toast: { icon: '💳',
        title: { ar: 'صُرِف القرض', he: 'ההלוואה אושרה' },
        body:  { ar: `قسط ${loan.monthly} ₪ · فوائد ${loan.interest} ₪`,
                 he: `החזר ${loan.monthly} ₪ · ריבית ${loan.interest} ₪` } } };
    },

    /* ═══════════════════════════════════════════════════════════
       الاستهلاك اليومي — الطعام والطاقة
       ═══════════════════════════════════════════════════════════ */
    buyMeal: () => {
      const s = S();
      if (!canAfford(s, ECONOMY.FOOD_PER_DAY) && s.balance < -1000) return { toast: notEnough() };
      charge(s, ECONOMY.FOOD_PER_DAY);
      s.energy = Math.min(100, s.energy + 30);
      return { toast: { icon: '🥙',
        title: { ar: 'وجبة جاهزة', he: 'ארוחה מוכנה' },
        body:  { ar: `−${ECONOMY.FOOD_PER_DAY} ₪ · الطاقة +30`,
                 he: `−${ECONOMY.FOOD_PER_DAY} ₪ · אנרגיה +30` } } };
    },

    buyGroceries: () => {
      const s = S();
      charge(s, 165);
      s.energy = Math.min(100, s.energy + 45);
      s.flags.cooksAtHome = true;
      return { toast: { icon: '🛒',
        title: { ar: 'تسوّق أسبوعي', he: 'קניות שבועיות' },
        body:  { ar: '−165 ₪ · نحو 22 ₪ للوجبة بدل 48',
                 he: '−165 ₪ · כ-22 ₪ לארוחה במקום 48' } } };
    },

    /* ═══════════════════════════════════════════════════════════
       الوقود والمواصلات
       ═══════════════════════════════════════════════════════════ */
    refuel: () => {
      const s = S();
      const litres = round(CAR.FUEL_TANK - s.fuel, 1);
      if (litres <= 0.5) {
        return { toast: { icon: '⛽',
          title: { ar: 'الخزّان ممتلئ', he: 'המכל מלא' }, body: { ar: '', he: '' } } };
      }
      const price = fuelPrice(s.month);
      const cost = round(litres * price);
      charge(s, cost);
      s.fuel = CAR.FUEL_TANK;
      return { toast: { icon: '⛽',
        title: { ar: 'تمّت التعبئة', he: 'התדלוק הושלם' },
        body:  { ar: `${litres} لتر × ${price} ₪ = ${cost} ₪`,
                 he: `${litres} ליטר × ${price} ₪ = ${cost} ₪` } } };
    },

    buyBusPass: () => {
      const s = S();
      charge(s, ECONOMY.BUS_PASS_MONTHLY);
      s.busPassUntilMonth = s.month;
      s.flags.transportCompared = true;
      const breakEven = Math.ceil(ECONOMY.BUS_PASS_MONTHLY / ECONOMY.BUS_TICKET);
      return { toast: { icon: '🎫',
        title: { ar: 'اشتراك شهري فعّال', he: 'המנוי החודשי פעיל' },
        body:  { ar: `يوفّر ابتداءً من الرحلة ${breakEven}`,
                 he: `משתלם החל מהנסיעה ה-${breakEven}` } } };
    },

    openBusPanel: () => game.ui.panels.showBusDestinations(S(), game),

    rideBus: (_, data) => {
      const s = S();
      const free = hasBusPass(s);
      if (!free && s.balance < ECONOMY.BUS_TICKET - 500) return { toast: notEnough() };
      if (!free) charge(s, ECONOMY.BUS_TICKET);

      s.busTripsThisMonth += 1;
      s.kmBus += 1.2;
      s.energy = Math.max(0, s.energy - 2);
      game.travelTo(data.stopId);

      return { toast: { icon: '🚌',
        title: { ar: 'وصلت', he: 'הגעת' },
        body: free
          ? { ar: 'رحلة مشمولة باشتراكك', he: 'נסיעה כלולה במנוי' }
          : { ar: `−${ECONOMY.BUS_TICKET} ₪ · رحلات هذا الشهر: ${s.busTripsThisMonth}`,
              he: `−${ECONOMY.BUS_TICKET} ₪ · נסיעות החודש: ${s.busTripsThisMonth}` } } };
    },

    /* ═══════════════════════════════════════════════════════════
       الأمن الرقمي
       ═══════════════════════════════════════════════════════════ */
    enableTwoFactor: () => {
      const s = S();
      s.flags.twoFactor = true;
      s.credit = Math.min(ECONOMY.CREDIT_MAX, s.credit + 5);
      s.iq += 10;
      return { toast: { icon: '🔐',
        title: { ar: 'التحقّق بخطوتين مفعَّل', he: 'אימות דו-שלבי הופעל' },
        body:  { ar: 'حسابك محميّ حتى لو تسرّبت كلمة السرّ',
                 he: 'החשבון מוגן גם אם הסיסמה דלפה' } } };
    },

    /* ═══════════════════════════════════════════════════════════
       أعطال السيارة — تفرّعات حدث «عطل مفاجئ»
       ═══════════════════════════════════════════════════════════ */
    payRepairFromSavings: () => {
      const s = S();
      const plan = INSURANCE.find(p => p.id === s.insurance);
      const out = plan ? insurancePayout(plan, 2600, 'ownCar').outOfPocket : 2600;
      const fromSavings = Math.min(s.savings, out);
      s.savings -= fromSavings;
      charge(s, out - fromSavings);
      return { toast: repairToast(out) };
    },

    payRepairInstallments: () => {
      const s = S();
      const plan = INSURANCE.find(p => p.id === s.insurance);
      const out = plan ? insurancePayout(plan, 2600, 'ownCar').outOfPocket : 2600;
      s.debt += out;
      s.monthlyCommit += round(out / 3);
      return { toast: repairToast(out) };
    },

    delayRepair: () => {
      const s = S();
      /* التأجيل يضاعف الكلفة ويستهلك الطاقة يومياً حتى الإصلاح */
      s.flags.brokenCar = true;
      return { toast: { icon: '⚠️',
        title: { ar: 'العطل مؤجَّل', he: 'התקלה נדחתה' },
        body:  { ar: 'الكلفة سترتفع — العطل الصغير يكبر',
                 he: 'העלות תעלה — תקלה קטנה גדלה' } } };
    },

    /* ═══════════════════════════════════════════════════════════
       البيت — نهاية اليوم
       ═══════════════════════════════════════════════════════════ */
    sleep: () => game.endDay()
  };

  /* ─────────────── مساعدات محلّية ─────────────── */
  function notEnough() {
    return { icon: '⚠️', title: { ar: t('notEnough'), he: t('notEnough') }, body: { ar: '', he: '' } };
  }
  function repairToast(amount) {
    return { icon: '🔧',
      title: { ar: 'أُصلحت السيارة', he: 'הרכב תוקן' },
      body:  { ar: `دفعت ${amount} ₪ من جيبك`, he: `שילמת ${amount} ₪ מכיסך` } };
  }
}

/** أيام الشهر — تُستخدم في واجهة الميزانية */
export const DAYS_PER_MONTH = TIME.DAYS_PER_MONTH;
