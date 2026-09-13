/* ═══════════════════════════════════════════════════════════════════
   player.js — شخصية اللاعب، الاصطدام، والكاميرا التابعة
   ───────────────────────────────────────────────────────────────────
   الشخصية مبنية من صناديق بسيطة بلا ملفّات نماذج أو هياكل عظمية:
   المشي يُحاكى بتأرجح جيبي للأطراف. هذا يكفي بصرياً تماماً ويوفّر
   ميغابايتات من التحميل — وهو قرار مقصود لصفوف بإنترنت بطيء.
   ═══════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { PLAYER, WORLD } from '../content/config.js';
import { normalizeAppearance } from '../content/avatar.js';

export class Player {
  constructor(scene, M, startPos = { x: -60, z: -34 }, lookAt = { x: 0, z: 0 }, appearance = null) {
    this.M = M;
    this.appearance = normalizeAppearance(appearance);
    this.position = new THREE.Vector3(startPos.x, 0, startPos.z);
    this.velocity = new THREE.Vector3();
    /* الشخصية والكاميرا تبدآن موجّهتين نحو مركز البلدة، فأوّل ما يراه
       الطالب هو المكان الذي عليه الذهاب إليه لا ظهر البيت */
    this.facing = Math.atan2(lookAt.x - startPos.x, lookAt.z - startPos.z);
    this.speed = 0;                  /* سرعة أفقية حالية — تُستخدم للأنيميشن */
    this.distanceTravelled = 0;      /* بالوحدات العالمية، تحوّلها الاقتصاد لكم */
    this.visible = true;

    /* حالة الكاميرا */
    this.camYaw = this.facing + Math.PI;   /* الكاميرا خلف الشخصية */
    /* ميل معتدل: يكفي لرؤية الطريق أمام اللاعب، ويترك ثلث الشاشة
       للسماء والأفق — فالغروب والتلال جزء من الإحساس بالمكان */
    this.camPitch = 0.3;
    this.camDistance = PLAYER.CAM_DISTANCE;
    this._camPos = new THREE.Vector3();

    this.group = new THREE.Group();
    this._build();
    this.group.position.copy(this.position);
    scene.add(this.group);
  }

  /* ─────────────── بناء الشخصية ─────────────── */
  _build() {
    const fig = buildFigure(this.appearance);
    this.group.add(fig.group);
    this.torso = fig.torso; this.head = fig.head;
    this.armL = fig.armL; this.armR = fig.armR; this.legL = fig.legL; this.legR = fig.legR;
  }

  /** تغيير المظهر أثناء اللعب (من المُنشئ) */
  setAppearance(appearance) {
    this.appearance = normalizeAppearance(appearance);
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    this._build();
  }


  /* ═══════════════════════════════════════════════════════════════
     التحديث لكل إطار
     ═══════════════════════════════════════════════════════════════ */

  /**
   * @param {number} dt          زمن الإطار بالثواني
   * @param {Input}  input
   * @param {Array}  colliders   مستطيلات AABB للمباني
   * @param {boolean} frozen     أثناء الحوارات: الكاميرا تعمل والحركة تتوقّف
   */
  update(dt, input, colliders, frozen = false) {
    this._updateCamera(input);

    if (frozen) { this.speed = 0; this._animate(dt, 0); return; }

    /* اتجاه الإدخال يُدار بزاوية الكاميرا: «للأمام» تعني دائماً
       بعيداً عن الكاميرا، وهذا ما يتوقّعه اللاعب في منظور الشخص الثالث */
    const { x: ix, y: iy } = input.axis;
    const target = new THREE.Vector3();
    if (ix !== 0 || iy !== 0) {
      /* الكاميرا عند (sin yaw, cos yaw) خلف اللاعب، فالأمام هو
         (−sin, −cos) واليمين على الشاشة هو (cos, −sin). */
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      target.set(ix * cos - iy * sin, 0, -(ix * sin + iy * cos)).normalize();
    }

    const maxSpeed = input.run ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED;
    const desired = target.multiplyScalar(maxSpeed);

    /* تنعيم السرعة يمنع التوقّف/الانطلاق الفوري ويعطي إحساس الوزن */
    this.velocity.lerp(desired, 1 - Math.exp(-12 * dt));
    if (this.velocity.lengthSq() < 0.0004) this.velocity.set(0, 0, 0);

    const step = this.velocity.clone().multiplyScalar(dt);
    this.position.add(step);
    this.distanceTravelled += step.length();

    this._resolveCollisions(colliders);
    this._clampToWorld();

    this.speed = this.velocity.length();

    /* دوران الشخصية نحو اتجاه الحركة بتنعيم زاوي يراعي الالتفاف حول ±π */
    if (this.speed > 0.15) {
      const wanted = Math.atan2(this.velocity.x, this.velocity.z);
      this.facing += shortestAngle(this.facing, wanted) * PLAYER.TURN_LERP;
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.facing;
    this._animate(dt, this.speed / PLAYER.RUN_SPEED);
  }

  /** تأرجح الأطراف: التردّد يتبع السرعة والسعة تتبعها أيضاً */
  _animate(dt, intensity) {
    this._phase = (this._phase || 0) + dt * (6 + intensity * 9);
    const swing = Math.sin(this._phase) * (0.15 + intensity * 0.85);
    this.armL.rotation.x = swing;
    this.armR.rotation.x = -swing;
    this.legL.rotation.x = -swing;
    this.legR.rotation.x = swing;
    /* ارتداد عمودي خفيف يوحي بوقع القدم */
    this.torso.position.y = 1.18 + Math.abs(Math.sin(this._phase)) * intensity * 0.05;
  }

  /* ═══════════════════════════════════════════════════════════════
     الاصطدام: دائرة اللاعب ضدّ مستطيلات المباني
     نزيح اللاعب على المحور ذي أقلّ اختراق — الطريقة الأبسط التي
     تُنتج انزلاقاً طبيعياً على الجدران بدل الالتصاق بها.
     ═══════════════════════════════════════════════════════════════ */
  _resolveCollisions(colliders) {
    const r = PLAYER.RADIUS;
    for (const c of colliders) {
      if (this.position.x + r <= c.minX || this.position.x - r >= c.maxX ||
          this.position.z + r <= c.minZ || this.position.z - r >= c.maxZ) continue;

      const penLeft   = this.position.x + r - c.minX;
      const penRight  = c.maxX - (this.position.x - r);
      const penTop    = this.position.z + r - c.minZ;
      const penBottom = c.maxZ - (this.position.z - r);
      const min = Math.min(penLeft, penRight, penTop, penBottom);

      if (min === penLeft)        { this.position.x = c.minX - r; this.velocity.x = 0; }
      else if (min === penRight)  { this.position.x = c.maxX + r; this.velocity.x = 0; }
      else if (min === penTop)    { this.position.z = c.minZ - r; this.velocity.z = 0; }
      else                        { this.position.z = c.maxZ + r; this.velocity.z = 0; }
    }
  }

  /** حدود الحركة: البلدة افتراضياً، أو مستطيل الغرفة عند الدخول */
  setBounds(rect) { this.bounds = rect || null; }

  _clampToWorld() {
    if (this.bounds) {
      const b = this.bounds;
      this.position.x = Math.max(b.minX, Math.min(b.maxX, this.position.x));
      this.position.z = Math.max(b.minZ, Math.min(b.maxZ, this.position.z));
      return;
    }
    const lim = WORLD.SIZE / 2 - 2;
    this.position.x = Math.max(-lim, Math.min(lim, this.position.x));
    this.position.z = Math.max(-lim, Math.min(lim, this.position.z));
  }

  /* ═══════════════════════════════════════════════════════════════
     الكاميرا التابعة
     ═══════════════════════════════════════════════════════════════ */
  _updateCamera(input) {
    const d = input.consumeCameraDeltas();
    this.camYaw -= d.yaw;
    /* نحصر الميل: فوق يمنع انقلاب المشهد، وتحت يمنع دخول الكاميرا الأرض */
    this.camPitch = Math.max(0.02, Math.min(0.95, this.camPitch + d.pitch));
    this.camDistance = Math.max(4, Math.min(18, this.camDistance + d.zoom));

    /* دوران الكاميرا بالمفاتيح للأجهزة بلا فأرة */
    if (input.keys.has('KeyQ')) this.camYaw += 0.03;
    if (input.keys.has('KeyE') && !input.keys.has('ShiftLeft')) { /* E محجوز للتفاعل */ }
  }

  /**
   * يضع الكاميرا خلف اللاعب بتنعيم؛ تُستدعى بعد update.
   * @param colliders مستطيلات المباني — تُستخدم لمنع دخول الكاميرا الجدران
   */
  applyCamera(camera, dt, targetOverride = null, colliders = null) {
    const focus = targetOverride || this.position;

    /* المسافة المطلوبة قد تُقصَّر إن كان بين الكاميرا واللاعب جدار.
       بدون هذا الفحص تدخل الكاميرا داخل المبنى فيرى الطالب سواداً
       كلّما اقترب من واجهة — وهو أكثر ما يُفسد ألعاب المنظور الثالث. */
    let distance = this.camDistance;
    if (colliders) {
      const dirX = Math.sin(this.camYaw), dirZ = Math.cos(this.camYaw);
      const blocked = nearestHit(focus.x, focus.z, dirX, dirZ, distance, colliders);
      if (blocked !== null) distance = Math.max(2.2, blocked - 0.6);
    }

    let height = PLAYER.CAM_HEIGHT + this.camPitch * distance;
    /* داخل غرفة: الكاميرا لا تخترق السقف */
    if (this.camMaxY != null) height = Math.min(height, this.camMaxY);
    this._camPos.set(
      focus.x + Math.sin(this.camYaw) * distance,
      Math.max(1.4, height),
      focus.z + Math.cos(this.camYaw) * distance);

    /* الاقتراب من اللاعب يجب أن يكون فورياً (وإلّا ظهر الجدار لحظةً)
       أمّا الابتعاد فيبقى ناعماً */
    const cameraDist = Math.hypot(camera.position.x - focus.x, camera.position.z - focus.z);
    const lerpFactor = cameraDist > distance + 0.5
      ? 1
      : 1 - Math.exp(-(PLAYER.CAM_LERP * 60) * dt);

    camera.position.lerp(this._camPos, lerpFactor);
    camera.lookAt(focus.x, focus.y + 1.9, focus.z);
  }

  setVisible(v) { this.group.visible = v; this.visible = v; }

  teleport(x, z) {
    this.position.set(x, 0, z);
    this.velocity.set(0, 0, 0);
    this.group.position.copy(this.position);
  }

  /** المسافة الأفقية إلى نقطة — تُستخدم لكشف قرب اللاعب من الأبواب */
  distanceTo(point) {
    return Math.hypot(this.position.x - point.x, this.position.z - point.z);
  }
}

