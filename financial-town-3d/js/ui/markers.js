/* ═══════════════════════════════════════════════════════════════════
   markers.js — لافتات HTML معلّقة فوق المباني في العالم ثلاثي الأبعاد
   ───────────────────────────────────────────────────────────────────
   لماذا HTML وليس نصّاً داخل المشهد؟ لأنّ النصّ العربي والعبري يحتاج
   تشكيل حروف واتّجاهاً صحيحاً (RTL)، وهذا ما يتقنه محرّك تخطيط
   المتصفّح ولا تتقنه خرائط النصوص في WebGL. نُسقِط موضع كل مبنى
   إلى إحداثيات الشاشة كل إطار ونحرّك العنصر فوقه.
   ═══════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { t } from '../content/i18n.js';
import { esc } from './util.js';

const MAX_DISTANCE = 120;   /* أبعد من ذلك تختفي اللافتة لتقليل الفوضى */

export class Markers {
  constructor(layerEl, camera) {
    this.layer = layerEl;
    this.camera = camera;
    this.items = [];
    this._v = new THREE.Vector3();
  }

  /** يبني عناصر اللافتات من مواصفات المدينة */
  build(specs) {
    this.layer.innerHTML = '';
    this.items = specs.map(spec => {
      const node = document.createElement('div');
      node.className = `marker marker-${spec.kind}${spec.cls ? ' ' + spec.cls : ''}`;
      /* بطاقات الأسعار ونقاط التفاعل تمرّر HTML جاهزاً؛ لافتات المباني تُبنى من المفتاح */
      node.innerHTML = spec.html
        ? (typeof spec.html === 'function' ? spec.html() : spec.html)
        : `<span class="m-icon">${spec.icon}</span><span class="m-name">${esc(t(spec.nameKey))}</span>`;
      this.layer.appendChild(node);
      return { ...spec, node };
    });
  }

  /** إعادة كتابة النصوص عند تبديل اللغة — بلا إعادة بناء العناصر */
  relabel() {
    for (const item of this.items) {
      if (item.html) { item.node.innerHTML = typeof item.html === 'function' ? item.html() : item.html; continue; }
      item.node.querySelector('.m-name').textContent = t(item.nameKey);
    }
  }

  clear() { this.layer.innerHTML = ''; this.items = []; }
  setVisible(v) { this.layer.classList.toggle('hidden', !v); }

  /** يميّز لافتة هدف المهمّة الحالية */
  setHighlight(id) {
    for (const item of this.items) item.node.classList.toggle('target', item.id === id);
  }

  /**
   * يُستدعى كل إطار: يُسقِط الموضع العالمي إلى الشاشة.
   * project() تُعيد إحداثيات مقصوصة (‎-1..1‎)؛ العمق z أكبر من 1
   * يعني أنّ النقطة خلف الكاميرا فنُخفي اللافتة بدل أن نرسمها مقلوبة.
   */
  update(cameraPosition) {
    const w = this.layer.clientWidth, h = this.layer.clientHeight;
    for (const item of this.items) {
      this._v.copy(item.position).project(this.camera);

      const behind = this._v.z > 1;
      const dist = cameraPosition.distanceTo(item.position);
      if (behind || dist > MAX_DISTANCE) { item.node.style.opacity = '0'; continue; }

      const x = (this._v.x * 0.5 + 0.5) * w;
      const y = (-this._v.y * 0.5 + 0.5) * h;
      item.node.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      /* تلاشٍ تدريجي مع البعد: يوحي بالعمق ويمنع ازدحام الأفق */
      item.node.style.opacity = String(Math.max(0.15, 1 - dist / MAX_DISTANCE));
      item.node.style.setProperty('--scale', String(Math.max(0.7, 1 - dist / 260)));
    }
  }
}
