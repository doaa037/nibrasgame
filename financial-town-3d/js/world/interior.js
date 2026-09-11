/* ═══════════════════════════════════════════════════════════════════
   interior.js — دواخل المؤسسات: غرف يُمشى فيها ويُتفاعل مع ما فيها
   ───────────────────────────────────────────────────────────────────
   كل مؤسسة لها داخل مبنيّ بعيداً عن البلدة (x ≈ 3000+) في المشهد
   نفسه. عند الدخول يُنقل اللاعب إليه، وتُطفأ الشمس والسماء، وتحلّ
   محلّها إضاءة الغرفة. لا تحميل ولا مشهد ثانٍ — انتقال فوري.

   «نقاط التفاعل» (hotspots) هي ما يجعل الداخل تجربة لا ديكوراً:
   منتج على رفّ يُضاف إلى السلّة، صندوق دفع يُقيّم السلّة، موظّف
   يفتح حواراً، سرير يُنهي اليوم، صرّاف آلي يودع ويسحب.
   ═══════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { PRODUCTS } from '../content/shop.data.js';
import { CARS_FOR_SALE, JOBS } from '../content/config.js';
import { t } from '../content/i18n.js';
import { esc } from '../ui/util.js';
import { unitPrice } from '../sim/shopping.js';
import { makeRandom } from '../core/random.js';

const ORIGIN_Z = 3000;
const ORIGINS = { market: 3000, bank: 3400, employment: 3800, dealer: 4200, cyber: 4600, home: 5000 };

export class Interiors {
  constructor(scene, M) {
    this.scene = scene;
    this.M = M;
    this.rnd = makeRandom(1_1_2026);
    this.rooms = {};
    this.current = null;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    for (const id of Object.keys(ORIGINS)) {
      const builder = this[`_build_${id}`];
      if (builder) this.rooms[id] = builder.call(this, ORIGINS[id], ORIGIN_Z);
    }
  }

  has(id) { return !!this.rooms[id]; }

  enter(id) {
    this.current = this.rooms[id];
    this.group.visible = true;
    for (const r of Object.values(this.rooms)) r.group.visible = r === this.current;
    return this.current;
  }

  exit() { this.current = null; this.group.visible = false; }

  /* ═══════════════════════════════════════════════════════════════
     الغرفة الأساسية: أرضية، جدران، سقف بألواح إنارة، وباب جنوبي
     ═══════════════════════════════════════════════════════════════ */
  _room({ ox, oz, w, d, h, floor, wall, ceilingColor = 0xf4f2ee, lights = [2, 2], lightIntensity = 38, warm = 0xfff1dc }) {
    const M = this.M;
    const g = new THREE.Group();
    const colliders = [], hotspots = [], markers = [];
    const add = (m) => { g.add(m); return m; };

    const floorMesh = add(box(w, 0.2, d, floor, ox, -0.1, oz)); floorMesh.receiveShadow = true;
    add(box(w + 0.6, 0.3, d + 0.6, M.plaster(ceilingColor), ox, h + 0.15, oz));

    /* الجدران: أربعة صناديق سميكة — سمكها هو ما يمنع الكاميرا من الخروج */
    const T = 0.6;
    add(box(w + T * 2, h, T, wall, ox, h / 2, oz - d / 2 - T / 2));                         /* شمال */
    add(box(T, h, d + T * 2, wall, ox - w / 2 - T / 2, h / 2, oz));                         /* غرب */
    add(box(T, h, d + T * 2, wall, ox + w / 2 + T / 2, h / 2, oz));                         /* شرق */
    /* الجنوب بفتحة باب في المنتصف */
    const doorW = 3.2, side = (w - doorW) / 2;
    add(box(side, h, T, wall, ox - doorW / 2 - side / 2, h / 2, oz + d / 2 + T / 2));
    add(box(side, h, T, wall, ox + doorW / 2 + side / 2, h / 2, oz + d / 2 + T / 2));
    add(box(doorW + 0.4, h - 3.0, T, wall, ox, h - (h - 3.0) / 2, oz + d / 2 + T / 2));   /* فوق الباب */
    add(box(doorW, 3.0, 0.12, M.plaster(0x2a3440), ox, 1.5, oz + d / 2 + T + 0.2));      /* الباب الزجاجي */
    add(box(doorW + 0.5, 0.25, 0.4, M.darkTrim, ox, 3.1, oz + d / 2 + T / 2));

    colliders.push(rect(ox, oz - d / 2 - T / 2, w + 2, T), rect(ox, oz + d / 2 + T / 2, w + 2, T),
                   rect(ox - w / 2 - T / 2, oz, T, d + 2), rect(ox + w / 2 + T / 2, oz, T, d + 2));

    /* ألواح إنارة في السقف + أضواء نقطية تحتها */
    const panelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(warm), emissiveIntensity: 1.6, roughness: 0.6 });
    const [nx, nz] = lights;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = ox - w / 2 + (i + 0.5) * (w / nx), z = oz - d / 2 + (j + 0.5) * (d / nz);
      add(box(2.4, 0.06, 1.2, panelMat, x, h - 0.04, z));
      const l = new THREE.PointLight(warm, lightIntensity, Math.max(w, d) * 0.8, 1.6);
      l.position.set(x, h - 0.5, z);
      g.add(l);
    }

    hotspots.push({ id: 'exit', kind: 'exit', x: ox, z: oz + d / 2 - 1.2, radius: 2.0 });
    markers.push({ id: 'exit', kind: 'hotspot', cls: 'marker-hotspot', position: new THREE.Vector3(ox, 2.6, oz + d / 2),
                   html: () => `<span class="m-icon">🚪</span><span class="m-name">${esc(t('exitBuilding'))}</span>` });

    this.group.add(g);
    return {
      group: g, colliders, hotspots, markers,
      spawn: { x: ox, z: oz + d / 2 - 2.6 },
      bounds: { minX: ox - w / 2 + 0.6, maxX: ox + w / 2 - 0.6, minZ: oz - d / 2 + 0.6, maxZ: oz + d / 2 - 0.6 },
      ceiling: h, origin: { x: ox, z: oz },
      add, ox, oz
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     🛍️ السوبرماركت — الرفوف، الثلّاجات، الخضار، الصناديق، والفخاخ
     ═══════════════════════════════════════════════════════════════ */
  _build_market(ox, oz) {
    const M = this.M;
    const tile = M.paving.clone(); tile.map = M.paving.map.clone(); tile.map.repeat.set(9, 8); tile.color.setHex(0xf2efe8); tile.roughness = 0.5;
    const R = this._room({ ox, oz, w: 30, d: 26, h: 4.6, floor: tile, wall: M.plaster(0xe8e4dc), lights: [3, 3], lightIntensity: 34 });
    R.id = 'market';
    const L = (x, z) => [ox + x, oz + z];

    /* ── وحدات رفوف مزدوجة الوجه: ثلاثة ممرّات ── */
    const shelfFrame = M.darkTrim, board = M.plaster(0xd9d5cc);
    for (const sx of [-7, 0, 7]) {
      const [x, z] = L(sx, -2.5);
      for (const ty of [0.4, 1.05, 1.7]) R.add(box(1.3, 0.05, 12, board, x, ty, z));
      R.add(box(0.12, 2.0, 12, shelfFrame, x, 1.0, z));                       /* الظهر */
      for (const ez of [-6, 6]) R.add(box(1.3, 2.0, 0.08, shelfFrame, x, 1.0, z + ez));
      R.colliders.push(rect(x, z, 1.5, 12.2));
      /* لافتة الممرّ معلّقة من السقف */
      const label = sx === -7 ? ['مخبوزات · أرز', 'מאפים · אורז'] : sx === 0 ? ['زيوت · قهوة', 'שמנים · קפה'] : ['منظّفات · مشروبات', 'ניקיון · משקאות'];
      R.add(textPlane(label, { w: 2.6, h: 0.7, bg: '#2f6f5e', fg: '#ffffff', size: 44 }, x, 3.6, z + 6.6));
    }

    /* ── جدار الثلّاجات في الشمال: خزائن زجاجية مضيئة ── */
    const fridgeGlass = new THREE.MeshPhysicalMaterial({ color: 0xbfe3f2, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1 });
    const fridgeLight = new THREE.MeshStandardMaterial({ color: 0xeef6ff, emissive: new THREE.Color(0xcfe8ff), emissiveIntensity: 0.9 });
    for (let i = 0; i < 6; i++) {
      const [x, z] = L(-10 + i * 4, -11.6);
      R.add(box(3.8, 2.4, 1.4, M.plaster(0xd0d4d8), x, 1.2, z));
      R.add(box(3.6, 2.0, 0.05, fridgeLight, x, 1.25, z + 0.68));
      R.add(box(3.6, 2.1, 0.04, fridgeGlass, x, 1.25, z + 0.74));
      for (const ty of [0.5, 1.15, 1.8]) R.add(box(3.4, 0.04, 1.0, board, x, ty, z + 0.1));
    }
    R.colliders.push(rect(ox, oz - 11.6, 26, 1.6));
    R.add(textPlane(['ألبان · بيض · دجاج', 'חלב · ביצים · עוף'], { w: 4.2, h: 0.8, bg: '#2f4f8f', fg: '#fff', size: 44 }, ox, 3.4, oz - 10.6));

    /* ── ركن الخضار في الغرب: صناديق خشبية مائلة ── */
    const crate = M.plaster(0x9a6b3d);
    for (let i = 0; i < 4; i++) {
      const [x, z] = L(-13.4, -1 + i * 2.4);
      R.add(box(1.4, 0.9, 2.2, crate, x, 0.45, z));
      const top = box(1.5, 0.12, 2.3, crate, x, 1.0, z); top.rotation.z = 0.35; R.add(top);
    }
    R.colliders.push(rect(ox - 13.4, oz + 2.6, 1.8, 10));
    R.add(textPlane(['خضار وفواكه', 'ירקות ופירות'], { w: 3, h: 0.7, bg: '#c46a3a', fg: '#fff', size: 44 }, ox - 13, 3.4, oz + 2));

    /* ── رفوف الجدار الشرقي: مشروبات ── */
    for (const ty of [0.4, 1.05, 1.7]) R.add(box(1.0, 0.05, 10, board, ox + 13.5, ty, oz - 4));
    R.add(box(0.1, 2.0, 10, shelfFrame, ox + 14.4, 1.0, oz - 4));
    R.colliders.push(rect(ox + 13.7, oz - 4, 1.4, 10.2));

    /* ── طاولات العروض عند نهايات الممرّات (end-caps) ── */
    for (const sx of [-4, 4]) {
      const [x, z] = L(sx, 5);
      R.add(box(2.4, 0.9, 1.4, M.plaster(0xd4a43c), x, 0.45, z));
      R.colliders.push(rect(x, z, 2.6, 1.6));
    }

    /* ── صناديق الدفع: منضدة، سير، شاشة، وأمينة صندوق ──
       أربعة صناديق على جانبَي المدخل، والمنتصف ممرّ دخول حرّ (كما في أيّ
       سوبرماركت حقيقي) حتى لا يظهر اللاعب لحظة الدخول ملتصقاً بأمينة الصندوق. */
    [-8.8, -3.6, 3.6, 8.8].forEach((sx, i) => {
      const [x, z] = L(sx, 8.6);
      R.add(box(3.2, 0.95, 1.0, M.plaster(0x3a4a5a), x, 0.48, z));
      R.add(box(2.0, 0.06, 0.7, M.plaster(0x1a1a1a), x - 0.3, 0.98, z));
      R.add(box(0.5, 0.4, 0.05, M.officeDark, x + 1.2, 1.35, z - 0.2));
      R.add(box(0.06, 0.4, 0.06, M.metal, x + 1.2, 1.1, z - 0.2));
      R.add(npc(M, { shirt: 0xb23a3a, pants: 0x2a2a30, hijab: i % 2 === 0 }, x, oz + 10.2, Math.PI));
      R.colliders.push(rect(x, z, 3.4, 1.2), rect(x, oz + 10.2, 0.8, 0.8));
      R.hotspots.push({ id: `checkout${i}`, kind: 'checkout', x, z: z - 1.4, radius: 1.7 });
      R.markers.push({ id: `checkout${i}`, kind: 'hotspot', cls: 'marker-hotspot', position: new THREE.Vector3(x, 2.3, z),
                       html: () => `<span class="m-icon">🧾</span><span class="m-name">${esc(t('checkout'))}</span>` });
    });
    /* حواجز الصناديق (تحدّ ممرّ الدخول الأوسط وتفصل بين الصناديق) */
    for (const sx of [-11.2, -6.2, -2.0, 2.0, 6.2, 11.2]) R.add(box(0.08, 1.0, 2.2, M.metal, ox + sx, 0.5, oz + 8.6));

    /* ── ركن الأطعمة الجاهزة (الخدمات السريعة) على الجدار الشرقي ── */
    {
      const [x, z] = L(12.6, 5.5);
      R.add(box(1.4, 1.0, 4, M.plaster(0xf0e8dc), x, 0.5, z));
      R.add(box(1.4, 0.6, 4, fridgeGlass, x, 1.3, z));
      R.add(npc(M, { shirt: 0xf4f4f0, pants: 0x3a3a3a, hijab: false }, x + 1.0, z, -Math.PI / 2));
      R.colliders.push(rect(x, z, 1.6, 4.2));
      R.hotspots.push({ id: 'deli', kind: 'npc', x: x - 1.4, z, radius: 1.8, action: 'location', target: 'market' });
      R.markers.push({ id: 'deli', kind: 'hotspot', cls: 'marker-hotspot', position: new THREE.Vector3(x, 2.4, z),
                       html: () => `<span class="m-icon">🥙</span><span class="m-name">${esc(t({ ar: 'أطعمة جاهزة', he: 'אוכל מוכן' }))}</span>` });
    }

    /* ── المنتجات على الرفوف ── */
    for (const p of PRODUCTS) {
      const [sx, sz, tier] = p.spot;
      const y = [0.42, 1.07, 1.72][tier] + 0.02;
      let x = ox + sx, z = oz + sz;
      if (sz === -11) { z = oz - 11.2; }                               /* داخل الثلّاجة */
      else if (sx === -13) { x = ox - 13.4; z = oz + sz; }             /* صناديق الخضار */
      else if (sx === 13) { x = ox + 13.5; }                            /* رفّ الجدار الشرقي */
      else if (sz === 5) { /* طاولة عرض */ }
      else if (sz === 8.6) {                                            /* رفّ اندفاعي عند الصندوق */
        R.add(box(0.7, 1.5, 0.5, M.plaster(0xe0c25e), x, 0.75, z));
        R.colliders.push(rect(x, z, 0.8, 0.6));
      } else { x = ox + sx + 0.75; }                                    /* وجه الرفّ الجنوبي للممرّ */

      const spread = sx === -13 ? 0 : 0.0;
      productStack(R, p, x, sz === -13 ? 1.05 : sz === 5 ? 0.95 : y, z, spread);
      R.hotspots.push({ id: p.id, kind: 'product', x, z, radius: 1.75, product: p });
      R.markers.push({
        id: p.id, kind: 'price', cls: 'marker-price' + (p.promo ? ' promo' : ''),
        position: new THREE.Vector3(x, (sz === -13 ? 1.05 : sz === 5 ? 0.95 : y) + 0.7, z),
        html: () => `${p.promo ? `<span class="m-promo">${esc(t(p.promo))}</span>` : ''}
          <span class="m-name">${esc(t(p.name))}</span>
          <span class="m-price num">${p.price} ₪</span>
          <span class="m-unit num">${unitPrice(p)} ₪/${esc(t(p.unit.label))}</span>`
      });
    }

    /* ── لافتة ترحيب وملصق العروض ── */
    // لافتة الترحيب على الجدار البعيد مواجِهةً للمدخل، لا خلف اللاعب حيث تحجب الكاميرا
    R.add(textPlane(['أهلاً بكم', 'ברוכים הבאים'], { w: 4, h: 0.9, bg: '#c46a3a', fg: '#fff', size: 52 }, ox, 4.1, oz - 12.9, 0));
    R.add(textPlane(['عروض الأسبوع!', 'מבצעי השבוע!'], { w: 2.6, h: 1.4, bg: '#ffe08a', fg: '#8a3a00', size: 56 }, ox - 4, 2.2, oz + 5.8, Math.PI));

    /* متسوّقون */
    R.add(npc(M, { shirt: 0x2f6f9e, pants: 0x3a3f46, hijab: true }, ox - 10, oz - 5, 0.6));
    R.add(npc(M, { shirt: 0x6a4a8a, pants: 0x2a2a30, hijab: false }, ox + 9, oz + 1, -2.2));
    return R;
  }

  /* ═══════════════════════════════════════════════════════════════
     🏦 البنك — ردهة، شبّاك موظّفين، صفّ انتظار، وصرّاف آلي
     ═══════════════════════════════════════════════════════════════ */
  _build_bank(ox, oz) {
    const M = this.M;
    const marble = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.25, metalness: 0.05 });
    const R = this._room({ ox, oz, w: 22, d: 16, h: 4.2, floor: marble, wall: M.stoneWarm, lights: [2, 2], lightIntensity: 32 });
    R.id = 'bank';
    /* المنضدة الطويلة وشبابيك الزجاج */
    R.add(box(16, 1.1, 0.9, M.plaster(0x4a3a2a), ox, 0.55, oz - 5));
    R.add(box(16, 0.06, 1.0, M.brass, ox, 1.12, oz - 5));
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe6f2, transparent: true, opacity: 0.3, roughness: 0.05 });
    R.add(box(16, 1.6, 0.05, glass, ox, 2.0, oz - 5));
    R.colliders.push(rect(ox, oz - 5, 16, 1.2));
    for (const sx of [-5, 0, 5]) {
      R.add(npc(M, { shirt: 0xf4f4f0, pants: 0x2a2a30, hijab: sx === 5 }, ox + sx, oz - 6.5, 0));
      R.add(box(0.5, 0.35, 0.04, M.officeDark, ox + sx, 1.4, oz - 5.2));
    }
    R.hotspots.push({ id: 'teller', kind: 'npc', x: ox, z: oz - 3.6, radius: 2.4, action: 'location', target: 'bank' });
    R.markers.push({ id: 'teller', kind: 'hotspot', cls: 'marker-hotspot', position: new THREE.Vector3(ox, 2.9, oz - 5),
                     html: () => `<span class="m-icon">🏦</span><span class="m-name">${esc(t('tellerSays'))}</span>` });
    /* صفّ الانتظار: أعمدة وحبال */
    for (let i = 0; i < 4; i++) {
      const z = oz - 2 + i * 1.6;
      for (const sx of [-1.2, 1.2]) R.add(cyl(0.05, 1.0, M.brass, ox + sx, 0.5, z));
      if (i < 3) for (const sx of [-1.2, 1.2]) R.add(box(0.03, 0.03, 1.6, M.plaster(0x8a1a1a), ox + sx, 0.95, z + 0.8));
    }
    /* الصرّاف الآلي على الجدار الشرقي */
    R.add(box(1.0, 2.0, 0.6, M.plaster(0x2a3440), ox + 10.4, 1.0, oz + 2));
    R.add(box(0.6, 0.45, 0.05, new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: new THREE.Color(0x36c4ff), emissiveIntensity: 0.8 }), ox + 9.85, 1.35, oz + 2));
    R.colliders.push(rect(ox + 10.4, oz + 2, 1.2, 0.8));
    R.hotspots.push({ id: 'atm', kind: 'npc', x: ox + 9.2, z: oz + 2, radius: 1.6, action: 'atm', target: 'bank' });
    R.markers.push({ id: 'atm', kind: 'hotspot', cls: 'marker-hotspot', position: new THREE.Vector3(ox + 10.4, 2.6, oz + 2),
                     html: () => `<span class="m-icon">🏧</span><span class="m-name">${esc(t('atm'))}</span>` });
    /* مقاعد الانتظار */
    for (let i = 0; i < 4; i++) R.add(box(0.6, 0.5, 0.6, M.plaster(0x2f4f8f), ox - 9, 0.5, oz - 2 + i * 1.2));
    R.add(textPlane(['البنك المحلّي', 'הבנק המקומי'], { w: 6, h: 1.1, bg: '#153554', fg: '#e8cc6e', size: 60 }, ox, 3.4, oz - 7.6));
    return R;
  }

  /* ═══════════════════════════════════════════════════════════════
     🏗️ مركز التشغيل — استقبال، لوحة وظائف، وطاولة مقابلة
     ═══════════════════════════════════════════════════════════════ */
  _build_employment(ox, oz) {
    const M = this.M;
    const R = this._room({ ox, oz, w: 20, d: 14, h: 3.6, floor: M.plaster(0x8d94a0), wall: M.plaster(0xeef0f2), lights: [2, 2], lightIntensity: 28, warm: 0xf4f7ff });
    R.id = 'employment';
    /* استقبال */
    R.add(box(4, 1.1, 1.0, M.plaster(0xd9d5cc), ox, 0.55, oz + 3.5));
    R.add(npc(M, { shirt: 0x2f6f5e, pants: 0x2a2a30, hijab: true }, ox, oz + 5, Math.PI));
    R.colliders.push(rect(ox, oz + 3.5, 4.2, 1.2), rect(ox, oz + 5, 0.8, 0.8));
    R.hotspots.push({ id: 'reception', kind: 'npc', x: ox, z: oz + 2.2, radius: 2.0, action: 'location', target: 'employment' });
    R.markers.push({ id: 'reception', kind: 'hotspot', cls: 'marker-hotspot', position: new THREE.Vector3(ox, 2.5, oz + 4),
                     html: () => `<span class="m-icon">🗂️</span><span class="m-name">${esc(t('receptionSays'))}</span>` });
    /* لوحة الوظائف */
    const jobLines = ['لوحة الوظائف · לוח משרות', ...JOBS.map(j => `${j.gross.toLocaleString('en-US')} ₪ · ${j.hours}`)];
    R.add(textPlane(jobLines, { w: 4.5, h: 2.6, bg: '#f7f3e8', fg: '#1a2330', size: 40, align: 'center' }, ox - 9.6, 2.0, oz - 2, Math.PI / 2));
    /* طاولة المقابلة */
    R.add(box(2.6, 0.08, 1.2, M.plaster(0x7a5a3a), ox + 4, 0.75, oz - 4));
    for (const sx of [-0.9, 0.9]) R.add(box(0.1, 0.72, 0.1, M.metal, ox + 4 + sx, 0.36, oz - 4));
    R.add(npc(M, { shirt: 0x3a3a3a, pants: 0x2a2a30, hijab: false }, ox + 4, oz - 5.4, Math.PI));
    for (const sx of [-0.6, 0.6]) R.add(box(0.55, 0.9, 0.55, M.plaster(0x2f4f8f), ox + 4 + sx, 0.45, oz - 2.6));
    R.colliders.push(rect(ox + 4, oz - 4, 2.8, 1.4), rect(ox + 4, oz - 5.4, 0.8, 0.8));
    R.hotspots.push({ id: 'interviewer', kind: 'npc', x: ox + 4, z: oz - 1.6, radius: 2.0, action: 'location', target: 'employment' });
    R.markers.push({ id: 'interviewer', kind: 'hotspot', cls: 'marker-hotspot', position: new THREE.Vector3(ox + 4, 2.4, oz - 5),
                     html: () => `<span class="m-icon">🤝</span><span class="m-name">${esc(t({ ar: 'مقابلة عمل', he: 'ראיון עבודה' }))}</span>` });
    /* نباتات وملصق */
    R.add(cyl(0.3, 0.5, M.plaster(0x7a5a3a), ox - 8, 0.25, oz + 5)); R.add(cyl(0.7, 1.4, M.oliveLight, ox - 8, 1.2, oz + 5, 7));
    R.add(textPlane(['مركز التشغيل', 'מרכז התעסוקה'], { w: 5, h: 1.0, bg: '#4a86c4', fg: '#fff', size: 56 }, ox, 3.0, oz - 6.6));
    return R;
  }

  /* ═══════════════════════════════════════════════════════════════
     🚗 معرض السيارات — صالة لامعة بثلاث سيارات على منصّات
     ═══════════════════════════════════════════════════════════════ */
  _build_dealer(ox, oz) {
    const M = this.M;
    const gloss = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.18, metalness: 0.1 });
    const R = this._room({ ox, oz, w: 28, d: 18, h: 5, floor: gloss, wall: M.plaster(0xe4e6ea), lights: [3, 2], lightIntensity: 40, warm: 0xffffff });
    R.id = 'dealer';
    CARS_FOR_SALE.forEach((c, i) => {
      const x = ox - 9 + i * 9, z = oz - 2;
      R.add(cyl(3.0, 0.3, M.darkTrim, x, 0.15, z, 32));
      R.add(displayCar(M, c.color, x, 0.3, z, 0.5 - i * 0.5));
      R.colliders.push(rect(x, z, 5, 5));
      R.hotspots.push({ id: `car${i}`, kind: 'npc', x, z: z + 4.2, radius: 2.2, action: 'location', target: 'dealer' });
      R.markers.push({ id: `car${i}`, kind: 'price', cls: 'marker-price', position: new THREE.Vector3(x, 2.8, z),
                       html: () => `<span class="m-name">${c.year}</span><span class="m-price num">${c.price.toLocaleString('en-US')} ₪</span>` });
    });
    R.add(box(3, 1.05, 1.2, M.plaster(0xd9d5cc), ox + 10, 0.52, oz + 5));
    R.add(npc(M, { shirt: 0x1a2a3a, pants: 0x1a1a1a, hijab: false }, ox + 10, oz + 6.4, Math.PI));
    R.colliders.push(rect(ox + 10, oz + 5, 3.2, 1.4));
    R.hotspots.push({ id: 'salesman', kind: 'npc', x: ox + 10, z: oz + 3.6, radius: 2.0, action: 'location', target: 'dealer' });
    R.markers.push({ id: 'salesman', kind: 'hotspot', cls: 'marker-hotspot', position: new THREE.Vector3(ox + 10, 2.5, oz + 5.6),
                     html: () => `<span class="m-icon">🤵</span><span class="m-name">${esc(t('salesmanSays'))}</span>` });
    R.add(textPlane(['معرض السيارات', 'סוכנות הרכב'], { w: 6, h: 1.1, bg: '#8f4f8f', fg: '#fff', size: 60 }, ox, 4.0, oz - 8.6));
    return R;
  }

  /* ═══════════════════════════════════════════════════════════════
     🛡️ مركز الأمن الرقمي — غرفة داكنة بشاشات وخوادم
     ═══════════════════════════════════════════════════════════════ */
  _build_cyber(ox, oz) {
    const M = this.M;
    const R = this._room({ ox, oz, w: 18, d: 12, h: 3.6, floor: M.plaster(0x1c2430), wall: M.plaster(0x1a2230), ceilingColor: 0x141a24, lights: [2, 1], lightIntensity: 14, warm: 0x9fd8ff });
    R.id = 'cyber';
    const screen = new THREE.MeshStandardMaterial({ color: 0x0d3040, emissive: new THREE.Color(0x36c4ff), emissiveIntensity: 1.2 });
    for (let i = 0; i < 3; i++) {
      const x = ox - 5 + i * 5, z = oz - 4;
      R.add(box(3.4, 0.08, 1.2, M.plaster(0x2a3440), x, 0.75, z));
      R.add(box(1.6, 0.9, 0.06, screen, x, 1.4, z - 0.3));
      R.add(box(0.5, 0.5, 0.5, M.plaster(0x2f4f8f), x, 0.25, z + 1.2));
      R.colliders.push(rect(x, z, 3.6, 1.4));
    }
    R.add(npc(M, { shirt: 0x36c4ff, pants: 0x1a1a1a, hijab: false }, ox, oz - 5.3, Math.PI));
    R.hotspots.push({ id: 'guide', kind: 'npc', x: ox, z: oz - 2.4, radius: 2.2, action: 'location', target: 'cyber' });
    R.markers.push({ id: 'guide', kind: 'hotspot', cls: 'marker-hotspot', position: new THREE.Vector3(ox, 2.4, oz - 4),
                     html: () => `<span class="m-icon">🛡️</span><span class="m-name">${esc(t('guideSays'))}</span>` });
    /* خزانة خوادم بمؤشّرات */
    R.add(box(1.2, 2.6, 0.9, M.plaster(0x12171f), ox + 8, 1.3, oz + 2));
    for (let i = 0; i < 8; i++) R.add(box(0.6, 0.04, 0.05, i % 3 ? screen : new THREE.MeshStandardMaterial({ color: 0x3aff8a, emissive: new THREE.Color(0x3aff8a), emissiveIntensity: 1 }), ox + 7.4, 0.5 + i * 0.28, oz + 2));
    R.colliders.push(rect(ox + 8, oz + 2, 1.4, 1.1));
    R.add(textPlane(['🛡️ مركز الأمن الرقمي', 'מרכז הביטחון הדיגיטלי'], { w: 6, h: 1.4, bg: '#0d3040', fg: '#9fd8ff', size: 52 }, ox, 2.6, oz - 5.6));
    return R;
  }

  /* ═══════════════════════════════════════════════════════════════
     🏠 البيت — شقّة صغيرة: سرير، مكتب، مطبخ، نافذة
     ═══════════════════════════════════════════════════════════════ */
  _build_home(ox, oz) {
    const M = this.M;
    const R = this._room({ ox, oz, w: 14, d: 11, h: 3.0, floor: M.plaster(0xb98c5a), wall: M.plaster(0xf2ebdd), lights: [2, 1], lightIntensity: 22 });
    R.id = 'home';
    /* سرير */
    R.add(box(2.0, 0.5, 2.2, M.plaster(0x7a5a3a), ox - 5, 0.25, oz - 3));
    R.add(box(1.9, 0.25, 2.1, M.plaster(0xe8e4dc), ox - 5, 0.62, oz - 3));
    R.add(box(1.9, 0.18, 0.6, M.plaster(0xf4f4f0), ox - 5, 0.84, oz - 3.7));
    R.add(box(1.9, 0.12, 1.3, M.plaster(0x2f6f5e), ox - 5, 0.8, oz - 2.6));
    R.colliders.push(rect(ox - 5, oz - 3, 2.2, 2.4));
    R.hotspots.push({ id: 'bed', kind: 'npc', x: ox - 3.4, z: oz - 3, radius: 1.8, action: 'sleep', target: 'home' });
    R.markers.push({ id: 'bed', kind: 'hotspot', cls: 'marker-hotspot', position: new THREE.Vector3(ox - 5, 1.8, oz - 3),
                     html: () => `<span class="m-icon">🛏️</span><span class="m-name">${esc(t('endDay'))}</span>` });
    /* مكتب ولابتوب */
    R.add(box(1.8, 0.06, 0.8, M.plaster(0x9a6b3d), ox + 3, 0.75, oz - 4.6));
    for (const sx of [-0.8, 0.8]) R.add(box(0.08, 0.75, 0.08, M.metal, ox + 3 + sx, 0.37, oz - 4.6));
    R.add(box(0.7, 0.03, 0.5, M.plaster(0x2a2a30), ox + 3, 0.8, oz - 4.6));
    R.add(box(0.7, 0.45, 0.02, new THREE.MeshStandardMaterial({ color: 0xdfe9ff, emissive: new THREE.Color(0xbfd4ff), emissiveIntensity: 0.8 }), ox + 3, 1.05, oz - 4.85));
    R.add(box(0.5, 0.85, 0.5, M.plaster(0x2f4f8f), ox + 3, 0.42, oz - 3.6));
    R.colliders.push(rect(ox + 3, oz - 4.6, 2, 1));
    R.hotspots.push({ id: 'desk', kind: 'npc', x: ox + 3, z: oz - 2.6, radius: 1.8, action: 'budget', target: 'home' });
    R.markers.push({ id: 'desk', kind: 'hotspot', cls: 'marker-hotspot', position: new THREE.Vector3(ox + 3, 1.9, oz - 4.6),
                     html: () => `<span class="m-icon">💻</span><span class="m-name">${esc(t('tabBudget'))}</span>` });
    /* مطبخ */
    R.add(box(1.0, 0.95, 4, M.plaster(0xd9d5cc), ox + 6.4, 0.48, oz + 1));
    R.add(box(1.0, 1.9, 0.9, M.plaster(0xe8e8e4), ox + 6.4, 0.95, oz + 3.8));
    R.colliders.push(rect(ox + 6.4, oz + 2, 1.2, 5));
    /* كنبة وسجّادة ونافذة */
    R.add(box(2.6, 0.55, 1.0, M.plaster(0x8a3a3a), ox - 3, 0.28, oz + 3));
    R.add(box(3.4, 0.03, 2.4, M.plaster(0xb23a3a), ox - 3, 0.02, oz + 2));
    R.colliders.push(rect(ox - 3, oz + 3, 2.8, 1.2));
    R.add(box(2.2, 1.4, 0.06, new THREE.MeshStandardMaterial({ color: 0xbfd9f2, emissive: new THREE.Color(0xbfd9f2), emissiveIntensity: 0.9 }), ox - 1, 1.8, oz - 5.45));
    return R;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   أدوات
   ═══════════════════════════════════════════════════════════════════ */

function rect(x, z, w, d) { return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }; }

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function cyl(r, h, mat, x, y, z, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.position.set(x, y, z);
  return m;
}