/**
 * أقرب اصطدام لشعاع أفقي بمجموعة مستطيلات (طريقة الشرائح — Slab).
 * نعمل في مستوى XZ فقط: المباني صناديق قائمة، فلا حاجة للبُعد الثالث.
 * تُعيد المسافة إلى أقرب جدار، أو null إن كان الطريق خالياً.
 */
function nearestHit(ox, oz, dx, dz, maxDist, colliders) {
  let best = null;
  for (const c of colliders) {
    /* نوسّع المستطيل قليلاً حتى لا تلامس الكاميرا الجدار تماماً */
    const minX = c.minX - 0.3, maxX = c.maxX + 0.3;
    const minZ = c.minZ - 0.3, maxZ = c.maxZ + 0.3;

    let tMin = 0, tMax = maxDist;

    /* المحور X */
    if (Math.abs(dx) < 1e-6) {
      if (ox < minX || ox > maxX) continue;      /* الشعاع موازٍ وخارج الشريحة */
    } else {
      const t1 = (minX - ox) / dx, t2 = (maxX - ox) / dx;
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
      if (tMin > tMax) continue;
    }

    /* المحور Z */
    if (Math.abs(dz) < 1e-6) {
      if (oz < minZ || oz > maxZ) continue;
    } else {
      const t1 = (minZ - oz) / dz, t2 = (maxZ - oz) / dz;
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
      if (tMin > tMax) continue;
    }

    if (tMin >= 0 && (best === null || tMin < best)) best = tMin;
  }
  return best;
}

