/* ═══════════════════════════════════════════════════════════════════
   shopping.js — سلّة التسوّق وتقييم القرار الاستهلاكي
   ───────────────────────────────────────────────────────────────────
   دوالّ خالصة على بيانات السلّة. التقييم لا يسأل «هل بقيت في
   الميزانية؟» فقط — بل أربعة أسئلة يسألها مستهلك واعٍ:
     1. هل اشتريت ما أحتاجه فعلاً؟             (التغطية)
     2. هل بقيت داخل الميزانية؟                (الانضباط)
     3. كم من المال ذهب لما ليس في القائمة؟    (الرغبات والاندفاع)
     4. هل قارنت السعر للوحدة لا سعر العبوة؟   (الوعي السعري)
   ═══════════════════════════════════════════════════════════════════ */

import { PRODUCTS, NEED_CATEGORIES } from '../content/shop.data.js';
import { round } from './economy.js';

const BY_ID = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));

export function createCart() { return { items: {} }; }         /* productId → qty */

export function addToCart(cart, productId, qty = 1) {
  cart.items[productId] = (cart.items[productId] || 0) + qty;
  return cart;
}
export function removeFromCart(cart, productId, qty = 1) {
  const n = (cart.items[productId] || 0) - qty;
  if (n <= 0) delete cart.items[productId]; else cart.items[productId] = n;
  return cart;
}
export function cartLines(cart) {
  return Object.entries(cart.items).map(([id, qty]) => ({ product: BY_ID[id], qty, total: round(BY_ID[id].price * qty, 2) }));
}
export function cartTotal(cart) {
  return round(cartLines(cart).reduce((s, l) => s + l.total, 0), 2);
}
export function unitPrice(product) {
  return round(product.price / product.unit.qty, 2);
}

/**
 * أرخص سعر للوحدة لكل فئة حاجة — المرجع للوعي السعري.
 * نستثني العبوات الكبيرة من المرجع: اختيار كيلو أرز بدل خمسة ليس
 * «دفعاً زائداً للماركة» بل قرار سيولة مشروع حين يكون النقد ضيّقاً.
 * فرص العبوات الكبيرة تُعرض كنصيحة منفصلة لا كعقوبة.
 */
function cheapestUnitByNeed(includeBulk = false) {
  const out = {};
  for (const p of PRODUCTS) {
    /* المرجع = أرخص خيار «عادي» بعبوة واحدة. العبوات الكبيرة والعروض
       تُقاس منفصلةً: هي قرارات مخزون وسيولة لا قرارات ماركة */
    if (!p.need || (!includeBulk && (p.kind === 'bulk' || p.kind === 'promo'))) continue;
    const u = unitPrice(p);
    if (!out[p.need] || u < out[p.need].unit) out[p.need] = { unit: u, product: p };
  }
  return out;
}

/**
 * تقييم السلّة عند الصندوق.
 * يعيد تحليلاً مفصَّلاً + جودة إجمالية good|mid|bad + نقاط ذكاء مالي.
 */
export function evaluateCart(cart, mission) {
  const lines = cartLines(cart);
  const total = cartTotal(cart);
  const budget = mission.budget;

  /* 1) التغطية */
  const covered = new Set(lines.filter(l => l.product.need).map(l => l.product.need));
  const missing = mission.needs.filter(n => !covered.has(n));

  /* 2) الميزانية */
  const overBy = round(total - budget, 2);
  const budgetGrade = overBy <= 0 ? 'good' : overBy <= budget * 0.1 ? 'mid' : 'bad';

  /* 3) ما ليس في القائمة */
  const wantsLines = lines.filter(l => !l.product.need);
  const wantsTotal = round(wantsLines.reduce((s, l) => s + l.total, 0), 2);
  const wantsShare = total > 0 ? wantsTotal / total : 0;
  const impulse = wantsLines.filter(l => l.product.kind === 'impulse');
  /* عرض على شيء ليس في القائمة = فخّ؛ عرض على حاجة = ملاحظة (دفعت أكثر الآن مقابل مخزون) */
  const promoTraps = lines.filter(l => l.product.kind === 'promo' && !l.product.need);
  const promoOnNeed = lines.filter(l => l.product.kind === 'promo' && l.product.need);
  let wantsGrade = wantsShare <= 0.15 ? 'good' : wantsShare <= 0.3 ? 'mid' : 'bad';
  /* الوقوع في فخّ عرض أو شراء اندفاعي عند الصندوق يُنزل الدرجة مرتبة —
     ولو كان المبلغ صغيراً: النمط هو ما يُعاقَب لا الرقم */
  if (impulse.length || promoTraps.length) wantsGrade = wantsGrade === 'good' ? 'mid' : 'bad';

  /* 4) الوعي السعري: لكل حاجة مشتراة، هل اختار الأرخص للوحدة أو ما يقاربه؟ */
  const cheapest = cheapestUnitByNeed(false);
  const cheapestAny = cheapestUnitByNeed(true);
  const priceChoices = [], bulkOpportunities = [];
  for (const l of lines) {
    const p = l.product;
    if (!p.need) continue;
    const best = cheapest[p.need];
    const ratio = unitPrice(p) / best.unit;
    priceChoices.push({ product: p, unit: unitPrice(p), bestUnit: best.unit, bestProduct: best.product,
                        ratio: round(ratio, 2), smart: ratio <= 1.15 || p.kind === 'bulk' || p.kind === 'promo' });
    const bulkBest = cheapestAny[p.need];
    if (p.kind === 'basic' && bulkBest.product.kind === 'bulk') {
      bulkOpportunities.push({ product: p, bulk: bulkBest.product, unit: unitPrice(p), bulkUnit: bulkBest.unit });
    }
  }
  const brandOverpay = priceChoices.filter(c => !c.smart);
  const priceGrade = brandOverpay.length === 0 ? 'good' : brandOverpay.length <= 2 ? 'mid' : 'bad';

  /* التركيب: التغطية والميزانية أثقل وزناً — هما جوهر «العيش بميزانية» */
  const score = (missing.length === 0 ? 30 : Math.max(0, 30 - missing.length * 8))
              + gradePts(budgetGrade, 30) + gradePts(wantsGrade, 20) + gradePts(priceGrade, 20);
  /* لا «ممتاز» مع فخّ عرض أو شراء اندفاعي — حتى لو كانت الأرقام جيّدة:
     الهدف تربية نمط، والنمط الذي يقع في الفخّ لم يكتمل بعد */
  const quality = score >= 78 && wantsGrade !== 'bad' ? 'good' : score >= 52 ? 'mid' : 'bad';
  const iq = quality === 'good' ? 22 : quality === 'mid' ? 11 : 4;

  return {
    total, budget, overBy, lines, missing, covered: [...covered],
    wantsTotal, wantsShare: round(wantsShare, 2), impulse, promoTraps, promoOnNeed,
    priceChoices, brandOverpay, bulkOpportunities, budgetGrade, wantsGrade, priceGrade,
    score, quality, iq,
    flags: {
      budgetKept: overBy <= 0 && missing.length === 0,
      impulseResisted: impulse.length === 0,
      unitPricer: brandOverpay.length === 0 && priceChoices.length >= 5
    }
  };
}

function gradePts(g, max) { return g === 'good' ? max : g === 'mid' ? max * 0.5 : max * 0.15; }

export { BY_ID as PRODUCT_BY_ID, NEED_CATEGORIES };
