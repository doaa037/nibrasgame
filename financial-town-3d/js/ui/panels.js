/* ═══════════════════════════════════════════════════════════════════
   panels.js — اللوحات المالية والأدوات التفاعلية
   ───────────────────────────────────────────────────────────────────
   هنا يصير المجرَّد ملموساً: قسيمة راتب حقيقية محسوبة من معطيات
   اللاعب، مقارنة تمويل بأرقامها، وميزانية شهرية تُظهر الفائض أو
   العجز. كل رقم في هذه اللوحات ناتج دوالّ economy.js — لا قيمة
   مكتوبة يدوياً، فلا يمكن أن يتناقض النصّ مع الحساب.
   ═══════════════════════════════════════════════════════════════════ */

import { t, getLang, COMPETENCIES } from '../content/i18n.js';
import { esc, money, num, frac, pct } from './util.js';
import {
  payslip, loanCost, transportCosts, fuelPrice, unitsToKm, evaluate,
  competencyBreakdown, leaderboardScore, safetyIndex, creditBand, round
} from '../sim/economy.js';
import { ECONOMY, INSURANCE, CARS_FOR_SALE, JOBS, TIME, CAR } from '../content/config.js';
import { BADGES, CLASSMATES } from '../content/quests.js';
import { BUS_STOPS, LOCATIONS } from '../content/world.data.js';
import { hasBusPass } from '../sim/state.js';

export class Panels {
  constructor(dialog) { this.dialog = dialog; }

