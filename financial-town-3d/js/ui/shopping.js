/* ═══════════════════════════════════════════════════════════════════
   shopping.js (ui) — سلّة التسوّق، قائمة الحاجات، وفاتورة الصندوق
   ───────────────────────────────────────────────────────────────────
   واجهة تجربة السوبرماركت: مؤشّر سلّة حيّ يُظهر الإجمالي مقابل
   الميزانية وأيّ حاجات غُطّيت، لوحة سلّة مفصّلة للإزالة، ولوحة صندوق
   تُقيّم القرار الاستهلاكي ببنود واضحة قبل الدفع — فالتعلّم يحدث في
   لحظة «هل أدفع أم أعيد شيئاً إلى الرفّ؟».
   ═══════════════════════════════════════════════════════════════════ */

import { t } from '../content/i18n.js';
import { esc, money, num, pct } from './util.js';
import { cartLines, cartTotal, unitPrice, NEED_CATEGORIES } from '../sim/shopping.js';

export class ShoppingUI {
  constructor(hudRoot, dialog) {
    this.root = hudRoot;
    this.dialog = dialog;
    this.cart = null; this.mission = null;
  }

  /* ─────────────── مؤشّر السلّة الحيّ ─────────────── */
  show(cart, mission, onChange) {
    this.cart = cart; this.mission = mission;
    if (onChange) this._onChange = onChange;
    this.root.classList.remove('hidden');
    this.update();
  }
  hide() { this.root.classList.add('hidden'); this.cart = null; }

  update() {
    if (!this.cart) return;
    const total = cartTotal(this.cart);
    const left = this.mission.budget - total;
    const lines = cartLines(this.cart);
    const covered = new Set(lines.filter(l => l.product.need).map(l => l.product.need));
    const count = lines.reduce((s, l) => s + l.qty, 0);
    const p = Math.min(100, total / this.mission.budget * 100);

    this.root.innerHTML = `
      <div class="c-head">
        <span class="c-title">🛒 ${esc(t('cart'))}</span>
        <span class="c-count">${num(count)}</span>
      </div>
      <div class="c-total">${money(total)}</div>
      <div class="c-budget ${left < 0 ? 'over' : ''}">
        ${left < 0 ? esc(t('overBudget')) + ' ' + money(-left)
                   : esc(t('budgetLeft')) + ': ' + money(left)}
      </div>
      <div class="bar"><i style="width:${p}%;background:${left < 0 ? 'var(--bad)' : p > 80 ? 'var(--warn)' : 'var(--good)'}"></i></div>
      <div class="c-list">${NEED_CATEGORIES.map(c =>
        `<span class="c-need ${covered.has(c.id) ? 'ok' : ''}">${c.icon} ${esc(t(c.name))}</span>`).join('')}</div>
      <button class="c-open" data-open-cart>${esc(t('cart'))} ›</button>`;
    this.root.querySelector('[data-open-cart]').addEventListener('click', () => this.openCartPanel());
  }

  /** تلميح المنتج عند الاقتراب من الرفّ */
  productPrompt(product) {
    const u = unitPrice(product);
    return `<kbd>E</kbd> ${esc(t(product.name))} — <span class="num">${product.price} ₪</span>
      <small style="opacity:.75">(${esc(t('perUnit'))} <span class="num">${u} ₪</span>/${esc(t(product.unit.label))})</small>`;
  }

  /* ─────────────── لوحة السلّة ─────────────── */
  openCartPanel(onChange) {
    this._onChange = onChange || this._onChange;
    this.dialog.showPanel({
      icon: '🛒', title: 'cart', sub: 'shoppingList',
      html: () => this._cartHtml(),
      foot: `<button class="btn btn-gold" data-close>${esc(t('keepShopping'))}</button>`
    });
    this._bindCart();
  }

