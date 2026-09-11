/* ═══════════════════════════════════════════════════════════════════
   state.js — حالة اللاعب: الإنشاء، التعديل، الحفظ، والاسترجاع
   ───────────────────────────────────────────────────────────────────
   الحالة كائن بسيط قابل للتسلسل (JSON) بالكامل — لا كائنات Three.js
   ولا دوال داخله. هذا شرط الحفظ في localStorage، وهو أيضاً ما يجعل
   تصدير نتيجة الطالب للمعلّم أمراً مباشراً.
   ═══════════════════════════════════════════════════════════════════ */

import { ECONOMY, TIME } from '../content/config.js';
import { clamp, round } from './economy.js';

const STORAGE_KEY = 'finTown3D.save';
const SAVE_VERSION = 1;

/** حالة بداية جديدة */
export function createState(name, classroom) {
  return {
    version: SAVE_VERSION,
    name, classroom: classroom || '',
    startedAt: Date.now(),

    /* ── المال ── */
    balance: 1500,          /* ما ادّخره اللاعب قبل بداية القصّة */
    savings: 0,
    debt: 0,
    monthlyCommit: 0,       /* مجموع الأقساط والالتزامات الشهرية */
    credit: ECONOMY.CREDIT_START,

    /* ── الشخصية ── */
    energy: 100,
    iq: 0,                  /* نقاط الذكاء المالي */

    /* ── الزمن ── */
    day: 1, month: 1, hour: TIME.DAY_START, minute: 0,

    /* ── العمل ── */
    job: null,              /* {id, gross, creditPoints, travelAllowance} */

    /* ── التنقّل ── */
    car: null,              /* {id, price, consumption, reliability, color, odometerKm} */
    insurance: null,        /* معرّف مسار التأمين */
    fuel: 0,                /* لتر في الخزّان */
    busPassUntilMonth: 0,   /* الاشتراك الشهري فعّال حتى هذا الشهر ضمناً */
    busTripsThisMonth: 0,
    kmWalked: 0, kmDriven: 0, kmBus: 0,

    /* ── التقدّم ── */
    decisions: [],          /* سجلّ كل قرار: {id, quality, competency, ...} */
    quests: {},             /* معرّف المهمّة ← 'active' | 'done' */
    questIndex: 0,
    badges: [],
    flags: {},              /* رايات تفتح الأوسمة والمسارات */
    monthLog: [],
    visited: {}             /* المؤسسات التي دخلها اللاعب */
  };
}

/* ═══════════════════════════════════════════════════════════════
   تطبيق أثر قرار
   ═══════════════════════════════════════════════════════════════ */

/**
 * يطبّق حقول fx على الحالة ويسجّل القرار.
 * الحقول كلّها اختيارية:
 *   balance / savings / debt : مبالغ فورية
 *   monthly                  : تغيّر الالتزام الشهري الثابت
 *   energy / iq / credit     : مؤشّرات
 *   flags                    : رايات تُفعّل الأوسمة
 */
export function applyEffects(s, fx = {}, record = null) {
  if (fx.balance)  s.balance += fx.balance;
  if (fx.savings)  s.savings = Math.max(0, s.savings + fx.savings);
  if (fx.debt)     s.debt = Math.max(0, s.debt + fx.debt);
  if (fx.monthly)  s.monthlyCommit = Math.max(0, s.monthlyCommit + fx.monthly);
  if (fx.energy)   s.energy = clamp(s.energy + fx.energy, 0, 100);
  if (fx.iq)       s.iq += fx.iq;
  if (fx.credit)   s.credit = clamp(s.credit + fx.credit, ECONOMY.CREDIT_MIN, ECONOMY.CREDIT_MAX);
  if (fx.flags)    Object.assign(s.flags, fx.flags);

  /* الدخول في السحب المكشوف يُسجَّل تلقائياً أينما حدث */
  if (s.balance < 0) s.flags.everOverdraft = true;

  if (record) s.decisions.push(record);
  return s;
}

/** هل يستطيع اللاعب دفع مبلغ نقداً دون الدخول في مينوس؟ */
export function canAfford(s, amount) { return s.balance >= amount; }

/** خصم مبلغ مع تسجيل الدخول في المينوس إن حدث */
export function charge(s, amount) {
  s.balance -= amount;
  if (s.balance < 0) s.flags.everOverdraft = true;
  return round(s.balance);
}

/* ═══════════════════════════════════════════════════════════════
   الزمن
   ═══════════════════════════════════════════════════════════════ */

/** تقديم الساعة بعدد دقائق؛ يُعيد true إذا انتهى اليوم */
export function advanceMinutes(s, minutes) {
  s.minute += minutes;
  while (s.minute >= 60) { s.minute -= 60; s.hour += 1; }
  return s.hour >= TIME.DAY_END;
}

/** الساعة بصيغة 24 ساعة معزولة اتجاهياً */
export function clockString(s) {
  const hh = String(Math.floor(s.hour)).padStart(2, '0');
  const mm = String(Math.floor(s.minute)).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** هل المؤسسة مفتوحة الآن؟ (ساعات العمل 08:00–20:00) */
export function isOpenNow(s) { return s.hour >= 8 && s.hour < 20; }

/* ═══════════════════════════════════════════════════════════════
   الاشتراك الشهري للحافلات
   ═══════════════════════════════════════════════════════════════ */
export function hasBusPass(s) { return s.busPassUntilMonth >= s.month; }

/* ═══════════════════════════════════════════════════════════════
   الحفظ والاسترجاع
   ═══════════════════════════════════════════════════════════════ */

export function save(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
  catch (e) { /* وضع التصفّح الخاص أو file:// — نتابع بلا حفظ */ }
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return (s && s.version === SAVE_VERSION && s.name) ? s : null;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* تجاهل */ }
}