  /* ═══════════════════════════════════════════════════════════════
     قسيمة الراتب
     ═══════════════════════════════════════════════════════════════ */
  showPayslip(state) {
    this.dialog.showPanel({
      icon: '🧾', title: 'tabPayslip', sub: 'gross',
      html: () => payslipHtml(state)
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     الميزانية الشهرية — الصورة الكاملة
     ═══════════════════════════════════════════════════════════════ */
  showBudget(state) {
    this.dialog.showPanel({
      icon: '📊', title: 'tabBudget', sub: 'compareNote',
      html: () => budgetHtml(state)
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     مقارنة القروض
     ═══════════════════════════════════════════════════════════════ */
  showLoans(state, game) {
    const offers = [
      { amount: 5000,  months: 24 },
      { amount: 10000, months: 36 },
      { amount: 10000, months: 60 }
    ].map(o => ({ ...o, ...loanCost(o.amount, ECONOMY.LOAN_RATE, o.months) }));

    this.dialog.showMenu({
      icon: '💳', title: 'tabBudget',
      intro: { ar: 'انتبه: القسط الأصغر لا يعني القرض الأرخص. قارن دائماً إجمالي الفوائد.',
               he: 'שימו לב: ההחזר הקטן אינו ההלוואה הזולה. השוו תמיד את סך הריבית.' },
      state,
      items: offers.map(o => ({
        label: { ar: `${o.amount.toLocaleString('en-US')} ₪ · ${o.months} قسطاً`,
                 he: `${o.amount.toLocaleString('en-US')} ₪ · ${o.months} תשלומים` },
        hint:  { ar: `القسط ${o.monthly} ₪ · إجمالي الفوائد ${o.interest} ₪`,
                 he: `החזר ${o.monthly} ₪ · סך ריבית ${o.interest} ₪` },
        action: 'takeLoan', data: { amount: o.amount, months: o.months }
      })),
      onPick: (item) => { game.runAction(item.action, item.data); this.dialog.close(); }
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     تقرير الائتمان
     ═══════════════════════════════════════════════════════════════ */
  showCreditReport(state) {
    this.dialog.showPanel({
      icon: '📈', title: 'hCredit', html: () => creditReportHtml(state)
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     مسارات التأمين
     ═══════════════════════════════════════════════════════════════ */
  showInsurance(state, game) {
    this.dialog.showMenu({
      icon: '🛡️', title: 'insurance',
      intro: { ar: 'الفرق بين المسارات ليس السعر فقط، بل من يدفع حين يقع الضرر.',
               he: 'ההבדל בין המסלולים אינו רק המחיר, אלא מי משלם כשנגרם נזק.' },
      state,
      items: INSURANCE.map(p => ({
        label: { ar: `${insuranceName(p.id).ar} — ${p.monthly} ₪ ${t('perMonth')}`,
                 he: `${insuranceName(p.id).he} — ${p.monthly} ₪ ${t('perMonth')}` },
        hint: p.coversOwnCar
          ? { ar: `يغطّي سيارتك وسيارة الغير · تحمّل ${p.deductible} ₪`,
              he: `מכסה את רכבך ואת רכב הצד השני · השתתפות ${p.deductible} ₪` }
          : p.coversThirdParty
            ? { ar: `يغطّي ضرر الغير فقط · تحمّل ${p.deductible} ₪`,
                he: `מכסה נזק לצד ג׳ בלבד · השתתפות ${p.deductible} ₪` }
            : { ar: 'إصابات الأشخاص فقط — لا يغطّي أيّ مركبة',
                he: 'נזקי גוף בלבד — אינו מכסה שום רכב' },
        action: 'buyInsurance', data: { planId: p.id }
      })),
      onPick: (item) => { game.runAction(item.action, item.data); this.dialog.close(); }
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     وجهات الحافلة
     ═══════════════════════════════════════════════════════════════ */
  showBusDestinations(state, game) {
    const free = hasBusPass(state);
    this.dialog.showMenu({
      icon: '🚌', title: 'busTitle', sub: 'busPick',
      intro: free ? 'busPassActive'
                  : { ar: `أجرة الرحلة ${ECONOMY.BUS_TICKET} ₪ · ${t('busPassMath')}`,
                      he: `מחיר הנסיעה ${ECONOMY.BUS_TICKET} ₪ · ${t('busPassMath')}` },
      state,
      items: BUS_STOPS.filter(s => s.id !== game.nearestStopId).map(stop => {
        const near = LOCATIONS.find(l => l.id === stop.linkedTo);
        return {
          label: { ar: `محطّة قرب ${t(near.nameKey)}`, he: `תחנה ליד ${t(near.nameKey)}` },
          hint: free ? { ar: 'مشمولة باشتراكك', he: 'כלולה במנוי' }
                     : { ar: `−${ECONOMY.BUS_TICKET} ₪`, he: `−${ECONOMY.BUS_TICKET} ₪` },
          action: 'rideBus', data: { stopId: stop.id }
        };
      }),
      onPick: (item) => { game.runAction(item.action, item.data); this.dialog.close(); }
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     تقرير نهاية الشهر
     ═══════════════════════════════════════════════════════════════ */
  showMonthReport(lines, state) {
    this.dialog.showPanel({
      icon: '📅', title: 'monthReport',
      html: () => `
        <table class="sheet">
          ${lines.map(l => `
            <tr class="${l.isSum ? 'sum' : ''}">
              <td>${esc(t(l.key))}</td>
              <td class="${l.amount < 0 ? 'bad' : 'good'}">${money(l.amount)}</td>
            </tr>`).join('')}
        </table>
        <p class="note">${esc(t({
          ar: 'انتبه: التضخّم يرفع مصروفاتك الثابتة كل شهر حتى لو لم يتغيّر سلوكك إطلاقاً.',
          he: 'שימו לב: האינפלציה מייקרת את ההוצאות הקבועות מדי חודש גם אם ההתנהגות לא השתנתה.'
        }))}</p>`
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     الأوسمة ولوحة المتصدّرين
     ═══════════════════════════════════════════════════════════════ */
  showBadges(state) {
    this.dialog.showPanel({
      icon: '🏅', title: 'badges', sub: 'badgesSub',
      html: () => badgesHtml(state) + leaderboardHtml(state)
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     التقرير الختامي
     ═══════════════════════════════════════════════════════════════ */
  showFinalReport(state, game) {
    this.dialog.showPanel({
      icon: '🎓', title: 'finalReport',
      html: () => finalReportHtml(state),
      foot: `
        <button class="btn btn-ghost" data-report="print">🖨️ ${esc(t('printReport'))}</button>
        <button class="btn btn-ghost" data-report="copy">📋 ${esc(t('copyForTeacher'))}</button>
        <button class="btn btn-gold" data-report="back">${esc(t('backToTown'))}</button>`
    });
    /* أزرار التذييل تحتاج ربطاً بعد الرسم */
    setTimeout(() => {
      const root = this.dialog.root;
      root.querySelector('[data-report="print"]')?.addEventListener('click', () => window.print());
      root.querySelector('[data-report="copy"]')?.addEventListener('click', (e) =>
        copyResult(state, e.currentTarget));
      root.querySelector('[data-report="back"]')?.addEventListener('click', () => this.dialog.close());
    }, 0);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   الأدوات التفاعلية داخل الحوارات
   تُستدعى بالاسم من dialog.js عبر ctx.renderWidget
   ═══════════════════════════════════════════════════════════════════ */
export function renderWidget(name, state) {
  switch (name) {
    case 'jobOffers':        return jobOffersHtml();
    case 'carOffers':        return carOffersHtml(state);
    case 'financeCompare':   return financeCompareHtml(state);
    case 'insuranceCompare': return insuranceCompareHtml();
    case 'creditReport':     return creditReportHtml(state);
    case 'phishingSms':      return phishingHtml();
    case 'payslip':          return payslipHtml(state);
    default: return '';
  }
}

/* ─────────────── قسيمة الراتب ─────────────── */
function payslipHtml(state) {
  if (!state.job) return `<p class="note">${esc(t('noJobYet'))}</p>`;
  const j = state.job;
  const s = payslip(j.gross, j.creditPoints, j.travelAllowance);
  const row = (label, why, val, cls = '') => `
    <tr class="${cls}">
      <td>${esc(label)}${why ? `<span class="why">${esc(why)}</span>` : ''}</td>
      <td>${money(val)}</td>
    </tr>`;

  return `
    <table class="sheet payslip">
      ${row(t('gross'), '', s.gross)}
      ${row(t('incomeTax'), `${t('afterPoints')} (${j.creditPoints})`, -s.tax, 'ded')}
      ${row(t('ni'), '0.4% / 7%', -s.ni, 'ded')}
      ${row(t('health'), '3.1% / 5%', -s.health, 'ded')}
      ${row(t('pension'), getLang() === 'he' ? 'נחסך עבורך — לא מס' : 'يُدَّخر لك — ليس ضريبة', -s.pension, 'ded')}
      ${s.travelAllowance ? row(t('travelPay'), t('travelRight'), s.travelAllowance, 'add') : ''}
      <tr class="sum"><td>${esc(t('net'))}</td><td>${money(s.net)}</td></tr>
    </table>
    <p class="note">${esc(t('employerAdds'))}:
      ${esc(t('pension'))} ${money(s.employerPension)} ·
      ${esc(t('severance'))} ${money(s.employerSeverance)}</p>`;
}

/* ─────────────── عروض العمل ─────────────── */
function jobOffersHtml() {
  return `<div class="cards">${JOBS.map(j => {
    const s = payslip(j.gross, j.creditPoints, j.travelAllowance);
    return `<div class="card-mini">
      <b>${money(j.gross)}</b>
      <small>${esc(t('gross'))}</small>
      <div class="kv"><span>${esc(t('net'))}</span>${money(s.net)}</div>
      <div class="kv"><span>${esc(t('travelPay'))}</span>${money(j.travelAllowance)}</div>
    </div>`;
  }).join('')}</div>`;
}

/* ─────────────── عروض السيارات ─────────────── */
function carOffersHtml(state) {
  const litre = fuelPrice(state.month);
  return `<div class="cards">${CARS_FOR_SALE.map(c => {
    const monthlyFuel = round(600 * c.consumption * litre);   /* 600 كم شهرياً افتراضاً */
    return `<div class="card-mini">
      <b>${money(c.price)}</b>
      <small>${c.year}</small>
      <div class="kv"><span>${esc(t('fuel'))} (600 ${esc(t('km'))})</span>${money(monthlyFuel)}</div>
      <div class="kv"><span>${esc(t('hCredit'))}</span>${pct(c.reliability * 100)}</div>
    </div>`;
  }).join('')}</div>`;
}

/* ─────────────── مقارنة التمويل ─────────────── */
function financeCompareHtml(state) {
  const price = 32000;
  const bank = loanCost(price, ECONOMY.LOAN_RATE, 48);
  const dealer = loanCost(price + 2500, ECONOMY.DEALER_LOAN_RATE, 48);
  const col = (title, o, best) => `
    <div class="card-mini ${best ? 'best' : ''}">
      <b>${esc(title)}</b>
      <div class="kv"><span>${esc(t('loanPayment'))}</span>${money(o.monthly)}</div>
      <div class="kv"><span>${esc(t('total'))}</span>${money(o.total)}</div>
      <div class="kv ${best ? 'good' : 'bad'}"><span>${esc(t('theRule'))}</span>${money(o.interest)}</div>
    </div>`;
  return `<div class="cards">
    <div class="card-mini best"><b>${esc(getLang() === 'he' ? 'מזומן' : 'نقداً')}</b>
      <div class="kv"><span>${esc(t('total'))}</span>${money(price)}</div>
      <div class="kv good"><span>${esc(t('theRule'))}</span>${money(0)}</div></div>
    ${col(getLang() === 'he' ? 'הלוואה בנקאית 9%' : 'قرض بنكي 9%', bank, false)}
    ${col(getLang() === 'he' ? 'מימון סוכנות' : 'تمويل المعرض', dealer, false)}
  </div>`;
}

/* ─────────────── مقارنة التأمين ─────────────── */
function insuranceCompareHtml() {
  return `<div class="cards">${INSURANCE.map(p => `
    <div class="card-mini">
      <b>${esc(insuranceName(p.id)[getLang()] || insuranceName(p.id).ar)}</b>
      <small>${money(p.monthly)} ${esc(t('perMonth'))}</small>
      <div class="kv"><span>${esc(getLang() === 'he' ? 'רכבך' : 'سيارتك')}</span>
        ${p.coversOwnCar ? '✅' : '❌'}</div>
      <div class="kv"><span>${esc(getLang() === 'he' ? 'צד ג׳' : 'الطرف الثالث')}</span>
        ${p.coversThirdParty ? '✅' : '❌'}</div>
      <div class="kv"><span>${esc(getLang() === 'he' ? 'השתתפות' : 'التحمّل')}</span>
        ${money(p.deductible)}</div>
    </div>`).join('')}</div>`;
}

function insuranceName(id) {
  return {
    mandatory:     { ar: 'إجباري (חובה)', he: 'חובה' },
    third:         { ar: 'طرف ثالث (צד ג׳)', he: 'צד ג׳' },
    comprehensive: { ar: 'شامل (מקיף)', he: 'מקיף' }
  }[id];
}

/* ─────────────── رسالة التصيّد ─────────────── */
function phishingHtml() {
  const he = getLang() === 'he';
  return `<div class="phone">
    <div class="phone-head">${he ? 'הודעה נכנסת' : 'رسالة واردة'} · SMS</div>
    <div class="sms">
      <div class="sms-from">BANK-SEC</div>
      <div class="sms-body">${he
        ? 'זוהתה פעילות חשודה בחשבונך. עדכן פרטים תוך 24 שעות אחרת החשבון ייחסם: bit.ly/bnk-vrfy'
        : 'رُصد نشاط مشبوه في حسابك. حدِّث تفاصيلك خلال 24 ساعة وإلّا سيُجمَّد الحساب: bit.ly/bnk-vrfy'}</div>
    </div>
  </div>`;
}

/* ─────────────── تقرير الائتمان ─────────────── */
function creditReportHtml(state) {
  const band = creditBand(state.credit);
  const labels = {
    excellent: { ar: 'ممتاز', he: 'מצוין' }, good: { ar: 'جيّد', he: 'טוב' },
    fair:      { ar: 'متوسّط', he: 'בינוני' }, weak: { ar: 'ضعيف', he: 'חלש' }
  };
  const p = (state.credit - ECONOMY.CREDIT_MIN) / (ECONOMY.CREDIT_MAX - ECONOMY.CREDIT_MIN) * 100;
  const factors = [
    { ok: !state.flags.everOverdraft,
      ar: 'حساب بلا مينوس متكرّر', he: 'חשבון ללא מינוס חוזר' },
    { ok: state.monthlyCommit === 0 || state.debt === 0,
      ar: 'عبء أقساط منخفض', he: 'נטל החזרים נמוך' },
    { ok: !!state.flags.rightsClaimed || !!state.job,
      ar: 'دخل موثّق بقسيمة راتب', he: 'הכנסה מתועדת בתלוש' },
    { ok: !!state.flags.scamBlocked,
      ar: 'لا نشاط احتيالي على الحساب', he: 'אין פעילות הונאה בחשבון' }
  ];
  return `
    <div class="gauge">
      <div class="gauge-value">${frac(Math.round(state.credit), ECONOMY.CREDIT_MAX)}</div>
      <div class="bar big"><i style="width:${p}%"></i></div>
      <div class="gauge-band">${esc(t(labels[band]))}</div>
    </div>
    <ul class="checks">
      ${factors.map(f => `<li class="${f.ok ? 'ok' : 'no'}">${f.ok ? '✅' : '⚠️'}
        ${esc(t({ ar: f.ar, he: f.he }))}</li>`).join('')}
    </ul>`;
}

/* ─────────────── الميزانية ─────────────── */
function budgetHtml(state) {
  const slip = state.job ? payslip(state.job.gross, state.job.creditPoints, state.job.travelAllowance) : null;
  const income = slip ? slip.net : 0;

  const kmMonth = round(unitsToKm(state.kmDriven * CAR.UNITS_PER_KM) + 120);
  const plan = INSURANCE.find(p => p.id === state.insurance);
  const costs = transportCosts({
    kmPerMonth: Math.max(60, kmMonth),
    tripsPerMonth: Math.max(state.busTripsThisMonth, 20),
    monthIndex: state.month,
    carConsumption: state.car ? state.car.consumption : CAR.CONSUMPTION_PER_KM,
    insuranceMonthly: plan ? plan.monthly : 0,
    loanMonthly: state.flags.hasCarLoan ? round(state.monthlyCommit - (plan ? plan.monthly : 0)) : 0,
    hasPass: hasBusPass(state)
  });

  const expenses = ECONOMY.RENT + ECONOMY.BILLS
                 + ECONOMY.FOOD_PER_DAY * 30 + state.monthlyCommit;
  const balance = income - expenses;

  return `
    ${slip ? '' : `<p class="note warn">${esc(t('noJobYet'))}</p>`}
    <table class="sheet">
      <tr><td>${esc(t('income'))}</td><td class="good">${money(income)}</td></tr>
      <tr><td>${esc(t('rent'))}</td><td class="bad">${money(-ECONOMY.RENT)}</td></tr>
      <tr><td>${esc(t('bills'))}</td><td class="bad">${money(-ECONOMY.BILLS)}</td></tr>
      <tr><td>${esc(t('food'))}</td><td class="bad">${money(-ECONOMY.FOOD_PER_DAY * 30)}</td></tr>
      ${state.monthlyCommit ? `<tr><td>${esc(t('loanPayment'))} + ${esc(t('insurance'))}</td>
        <td class="bad">${money(-state.monthlyCommit)}</td></tr>` : ''}
      <tr class="sum"><td>${esc(t(balance >= 0 ? 'netMonthly' : 'deficit'))}</td>
        <td class="${balance >= 0 ? 'good' : 'bad'}">${money(balance)}</td></tr>
    </table>

    <h4 class="sub">🚌 ${esc(t('tabTransport'))}</h4>
    <div class="cards">
      <div class="card-mini ${costs.walking.monthly === 0 ? 'best' : ''}">
        <b>🚶 ${esc(t('onFoot'))}</b><small>${money(0)} ${esc(t('perMonth'))}</small>
      </div>
      <div class="card-mini">
        <b>🚌 ${esc(t('busOption'))}</b>
        <small>${money(costs.bus.monthly)} ${esc(t('perMonth'))}</small>
        <div class="kv"><span>${esc(getLang() === 'he' ? 'נקודת איזון' : 'نقطة التعادل')}</span>
          ${num(costs.bus.breakEvenTrips)}</div>
      </div>
      <div class="card-mini">
        <b>🚗 ${esc(t('ownCarOption'))}</b>
        <small>${money(costs.car.monthly)} ${esc(t('perMonth'))}</small>
        <div class="kv"><span>${esc(t('fuel'))}</span>${money(costs.car.fuel)}</div>
        <div class="kv"><span>${esc(t('insurance'))}</span>${money(costs.car.insurance)}</div>
        <div class="kv"><span>${esc(t('costPerKm'))}</span>${money(costs.car.perKm)}</div>
      </div>
    </div>
    <p class="note">${esc(t('compareNote'))}</p>`;
}

/* ─────────────── الأوسمة والمتصدّرون ─────────────── */
function badgesHtml(state) {
  return `<div class="badges">${BADGES.map(b => {
    const got = state.badges.includes(b.id);
    return `<div class="badge ${got ? 'earned' : ''}">
      <div class="b-icon">${got ? b.icon : '🔒'}</div>
      <div class="b-name">${esc(t(b.name))}</div>
      <div class="b-desc">${esc(t(b.desc))}</div>
    </div>`;
  }).join('')}</div>`;
}

function leaderboardHtml(state) {
  const mine = leaderboardScore(state);
  const rows = CLASSMATES.map((c, i) => ({
    name: t(c), score: c.base + ((state.name.length * 37 + i * 53) % 120), me: false
  }));
  rows.push({ name: `${state.name} (${t('you')})`, score: mine, me: true });
  rows.sort((a, b) => b.score - a.score);

  return `<h4 class="sub">📊 ${esc(t('leaderboard'))}</h4>
    <p class="note">${esc(t('leaderboardSub'))}</p>
    ${rows.map((r, i) => `<div class="lb-row ${r.me ? 'me' : ''}">
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-name">${esc(r.name)}</span>
      <span class="lb-score">${num(r.score)}</span>
    </div>`).join('')}`;
}

/* ─────────────── التقرير الختامي ─────────────── */
function finalReportHtml(state) {
  const ev = evaluate(state);
  const comps = competencyBreakdown(state, Object.keys(COMPETENCIES));

  return `
    <div class="report-hero">
      <div class="grade">${ev.grade.letter}</div>
      <div class="chip">${esc(t('finalScore'))}: ${frac(ev.total, 100)}</div>
      <h3>${esc(state.name)}${state.classroom ? ` · ${esc(state.classroom)}` : ''}</h3>
    </div>

    <div class="cards">
      <div class="card-mini"><b>${money(state.balance)}</b><small>${esc(t('hBalance'))}</small></div>
      <div class="card-mini"><b>${money(state.savings)}</b><small>${esc(t('tabBudget'))}</small></div>
      <div class="card-mini"><b>${money(state.debt)}</b><small>${esc(t('hDebt'))}</small></div>
      <div class="card-mini"><b>${frac(Math.round(state.credit), 1000)}</b><small>${esc(t('hCredit'))}</small></div>
      <div class="card-mini"><b>${frac(safetyIndex(state), 100)}</b><small>${esc(t('hSafety'))}</small></div>
      <div class="card-mini"><b>${num(state.iq)}</b><small>🧠</small></div>
    </div>

    <h4 class="sub">🎯 ${esc(t('skillsMap'))}</h4>
    <p class="note">${esc(t('skillsMapSub'))}</p>
    ${comps.map(c => {
      const meta = COMPETENCIES[c.key];
      const color = c.pct >= 75 ? 'var(--good)' : c.pct >= 50 ? 'var(--warn)' : 'var(--bad)';
      return `<div class="skill">
        <div class="skill-head"><span>${meta.icon} ${esc(t(meta.name))}</span><b>${pct(c.pct)}</b></div>
        <div class="bar"><i style="width:${c.pct}%;background:${color}"></i></div>
      </div>`;
    }).join('')}

    ${badgesHtml(state)}

    <h4 class="sub">📝 ${esc(t('decisionLog'))}</h4>
    <p class="note">${num(state.decisions.length)} ${esc(t('decisionsMade'))}</p>
    ${state.decisions.map(d => {
      const cls = d.quality === 'good' ? 'ok' : d.quality === 'mid' ? 'mid' : 'bad';
      const ico = d.quality === 'good' ? '✅' : d.quality === 'mid' ? '🟡' : '❌';
      return `<div class="log ${cls}"><span>${ico}</span>
        <span><b>${esc(t(d.title))}</b><small>${esc(t(d.text))}</small></span></div>`;
    }).join('')}`;
}

/** نسخ ملخّص النتيجة للمعلّم أو لمجموعة الصفّ */
function copyResult(state, button) {
  const ev = evaluate(state);
  const text = [
    `${t('gameName')} — ${t('finalReport')}`,
    `${state.name}${state.classroom ? ` · ${state.classroom}` : ''}`,
    `${t('finalScore')}: ${ev.total}/100 (${ev.grade.letter})`,
    `${t('hSafety')}: ${safetyIndex(state)}/100 | ${t('hCredit')}: ${Math.round(state.credit)}`,
    `${t('hBalance')}: ${Math.round(state.balance)} ₪ | ${t('hDebt')}: ${Math.round(state.debt)} ₪`,
    `${t('badges')}: ${state.badges.length}/${BADGES.length}`
  ].join('\n');

  const done = () => {
    const original = button.textContent;
    button.textContent = t('copied');
    setTimeout(() => { button.textContent = original; }, 1600);
  };

  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => fallback(text, done));
  else fallback(text, done);
}

function fallback(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); cb(); } catch (e) { /* تجاهل */ }
  ta.remove();
}
