/* ═══════════════════════════════════════════════════════════════════
   environment.js — السماء، الشمس، الغيوم، التلال، والدورة اليومية
   ───────────────────────────────────────────────────────────────────
   الجوّ يتبع ساعة اللعبة: شروق في الثامنة، ظهيرة بيضاء، عصر ذهبي،
   غروب برتقالي، ثمّ ليل تُضاء فيه النوافذ والمصابيح. هذا ليس زينة:
   الطالب الذي يرى الشمس تغرب يشعر بأنّ اليوم ينتهي فعلاً — وأنّ
   ما لم يُنجَز اليوم سيُدفع ثمنه غداً.

   الإضاءة المحيطة تأتي من خريطة بيئة (PMREM) تُولَّد من قبّة السماء
   نفسها، فتنعكس ألوان السماء على الزجاج والطلاء بشكل متّسق.
   ═══════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { WORLD } from '../content/config.js';
import { makeNoise2D } from '../core/random.js';
import { cloudTexture } from './textures.js';

/* ─────────────── إطارات الدورة اليومية ─────────────── */
const KEYFRAMES = [
  { h: 5.5,  zenith: 0x1a2650, horizon: 0x6a4a6e, sun: 0xffb27a, sunI: 0.15, hemiSky: 0x5a6a9a, hemiGround: 0x3a3230, hemiI: 0.55 },
  { h: 7.0,  zenith: 0x4f7fc4, horizon: 0xffc48a, sun: 0xffd6a0, sunI: 1.3,  hemiSky: 0xa8c4ea, hemiGround: 0x8a7a62, hemiI: 0.95 },
  { h: 10,   zenith: 0x2f6fd0, horizon: 0xbfd9f2, sun: 0xfff3e0, sunI: 2.4,  hemiSky: 0xd6ecff, hemiGround: 0x9c8f74, hemiI: 1.15 },
  { h: 13,   zenith: 0x2a66cc, horizon: 0xc9e1f6, sun: 0xffffff, sunI: 2.9,  hemiSky: 0xe4f3ff, hemiGround: 0xa39a80, hemiI: 1.25 },
  { h: 16.5, zenith: 0x3570c8, horizon: 0xe3d4b8, sun: 0xffe9c4, sunI: 2.2,  hemiSky: 0xd2e4f8, hemiGround: 0x9a8c70, hemiI: 1.1 },
  { h: 18.5, zenith: 0x3c4f8c, horizon: 0xff9a4a, sun: 0xffa050, sunI: 1.3,  hemiSky: 0xb0b6d4, hemiGround: 0x8a7660, hemiI: 1.0 },
  { h: 19.6, zenith: 0x1f2a55, horizon: 0xd9643a, sun: 0xff7a3a, sunI: 0.45, hemiSky: 0x6a74a0, hemiGround: 0x5a4a40, hemiI: 0.8 },
  { h: 20.6, zenith: 0x0b1230, horizon: 0x3a2f55, sun: 0x6a7aa0, sunI: 0.08, hemiSky: 0x3a4a80, hemiGround: 0x2a2624, hemiI: 0.6 },
  { h: 23.5, zenith: 0x060a1c, horizon: 0x1b1f3a, sun: 0x5a6a90, sunI: 0.06, hemiSky: 0x2c3a66, hemiGround: 0x1e1c1a, hemiI: 0.5 }
];

const SKY_VERT = `
  varying vec3 vDir;
  void main() {
    vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w;   /* تثبيت القبّة عند أقصى العمق */
  }`;

