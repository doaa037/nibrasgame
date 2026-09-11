/* ═══════════════════════════════════════════════════════════════════
   engine3d.js — نواة العرض ثلاثي الأبعاد
   ───────────────────────────────────────────────────────────────────
   مسؤولة عن: المشهد، الكاميرا، الإضاءة، حلقة الرسم، وتغيير الحجم.
   لا تعرف شيئاً عن المال ولا عن اللاعب — فصل تامّ بين طبقة العرض
   وطبقة المحاكاة، حتى يمكن تعديل أيّهما دون كسر الآخر.
   ═══════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { WORLD } from '../content/config.js';

export class Engine3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.updaters = [];      /* دوال تُستدعى كل إطار: fn(dt, elapsed) */
    this.running = false;
    this.paused = false;

    this._initRenderer();
    this._initScene();
    this._initCamera();

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._onResize();
  }

  /* ─────────────── العارض ─────────────── */
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    /* سقف كثافة البكسل يحمي الأجهزة الضعيفة من انهيار عدد الإطارات:
       شاشة Retina بكثافة 3 ترسم 9 أضعاف البكسلات بلا مكسب بصري يُذكر */
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, WORLD.MAX_PIXEL_RATIO));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    /* تون سينمائي (ACES): يضغط الإضاءة العالية بنعومة بدل قصّها،
       فتبدو الشمس ساطعة والظلال غنيّة بدل صورة باهتة مسطّحة */
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
  }

  /* ─────────────── المشهد ─────────────── */
  _initScene() {
    this.scene = new THREE.Scene();
    /* الخلفية والضباب والإضاءة يديرها Environment تبعاً لساعة اللعبة */
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 600);
    this.camera.position.set(0, 12, 20);
    this.camera.lookAt(0, 1.5, 0);
  }

  /* ─────────────── الحجم ─────────────── */
  _onResize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  /* ─────────────── الحلقة ─────────────── */
  onUpdate(fn) { this.updaters.push(fn); }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      /* سقف dt عند 1/20 ثانية: عند تجمّد اللسان (تبويب في الخلفية،
         أو حوار طويل) لا نريد قفزة فيزيائية تعبر الجدران */
      const dt = Math.min(this.clock.getDelta(), 0.05);
      if (!this.paused) for (const fn of this.updaters) fn(dt, this.clock.elapsedTime);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  setPaused(v) { this.paused = v; }

  dispose() {
    this.running = false;
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }

  /** فحص دعم WebGL قبل محاولة الإقلاع — رسالة مفهومة خير من شاشة سوداء */
  static isSupported() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
                (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }
}
