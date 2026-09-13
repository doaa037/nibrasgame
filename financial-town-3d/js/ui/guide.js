/* ═══════════════════════════════════════════════════════════════════
   guide.js — التوجيه إلى هدف المهمّة: سهم بوصلة، مسافة، وخريطة مصغّرة
   ───────────────────────────────────────────────────────────────────
   الطالب الجديد لا يعرف البلدة. السهم يدور مع الكاميرا فيشير دائماً إلى
   اتجاه الهدف على الشاشة، والمسافة تنقص وهو يمشي، والخريطة المصغّرة تعطيه
   صورة ذهنية للبلدة: الشوارع، المؤسسات، موقعه، والهدف.
   ═══════════════════════════════════════════════════════════════════ */

import { esc } from './util.js';
import { t } from '../content/i18n.js';
import { LOCATIONS, BUS_STOPS, ROAD_AXES, MOSQUE } from '../content/world.data.js';
import { WORLD } from '../content/config.js';

const MAP_PX = 150;

export class Guide {
  constructor(root, town) {
    this.root = root;
    this.town = town;
    this.target = null;               /* {x, z, name, id, kind} */
    this.root.innerHTML = `
      <div class="guide-card">
        <div class="guide-row">
          <div class="guide-arrow" data-f="arrow">
            <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
              <path d="M20 3 L31 30 L20 24 L9 30 Z" fill="currentColor"/>
            </svg>
          </div>
          <div class="guide-text">
            <div class="guide-label" data-f="label"></div>
            <div class="guide-name" data-f="name"></div>
            <div class="guide-dist num" data-f="dist"></div>
          </div>
        </div>
        <canvas class="guide-map" width="${MAP_PX}" height="${MAP_PX}" data-f="map"></canvas>
      </div>`;
    this.f = {};
    for (const n of this.root.querySelectorAll('[data-f]')) this.f[n.dataset.f] = n;
    this.ctx = this.f.map.getContext('2d');
    this.scale = MAP_PX / (WORLD.SIZE + 20);
    this._drawBase();
    this._lastText = '';
    this._mapTick = 0;
  }

  /** الهدف الحالي: معرّف موقع، أو 'busStop' (أقرب محطّة)، أو null */
  setTarget(id, playerPos) {
    if (!id) { this.target = null; this.root.classList.add('hidden'); return; }
    let x, z, nameKey;
    if (id === 'busStop') {
      let best = null, bd = Infinity;
      for (const s of BUS_STOPS) {
        const d = Math.hypot(s.pos[0] - playerPos.x, s.pos[1] - playerPos.z);
        if (d < bd) { bd = d; best = s; }
      }
      const door = this.town.doors[best.id];
      x = door.x; z = door.z; nameKey = 'locBusStop';
    } else {
      const loc = LOCATIONS.find(l => l.id === id);
      const door = this.town.doors[id];
      if (!loc || !door) { this.target = null; this.root.classList.add('hidden'); return; }
      x = door.x; z = door.z; nameKey = loc.nameKey;
    }
    this.target = { id, x, z, nameKey };   /* الاسم يُترجم عند العرض ليتبع تبديل اللغة */
    this.root.classList.remove('hidden');
  }

  /** نداء كل إطار من اللعبة */
  update(dt, player, camYaw, inside) {
    if (!this.target) return;
    const targetName = t(this.target.nameKey);
    let tx = this.target.x, tz = this.target.z, label = t('guideTo'), name = targetName;

    /* داخل مبنى غير الهدف: نوجّه إلى باب الخروج */
    if (inside) {
      if (inside.id === this.target.id) { label = ''; name = t('guideArrived'); }
      else {
        const exit = inside.hotspots.find(h => h.kind === 'exit');
        if (exit) { tx = exit.x; tz = exit.z; label = `${t('guideQuestAt')} ${targetName}`; name = t('guideExit'); }
      }
    }

    const dx = tx - player.position.x, dz = tz - player.position.z;
    const dist = Math.hypot(dx, dz);
    const arrived = !inside && dist < 7;

    /* زاوية السهم على الشاشة: الأمام = بعيداً عن الكاميرا، اليمين = يمين الشاشة */
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const fwd = dx * fx + dz * fz, right = dx * rx + dz * rz;
    const ang = Math.atan2(right, fwd) * 180 / Math.PI;
    this.f.arrow.style.transform = `rotate(${ang.toFixed(1)}deg)`;
    this.f.arrow.classList.toggle('near', arrived);

    const txt = arrived ? `✓|${t('guideArrived')}|` : `${label}|${name}|${formatDist(dist)}`;
    if (txt !== this._lastText) {
      this._lastText = txt;
      const [l, n, d] = txt.split('|');
      this.f.label.textContent = l;
      this.f.name.textContent = n;
      this.f.dist.textContent = d;
    }

    /* الخريطة: تُرسم 10 مرّات في الثانية — يكفي وأرخص من كل إطار */
    this._mapTick += dt;
    if (this._mapTick > 0.1) { this._mapTick = 0; this._drawMap(player, camYaw, inside); }
  }

