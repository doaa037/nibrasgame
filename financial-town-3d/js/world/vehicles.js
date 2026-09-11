/* ═══════════════════════════════════════════════════════════════════
   vehicles.js — سيارة اللاعب والحافلة العامّة
   ───────────────────────────────────────────────────────────────────
   هنا تلتقي الفيزياء بالاقتصاد: كل متر يقطعه اللاعب بسيارته يستهلك
   وقوداً له سعر، وكل رحلة حافلة تُخصم من رصيده أو من اشتراكه الشهري.
   المسافة ليست تفصيلاً بصرياً — إنّها بند في الميزانية.
   ═══════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { CAR, WORLD } from '../content/config.js';
import { BUS_ROUTE } from '../content/world.data.js';

/* ═══════════════════════════════════════════════════════════════
   سيارة اللاعب
   ═══════════════════════════════════════════════════════════════ */
export class PlayerCar {
  constructor(scene, M, color = 0x3f6fa8) {
    this.M = M;
    this.position = new THREE.Vector3(-46, 0, -34);
    this.heading = 0;              /* اتجاه السيارة (راديان) */
    this.speed = 0;                /* م/ث — سالب يعني رجوعاً للخلف */
    this.distanceTravelled = 0;    /* وحدات عالمية منذ آخر قراءة */
    this.owned = false;
    this.occupied = false;

    this.group = new THREE.Group();
    this._build(color);
    this.group.visible = false;
    scene.add(this.group);
  }

  /*
   * اصطلاح الاتجاه في اللعبة: المركبة تتّجه نحو محور Z المحلّي الموجب،
   * لأنّ الحركة تُحسب بـ (sin θ, cos θ). لذلك الطول على Z والعرض على X.
   * عكس هذا الاصطلاح يجعل السيارة تسير جانبياً — وهو خطأ لا يظهر في
   * أيّ اختبار رقمي، بل في الصورة فقط.
   */
  _build(color) {
    const M = this.M;
    /* هيكل من طبقتين: قاعدة عريضة وقمرة أضيق بزجاج عاكس — الصورة
       الظلّية المألوفة لسيارة هاتشباك، بلا ملفّ نموذج */
    this.paint = M.carPaint(color);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.72, 4.4), this.paint);
    lower.position.y = 0.72;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.5, 3.9), this.paint);
    upper.position.set(0, 1.28, -0.1);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 2.35), M.carGlass);
    cabin.position.set(0, 1.78, -0.15);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.08, 2.3), this.paint);
    roof.position.set(0, 2.11, -0.15);
    for (const part of [lower, upper, cabin, roof]) part.castShadow = true;

    /* مصابيح أمامية وخلفية */
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.12), M.headlight);
    headL.position.set(0.62, 1.05, 2.2);
    const headR = headL.clone(); headR.position.x = -0.62;
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), M.taillight);
    tailL.position.set(0.66, 1.1, -2.2);
    const tailR = tailL.clone(); tailR.position.x = -0.66;
    /* شبك أمامي ومصدّ */
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.08), M.darkTrim);
    grille.position.set(0, 0.95, 2.22);
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.22, 0.14), M.darkTrim);
    bumper.position.set(0, 0.5, 2.22);
    const bumperR = bumper.clone(); bumperR.position.z = -2.22;

    this.group.add(lower, upper, cabin, roof, headL, headR, tailL, tailR, grille, bumper, bumperR);

    /* العجلات: إطار + جنط، محور الدوران على X */
    this.wheels = [];
    const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18);
    tireGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.32, 10);
    rimGeo.rotateZ(Math.PI / 2);
    for (const [x, z] of [[0.95, 1.42], [-0.95, 1.42], [0.95, -1.42], [-0.95, -1.42]]) {
      const w = new THREE.Group();
      w.add(new THREE.Mesh(tireGeo, M.tire), new THREE.Mesh(rimGeo, M.rim));
      w.position.set(x, 0.42, z);
      w.children.forEach(c => { c.castShadow = true; });
      this.group.add(w);
      this.wheels.push(w);
    }
  }

  /** تسليم السيارة بعد الشراء: تظهر أمام مكان محدَّد */
  deliver(x, z, color) {
    this.owned = true;
    this.position.set(x, 0, z);
    this.heading = 0;
    this.speed = 0;
    if (color !== undefined) this.paint.color.setHex(color);
    this.group.visible = true;
    this._sync();
  }

  /* ═══════════════════════════════════════════════════════════════
     قيادة مبسّطة لكنّها مقنعة
     ───────────────────────────────────────────────────────────────
     نموذج «دراجة» بسيط: التوجيه يدوّر السيارة فقط عندما تتحرّك،
     تماماً كما في الواقع — عجلة القيادة لا تُدير سيارة واقفة.
     ═══════════════════════════════════════════════════════════════ */
  update(dt, input, colliders) {
    if (!this.occupied) return;

    const throttle = input.axis.y;          /* ‎+1‎ تسارع، ‎-1‎ فرملة/رجوع */
    const steer = -input.axis.x;

    if (throttle > 0)      this.speed += CAR.ACCEL * throttle * dt;
    else if (throttle < 0) this.speed += CAR.BRAKE * throttle * dt;
    else {
      /* احتكاك يوقف السيارة تدريجياً عند ترك الدوّاسة */
      const drop = CAR.FRICTION * dt;
      this.speed = Math.abs(this.speed) <= drop ? 0 : this.speed - Math.sign(this.speed) * drop;
    }
    this.speed = Math.max(-CAR.REVERSE_SPEED, Math.min(CAR.MAX_SPEED, this.speed));

    /* معدّل الدوران يتناسب مع السرعة حتى سقف معيّن */
    const speedFactor = Math.min(Math.abs(this.speed) / 6, 1);
    this.heading += steer * CAR.TURN_RATE * speedFactor * dt * Math.sign(this.speed || 1);

    const step = this.speed * dt;
    const dx = Math.sin(this.heading) * step;
    const dz = Math.cos(this.heading) * step;
    this.position.x += dx;
    this.position.z += dz;
    this.distanceTravelled += Math.abs(step);

    this._resolveCollisions(colliders);
    this._clampToWorld();
    this._sync();

    /* دوران العجلات: زاوية = مسافة ÷ نصف القطر */
    for (const w of this.wheels) w.rotation.x += step / 0.45;   /* محور العجلة المحلّي */
  }

  /** ارتداد بسيط عن المباني — يوقف السيارة بدل اختراق الجدار */
  _resolveCollisions(colliders) {
    const r = 2.4;    /* نصف قطر تقريبي يغلّف هيكل السيارة */
    for (const c of colliders) {
      if (this.position.x + r <= c.minX || this.position.x - r >= c.maxX ||
          this.position.z + r <= c.minZ || this.position.z - r >= c.maxZ) continue;

      const pens = [
        this.position.x + r - c.minX, c.maxX - (this.position.x - r),
        this.position.z + r - c.minZ, c.maxZ - (this.position.z - r)
      ];
      const min = Math.min(...pens);
      if (min === pens[0]) this.position.x = c.minX - r;
      else if (min === pens[1]) this.position.x = c.maxX + r;
      else if (min === pens[2]) this.position.z = c.minZ - r;
      else this.position.z = c.maxZ + r;

      this.speed *= -0.15;    /* ارتداد خفيف يوصل رسالة الاصطدام */
    }
  }

  _clampToWorld() {
    const lim = WORLD.SIZE / 2 - 4;
    this.position.x = Math.max(-lim, Math.min(lim, this.position.x));
    this.position.z = Math.max(-lim, Math.min(lim, this.position.z));
  }

  _sync() {
    this.group.position.copy(this.position);
    this.group.rotation.y = this.heading;
  }

  /** يقرأ المسافة المقطوعة ويصفّرها — يستدعيها الاقتصاد لحساب الوقود */
  consumeDistance() {
    const d = this.distanceTravelled;
    this.distanceTravelled = 0;
    return d;
  }

  /** نقطة نزول اللاعب: بجانب السيارة لا داخلها */
  exitPoint() {
    /* اليمين المحلّي للمركبة المتّجهة نحو +Z هو (cos θ, −sin θ) */
    return {
      x: this.position.x + Math.cos(this.heading) * 2.6,
      z: this.position.z - Math.sin(this.heading) * 2.6
    };
  }

  distanceTo(point) {
    return Math.hypot(this.position.x - point.x, this.position.z - point.z);
  }
}

