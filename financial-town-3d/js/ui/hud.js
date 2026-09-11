/* ═══════════════════════════════════════════════════════════════════
   hud.js — المؤشّرات الحيّة على الشاشة
   ───────────────────────────────────────────────────────────────────
   قاعدة أداء مهمّة: لا نلمس الـ DOM إلّا حين تتغيّر القيمة فعلاً.
   تحديث نصّ عنصر ستّين مرّة في الثانية يجبر المتصفّح على إعادة
   تخطيط الصفحة ويأكل من عدد إطارات المشهد ثلاثي الأبعاد.
   ═══════════════════════════════════════════════════════════════════ */

import { t } from '../content/i18n.js';
import { esc, money, num, frac } from './util.js';
import { safetyIndex } from '../sim/economy.js';
import { clockString, hasBusPass } from '../sim/state.js';
import { activeQuest } from '../content/quests.js';
import { CAR } from '../content/config.js';

export class HUD {
  constructor(root) {
    this.root = root;
    this.cache = {};        /* آخر قيمة معروضة لكل حقل */
    this._build();
  }

  _build() {
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-metrics">
          ${metricTile('balance', '💰', 'hBalance')}
          ${metricTile('safety',  '🛡️', 'hSafety', true)}
          ${metricTile('debt',    '📉', 'hDebt')}
          ${metricTile('energy',  '⚡', 'hEnergy', true)}
        </div>
        <div class="hud-clock">
          <div class="clock-time" data-f="clock">08:00</div>
          <div class="clock-date" data-f="date"></div>
          <div class="clock-mode" data-f="mode"></div>
        </div>
      </div>

      <div class="hud-quest" data-f="questBox">
        <div class="q-label" data-f="questLabel"></div>
        <div class="q-title" data-f="questTitle"></div>
        <div class="q-desc" data-f="questDesc"></div>
      </div>

      <div class="hud-prompt hidden" data-f="prompt"></div>
    `;
    this.f = {};
    for (const node of this.root.querySelectorAll('[data-f]')) this.f[node.dataset.f] = node;
    for (const node of this.root.querySelectorAll('[data-m]')) this.f[node.dataset.m] = node;
  }

  /** تحديث حقل فقط عند تغيّر قيمته */
  _set(key, html) {
    if (this.cache[key] === html) return;
    this.cache[key] = html;
    const node = this.f[key];
    if (node) node.innerHTML = html;
  }

  /** يُستدعى كل إطار — لكنّه لا يكتب في الـ DOM إلّا عند التغيّر */
  update(state) {
    const safety = safetyIndex(state);

    this._set('balanceValue', money(state.balance));
    this._set('balanceNote', state.balance < 0
      ? `<span class="bad">${esc(t('overdraft'))}</span>`
      : `${esc(t('tabBudget'))}: ${money(state.savings)}`);
    this.f.balance?.classList.toggle('danger', state.balance < 0);

    this._set('safetyValue', frac(safety, 100));
    this._setBar('safety', safety);

    this._set('debtValue', money(state.debt));
    this._set('debtNote', state.monthlyCommit > 0
      ? `${esc(t('monthlyCost'))}: ${money(state.monthlyCommit)}` : '');

    this._set('energyValue', frac(Math.round(state.energy), 100));
    this._setBar('energy', state.energy);

    this._set('clock', `<span class="num">${clockString(state)}</span>`);
    this._set('date', `${esc(t('hDay'))} ${num(state.day)} · ${esc(t('hMonth'))} ${num(state.month)}`);

    this._set('mode', this._modeLine(state));
    this._updateQuest(state);
  }

  _modeLine(state) {
    if (state.inCar) {
      const litres = Math.max(0, Math.round(state.fuel));
      return `🚗 ${esc(t('driving'))} · ${esc(t('hFuel'))} ${frac(litres, CAR.FUEL_TANK)}`;
    }
    if (hasBusPass(state)) return `🎫 ${esc(t('busPassActive'))}`;
    return `🚶 ${esc(t('onFoot'))}`;
  }

  _setBar(key, value) {
    const bar = this.f[key]?.querySelector('.bar > i');
    if (!bar) return;
    const v = Math.max(0, Math.min(100, value));
    if (this.cache[key + 'Bar'] === v) return;
    this.cache[key + 'Bar'] = v;
    bar.style.width = v + '%';
    bar.style.background = v > 60 ? 'var(--good)' : v > 30 ? 'var(--warn)' : 'var(--bad)';
  }

  _updateQuest(state) {
    const q = activeQuest(state);
    if (!q) {
      this._set('questLabel', '🎓');
      this._set('questTitle', esc(t('questDone')));
      this._set('questDesc', '');
      return;
    }
    this._set('questLabel', `🎯 ${esc(t('questTracker'))}`);
    this._set('questTitle', esc(t(q.title)));
    this._set('questDesc', esc(t(q.desc)));
  }

  /** تلميح التفاعل عند الاقتراب من باب أو مركبة */
  showPrompt(text) {
    const node = this.f.prompt;
    if (!text) { node.classList.add('hidden'); this.cache.prompt = null; return; }
    node.classList.remove('hidden');
    this._set('prompt', text);
  }

  /** إعادة رسم كامل عند تبديل اللغة */
  relabel(state) {
    this.cache = {};
    this._build();
    this.update(state);
  }
}

function metricTile(id, icon, labelKey, withBar = false) {
  return `
    <div class="metric" data-m="${id}">
      <div class="m-top">
        <span class="m-icon">${icon}</span>
        <span class="m-label">${esc(t(labelKey))}</span>
      </div>
      <div class="m-value" data-f="${id}Value">—</div>
      ${withBar ? '<div class="bar"><i></i></div>' : `<div class="m-note" data-f="${id}Note"></div>`}
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   إشعارات منبثقة (أوسمة، نتائج إجراءات)
   ═══════════════════════════════════════════════════════════════ */
export class Toasts {
  constructor(root) { this.root = root; }

  show({ icon, title, body }) {
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = `<span class="t-icon">${icon}</span>
      <span><b>${esc(t(title))}</b>${body && t(body) ? `<small>${esc(t(body))}</small>` : ''}</span>`;
    this.root.appendChild(node);
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 320);
    }, 4200);
  }

  badge(b) {
    this.show({ icon: b.icon, title: { ar: `🏅 ${t('newBadge')}`, he: `🏅 ${t('newBadge')}` },
                body: b.name });
  }
}