/** لافتة نصّية ثنائية اللغة تُرسم على Canvas — المتصفّح يشكّل العربية والعبرية صحيحاً */
function textPlane(lines, { w, h, bg = '#ffffff', fg = '#111', size = 48 }, x, y, z, rotY = 0) {
  const W = 1024, H = Math.round(1024 * h / w);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
  ctx.font = `800 ${size}px Cairo, Heebo, "Segoe UI", sans-serif`;
  const lh = H / (lines.length + 0.4);
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, lh * (i + 0.7)));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = rotY;
  return m;
}

/** كومة منتجات ملوّنة على الرفّ (2×2 + واحدة فوق) */
function productStack(R, p, x, y, z) {
  const mat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.55, metalness: 0.05 });
  const s = 0.3;
  for (const [dx, dz] of [[-0.18, -0.12], [0.18, -0.12], [-0.18, 0.14], [0.18, 0.14], [0, 0.01]]) {
    const b = box(s, s * 0.9, s * 0.8, mat, x + dx, y + (dz === 0.01 ? s * 0.9 : 0) + s * 0.45, z + dz);
    b.rotation.y = (dx + dz) * 0.4;
    R.add(b);
  }
}

/** شخصية ثانوية ثابتة — نفس لغة اللاعب البصرية */
function npc(M, { shirt, pants, hijab }, x, z, rotY = 0) {
  const g = new THREE.Group();
  const shirtM = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const pantsM = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  g.add(box(0.56, 0.64, 0.3, shirtM, 0, 1.16, 0));
  g.add(box(0.48, 0.16, 0.26, pantsM, 0, 0.76, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), M.skin); head.position.y = 1.72; g.add(head);
  if (hijab) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
      new THREE.MeshStandardMaterial({ color: 0x3a3f5a, roughness: 0.9 }));
    h.position.y = 1.75; g.add(h);
    g.add(box(0.5, 0.35, 0.34, new THREE.MeshStandardMaterial({ color: 0x3a3f5a, roughness: 0.9 }), 0, 1.5, -0.02));
  } else {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hair);
    hair.position.y = 1.75; g.add(hair);
  }
  for (const sx of [-0.36, 0.36]) g.add(box(0.14, 0.58, 0.14, shirtM, sx, 1.18, 0));
  for (const sx of [-0.14, 0.14]) g.add(box(0.18, 0.74, 0.18, pantsM, sx, 0.4, 0));
  g.position.set(x, 0, z); g.rotation.y = rotY;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** سيارة معروضة على منصّة */
function displayCar(M, color, x, y, z, rot) {
  const g = new THREE.Group();
  const paint = M.carPaint(color);
  g.add(box(1.9, 0.72, 4.4, paint, 0, 0.72, 0));
  g.add(box(1.86, 0.5, 3.9, paint, 0, 1.28, -0.1));
  g.add(box(1.7, 0.62, 2.35, M.carGlass, 0, 1.78, -0.15));
  g.add(box(1.74, 0.08, 2.3, paint, 0, 2.11, -0.15));
  for (const [ox, oz] of [[0.95, 1.42], [-0.95, 1.42], [0.95, -1.42], [-0.95, -1.42]]) {
    const w = cyl(0.42, 0.3, M.tire, ox, 0.42, oz, 18); w.rotation.z = Math.PI / 2; g.add(w);
    const r = cyl(0.24, 0.32, M.rim, ox, 0.42, oz, 10); r.rotation.z = Math.PI / 2; g.add(r);
  }
  g.position.set(x, y, z); g.rotation.y = rot;
  return g;
}