  _cartHtml() {
    const lines = cartLines(this.cart);
    if (!lines.length) return `<p class="note">${esc(t('cartEmpty'))}</p>`;
    return lines.map(l => `
      <div class="cart-line" data-line="${l.product.id}">
        <span class="cl-swatch" style="background:#${l.product.color.toString(16).padStart(6, '0')}"></span>
        <span class="cl-name">${esc(t(l.product.name))}
          <small>${money(l.product.price)} · ${esc(t('perUnit'))} ${money(unitPrice(l.product))}</small></span>
        <span class="cl-qty">×${l.qty}</span>
        <span class="cl-total">${money(l.total)}</span>
        <button data-remove="${l.product.id}">${esc(t('remove'))}</button>
      </div>`).join('') +
      `<div class="cart-line" style="background:rgba(212,175,55,.1)"><span class="cl-name"><b>${esc(t('total'))}</b></span>
        <span class="cl-total">${money(cartTotal(this.cart))}</span></div>`;
  }

  _bindCart() {
    const root = this.dialog.root;
    root.querySelector('[data-close]')?.addEventListener('click', () => this.dialog.close());
    for (const b of root.querySelectorAll('[data-remove]')) {
      b.addEventListener('click', () => {
        this._onChange?.('remove', b.dataset.remove);
        this.update();
        const body = root.querySelector('.dlg-body');
        if (body) { body.innerHTML = this._cartHtml(); this._bindCart(); }
      });
    }
  }

  /* ─────────────── الصندوق: الفاتورة والتقييم ─────────────── */
  openCheckout(ev, state, { onPay, onBack }) {
    const goesMinus = state.balance - ev.total < 0;
    this.dialog.showPanel({
      icon: '🧾', title: 'checkout', sub: 'cashierSays',
      html: () => this._checkoutHtml(ev, goesMinus),
      foot: `
        <button class="btn btn-ghost" data-back>${esc(t('keepShopping'))}</button>
        <button class="btn btn-gold" data-pay>${esc(t('payAndLeave'))} — ${money(ev.total)}</button>`,
      dismissible: false
    });
    const root = this.dialog.root;
    root.querySelector('[data-back]').addEventListener('click', () => { this.dialog.close(); onBack?.(); });
    root.querySelector('[data-pay]').addEventListener('click', () => { this.dialog.close(); onPay?.(); });
  }

