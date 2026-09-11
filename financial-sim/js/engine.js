/* ═══════════════════════════════════════════════════════════════════
   engine.js — المحرك المالي وإدارة الحالة
   ───────────────────────────────────────────────────────────────────
   يحتوي على:
     (أ) الثوابت الاقتصادية المستخدمة في الحسابات
     (ب) دوال الحساب المالي (قسيمة الراتب، الأقساط، الفوائد، التضخّم)
     (ج) حالة اللاعب: الإنشاء، تطبيق القرارات، دورة الشهر، التقييم
   كل دالة حسابية هنا خالصة (Pure) وقابلة للاختبار منفصلةً عن الواجهة.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════
     (أ) الثوابت الاقتصادية
     القيم تقريبية ومبنية على المعطيات الإسرائيلية المعتادة، والهدف
     منها التدريب على المنطق الحسابي لا التدقيق الضريبي.
     ═══════════════════════════════════════════════════════════════ */
  var CONST = {
    /* شرائح ضريبة الدخل الشهرية (מדרגות מס הכנסה) */
    TAX_BRACKETS: [
      { upTo: 7010,     rate: 0.10 },
      { upTo: 10060,    rate: 0.14 },
      { upTo: 16150,    rate: 0.20 },
      { upTo: 22440,    rate: 0.31 },
      { upTo: 46690,    rate: 0.35 },
      { upTo: Infinity, rate: 0.47 }
    ],
    CREDIT_POINT: 242,      /* قيمة نقطة التزكية الشهرية (נקודת זיכוי) */

    /* التأمين الوطني وضريبة الصحّة: نسبة منخفضة تحت العتبة ومرتفعة فوقها.
       العتبة = 60% من الأجر المتوسّط في الاقتصاد. */
    NI_THRESHOLD: 7522,
    NI_LOW: 0.004,  NI_HIGH: 0.07,
    HEALTH_LOW: 0.031, HEALTH_HIGH: 0.05,

    /* المعاش: خصم العامل، وإيداعات المشغّل (تعويضات + تقديمات) */
    PENSION_EMPLOYEE: 0.06,
    PENSION_EMPLOYER: 0.065,
    SEVERANCE_EMPLOYER: 0.0833,

    /* أسعار الفائدة السنوية */
    OVERDRAFT_RATE: 0.15,   /* فائدة السحب المكشوف (بريمة + هامش) */
    LOAN_RATE: 0.09,        /* متوسّط فائدة القروض الاستهلاكية */
    SAVINGS_RATE: 0.04,     /* عائد وديعة/صندوق نقدي */
    INFLATION: 0.032,       /* التضخّم السنوي */

    /* حدود المؤشّرات */
    CREDIT_MIN: 300, CREDIT_MAX: 1000, CREDIT_START: 700
  };

  /* ═══════════════════════════════════════════════════════════════
     (ب) الدوال الحسابية
     ═══════════════════════════════════════════════════════════════ */

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round(v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; }

  /**
   * ضريبة الدخل الشهرية بالشرائح التصاعدية.
   * كل شريحة تُطبَّق على الجزء الواقع داخلها فقط — وهذا سوء الفهم
   * الأشهر لدى الطلاب: «الترقية ترفعني لشريحة أعلى فأخسر».
   */
  function incomeTax(gross, creditPoints) {
    var remaining = gross, prev = 0, tax = 0;
    for (var i = 0; i < CONST.TAX_BRACKETS.length && remaining > 0; i++) {
      var b = CONST.TAX_BRACKETS[i];
      var slice = Math.min(remaining, b.upTo - prev);
      tax += slice * b.rate;
      remaining -= slice;
      prev = b.upTo;
    }
    /* نقاط التزكية تُخصم من الضريبة نفسها لا من الدخل الخاضع لها */
    tax -= (creditPoints || 0) * CONST.CREDIT_POINT;
    return Math.max(0, tax);
  }

  /** نسبة مركّبة من شطرين: منخفض تحت العتبة ومرتفع فوقها */
  function twoTierRate(gross, low, high) {
    if (gross <= CONST.NI_THRESHOLD) return gross * low;
    return CONST.NI_THRESHOLD * low + (gross - CONST.NI_THRESHOLD) * high;
  }

  /**
   * حساب قسيمة الراتب الكاملة: من الإجمالي (ברוטו) إلى الصافي (נטו).
   * تُعيد كل بند على حدة حتى تتمكّن الواجهة من عرض القسيمة كما هي.
   */
  function computePayslip(gross, creditPoints) {
    var tax     = incomeTax(gross, creditPoints);
    var ni      = twoTierRate(gross, CONST.NI_LOW, CONST.NI_HIGH);
    var health  = twoTierRate(gross, CONST.HEALTH_LOW, CONST.HEALTH_HIGH);
    var pension = gross * CONST.PENSION_EMPLOYEE;
    var net     = gross - tax - ni - health - pension;
    return {
      gross: round(gross),
      tax: round(tax), ni: round(ni), health: round(health), pension: round(pension),
      totalDeductions: round(tax + ni + health + pension),
      net: round(net),
      /* إيداعات المشغّل لا تُخصم من الراتب لكنّها جزء من قيمة العامل */
      employerPension:   round(gross * CONST.PENSION_EMPLOYER),
      employerSeverance: round(gross * CONST.SEVERANCE_EMPLOYER)
    };
  }

  /**
   * القسط الشهري لقرض بالاستهلاك المتساوي (שפיצר):
   *   PMT = P · i / (1 − (1+i)^−n)
   * حيث i الفائدة الشهرية و n عدد الأقساط.
   */
  function pmt(principal, annualRate, months) {
    var i = annualRate / 12;
    if (i === 0) return principal / months;
    return principal * i / (1 - Math.pow(1 + i, -months));
  }

  /** الكلفة الإجمالية للقرض والفوائد المدفوعة فيه */
  function loanCost(principal, annualRate, months) {
    var monthly = pmt(principal, annualRate, months);
    var total = monthly * months;
    return {
      monthly: round(monthly),
      total: round(total),
      interest: round(total - principal),
      months: months,
      rate: annualRate
    };
  }

  /** فائدة السحب المكشوف الشهرية (تُحتسب على الرصيد السالب فقط) */
  function overdraftInterest(balance) {
    if (balance >= 0) return 0;
    return round(Math.abs(balance) * CONST.OVERDRAFT_RATE / 12, 2);
  }

  /** القيمة الحقيقية لمبلغ بعد سنوات من التضخّم (قوّة شرائية) */
  function realValue(amount, years, inflation) {
    return round(amount / Math.pow(1 + (inflation || CONST.INFLATION), years));
  }

  /** النموّ بالفائدة المركّبة — يُستخدم في شرح كلفة الفرصة البديلة */
  function compound(amount, annualRate, years) {
    return round(amount * Math.pow(1 + annualRate, years));
  }

  /* ═══════════════════════════════════════════════════════════════
     (ج) حالة اللاعب
     ═══════════════════════════════════════════════════════════════ */

  var STORAGE_KEY = 'finTown.state';

  /** إنشاء حالة جديدة من بطاقة الوضع المالي المسحوبة عشوائياً */
  function createState(name, classroom, profile) {
    var slip = computePayslip(profile.gross, profile.creditPoints);
    return {
      version: 1,
      name: name,
      classroom: classroom || '',
      profileId: profile.id,

      /* المعطيات المالية الثابتة المشتقّة من البطاقة */
      gross: profile.gross,
      netSalary: slip.net,
      allowance: profile.allowance || 0,
      fixed: profile.fixed,
      overdraftLimit: profile.overdraft || 0,
      selfEmployed: !!profile.selfEmployed,

      /* المؤشّرات الحيّة */
      balance: profile.balance,
      savings: 0,
      debt: profile.debt || 0,
      monthlyCommit: 0,              /* أقساط والتزامات ثابتة أضافها اللاعب */
      wellness: profile.wellness,
      stress: profile.debt > 0 ? 25 : 12,
      iq: 0,
      credit: profile.credit,

      /* التقدّم */
      month: 1,
      decisions: [],
      completed: {},
      badges: [],
      flags: {},
      monthLog: [],
      startedAt: Date.now()
    };
  }

  /**
   * تطبيق أثر خيار على الحالة.
   * تُعيد كائن «الآثار الفعلية» ليعرضه الواجهة كتغذية راجعة مرئية.
   */
  function applyOption(state, scenario, stepIndex, option) {
    var fx = option.fx || {};
    var before = snapshot(state);

    if (fx.balance)  state.balance += fx.balance;
    if (fx.savings)  state.savings = Math.max(0, state.savings + fx.savings);
    if (fx.debt)     state.debt = Math.max(0, state.debt + fx.debt);
    if (fx.monthly)  state.monthlyCommit = Math.max(0, state.monthlyCommit + fx.monthly);
    if (fx.wellness) state.wellness = clamp(state.wellness + fx.wellness, 0, 100);
    if (fx.stress)   state.stress = clamp(state.stress + fx.stress, 0, 100);
    if (fx.iq)       state.iq += fx.iq;
    if (fx.credit)   state.credit = clamp(state.credit + fx.credit, CONST.CREDIT_MIN, CONST.CREDIT_MAX);

    /* الرايات (flags) تُفعِّل الأوسمة والمسارات اللاحقة */
    if (option.flags) {
      Object.keys(option.flags).forEach(function (k) { state.flags[k] = option.flags[k]; });
    }
    /* الدخول في السحب المكشوف يُسجَّل تلقائياً */
    if (state.balance < 0) state.flags.everOverdraft = true;

    state.decisions.push({
      scenarioId: scenario.id, loc: scenario.loc, competency: scenario.competency,
      step: stepIndex, quality: option.quality,
      title: scenario.title, text: option.text
    });

    return { before: before, after: snapshot(state), fx: fx };
  }

  function snapshot(s) {
    return { balance: s.balance, savings: s.savings, debt: s.debt,
             wellness: s.wellness, stress: s.stress, iq: s.iq, credit: s.credit };
  }

  /** تسجيل إتمام سيناريو كامل */
  function completeScenario(state, scenarioId, allScenarios) {
    state.completed[scenarioId] = true;
    if (allScenarios.every(function (sc) { return state.completed[sc.id]; })) {
      state.flags.allScenariosDone = true;
    }
  }

  /**
   * دورة نهاية الشهر — قلب المحاكاة الاقتصادية:
   *   1. يُودَع الراتب الصافي والمصروف
   *   2. تُخصم المصروفات الثابتة والالتزامات الشهرية
   *   3. تُحتسب فائدة السحب المكشوف على الرصيد السالب
   *   4. يُخدَم الدَّين: جزء من الالتزام يسدّد أصل الدَّين، والباقي فائدة
   *   5. تُضاف عوائد المدّخرات
   *   6. يرفع التضخّم المصروفات الثابتة للشهر القادم
   */
  function advanceMonth(state) {
    var log = { month: state.month, lines: [] };

    var income = state.netSalary + state.allowance;
    state.balance += income;
    log.income = round(income);

    var spend = state.fixed + state.monthlyCommit;
    state.balance -= spend;
    log.spend = round(spend);

    var odi = overdraftInterest(state.balance);
    if (odi > 0) { state.balance -= odi; state.stress = clamp(state.stress + 4, 0, 100); }
    log.overdraftInterest = odi;

    /* خدمة الدَّين: فائدة شهرية + سداد ما يسمح به الالتزام الشهري */
    var debtInterest = 0, debtPaid = 0;
    if (state.debt > 0) {
      debtInterest = round(state.debt * CONST.LOAN_RATE / 12, 2);
      state.debt += debtInterest;
      debtPaid = Math.min(state.debt, state.monthlyCommit);
      state.debt = Math.max(0, state.debt - debtPaid);
    }
    log.debtInterest = debtInterest;
    log.debtPaid = round(debtPaid);

    var yieldAmt = round(state.savings * CONST.SAVINGS_RATE / 12, 2);
    state.savings += yieldAmt;
    log.savingsYield = yieldAmt;

    /* التضخّم: المصروفات الثابتة ترتفع شهرياً بمعدّل التضخّم */
    var inflationAdd = round(state.fixed * CONST.INFLATION / 12, 2);
    state.fixed = round(state.fixed + inflationAdd, 2);
    log.inflation = inflationAdd;

    /* أثر الوضع المالي على الرفاهية والائتمان */
    if (state.balance >= 0) {
      state.wellness = clamp(state.wellness + 3, 0, 100);
      state.stress = clamp(state.stress - 4, 0, 100);
      state.credit = clamp(state.credit + 6, CONST.CREDIT_MIN, CONST.CREDIT_MAX);
    } else {
      state.wellness = clamp(state.wellness - 5, 0, 100);
      state.stress = clamp(state.stress + 6, 0, 100);
      state.credit = clamp(state.credit - 10, CONST.CREDIT_MIN, CONST.CREDIT_MAX);
    }

    log.endBalance = round(state.balance);
    state.monthLog.push(log);
    state.month += 1;
    return log;
  }

  /* ═══════════════════════════════════════════════════════════════
     التقييم والنتيجة
     ═══════════════════════════════════════════════════════════════ */

  var QUALITY_SCORE = { good: 100, mid: 60, bad: 15 };

  /** صافي الثروة = ما تملكه ناقص ما عليك */
  function netWorth(s) { return round(s.balance + s.savings - s.debt); }

  /**
   * النتيجة النهائية (0–100):
   *   70% جودة القرارات التربوية + 30% الصحّة المالية الناتجة.
   * هذا الوزن مقصود: الهدف التعلّمي هو جودة التفكير المالي لا الحظّ.
   */
  function evaluate(s) {
    var q = 0;
    if (s.decisions.length) {
      s.decisions.forEach(function (d) { q += QUALITY_SCORE[d.quality] || 0; });
      q = q / s.decisions.length;
    }

    var creditPct = clamp((s.credit - CONST.CREDIT_MIN) /
                          (CONST.CREDIT_MAX - CONST.CREDIT_MIN) * 100, 0, 100);
    var solvency  = clamp(50 + netWorth(s) / 120, 0, 100);
    var health    = (s.wellness + (100 - s.stress) + creditPct + solvency) / 4;

    var total = round(q * 0.7 + health * 0.3);
    return {
      total: total,
      decisionQuality: round(q),
      health: round(health),
      credit: round(s.credit),
      netWorth: netWorth(s),
      grade: gradeFor(total)
    };
  }

  function gradeFor(pct) {
    var list = global.DATA.GRADES;
    for (var i = 0; i < list.length; i++) if (pct >= list[i].min) return list[i];
    return list[list.length - 1];
  }

  /** توزيع الأداء على مجالات الكفاية وفق إطار OECD/PISA */
  function competencyBreakdown(s) {
    var acc = {};
    Object.keys(global.DATA.COMPETENCIES).forEach(function (k) { acc[k] = { sum: 0, n: 0 }; });
    s.decisions.forEach(function (d) {
      if (!acc[d.competency]) return;
      acc[d.competency].sum += QUALITY_SCORE[d.quality] || 0;
      acc[d.competency].n += 1;
    });
    return Object.keys(acc).map(function (k) {
      return { key: k, pct: acc[k].n ? Math.round(acc[k].sum / acc[k].n) : 0, count: acc[k].n };
    });
  }

  /** نقاط لوحة المتصدّرين: تجمع بين المعرفة والنتيجة المالية */
  function leaderboardScore(s) {
    return Math.max(0, Math.round(s.iq * 4 + evaluate(s).total * 3 + netWorth(s) / 60));
  }

  /** فحص الأوسمة المستحقّة؛ تُعيد قائمة الأوسمة الجديدة فقط */
  function checkBadges(s) {
    var fresh = [];
    global.DATA.BADGES.forEach(function (b) {
      if (s.badges.indexOf(b.id) === -1 && b.check(s)) { s.badges.push(b.id); fresh.push(b); }
    });
    return fresh;
  }

  /* ═══════════════════════════════════════════════════════════════
     الحفظ والاسترجاع (localStorage)
     ═══════════════════════════════════════════════════════════════ */
  function save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return (s && s.version === 1 && s.name) ? s : null;
    } catch (e) { return null; }
  }
  function clear() { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }

  global.ENGINE = {
    CONST: CONST,
    clamp: clamp, round: round,
    incomeTax: incomeTax, computePayslip: computePayslip,
    pmt: pmt, loanCost: loanCost, overdraftInterest: overdraftInterest,
    realValue: realValue, compound: compound,
    createState: createState, applyOption: applyOption,
    completeScenario: completeScenario, advanceMonth: advanceMonth,
    evaluate: evaluate, competencyBreakdown: competencyBreakdown,
    leaderboardScore: leaderboardScore, checkBadges: checkBadges,
    netWorth: netWorth,
    save: save, load: load, clear: clear
  };
})(window);
