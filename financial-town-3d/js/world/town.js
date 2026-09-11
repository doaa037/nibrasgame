/* ═══════════════════════════════════════════════════════════════════
   town.js — بناء البلدة ثلاثية الأبعاد إجرائياً
   ───────────────────────────────────────────────────────────────────
   ما يجعل بلدةً تبدو حقيقية ليس عدد المضلّعات بل التفاصيل التي
   يتعرّف عليها العين فوراً: خزّانات المياه وسخّانات الشمس على الأسطح،
   الشتّرات المنسدلة، الشرفات، المظلّات المخطّطة فوق المحلّات، الحجر
   القدسي، الأرصفة المبلّطة وحوافّها، ممرّات المشاة، وأشجار الزيتون
   والسرو. كلّها هنا — وكلّها مُجمَّعة (InstancedMesh) حتى تبقى
   البلدة كاملةً تحت 80 استدعاء رسم على حاسوب مدرسي.
   ═══════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { WORLD } from '../content/config.js';
import { ROAD_AXES, BLOCK_CENTERS, LOCATIONS, BUS_STOPS, MOSQUE, FILLER, PROPS }
  from '../content/world.data.js';
import { makeRandom } from '../core/random.js';
import { FACADE_TILE } from './materials.js';

export class Town {
  /**
   * @param {THREE.Scene} scene
   * @param {object} M  الخامات المشتركة من createMaterials()
   */
  constructor(scene, M) {
    this.scene = scene;
    this.M = M;
    this.rnd = makeRandom(20260910);
    this.colliders = [];
    this.doors = {};
    this.markers = [];
    this.group = new THREE.Group();
    this.contactShadows = [];     /* أقدام المباني: ظلال تلامس مزيّفة رخيصة */

    this._buildGround();
    this._buildRoads();
    this._buildLandmarks();
    this._buildMosque();
    this._buildFillerBuildings();
    this._buildBusStops();
    this._buildTrees();
    this._buildLamps();
    this._buildParkedCars();
    this._buildContactShadows();

    scene.add(this.group);
  }

  /* ═══════════════════════════════════════════════════════════════
     الأرض
     ═══════════════════════════════════════════════════════════════ */
  _buildGround() {
    const size = WORLD.SIZE + 140;
    const geo = new THREE.PlaneGeometry(size, size);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, this.M.ground);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  /* ═══════════════════════════════════════════════════════════════
     الشوارع: أسفلت + رصيف مبلّط + حافّة + خطوط + ممرّات مشاة
     ═══════════════════════════════════════════════════════════════ */
  _buildRoads() {
    const L = WORLD.SIZE, RW = WORLD.ROAD_WIDTH, SW = WORLD.SIDEWALK;
    const M = this.M;
    /* خامات بتكرار يطابق الاتّجاه: 8م لبلاطة الأسفلت، 3.2م لبلاطة الرصيف */
    const asphaltH = tiled(M.asphalt, L / 8, RW / 8), asphaltV = tiled(M.asphalt, RW / 8, L / 8);
    const pavingH  = tiled(M.paving, L / 3.2, (RW + SW * 2) / 3.2);
    const pavingV  = tiled(M.paving, (RW + SW * 2) / 3.2, L / 3.2);

    const roads = new THREE.Group();
    const dashSpecs = [], curbSpecs = [], zebraSpecs = [];

    for (const axis of ROAD_AXES) {
      for (const horizontal of [true, false]) {
        const walkW = RW + SW * 2;
        const walk = box(horizontal ? L : walkW, 0.3, horizontal ? walkW : L,
                         horizontal ? pavingH : pavingV, horizontal ? 0 : axis, 0.15, horizontal ? axis : 0);
        walk.receiveShadow = true;
        roads.add(walk);

        const road = box(horizontal ? L : RW, 0.34, horizontal ? RW : L,
                         horizontal ? asphaltH : asphaltV, horizontal ? 0 : axis, 0.17, horizontal ? axis : 0);
        road.receiveShadow = true;
        roads.add(road);

        /* حافّتا الرصيف على جانبي الأسفلت */
        for (const side of [-1, 1]) {
          const off = side * (RW / 2 + 0.18);
          curbSpecs.push({ x: horizontal ? 0 : axis + off, z: horizontal ? axis + off : 0,
                           sx: horizontal ? L : 0.36, sz: horizontal ? 0.36 : L });
        }

        /* خطّ متقطّع في المنتصف */
        const dashes = 30, len = L / dashes * 0.42;
        for (let i = 0; i < dashes; i++) {
          const p = -L / 2 + (i + 0.5) * (L / dashes);
          /* لا خطوط داخل التقاطعات */
          if (ROAD_AXES.some(a => Math.abs(p - a) < RW / 2 + 1)) continue;
          dashSpecs.push({ x: horizontal ? p : axis, z: horizontal ? axis : p,
                           sx: horizontal ? len : 0.3, sz: horizontal ? 0.3 : len });
        }
      }
    }

    /* ممرّات مشاة عند كل تقاطع — على الأذرع الأربعة */
    for (const ax of ROAD_AXES) for (const az of ROAD_AXES) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cx = ax + dx * (RW / 2 + 1.6), cz = az + dz * (RW / 2 + 1.6);
        const along = dx !== 0;                 /* الممرّ يعبر الشارع الرأسي */
        for (let s = -2.5; s <= 2.5; s++) {
          zebraSpecs.push({
            x: cx + (along ? 0 : s * 1.6), z: cz + (along ? s * 1.6 : 0),
            sx: along ? 2.2 : 0.75, sz: along ? 0.75 : 2.2
          });
        }
      }
    }

    roads.add(instancedFlat(dashSpecs, M.lane, 0.36, 0.02));
    roads.add(instancedFlat(zebraSpecs, M.zebra, 0.36, 0.02));
    roads.add(instancedFlat(curbSpecs, M.curb, 0.33, 0.14));
    this.group.add(roads);
  }

  /* ═══════════════════════════════════════════════════════════════
     المؤسسات — كل واحدة بهويّة معمارية خاصّة
     ═══════════════════════════════════════════════════════════════ */
  _buildLandmarks() {
    for (const loc of LOCATIONS) {
      const builder = this[`_lm_${loc.id}`];
      if (builder) builder.call(this, loc);
      this._doorPlate(loc);
      const [w, , d] = loc.size;
      this.colliders.push(rect(loc.pos[0], loc.pos[1], w, d));
      this.contactShadows.push({ x: loc.pos[0], z: loc.pos[1], w: w + 4, d: d + 4 });
      this.doors[loc.id] = { x: loc.door[0], z: loc.door[1] };
      this.markers.push({ id: loc.id, icon: loc.icon, nameKey: loc.nameKey,
                          position: new THREE.Vector3(loc.pos[0], loc.size[1] + 3.4, loc.pos[1]),
                          kind: 'location' });
    }
  }

  /* 🏠 البيت — حجر، شرفة، سخّان شمسي، حديقة صغيرة */
  _lm_home(loc) {
    const M = this.M, [x, z] = loc.pos, [w, h, d] = loc.size;
    const g = new THREE.Group();
    g.add(facadeBox(w, h, d, M.stoneWarm, new THREE.Vector2(4, 4), M.roof, x, h / 2, z));
    g.add(box(w + 1, 0.5, d + 1, M.concrete, x, h + 0.25, z));            /* سور السطح */
    /* شرفة على الواجهة المطلّة على الشارع */
    g.add(box(6, 0.3, 2.2, M.concrete, x + 2, 4.6, z + d / 2 + 1.1));
    g.add(box(6, 1.1, 0.08, M.railing, x + 2, 5.3, z + d / 2 + 2.2));
    g.add(awning(4.5, M.awning('#2f6f5e'), x - 4, 3.6, z + d / 2 + 0.4));
    /* سخّان شمسي وخزّان — أيقونة الأسطح المحلّية */
    g.add(solarHeater(M, x - 3, h + 0.5, z - 2));
    g.add(cylinder(0.9, 1.6, M.whiteTank, x + 4, h + 1.3, z - 3));
    /* حديقة: سياج أخضر وشجرة */
    g.add(box(w + 6, 0.8, 0.5, M.hedge, x, 0.4, z + d / 2 + 5));
    this.group.add(g);
  }

  /* 🏗️ مركز التشغيل — برج زجاجي على قاعدة خرسانية ومظلّة مدخل */
  _lm_employment(loc) {
    const M = this.M, [x, z] = loc.pos, [w, h, d] = loc.size;
    const g = new THREE.Group();
    g.add(box(w + 2, 1.2, d + 2, M.concrete, x, 0.6, z));                 /* منصّة */
    g.add(facadeBox(w, h, d, M.officeGlass, new THREE.Vector2(8, 8), M.roof, x, h / 2 + 1, z));
    g.add(box(w + 0.6, 1.4, d + 0.6, M.darkTrim, x, h + 1.2, z));          /* تاج */
    /* شريط خرساني أفقي يفصل الطابق الأرضي */
    g.add(box(w + 0.3, 0.6, d + 0.3, M.concrete, x, 4.4, z));
    /* مظلّة المدخل */
    g.add(box(9, 0.35, 5, M.darkTrim, x, 3.8, z + d / 2 + 2.5));
    for (const ox of [-3.6, 3.6]) g.add(cylinder(0.18, 3.6, M.metal, x + ox, 1.9, z + d / 2 + 4.6));
    g.add(box(4, 3, 0.5, M.darkTrim, x, h + 2.2, z));                      /* غرفة مصعد على السطح */
    this.group.add(g);
  }

  /* 🏦 البنك — حجر ثقيل، أعمدة، نوافذ طويلة داكنة، لوحة نحاسية */
  _lm_bank(loc) {
    const M = this.M, [x, z] = loc.pos, [w, h, d] = loc.size;
    const g = new THREE.Group();
    g.add(box(w + 3, 0.9, d + 3, M.concrete, x, 0.45, z));
    g.add(facadeBox(w, h, d, M.stone, new THREE.Vector2(5, 5), M.roof, x, h / 2 + 0.9, z));
    g.add(box(w + 1.4, 0.9, d + 1.4, M.stone, x, h + 1.3, z));             /* إفريز */
    /* نوافذ طويلة مقوّسة الإيحاء على الواجهة الشرقية (المدخل) */
    for (const oz of [-6, -3, 3, 6]) g.add(box(0.3, 6, 1.6, M.officeDark, x + w / 2 + 0.1, 5.2, z + oz));
    /* أعمدة المدخل */
    for (const oz of [-2.2, 2.2]) g.add(cylinder(0.45, 7, M.stoneWarm, x + w / 2 + 2, 4.4, z + oz));
    g.add(box(0.4, 1.2, 7.5, M.stoneWarm, x + w / 2 + 2, 8.3, z));
    g.add(box(0.15, 0.9, 5, M.brass, x + w / 2 + 0.25, 9.4, z));           /* لوحة الاسم */
    this.group.add(g);
  }

  /* 🛍️ الشارع التجاري — محلّات بفاترينات ومظلّات، وسكن فوقها */
  _lm_market(loc) {
    const M = this.M, [x, z] = loc.pos, [w, h, d] = loc.size;
    const g = new THREE.Group();
    const ground = 4.2;
    g.add(facadeBox(w, ground, d, M.shopfront, new THREE.Vector2(w / 1, ground), M.concrete, x, ground / 2, z));
    g.add(facadeBox(w, h - ground, d, M.facade[1], FACADE_TILE, M.roof, x, ground + (h - ground) / 2, z, true));
    g.add(box(w + 0.8, 0.45, d + 0.8, M.concrete, x, ground + 0.2, z));   /* بلاطة فاصلة */
    const colors = ['#c0392b', '#2f6f5e', '#c9891f', '#2f4f8f'];
    for (let i = 0; i < 4; i++) {
      g.add(awning(5, M.awning(colors[i]), x - w / 2 - 0.2, 3.5, z - d / 2 + 2.5 + i * (d - 5) / 3, true));
    }
    g.add(solarHeater(M, x + 6, h + 0.5, z + 3));
    g.add(cylinder(0.9, 1.6, M.whiteTank, x - 6, h + 1.3, z - 4));
    g.add(box(1.1, 0.8, 0.6, M.acUnit, x - w / 2 - 0.35, 7, z + 2));      /* مكيّف */
    this.group.add(g);
  }

  /* 🚗 معرض السيارات — صالة زجاجية على منصّة، وسيارة معروضة */
  _lm_dealer(loc) {
    const M = this.M, [x, z] = loc.pos, [w, h, d] = loc.size;
    const g = new THREE.Group();
    g.add(box(w + 4, 0.7, d + 4, M.concrete, x, 0.35, z));
    g.add(facadeBox(w, h, d, M.officeGlass, new THREE.Vector2(6, 6), M.roof, x, h / 2 + 0.7, z));
    g.add(box(w + 1, 1.8, d + 1, M.plaster(0x8f4f8f), x, h + 1.1, z));    /* شريط العلامة */
    g.add(box(w - 2, 1.0, 0.3, M.brass, x, h + 1.1, z + d / 2 + 0.7));
    /* سيارة معروضة أمام الصالة على منصّة دوّارة */
    g.add(cylinder(3.2, 0.3, M.darkTrim, x - 8, 0.85, z + d / 2 + 6));
    g.add(displayCar(M, 0xd6d6d8, x - 8, 1.0, z + d / 2 + 6, 0.6));
    for (const ox of [-w / 2, w / 2]) g.add(cylinder(1.2, 0.05, M.concrete, x + ox, 0.72, z + d / 2 + 3));
    this.group.add(g);
  }

  /* 🛡️ مركز الأمن الرقمي — زجاج داكن بشريط سماوي مضيء */
  _lm_cyber(loc) {
    const M = this.M, [x, z] = loc.pos, [w, h, d] = loc.size;
    const g = new THREE.Group();
    g.add(box(w + 2, 1.0, d + 2, M.darkTrim, x, 0.5, z));
    g.add(facadeBox(w, h, d, M.officeDark, new THREE.Vector2(6, 6), M.roof, x, h / 2 + 1, z));
    const accent = new THREE.MeshStandardMaterial({
      color: 0x0d3040, emissive: new THREE.Color(0x36c4ff), emissiveIntensity: 0.9, roughness: 0.4 });
    g.add(box(w + 0.3, 0.35, d + 0.3, accent, x, 4.2, z));
    g.add(box(w + 0.3, 0.35, d + 0.3, accent, x, h + 0.6, z));
    /* أطباق وهوائيات على السطح */
    g.add(cylinder(0.12, 5, M.metal, x + 4, h + 3.5, z - 3));
    g.add(cylinder(1.4, 0.2, M.acUnit, x - 4, h + 1.6, z + 3));
    this.group.add(g);
  }

  /* ⛽ محطّة الوقود — سقف على أعمدة، مضخّات، وكشك */
  _lm_gas(loc) {
    const M = this.M, [x, z] = loc.pos, [w, , d] = loc.size;
    const g = new THREE.Group();
    g.add(box(w + 6, 0.25, d + 6, M.concrete, x, 0.12, z));               /* أرضية */
    const canopyY = 5.6;
    g.add(box(w, 0.6, d, M.plaster(0xf2eee6), x, canopyY, z));
    g.add(box(w + 0.2, 0.7, d + 0.2, M.plaster(0xd7a13b), x, canopyY - 0.6, z));
    for (const [ox, oz] of [[-w / 3, -d / 3], [w / 3, -d / 3], [-w / 3, d / 3], [w / 3, d / 3]]) {
      g.add(cylinder(0.32, canopyY, M.metal, x + ox, canopyY / 2, z + oz));
    }
    /* مضخّتان */
    for (const ox of [-3.5, 3.5]) {
      g.add(box(1.1, 1.9, 0.7, M.plaster(0xe8e8e2), x + ox, 1.2, z));
      g.add(box(0.5, 0.6, 0.1, M.darkTrim, x + ox, 1.6, z + 0.4));
      g.add(box(3.2, 0.2, 1.4, M.concrete, x + ox, 0.35, z));
    }
    /* كشك */
    g.add(facadeBox(6, 3.4, 5, M.officeGlass, new THREE.Vector2(6, 3.4), M.roof, x + w / 2 + 4, 1.95, z - 2));
    this.group.add(g);
  }

  /** باب ذهبي على الواجهة المواجهة لنقطة الدخول */
  _doorPlate(loc) {
    const [w, , d] = loc.size, [x, z] = loc.pos;
    const dx = loc.door[0] - x, dz = loc.door[1] - z;
    const onX = Math.abs(dx) > Math.abs(dz);
    const sign = onX ? Math.sign(dx) : Math.sign(dz);
    const door = box(onX ? 0.3 : 3.2, 3.2, onX ? 3.2 : 0.3, this.M.brass,
                     x + (onX ? sign * (w / 2 + 0.2) : 0), 1.6, z + (onX ? 0 : sign * (d / 2 + 0.2)));
    door.castShadow = false;
    this.group.add(door);
    /* درجتان أمام الباب */
    const step = box(onX ? 1.2 : 4.5, 0.35, onX ? 4.5 : 1.2, this.M.concrete,
                     x + (onX ? sign * (w / 2 + 0.9) : 0), 0.18, z + (onX ? 0 : sign * (d / 2 + 0.9)));
    this.group.add(step);
  }

  /* ═══════════════════════════════════════════════════════════════
     الجامع — قبّة، مئذنة بشرفة، مدخل مقوّس
     ═══════════════════════════════════════════════════════════════ */
  _buildMosque() {
    const M = this.M, [x, z] = MOSQUE.pos, [w, h, d] = MOSQUE.base;
    const g = new THREE.Group();
    g.add(box(w + 6, 0.6, d + 6, M.stoneWarm, x, 0.3, z));                 /* صحن */
    g.add(facadeBox(w, h, d, M.stone, new THREE.Vector2(5, 5), M.roof, x, h / 2 + 0.6, z));
    g.add(box(w + 1, 0.8, d + 1, M.stoneWarm, x, h + 1.0, z));
    /* المدخل المقوّس: فتحة داكنة عميقة بقمّة نصف دائرية، وإطار حجري
       بارز حولها — القوس يُقرأ كفتحة لا كزخرفة ملصقة على الجدار */
    g.add(box(4.6, 6.2, 0.9, M.stoneWarm, x, 3.1, z + d / 2 + 0.25));        /* الإطار البارز */
    g.add(cylinder(2.6, 0.9, M.stoneWarm, x, 6.2, z + d / 2 + 0.25, 24, true));
    g.add(box(3.2, 5.0, 0.5, M.darkTrim, x, 2.5, z + d / 2 + 0.55));         /* الفتحة */
    g.add(cylinder(1.6, 0.5, M.darkTrim, x, 5.0, z + d / 2 + 0.55, 24, true));
    /* القبّة الكبيرة على طبل ثماني */
    g.add(cylinder(w * 0.42, 1.6, M.stone, x, h + 2.2, z, 8));
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(w * 0.42, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2), M.dome);
    dome.position.set(x, h + 3, z); dome.castShadow = true; g.add(dome);
    g.add(cylinder(0.12, 2.2, M.brass, x, h + 3 + w * 0.42 + 1, z));
    g.add(sphere(0.35, M.brass, x, h + 3 + w * 0.42 + 2.1, z));
    /* قبّتان صغيرتان */
    for (const ox of [-w / 2 + 3, w / 2 - 3]) {
      const sd = new THREE.Mesh(new THREE.SphereGeometry(2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.dome);
      sd.position.set(x + ox, h + 1.4, z - d / 2 + 3); g.add(sd);
    }
    /* المئذنة: بدن، شرفة، بدن أعلى أرفع، قبّة مخروطية */
    const mx = x + w / 2 + 3.2, mz = z + d / 2 + 3.2, mh = MOSQUE.minaretHeight;
    g.add(cylinder(1.5, 2, M.stoneWarm, mx, 1.6, mz, 8));
    g.add(cylinder(1.15, mh * 0.62, M.stone, mx, mh * 0.31 + 2, mz, 12));
    g.add(cylinder(1.9, 0.5, M.stoneWarm, mx, mh * 0.62 + 2.2, mz, 12));   /* الشرفة */
    g.add(cylinder(1.95, 1.2, M.railing, mx, mh * 0.62 + 3.0, mz, 12, false, true));
    g.add(cylinder(0.85, mh * 0.3, M.stone, mx, mh * 0.62 + 2.6 + mh * 0.15, mz, 12));
    g.add(cylinder(1.05, 0.4, M.stoneWarm, mx, mh * 0.92 + 2.8, mz, 12));
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.15, 3.2, 12), M.dome);
    cap.position.set(mx, mh * 0.92 + 4.6, mz); cap.castShadow = true; g.add(cap);
    g.add(sphere(0.25, M.brass, mx, mh * 0.92 + 6.4, mz));
    /* أشجار سرو عند المدخل */
    this._cypressSpots = [[x - 7, z + d / 2 + 4], [x + 7, z + d / 2 + 4], [x - w / 2 - 4, z - 4], [x + w / 2 - 1, z - d / 2 - 4]];

    this.group.add(g);
    this.colliders.push(rect(x, z, w, d));
    this.colliders.push(rect(mx, mz, 3.5, 3.5));
    this.contactShadows.push({ x, z, w: w + 4, d: d + 4 });
  }

  /* ═══════════════════════════════════════════════════════════════
     المباني السكنية — مُجمَّعة مع تجهيزات الأسطح والشرفات
     ═══════════════════════════════════════════════════════════════ */
  _buildFillerBuildings() {
    const placed = [...this.colliders];
    const specs = [];
    const half = WORLD.BLOCK / 2 - WORLD.ROAD_WIDTH / 2 - WORLD.SIDEWALK - 1.5;

    for (const bx of BLOCK_CENTERS) for (const bz of BLOCK_CENTERS) {
      let attempts = 0, placedHere = 0;
      while (placedHere < FILLER.PER_BLOCK && attempts < 80) {
        attempts++;
        const floors = this.rnd.int(2, 5);
        const w = this.rnd.range(FILLER.MIN_SIZE, FILLER.MAX_SIZE);
        const d = this.rnd.range(FILLER.MIN_SIZE, FILLER.MAX_SIZE);
        const h = floors * FACADE_TILE.y;                 /* ارتفاع = طوابق كاملة */
        const x = bx + (this.rnd() * 2 - 1) * (half - w / 2);
        const z = bz + (this.rnd() * 2 - 1) * (half - d / 2);
        const r = rect(x, z, w + 2.5, d + 2.5);
        if (placed.some(p => overlaps(p, r))) continue;
        placed.push(r);
        specs.push({ x, z, w, d, h, floors, color: this.rnd.pick(FILLER.PALETTE) });
        this.colliders.push(rect(x, z, w, d));
        this.contactShadows.push({ x, z, w: w + 3, d: d + 3 });
        placedHere++;
      }
    }
    this.fillerSpecs = specs;

    /* تنويعتان من الواجهات تتناوبان */
    const groups = [[], []];
    specs.forEach((s, i) => groups[i % 2].push(s));
    groups.forEach((list, gi) => {
      if (!list.length) return;
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const dims = new Float32Array(list.length * 3);
      list.forEach((s, i) => dims.set([s.w, s.h, s.d], i * 3));
      geo.setAttribute('instDims', new THREE.InstancedBufferAttribute(dims, 3));
      const mesh = new THREE.InstancedMesh(geo, this.M.facade[gi], list.length);
      mesh.castShadow = mesh.receiveShadow = true;
      const m = new THREE.Matrix4(), c = new THREE.Color();
      list.forEach((s, i) => {
        m.compose(new THREE.Vector3(s.x, s.h / 2, s.z), new THREE.Quaternion(), new THREE.Vector3(s.w, s.h, s.d));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, c.setHex(s.color));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      this.group.add(mesh);
    });

    /* سور السطح (parapet) وبلاطة السطح */
    this.group.add(instancedBoxes(specs.map(s => ({ x: s.x, y: s.h + 0.3, z: s.z, sx: s.w + 0.5, sy: 0.6, sz: s.d + 0.5 })), this.M.roof));

    /* تجهيزات الأسطح: خزّانات بيضاء وسوداء، سخّانات شمسية، مكيّفات */
    const whiteTanks = [], blackTanks = [], panels = [], boilers = [], acs = [], balconies = [], rails = [];
    for (const s of specs) {
      const n = this.rnd.int(1, 3);
      for (let i = 0; i < n; i++) {
        const px = s.x + this.rnd.range(-s.w / 2 + 1.5, s.w / 2 - 1.5);
        const pz = s.z + this.rnd.range(-s.d / 2 + 1.5, s.d / 2 - 1.5);
        const kind = this.rnd();
        if (kind < 0.35)      whiteTanks.push({ x: px, y: s.h + 0.95, z: pz, r: 0.75, h: 1.5 });
        else if (kind < 0.5)  blackTanks.push({ x: px, y: s.h + 0.85, z: pz, r: 0.7, h: 1.3 });
        else if (kind < 0.85) {
          const rot = this.rnd.range(0, Math.PI * 2);
          panels.push({ x: px, y: s.h + 0.75, z: pz, rot, sx: 2.2, sy: 0.08, sz: 1.4, tilt: -0.55 });
          boilers.push({ x: px + Math.sin(rot) * 0.9, y: s.h + 1.35, z: pz + Math.cos(rot) * 0.9, r: 0.42, h: 1.5, rot: Math.PI / 2 });
        } else acs.push({ x: px, y: s.h + 0.55, z: pz, sx: 0.9, sy: 0.7, sz: 0.5 });
      }
      /* شرفات على الواجهة الجنوبية للمباني ذات ثلاثة طوابق فأكثر */
      if (s.floors >= 3 && this.rnd.chance(0.7)) {
        for (let f = 1; f < s.floors; f++) {
          const y = f * FACADE_TILE.y + 0.15;
          balconies.push({ x: s.x, y, z: s.z + s.d / 2 + 0.9, sx: Math.min(6, s.w - 2), sy: 0.25, sz: 1.8 });
          rails.push({ x: s.x, y: y + 0.65, z: s.z + s.d / 2 + 1.78, sx: Math.min(6, s.w - 2), sy: 1.05, sz: 0.06 });
        }
      }
    }
    this.group.add(instancedCylinders(whiteTanks, this.M.whiteTank));
    this.group.add(instancedCylinders(blackTanks, this.M.blackTank));
    this.group.add(instancedBoxes(panels, this.M.solarPanel));
    this.group.add(instancedCylinders(boilers, this.M.whiteTank));
    this.group.add(instancedBoxes(acs, this.M.acUnit));
    this.group.add(instancedBoxes(balconies, this.M.concrete));
    this.group.add(instancedBoxes(rails, this.M.railing));
  }

  /* ═══════════════════════════════════════════════════════════════
     محطّات الحافلات — مظلّة زجاجية، مقعد، لافتة
     ═══════════════════════════════════════════════════════════════ */
  _buildBusStops() {
    const M = this.M;
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x9fc4d8, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1,
      transmission: 0, side: THREE.DoubleSide });
    for (const stop of BUS_STOPS) {
      const [x, z] = stop.pos;
      const g = new THREE.Group();
      g.add(box(5.6, 0.25, 2.6, M.darkTrim, x, 3.1, z));
      g.add(box(5.4, 2.6, 0.08, glass, x, 1.75, z - 1.25));                 /* لوح خلفي */
      g.add(box(0.08, 2.6, 2.4, glass, x - 2.7, 1.75, z));                  /* لوح جانبي */
      for (const off of [-2.7, 2.7]) g.add(cylinder(0.09, 3.1, M.metal, x + off, 1.55, z - 1.25));
      g.add(box(4.2, 0.12, 0.9, M.plaster(0x7a5a3a), x, 0.85, z - 0.7));
      for (const off of [-1.8, 1.8]) g.add(box(0.1, 0.8, 0.8, M.metal, x + off, 0.42, z - 0.7));
      /* لافتة المحطّة */
      g.add(cylinder(0.06, 3.4, M.metal, x + 3.4, 1.7, z + 0.8));
      g.add(box(0.06, 0.9, 0.7, M.plaster(0x2f7d6b), x + 3.4, 3.3, z + 0.8));
      this.group.add(g);
      this.doors[stop.id] = { x, z: z + 2.6 };
      this.markers.push({ id: stop.id, icon: '🚌', nameKey: 'locBusStop',
                          position: new THREE.Vector3(x, 4.8, z), kind: 'bus' });
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     الأشجار — زيتون على الأرصفة، سرو عند الجامع والمؤسسات
     ═══════════════════════════════════════════════════════════════ */
  _buildTrees() {
    const trunks = [], dark = [], light = [];
    for (let i = 0; i < PROPS.TREE_COUNT; i++) {
      const axis = this.rnd.pick(ROAD_AXES);
      const along = (this.rnd() * 2 - 1) * (WORLD.SIZE / 2 - 8);
      if (ROAD_AXES.some(a => Math.abs(along - a) < 9)) continue;      /* لا أشجار في التقاطعات */
      const side = (this.rnd.chance(0.5) ? -1 : 1) * (WORLD.ROAD_WIDTH / 2 + WORLD.SIDEWALK - 0.7);
      const horizontal = this.rnd.chance(0.5);
      const x = horizontal ? along : axis + side, z = horizontal ? axis + side : along;
      const s = this.rnd.range(0.85, 1.35);
      trunks.push({ x, y: 1.3 * s, z, r: 0.22 * s, h: 2.6 * s, r2: 0.34 * s });
      /* تاج من كتلتين: داخلية داكنة وخارجية أفتح — يعطي عمقاً بصرياً */
      for (let k = 0; k < 3; k++) {
        const ox = this.rnd.range(-0.9, 0.9) * s, oz = this.rnd.range(-0.9, 0.9) * s, oy = this.rnd.range(-0.3, 0.6) * s;
        dark.push({ x: x + ox, y: 3.1 * s + oy, z: z + oz, r: this.rnd.range(1.2, 1.7) * s, rot: this.rnd() * 3 });
      }
      for (let k = 0; k < 2; k++) {
        const ox = this.rnd.range(-1.1, 1.1) * s, oz = this.rnd.range(-1.1, 1.1) * s;
        light.push({ x: x + ox, y: 3.6 * s + this.rnd.range(0, 0.6) * s, z: z + oz, r: this.rnd.range(0.9, 1.3) * s, rot: this.rnd() * 3 });
      }
    }
    this.group.add(instancedCylinders(trunks, this.M.trunk, 7));
    this.group.add(instancedIcosa(dark, this.M.oliveDark));
    this.group.add(instancedIcosa(light, this.M.oliveLight));

    /* السرو: أعمدة خضراء رفيعة حول الجامع وأمام البنك والبيت */
    const cyp = [...(this._cypressSpots || [])];
    for (const loc of LOCATIONS) {
      if (['bank', 'home', 'employment'].includes(loc.id)) {
        const [x, z] = loc.pos, [w, , d] = loc.size;
        cyp.push([x - w / 2 - 3, z + d / 2 + 3], [x + w / 2 + 3, z + d / 2 + 3]);
      }
    }
    const cones = cyp.map(([x, z]) => {
      const s = this.rnd.range(0.85, 1.25);
      return { x, y: 4.2 * s, z, r: 1.1 * s, h: 8.4 * s };
    });
    this.group.add(instancedCones(cones, this.M.cypress));
  }

  /* ═══════════════════════════════════════════════════════════════
     أعمدة الإنارة — ذراع مائلة ورأس يضيء ليلاً
     ═══════════════════════════════════════════════════════════════ */
  _buildLamps() {
    const poles = [], arms = [], heads = [];
    for (const axis of ROAD_AXES) {
      for (let p = -WORLD.SIZE / 2 + 15; p <= WORLD.SIZE / 2 - 15; p += PROPS.LAMP_SPACING) {
        if (ROAD_AXES.some(a => Math.abs(p - a) < 8)) continue;
        for (const [x, z, rot] of [[p, axis + WORLD.ROAD_WIDTH / 2 + 1.2, 0], [axis + WORLD.ROAD_WIDTH / 2 + 1.2, p, Math.PI / 2]]) {
          poles.push({ x, y: 3.6, z, r: 0.11, h: 7.2, r2: 0.16 });
          const ax = x - Math.sin(rot) * 0 - (rot === 0 ? 0 : 0.9), az = z - (rot === 0 ? 0.9 : 0);
          arms.push({ x: rot === 0 ? x : x - 0.9, y: 7.1, z: rot === 0 ? z - 0.9 : z, sx: rot === 0 ? 0.12 : 1.9, sy: 0.12, sz: rot === 0 ? 1.9 : 0.12 });
          heads.push({ x: rot === 0 ? x : x - 1.8, y: 7.0, z: rot === 0 ? z - 1.8 : z, sx: 0.55, sy: 0.22, sz: 0.55 });
          void ax; void az;
        }
      }
    }
    this.group.add(instancedCylinders(poles, this.M.metal, 8));
    this.group.add(instancedBoxes(arms, this.M.metal));
    this.group.add(instancedBoxes(heads, this.M.lampHead));
    /* مواضع الرؤوس تُصدَّر للبيئة لتضع عندها برك الضوء ليلاً */
    this.lampPositions = heads.map(h => ({ x: h.x, y: h.y, z: h.z }));
  }

  /* ═══════════════════════════════════════════════════════════════
     سيارات واقفة — طلاء لامع وزجاج عاكس وعجلات بجنوط
     ═══════════════════════════════════════════════════════════════ */
  _buildParkedCars() {
    const bodies = [], cabins = [], wheels = [], rims = [];
    for (let i = 0; i < PROPS.PARKED_CAR_COUNT; i++) {
      const axis = this.rnd.pick(ROAD_AXES);
      const along = (this.rnd() * 2 - 1) * (WORLD.SIZE / 2 - 22);
      if (ROAD_AXES.some(a => Math.abs(along - a) < 12)) continue;
      const horizontal = this.rnd.chance(0.5);
      const side = (this.rnd.chance(0.5) ? -1 : 1) * (WORLD.ROAD_WIDTH / 2 - 1.3);
      const x = horizontal ? along : axis + side, z = horizontal ? axis + side : along;
      const rot = horizontal ? Math.PI / 2 : 0;
      const color = this.rnd.pick(PROPS.CAR_COLORS);
      bodies.push({ x, y: 0.72, z, rot, sx: 1.85, sy: 0.85, sz: 4.3, color });
      cabins.push({ x: x - Math.cos(rot) * 0.0, y: 1.42, z: z - Math.sin(rot) * 0.0, rot, sx: 1.62, sy: 0.62, sz: 2.2 });
      for (const [ox, oz] of [[0.86, 1.4], [-0.86, 1.4], [0.86, -1.4], [-0.86, -1.4]]) {
        const wx = x + Math.cos(rot) * ox + Math.sin(rot) * oz, wz = z - Math.sin(rot) * ox + Math.cos(rot) * oz;
        wheels.push({ x: wx, y: 0.36, z: wz, r: 0.36, h: 0.26, rot: rot + Math.PI / 2, axisZ: true });
        rims.push({ x: wx, y: 0.36, z: wz, r: 0.2, h: 0.28, rot: rot + Math.PI / 2, axisZ: true });
      }
    }
    const bodyMesh = instancedBoxes(bodies, this.M.carPaint(0xffffff), true);
    this.group.add(bodyMesh);
    this.group.add(instancedBoxes(cabins, this.M.carGlass));
    this.group.add(instancedCylinders(wheels, this.M.tire, 14));
    this.group.add(instancedCylinders(rims, this.M.rim, 10));
  }

  /* ═══════════════════════════════════════════════════════════════
     ظلال التلامس — بقعة داكنة شفّافة عند قاعدة كل مبنى
     أرخص بديل للإطباق المحيطي (AO): يثبّت المباني على الأرض بصرياً
     ═══════════════════════════════════════════════════════════════ */
  _buildContactShadows() {
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, mat, this.contactShadows.length);
    const m = new THREE.Matrix4();
    this.contactShadows.forEach((s, i) => {
      m.compose(new THREE.Vector3(s.x, 0.05, s.z), new THREE.Quaternion(), new THREE.Vector3(s.w, 1, s.d));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.renderOrder = 1;
    this.group.add(mesh);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   أدوات هندسية
   ═══════════════════════════════════════════════════════════════════ */

export function rect(x, z, w, d) {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}
export function overlaps(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function cylinder(r, h, mat, x, y, z, seg = 16, halfOnly = false, open = false) {
  const geo = halfOnly
    ? new THREE.CylinderGeometry(r, r, h, seg, 1, false, 0, Math.PI)
    : new THREE.CylinderGeometry(r, r, h, seg, 1, open);
  if (halfOnly) geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function sphere(r, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.position.set(x, y, z); m.castShadow = true;
  return m;
}

/** نسخة خامة بتكرار خامة خاصّ — للأسطح ذات الأبعاد المختلفة */
function tiled(mat, ru, rv) {
  const m = mat.clone();
  for (const key of ['map', 'emissiveMap', 'roughnessMap']) {
    if (m[key]) { m[key] = m[key].clone(); m[key].repeat.set(ru, rv); m[key].needsUpdate = true; }
  }
  return m;
}

/**
 * صندوق بخامة واجهة مكرَّرة صحيحاً على كل وجه:
 * وجوه ±X عرضها العمق، ووجوه ±Z عرضها العرض، والسقف خامة مستقلّة.
 */
function facadeBox(w, h, d, mat, tile, topMat, x, y, z, noInject = false) {
  const base = noInject ? stripInjection(mat) : mat;
  const mx = tiled(base, d / tile.x, h / tile.y);
  const mz = tiled(base, w / tile.x, h / tile.y);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mx, mx, topMat, topMat, mz, mz]);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
/** خامة الواجهة المُجمَّعة تحمل حقناً يفترض سمة instDims — نزيله للأجسام العادية */
function stripInjection(mat) {
  const m = mat.clone();
  m.onBeforeCompile = () => {};
  m.customProgramCacheKey = () => 'plain-facade';
  return m;
}

function awning(width, mat, x, y, z, onXFace = false) {
  const geo = new THREE.PlaneGeometry(width, 1.6);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(onXFace ? 0 : -0.9, onXFace ? -Math.PI / 2 : 0, onXFace ? 0.9 : 0);
  m.castShadow = true;
  return m;
}

function solarHeater(M, x, y, z) {
  const g = new THREE.Group();
  const panel = box(2.2, 0.08, 1.4, M.solarPanel, 0, 0.5, 0); panel.rotation.x = -0.55;
  const boiler = cylinder(0.42, 1.5, M.whiteTank, 0, 1.25, -0.9, 12); boiler.rotation.z = Math.PI / 2;
  g.add(panel, boiler);
  g.position.set(x, y, z);
  return g;
}

/** سيارة معروضة — نفس هيكل سيارة اللاعب بمقياس أصغر */
function displayCar(M, color, x, y, z, rot) {
  const g = new THREE.Group();
  g.add(box(1.85, 0.85, 4.3, M.carPaint(color), 0, 0.55, 0));
  g.add(box(1.62, 0.62, 2.2, M.carGlass, 0, 1.25, -0.1));
  for (const [ox, oz] of [[0.86, 1.4], [-0.86, 1.4], [0.86, -1.4], [-0.86, -1.4]]) {
    const w = cylinder(0.36, 0.26, M.tire, ox, 0.2, oz, 14); w.rotation.z = Math.PI / 2; g.add(w);
  }
  g.position.set(x, y, z); g.rotation.y = rot;
  return g;
}

/* ─────────────── بنّاؤو النسخ المُجمَّعة ─────────────── */

function instancedBoxes(specs, mat, withColor = false) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, specs.length);
  mesh.castShadow = mesh.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  specs.forEach((s, i) => {
    q.setFromEuler(new THREE.Euler(s.tilt || 0, s.rot || 0, 0));
    m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.sx, s.sy, s.sz));
    mesh.setMatrixAt(i, m);
    if (withColor) mesh.setColorAt(i, c.setHex(s.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (withColor && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** مستطيلات مسطّحة على الأرض (خطوط، ممرّات، حوافّ) */
function instancedFlat(specs, mat, y, thickness) {
  return instancedBoxes(specs.map(s => ({ ...s, y, sy: thickness })), mat);
}

function instancedCylinders(specs, mat, seg = 12) {
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, seg), mat, specs.length);
  mesh.castShadow = mesh.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  specs.forEach((s, i) => {
    /* أسطوانة أفقية (عجلة/سخّان) تُدار حول Z ثمّ Y */
    q.setFromEuler(s.axisZ ? new THREE.Euler(0, s.rot, Math.PI / 2) : new THREE.Euler(0, 0, s.rot || 0));
    const rBottom = s.r2 ?? s.r;
    m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.r, s.h, rBottom));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function instancedIcosa(specs, mat) {
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat, specs.length);
  mesh.castShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  specs.forEach((s, i) => {
    q.setFromEuler(new THREE.Euler(0, s.rot, 0));
    m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.r, s.r * 0.8, s.r));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function instancedCones(specs, mat) {
  const mesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 8), mat, specs.length);
  mesh.castShadow = true;
  const m = new THREE.Matrix4();
  specs.forEach((s, i) => {
    m.compose(new THREE.Vector3(s.x, s.y, s.z), new THREE.Quaternion(), new THREE.Vector3(s.r, s.h, s.r));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