/** أقصر فرق زاوي بين زاويتين، يعالج الالتفاف حول ‎±π‎ */
function shortestAngle(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/* ═══════════════════════════════════════════════════════════════════
   بناء الجسم من المظهر — مشترك بين اللعبة ومعاينة مُنشئ الشخصية
   ═══════════════════════════════════════════════════════════════════ */
const mat = (color, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness });

/** طرف من جزأين (كمّ/جلد أو بنطال/حذاء) يدور من الكتف أو الورك */
function limb(w, len, upperMat, lowerMat, x, y) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(w, len * 0.55, w), upperMat);
  upper.position.y = -len * 0.275;
  const lower = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, len * 0.45, w * 0.92), lowerMat);
  lower.position.y = -len * 0.775;
  upper.castShadow = lower.castShadow = true;
  pivot.add(upper, lower);
  return pivot;
}

/**
 * يبني شخصية من صناديق وكرات وفق المظهر المختار ويعيد المراجع التي
 * يحتاجها الأنيميشن. لا ملفّات نماذج: يُحمَّل فوراً حتى على أجهزة المدرسة.
 */
export function buildFigure(appearance) {
  const a = normalizeAppearance(appearance);
  const skin = mat(a.skin, 0.75), shirt = mat(a.shirt), pants = mat(a.pants, 0.9),
        hair = mat(a.hair, 0.9), shoes = mat(0x1b1b1b, 0.8), scarf = mat(a.scarf, 0.9);
  const group = new THREE.Group();
  const mesh = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; group.add(o); return o; };

  const torso = mesh(new THREE.BoxGeometry(0.58, 0.66, 0.32), shirt, 0, 1.18, 0);
  mesh(new THREE.BoxGeometry(0.5, 0.18, 0.28), pants, 0, 0.78, 0);
  const head = mesh(new THREE.SphereGeometry(0.21, 18, 14), skin, 0, 1.76, 0);
  mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 10), skin, 0, 1.56, 0);

  if (a.style === 'hijab') {
    /* حجاب: غطاء رأس يمتدّ إلى الكتفين، والوجه مكشوف */
    mesh(new THREE.SphereGeometry(0.235, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), scarf, 0, 1.79, 0);
    mesh(new THREE.BoxGeometry(0.52, 0.36, 0.36), scarf, 0, 1.5, -0.02);
  } else if (a.style === 'girl') {
    /* شعر طويل: قبّعة الشعر + ضفيرة خلفية */
    mesh(new THREE.SphereGeometry(0.228, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), hair, 0, 1.79, 0);
    mesh(new THREE.BoxGeometry(0.3, 0.5, 0.14), hair, 0, 1.5, -0.2);
  } else {
    mesh(new THREE.SphereGeometry(0.225, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 1.79, 0);
  }

  const armL = limb(0.15, 0.6, shirt, skin, -0.38, 1.46), armR = limb(0.15, 0.6, shirt, skin, 0.38, 1.46);
  const legL = limb(0.19, 0.76, pants, shoes, -0.15, 0.78), legR = limb(0.19, 0.76, pants, shoes, 0.15, 0.78);
  group.add(armL, armR, legL, legR);

  /* حقيبة ظهر — تفصيلة تُميّز الطالب */
  mesh(new THREE.BoxGeometry(0.4, 0.46, 0.16), mat(a.bag, 0.8), 0, 1.2, -0.24);

  return { group, torso, head, armL, armR, legL, legR };
}