  /* ─────────────── الخريطة المصغّرة ─────────────── */
  _toMap(x, z) { return [MAP_PX / 2 + x * this.scale, MAP_PX / 2 + z * this.scale]; }

  /** الطبقة الثابتة (شوارع ومبانٍ) تُرسم مرّة على كانفاس خفيّ */
  _drawBase() {
    const base = document.createElement('canvas');
    base.width = base.height = MAP_PX;
    const c = base.getContext('2d'), s = this.scale;
    c.fillStyle = '#0d2438'; c.beginPath(); c.arc(MAP_PX / 2, MAP_PX / 2, MAP_PX / 2, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.arc(MAP_PX / 2, MAP_PX / 2, MAP_PX / 2 - 1, 0, Math.PI * 2); c.clip();
    /* الشوارع */
    c.strokeStyle = '#3c4c5c'; c.lineWidth = Math.max(2, 7 * s);
    for (const a of ROAD_AXES) {
      const [p] = this._toMap(a, 0); const [, q] = this._toMap(0, a);
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, MAP_PX); c.stroke();
      c.beginPath(); c.moveTo(0, q); c.lineTo(MAP_PX, q); c.stroke();
    }
    /* المباني السكنية */
    c.fillStyle = '#26445f';
    for (const b of this.town.fillerSpecs || []) {
      const [x, z] = this._toMap(b.x, b.z);
      c.fillRect(x - b.w * s / 2, z - b.d * s / 2, Math.max(2, b.w * s), Math.max(2, b.d * s));
    }
    /* المسجد */
    { const [x, z] = this._toMap(MOSQUE.pos[0], MOSQUE.pos[1]); c.fillStyle = '#2f8f7a';
      c.fillRect(x - MOSQUE.base[0] * s / 2, z - MOSQUE.base[2] * s / 2, MOSQUE.base[0] * s, MOSQUE.base[2] * s); }
    /* المؤسسات بألوانها */
    for (const loc of LOCATIONS) {
      const [x, z] = this._toMap(loc.pos[0], loc.pos[1]);
      c.fillStyle = '#' + loc.color.toString(16).padStart(6, '0');
      c.fillRect(x - loc.size[0] * s / 2, z - loc.size[2] * s / 2, loc.size[0] * s, loc.size[2] * s);
    }
    c.restore();
    this.base = base;
  }

  _drawMap(player, camYaw, inside) {
    const c = this.ctx;
    c.clearRect(0, 0, MAP_PX, MAP_PX);
    c.drawImage(this.base, 0, 0);
    if (inside) {
      /* داخل مبنى: نُظهر موضع المبنى بدل موضع اللاعب البعيد */
      const loc = LOCATIONS.find(l => l.id === inside.id);
      if (loc) { const [x, z] = this._toMap(loc.pos[0], loc.pos[1]); this._dot(c, x, z, '#f5e9b2', 5); }
      return;
    }
    /* الهدف: نجمة نابضة */
    if (this.target) {
      const [x, z] = this._toMap(this.target.x, this.target.z);
      const pulse = 4 + Math.sin(performance.now() / 220) * 1.5;
      c.strokeStyle = 'rgba(212,175,55,.55)'; c.lineWidth = 2;
      c.beginPath(); c.arc(x, z, pulse + 4, 0, Math.PI * 2); c.stroke();
      this._dot(c, x, z, '#d4af37', 4);
    }
    /* اللاعب: مثلّث يشير إلى اتجاه الكاميرا */
    const [px, pz] = this._toMap(player.position.x, player.position.z);
    const dirx = -Math.sin(camYaw), dirz = -Math.cos(camYaw);
    c.save(); c.translate(px, pz); c.rotate(Math.atan2(dirx, -dirz));
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(0, 2); c.lineTo(-5, 5); c.closePath(); c.fill();
    c.restore();
    /* حدّ الخريطة */
    c.strokeStyle = 'rgba(212,175,55,.5)'; c.lineWidth = 2;
    c.beginPath(); c.arc(MAP_PX / 2, MAP_PX / 2, MAP_PX / 2 - 1, 0, Math.PI * 2); c.stroke();
  }

  _dot(c, x, z, color, r) { c.fillStyle = color; c.beginPath(); c.arc(x, z, r, 0, Math.PI * 2); c.fill(); }
}

function formatDist(units) {
  const m = Math.round(units);
  return m >= 1000 ? `${(m / 1000).toFixed(1)} ${t('unitKm')}` : `${m} ${t('unitM')}`;
}
