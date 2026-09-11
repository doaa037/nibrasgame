/* ═══════════════════════════════════════════════════════════════════
   dialog.js — نظام الحوارات واللوحات
   ───────────────────────────────────────────────────────────────────
   نافذة واحدة تخدم ثلاث حالات: مشهد قصّة متعدّد الخطوات، حدث عشوائي
   من خطوة واحدة، وقائمة خدمات. توحيدها يضمن أنّ تجربة الطالب متّسقة
   وأنّ تبديل اللغة يعمل في كل مكان بنفس الطريقة.
   ═══════════════════════════════════════════════════════════════════ */

import { t, getLang, list as langList } from '../content/i18n.js';
import { COMPETENCIES } from '../content/i18n.js';
import { esc, el, money, num } from './util.js';

export class Dialog {
  constructor(root) {
    this.root = root;
    this.open = false;
    this.current = null;      /* وصف ما هو معروض، لإعادة رسمه عند تبديل اللغة */
    this.onClose = null;

    /* الإغلاق بالنقر على الخلفية أو بمفتاح Escape */
    this.root.addEventListener('mousedown', (e) => {
      if (e.target === this.root && this.current?.dismissible !== false) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.open && this.current?.dismissible !== false) this.close();
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     مشهد قصّة متعدّد الخطوات
     ═══════════════════════════════════════════════════════════════ */
  showScene(scene, ctx) {
    this.current = { kind: 'scene', scene, ctx, step: 0, picked: null };
    this.open = true;
    this._render();
  }

  /** حدث عشوائي — خطوة واحدة بنفس بنية الخيارات */
  showEvent(event, ctx) {
    this.current = { kind: 'event', event, ctx, picked: null };
    this.open = true;
    this._render();
  }

  /** قائمة خدمات مؤسسة */
  showMenu(config) {
    this.current = { kind: 'menu', ...config };
    this.open = true;
    this._render();
  }

  /** لوحة معلومات عامّة (قسيمة راتب، ميزانية، تقرير…) */
  showPanel(config) {
    this.current = { kind: 'panel', ...config };
    this.open = true;
    this._render();
  }

  close() {
    this.open = false;
    this.current = null;
    this.root.innerHTML = '';
    this.root.classList.add('hidden');
    this.onClose?.();
  }

  /** إعادة الرسم عند تبديل اللغة مع الحفاظ على الحالة الداخلية */
  refresh() { if (this.open) this._render(); }

  /* ═══════════════════════════════════════════════════════════════
     الرسم
     ═══════════════════════════════════════════════════════════════ */
  _render() {
    const c = this.current;
    if (!c) return;
    this.root.classList.remove('hidden');

    let body = '';
    if (c.kind === 'scene')      body = this._renderScene(c);
    else if (c.kind === 'event') body = this._renderEvent(c);
    else if (c.kind === 'menu')  body = this._renderMenu(c);
    else                         body = this._renderPanel(c);

    this.root.innerHTML = body;
    this._bind();
  }

  _shell({ icon, title, sub, inner, foot = '', dismissible = true }) {
    return `
      <div class="dlg">
        <header class="dlg-head">
          <div class="dlg-icon">${icon || '💬'}</div>
          <div class="dlg-titles">
            <h3>${esc(title)}</h3>
            ${sub ? `<p>${esc(sub)}</p>` : ''}
          </div>
          <div class="lang-switch lang-mini">
            ${langList().map(l => `<button data-lang="${l.code}"
              aria-pressed="${l.code === getLang()}">${esc(l.short)}</button>`).join('')}
          </div>
          ${dismissible ? `<button class="dlg-close" data-close aria-label="${esc(t('closeBtn'))}">✕</button>` : ''}
        </header>
        <div class="dlg-body">${inner}</div>
        ${foot ? `<footer class="dlg-foot">${foot}</footer>` : ''}
      </div>`;
  }

  /* ─────────────── مشهد ─────────────── */
  _renderScene(c) {
    const { scene, step, picked } = c;
    const s = scene.steps[step];
    const comp = COMPETENCIES[scene.competency];

    const inner = `
      <div class="steps">${scene.steps.map((_, i) =>
        `<i class="${i < step ? 'done' : i === step ? 'on' : ''}"></i>`).join('')}</div>
      ${s.widget ? `<div class="widget-slot" data-widget="${s.widget}"></div>` : ''}
      <div class="say">${resolveText(s.text, c.ctx.state)}</div>
      ${this._optionsBlock(s.options, picked)}
      <div class="fb-slot">${picked !== null ? this._feedback(s.options[picked]) : ''}</div>`;

    const isLast = step + 1 >= scene.steps.length;
    const foot = picked !== null
      ? `<button class="btn btn-gold" data-next>${esc(isLast ? t('leaveBtn') : t('continueBtn'))} ←</button>`
      : `<span class="hint">${esc(t('whatDoYouDo'))}</span>`;

    return this._shell({
      icon: scene.icon || '💬',
      title: t(scene.title),
      sub: `${comp.icon} ${t('competency')}: ${t(comp.name)}`,
      inner, foot, dismissible: picked === null
    });
  }

  /* ─────────────── حدث ─────────────── */
  _renderEvent(c) {
    const { event, picked } = c;
    const comp = COMPETENCIES[event.competency];
    const inner = `
      <div class="say event">${resolveText(event.text, c.ctx.state)}</div>
      ${this._optionsBlock(event.options, picked)}
      <div class="fb-slot">${picked !== null ? this._feedback(event.options[picked]) : ''}</div>`;

    const foot = picked !== null
      ? `<button class="btn btn-gold" data-next>${esc(t('continueBtn'))} ←</button>`
      : `<span class="hint">${esc(t('whatDoYouDo'))}</span>`;

    return this._shell({
      icon: event.icon, title: t(event.title),
      sub: `${comp.icon} ${t(comp.name)}`,
      inner, foot, dismissible: false
    });
  }

  /* ─────────────── قائمة خدمات ─────────────── */
  _renderMenu(c) {
    const inner = `
      ${c.intro ? `<div class="say">${esc(t(c.intro))}</div>` : ''}
      <div class="options">
        ${c.items.map((item, i) => `
          <button class="option ${item.primary ? 'primary' : ''}" data-item="${i}">
            <span class="opt-key">${item.primary ? '★' : i + 1}</span>
            <span class="grow">
              <b>${esc(t(typeof item.label === 'function' ? item.label(c.state) : item.label))}</b>
              ${item.hint ? `<small>${esc(t(item.hint))}</small>` : ''}
            </span>
          </button>`).join('')}
      </div>`;
    return this._shell({ icon: c.icon, title: t(c.title), sub: c.sub ? t(c.sub) : '', inner });
  }

  /* ─────────────── لوحة ─────────────── */
  _renderPanel(c) {
    return this._shell({
      icon: c.icon, title: t(c.title), sub: c.sub ? t(c.sub) : '',
      inner: typeof c.html === 'function' ? c.html() : c.html,
      foot: c.foot || ''
    });
  }

  /* ─────────────── كتلة الخيارات ─────────────── */
  _optionsBlock(options, picked) {
    return `<div class="options">${options.map((o, i) => {
      let cls = '';
      if (picked !== null) {
        if (i === picked) cls = o.quality === 'good' ? 'correct' : o.quality === 'bad' ? 'wrong' : 'picked';
        /* نكشف الخيار الأمثل حتى لو لم يختره الطالب — التعلّم بالمقارنة */
        else if (options[i].quality === 'good' && options[picked].quality !== 'good') cls = 'correct';
        else cls = 'dimmed';
      }
      return `<button class="option ${cls}" data-opt="${i}" ${picked !== null ? 'disabled' : ''}>
        <span class="opt-key">${String.fromCharCode(65 + i)}</span>
        <span class="grow">${t(o.text)}</span>
      </button>`;
    }).join('')}</div>`;
  }

  /* ─────────────── التغذية الراجعة ─────────────── */
  _feedback(opt) {
    const cls = opt.quality === 'good' ? 'ok' : opt.quality === 'mid' ? 'mid' : 'bad';
    const head = opt.quality === 'good' ? `✅ ${t('goodChoice')}`
               : opt.quality === 'mid'  ? `🟡 ${t('midChoice')}`
               :                          `❌ ${t('badChoice')}`;
    return `
      <div class="feedback ${cls}">
        <h4>${esc(head)}</h4>
        <p>${t(opt.feedback)}</p>
        ${opt.rule ? `<div class="rule"><b>📌 ${esc(t('theRule'))}</b>${t(opt.rule)}</div>` : ''}
        ${impacts(opt.fx || {})}
      </div>`;
  }

  /* ═══════════════════════════════════════════════════════════════
     ربط الأحداث
     ═══════════════════════════════════════════════════════════════ */
  _bind() {
    const c = this.current;

    this.root.querySelector('[data-close]')?.addEventListener('click', () => this.close());

    for (const b of this.root.querySelectorAll('[data-opt]')) {
      b.addEventListener('click', () => {
        const i = +b.dataset.opt;
        if (c.picked !== null) return;
        c.picked = i;
        const step = c.kind === 'scene' ? c.scene.steps[c.step] : c.event;
        c.ctx.onChoose(step.options[i], c.kind === 'scene' ? c.scene : c.event, c.step ?? 0);
        this._render();
      });
    }

    this.root.querySelector('[data-next]')?.addEventListener('click', () => {
      if (c.kind === 'event') { const done = c.ctx.onFinish; this.close(); done?.(); return; }
      if (c.step + 1 < c.scene.steps.length) { c.step += 1; c.picked = null; this._render(); }
      else { const done = c.ctx.onFinish; this.close(); done?.(); }
    });

    for (const b of this.root.querySelectorAll('[data-item]')) {
      b.addEventListener('click', () => c.onPick(c.items[+b.dataset.item]));
    }

    /* الأدوات التفاعلية (قسيمة راتب، مقارنة قروض…) تُحقن من الخارج */
    const slot = this.root.querySelector('.widget-slot');
    if (slot && c.ctx?.renderWidget) slot.innerHTML = c.ctx.renderWidget(slot.dataset.widget);
  }
}

/* ─────────────── مساعدات ─────────────── */

/** نصّ الحدث قد يكون دالة تحسب أرقاماً حيّة من الحالة */
function resolveText(text, state) {
  return t(typeof text === 'function' ? text(state) : text);
}

/** ترجمة أثر القرار إلى شارات مرئية */
function impacts(fx) {
  const map = [
    ['balance', '💰', 'hBalance', true],
    ['savings', '🏦', 'tabBudget', true],
    ['debt',    '📉', 'hDebt', false],
    ['monthly', '🔁', 'monthlyCost', false],
    ['iq',      '🧠', 'hSafety', true],
    ['energy',  '⚡', 'hEnergy', true],
    ['credit',  '📊', 'hCredit', true]
  ];
  const chips = map.filter(m => fx[m[0]]).map(([key, icon, labelKey, higherIsBetter]) => {
    const v = fx[key];
    const positive = higherIsBetter ? v > 0 : v < 0;
    const isMoney = ['balance', 'savings', 'debt', 'monthly'].includes(key);
    const val = isMoney
      ? `${Math.abs(Math.round(v)).toLocaleString('en-US')} ₪`
      : Math.abs(Math.round(v));
    return `<span class="impact ${positive ? 'up' : 'down'}">${icon} ${esc(t(labelKey))}
      <span class="num">${v > 0 ? '+' : '−'}${val}</span></span>`;
  }).join('');
  return chips ? `<div class="impacts">${chips}</div>` : '';
}

export { impacts };
