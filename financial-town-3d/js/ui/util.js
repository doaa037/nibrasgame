/* ═══════════════════════════════════════════════════════════════════
   util.js — أدوات عرض مشتركة
   ───────────────────────────────────────────────────────────────────
   نقطة مهمّة في واجهة ثنائية الاتجاه: الأرقام والمبالغ تُكتب دائماً
   من اليسار لليمين حتى داخل نصّ عربي أو عبري. لذلك كل رقم يُغلَّف
   بعنصر معزول اتجاهياً (unicode-bidi: isolate)، وإلّا انقلب ترتيب
   «63/100» أو التصق رمز الشيكل بالكلمة المجاورة.
   ═══════════════════════════════════════════════════════════════════ */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** تهريب النصّ قبل إدراجه في HTML */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** مبلغ بالشيكل بأرقام لاتينية معزولة اتجاهياً */
export function money(n) {
  const v = Math.round(n);
  const sign = v < 0 ? '−' : '';
  return `<span class="num">${sign}${Math.abs(v).toLocaleString('en-US')} ₪</span>`;
}

export function num(n) { return `<span class="num">${n}</span>`; }

/** كسر (مثل 63/100) داخل عزل اتجاهي واحد حتى لا ينقلب ترتيبه */
export function frac(a, b) { return `<span class="num">${a}/${b}</span>`; }

/** نسبة مئوية معزولة */
export function pct(n) { return `<span class="num">${Math.round(n)}%</span>`; }

/** ينشئ عنصراً من نصّ HTML */
export function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

/** لون دلالي حسب موقع القيمة */
export function toneClass(v, goodAbove, badBelow) {
  if (v >= goodAbove) return 'good';
  if (v <= badBelow) return 'bad';
  return 'warn';
}