const SKY_FRAG = `
  varying vec3 vDir;
  uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor;
  uniform float sunIntensity; uniform float haze;
  void main() {
    vec3 d = normalize(vDir);
    float t = clamp(d.y, 0.0, 1.0);
    /* تدرّج غير خطّي: الأفق يمتدّ عالياً ثمّ يهبط سريعاً إلى لون الذروة */
    vec3 col = mix(horizon, zenith, pow(t, 0.48));
    /* هالة الأفق (غبار وضباب صيفي) */
    col = mix(col, horizon, haze * pow(1.0 - t, 6.0));
    float s = max(dot(d, sunDir), 0.0);
    col += sunColor * (pow(s, 420.0) * 1.6 + pow(s, 24.0) * 0.28 + pow(s, 4.0) * 0.06) * sunIntensity;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class Environment {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.hour = 9;
    this._lastEnvHour = -1;
    this.nightFactor = 0;

    this._buildSky();
    this._buildLights();
    this._buildLampPool();
    this._buildHills();
    this._buildClouds();

    this.pmrem = new THREE.PMREMGenerator(engine.renderer);
    this.pmrem.compileEquirectangularShader();
    this.scene.fog = new THREE.Fog(0xbfd9f2, WORLD.FOG_NEAR, WORLD.FOG_FAR);

    this.setHour(this.hour, true);
  }

  /* ─────────────── قبّة السماء ─────────────── */
  _buildSky() {
    this.skyUniforms = {
      zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() },
      sunIntensity: { value: 1 }, haze: { value: 0.55 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, fog: false
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    /* مشهد مصغّر يحتوي القبّة وحدها لتوليد خريطة البيئة منه */
    this.skyScene = new THREE.Scene();
    this.skyScene.add(new THREE.Mesh(this.sky.geometry, mat));
  }

  /* ─────────────── الشمس والضوء المحيط ─────────────── */
  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0xdff0ff, 0x9c8f74, 1.1);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff2d8, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(WORLD.SHADOW_MAP, WORLD.SHADOW_MAP);
    const d = 95;
    Object.assign(this.sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: 400 });
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
  }

  /* ─────────────── برك ضوء المصابيح ───────────────
     مئة عمود إنارة لا تعني مئة مصدر ضوء: نحتفظ بستّة أضواء نقطية
     فقط ونُعيد وضعها كل إطار عند أقرب ستّة أعمدة للاعب. العين لا
     تلاحظ الفرق، وبطاقة الرسوم تلاحظه جيّداً. */
  _buildLampPool() {
    this.lampLights = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(0xffcf7a, 0, 26, 1.8);
      l.castShadow = false;
      this.scene.add(l);
      this.lampLights.push(l);
    }
    this.lampPositions = [];
  }

  /** تُستدعى من البلدة بعد بناء الأعمدة */
  setLampPositions(list) { this.lampPositions = list; }

  _updateLampPool(playerPos) {
    if (!this.lampPositions.length) return;
    const intensity = this.nightFactor * 55;
    if (intensity <= 0.01) { for (const l of this.lampLights) l.intensity = 0; return; }
    const nearest = this.lampPositions
      .map(p => ({ p, d: (p.x - playerPos.x) ** 2 + (p.z - playerPos.z) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.lampLights.length);
    this.lampLights.forEach((l, i) => {
      const n = nearest[i];
      if (!n) { l.intensity = 0; return; }
      l.position.set(n.p.x, n.p.y - 0.3, n.p.z);
      l.intensity = intensity;
    });
  }

  /* ─────────────── تلال الجليل في الأفق ─────────────── */
  _buildHills() {
    const noise = makeNoise2D(4_242);
    const inner = 150, outer = 560;
    const geo = new THREE.RingGeometry(inner, outer, 128, 16);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color(0x9a9270), mid = new THREE.Color(0x6f7f52), high = new THREE.Color(0x8a8a78);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const r = Math.hypot(x, z);
      const ramp = Math.min(1, (r - inner) / 120);          /* الارتفاع يبدأ ناعماً من حافّة البلدة */
      const n = noise.fbm(x / 140 + 10, z / 140 + 10, 4) * 0.7 + noise.fbm(x / 45, z / 45, 3) * 0.3;
      const y = Math.max(0, (n - 0.35)) * 70 * ramp - 0.4;
      pos.setY(i, y);
      const c = y < 8 ? low.clone().lerp(mid, y / 8) : mid.clone().lerp(high, Math.min(1, (y - 8) / 30));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const hills = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, flatShading: true }));
    hills.receiveShadow = true;
    this.scene.add(hills);
  }

  /* ─────────────── غيوم عابرة ─────────────── */
  _buildClouds() {
    const tex = cloudTexture();
    this.clouds = [];
    for (let i = 0; i < 11; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.72, depthWrite: false, fog: false }));
      const w = 90 + Math.random() * 110;
      s.scale.set(w, w * 0.5, 1);
      s.position.set((Math.random() - 0.5) * 900, 120 + Math.random() * 60, (Math.random() - 0.5) * 900);
      s.userData.speed = 0.8 + Math.random() * 1.2;
      this.scene.add(s);
      this.clouds.push(s);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     الدورة اليومية
     ═══════════════════════════════════════════════════════════════ */
  setHour(hour, force = false) {
    this.hour = hour;
    if (this.interior) return;     /* الداخل لا يتأثّر بالشمس */
    const k = interpolate(hour);

    /* مسار الشمس: تشرق شرقاً 5:30 وتغرب غرباً 19:40 */
    const a = Math.PI * (hour - 5.5) / 14.2;
    const elev = Math.sin(a);
    const dir = new THREE.Vector3(Math.cos(a), Math.max(elev, -0.35), 0.42).normalize();
    this.skyUniforms.sunDir.value.copy(dir);
    this.skyUniforms.zenith.value.setHex(k.zenith);
    this.skyUniforms.horizon.value.setHex(k.horizon);
    this.skyUniforms.sunColor.value.setHex(k.sun);
    this.skyUniforms.sunIntensity.value = Math.max(0.05, k.sunI / 2.9);

    /* الضوء الاتّجاهي: نهاراً من الشمس، ليلاً قمر باهت من اتّجاه ثابت */
    const night = elev < 0.04;
    this.sunDir = night ? new THREE.Vector3(-0.4, 0.75, 0.5).normalize() : dir;
    this.sun.color.setHex(night ? 0x9db1e6 : k.sun);
    this.sun.intensity = night ? 0.55 : k.sunI;     /* قمر بدر: يكفي لقراءة الشارع */
    this.hemi.color.setHex(k.hemiSky);
    this.hemi.groundColor.setHex(k.hemiGround);
    this.hemi.intensity = k.hemiI;

    this.scene.fog.color.setHex(k.horizon);
    this.scene.fog.near = night ? 40 : WORLD.FOG_NEAR;
    this.scene.fog.far = night ? 230 : WORLD.FOG_FAR;

    /* عامل الليل: يبدأ التدرّج 18:30 ويكتمل 20:15 */
    this.nightFactor = smoothstep(18.5, 20.25, hour);

    /* خريطة البيئة تُعاد كل نصف ساعة لعب — كافية لانتقال ناعم */
    const bucket = Math.floor(hour * 2);
    if (force || bucket !== this._lastEnvHour) {
      this._lastEnvHour = bucket;
      const old = this.scene.environment;
      this.scene.environment = this.pmrem.fromScene(this.skyScene, 0.05).texture;
      if (old) old.dispose();
    }
  }

  /**
   * الوضع الداخلي: تُطفأ الشمس والسماء وبرك المصابيح، ويحلّ ضوء محيط
   * محايد يترك للإضاءة الداخلية أن تحدّد جوّ المكان.
   */
  setInterior(on) {
    this.interior = on;
    this.sky.visible = !on;
    for (const c of this.clouds) c.visible = !on;
    this.sun.castShadow = !on;      /* خريطة الظلّ تُرسم كل إطار — لا حاجة لها داخلياً */
    if (on) {
      this.sun.intensity = 0;
      this.hemi.color.setHex(0xf2f0ea); this.hemi.groundColor.setHex(0x8a8478); this.hemi.intensity = 0.9;
      this.scene.fog.near = 400; this.scene.fog.far = 900;
      for (const l of this.lampLights) l.intensity = 0;
    } else {
      this.setHour(this.hour, true);
    }
  }

  /** يتبع اللاعب كل إطار: صندوق الظلّ حوله، والغيوم تنزلق */
  update(dt, playerPos) {
    if (this.interior) return;
    this.sun.position.copy(playerPos).addScaledVector(this.sunDir, 160);
    this.sun.target.position.copy(playerPos);
    this.sun.target.updateMatrixWorld();
    this.sky.position.copy(playerPos);
    this._updateLampPool(playerPos);

    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 480) c.position.x = -480;
    }
  }
}

/* ─────────────── مساعدات ─────────────── */

function interpolate(hour) {
  const h = Math.max(KEYFRAMES[0].h, Math.min(KEYFRAMES.at(-1).h, hour));
  let i = 0;
  while (i < KEYFRAMES.length - 2 && KEYFRAMES[i + 1].h < h) i++;
  const a = KEYFRAMES[i], b = KEYFRAMES[i + 1];
  const t = smoothstep(a.h, b.h, h);
  const lerpHex = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), t).getHex();
  return {
    zenith: lerpHex(a.zenith, b.zenith), horizon: lerpHex(a.horizon, b.horizon),
    sun: lerpHex(a.sun, b.sun), sunI: a.sunI + (b.sunI - a.sunI) * t,
    hemiSky: lerpHex(a.hemiSky, b.hemiSky), hemiGround: lerpHex(a.hemiGround, b.hemiGround),
    hemiI: a.hemiI + (b.hemiI - a.hemiI) * t
  };
}

function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