  _checkoutHtml(ev, goesMinus) {
    const q = ev.quality;
    const head = q === 'good' ? `✅ ${t('goodChoice')}` : q === 'mid' ? `🟡 ${t('midChoice')}` : `❌ ${t('badChoice')}`;
    const cls = (g) => g === 'good' ? 'ok' : g === 'mid' ? 'mid' : 'bad';

    const receipt = `
      <table class="sheet">
        ${ev.lines.map(l => `<tr><td>${esc(t(l.product.name))} ×${l.qty}</td><td>${money(l.total)}</td></tr>`).join('')}
        <tr class="sum"><td>${esc(t('total'))} / ${esc(t('tabBudget'))} ${money(ev.budget)}</td>
          <td class="${ev.overBy > 0 ? 'bad' : 'good'}">${money(ev.total)}</td></tr>
      </table>`;

    const verdicts = [];
    verdicts.push(v(ev.missing.length ? 'bad' : 'ok', '📋',
      ev.missing.length
        ? `${t('missingNeeds')}: ${ev.missing.map(n => t(NEED_CATEGORIES.find(c => c.id === n).name)).join('، ')}`
        : { ar: 'كل حاجات القائمة موجودة', he: 'כל הצרכים ברשימה נמצאים' },
      { ar: 'القائمة تُكتب في البيت لا أمام الرفّ — هي الحاجز الأوّل ضدّ الإنفاق العاطفي.',
        he: 'הרשימה נכתבת בבית ולא מול המדף — היא המחסום הראשון מפני הוצאה רגשית.' }));

    verdicts.push(v(cls(ev.budgetGrade), '💰',
      ev.overBy > 0 ? `${t('overBudget')} ${money(ev.overBy)}` : { ar: `بقيت داخل الميزانية — وفّرت ${money(-ev.overBy)}`, he: `נשארת בתקציב — חסכת ${money(-ev.overBy)}` },
      { ar: 'الميزانية سقف يُقرَّر مسبقاً؛ تجاوزه بـ10% كل أسبوع = شهر إضافي من المصاريف سنوياً.',
        he: 'תקציב הוא תקרה שנקבעת מראש; חריגה של 10% כל שבוע = חודש הוצאות נוסף בשנה.' }));

    const extras = [];
    if (ev.impulse.length) extras.push(`${t('impulseBuys')}: ${ev.impulse.map(l => t(l.product.name)).join('، ')}`);
    if (ev.promoTraps.length) extras.push(`${t('promoTraps')}: ${ev.promoTraps.map(l => t(l.product.name)).join('، ')}`);
    verdicts.push(v(cls(ev.wantsGrade), '🎯',
      `${t('wantsShare')}: ${pct(ev.wantsShare * 100)} (${money(ev.wantsTotal)})` + (extras.length ? ' · ' + extras.join(' · ') : ''),
      { ar: 'ما عند الصندوق وُضع هناك عمداً: قرار في ثلاث ثوانٍ وأنت متعب من التسوّق. العرض مربح فقط إن كان الصنف في قائمتك أصلاً.',
        he: 'מה שליד הקופה הונח שם בכוונה: החלטה בשלוש שניות כשאתם עייפים. מבצע משתלם רק אם הפריט ממילא ברשימה.' }));

    const overpay = ev.brandOverpay.map(c =>
      `${t(c.product.name)} (${money(c.unit)}) ← ${t('cheaperOption')}: ${t(c.bestProduct.name)} (${money(c.bestUnit)})`);
    const bulk = ev.bulkOpportunities.map(b =>
      `${t(b.product.name)} ${money(b.unit)} ← ${t(b.bulk.name)} ${money(b.bulkUnit)}`);
    verdicts.push(v(cls(ev.priceGrade), '🏷️',
      overpay.length ? `${t('brandOverpay')}: ${overpay.join(' · ')}` : { ar: 'قارنت السعر للوحدة بذكاء', he: 'השווית מחיר ליחידה בחוכמה' },
      bulk.length
        ? { ar: `${t('bulkTip')}: ${bulk.join(' · ')} — بشرط أن تستهلكه وأن يبقى نقدك كافياً.`,
            he: `${t('bulkTip')}: ${bulk.join(' · ')} — בתנאי שתצרכו אותו ושהמזומן יספיק.` }
        : { ar: 'السعر للوحدة (₪/كغ، ₪/لتر) هو الرقم الوحيد الذي يسمح بمقارنة عادلة بين العبوات.',
            he: 'המחיר ליחידה (₪/ק״ג, ₪/ליטר) הוא המספר היחיד שמאפשר השוואה הוגנת בין אריזות.' }));

    return `
      <div class="feedback ${cls(q)}"><h4>${esc(head)} — ${esc(t('shopScore'))} ${num(ev.score)}/100</h4></div>
      ${receipt}
      ${verdicts.join('')}
      ${goesMinus ? `<p class="note warn">⚠️ ${esc(t({ ar: 'الدفع الآن يُدخل حسابك في المينوس — بفائدة 15% سنوياً على مشتريات أُكلت خلال أسبوع.',
                                                        he: 'תשלום עכשיו יכניס את החשבון למינוס — בריבית 15% שנתית על קניות שנאכלות תוך שבוע.' }))}</p>` : ''}`;
  }
}

/* سطر حكم واحد. النصّان يأتيان من ملفّات المحتوى الموثوقة (i18n وبيانات
   المنتجات) وقد يحتويان على مبالغ مُنسَّقة بـ money() أي على وسوم <span>،
   لذلك لا يُهرَّبان هنا — التهريب يُطبَّق عند المصدر على أيّ نصّ غير موثوق. */
function v(cls, icon, main, small) {
  const mainTxt = typeof main === 'string' ? main : t(main);
  return `<div class="verdict ${cls}"><span>${icon}</span><span><b>${mainTxt}</b><small>${t(small)}</small></span></div>`;
}