/* ═══════════════════════════════════════════════════════════════
   الحافلة العامّة — تدور في مسار مغلق حول مركز البلدة
   وجودها المرئي مقصود: الطالب يرى البديل يمرّ أمامه وهو يقرّر.
   ═══════════════════════════════════════════════════════════════ */
export class Bus {
  constructor(scene, M) {
    this.M = M;
    this.route = BUS_ROUTE.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.segment = 0;
    this.t = 0;
    this.speed = 7;

    this.group = new THREE.Group();
    this._build();
    scene.add(this.group);
  }

  /* نفس اصطلاح الاتجاه: الطول على Z حتى تسير الحافلة إلى الأمام */
  _build() {
    const M = this.M;
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 9.4), M.busPaint);
    body.position.y = 1.6;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(2.62, 1.1, 9.4), M.carGlass);
    upper.position.y = 3.25;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.66, 0.18, 9.5), M.busPaint);
    roof.position.y = 3.9;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.35, 9.5), M.busStripe);
    stripe.position.y = 2.65;
    const front = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.5, 0.1), M.carGlass);
    front.position.set(0, 3.0, 4.75);
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.1), M.headlight);
    headL.position.set(0.85, 1.1, 4.75);
    const headR = headL.clone(); headR.position.x = -0.85;
    for (const p of [body, upper, roof, stripe]) p.castShadow = true;
    this.group.add(body, upper, roof, stripe, front, headL, headR);

    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.42, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const [x, z] of [[1.3, 3], [-1.3, 3], [1.3, -3], [-1.3, -3]]) {
      const w = new THREE.Mesh(wheelGeo, M.tire);
      w.position.set(x, 0.55, z);
      this.group.add(w);
    }
  }

  /** حركة خطّية بين نقاط المسار مع الالتفاف عند الزوايا */
  update(dt) {
    const from = this.route[this.segment];
    const to = this.route[(this.segment + 1) % this.route.length];
    const length = from.distanceTo(to);

    this.t += (this.speed * dt) / length;
    if (this.t >= 1) { this.t -= 1; this.segment = (this.segment + 1) % this.route.length; }

    const pos = from.clone().lerp(to, this.t);
    this.group.position.set(pos.x, 0, pos.z);
    this.group.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
  }
}
