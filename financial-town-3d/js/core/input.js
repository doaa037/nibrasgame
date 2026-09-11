/* ═══════════════════════════════════════════════════════════════════
   input.js — إدخال موحّد: لوحة مفاتيح + لمس
   ───────────────────────────────────────────────────────────────────
   تُخفي الفروق بين الحاسوب والجوّال خلف واجهة واحدة: منطق اللعبة
   يسأل عن اتجاه الحركة ولا يعرف إن جاء من WASD أم من عصا لمس.
   ═══════════════════════════════════════════════════════════════════ */

export class Input {
  constructor(target = window) {
    this.keys = new Set();
    this.axis = { x: 0, y: 0 };        /* اتجاه الحركة الموحّد (‎-1..1‎) */
    this.run = false;
    this.cameraYawDelta = 0;           /* دوران الكاميرا الأفقي هذا الإطار */
    this.cameraPitchDelta = 0;
    this.zoomDelta = 0;
    this.enabled = true;

    this._pressHandlers = new Map();   /* مفتاح ← دالة تُنفَّذ مرّة عند الضغط */
    this._dragging = false;
    this._lastPointer = { x: 0, y: 0 };
    this._touchId = null;
    this._touchOrigin = { x: 0, y: 0 };

    this._bindKeyboard(target);
    this._bindPointer(target);
  }

  /* ─────────────── لوحة المفاتيح ─────────────── */
  _bindKeyboard(target) {
    target.addEventListener('keydown', (e) => {
      /* لا نبتلع الإدخال أثناء الكتابة في حقل نصّي */
      if (e.target.matches?.('input, textarea')) return;
      const code = e.code;
      if (!this.keys.has(code)) {
        const handler = this._pressHandlers.get(code);
        if (handler) { e.preventDefault(); handler(); }
      }
      this.keys.add(code);
      if (MOVEMENT_CODES.has(code)) e.preventDefault();
      this._updateAxis();
    });

    target.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this._updateAxis();
    });

    /* فقدان التركيز (تبديل نافذة) يجب أن يحرّر كل المفاتيح،
       وإلّا بقي اللاعب يمشي إلى الأبد بعد العودة */
    window.addEventListener('blur', () => { this.keys.clear(); this._updateAxis(); });
  }

  /** يربط دالة بمفتاح، تُنفَّذ مرّة واحدة عند الضغط لا مع التكرار */
  onPress(code, fn) { this._pressHandlers.set(code, fn); }

  _updateAxis() {
    if (!this.enabled) { this.axis.x = this.axis.y = 0; return; }
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('KeyW') || k.has('ArrowUp'))    y += 1;
    if (k.has('KeyS') || k.has('ArrowDown'))  y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft'))  x -= 1;

    /* التطبيع يمنع أن يكون القطر أسرع من المستقيم */
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    this.axis.x = x; this.axis.y = y;
    this.run = k.has('ShiftLeft') || k.has('ShiftRight');
  }

  /* ─────────────── الفأرة واللمس ─────────────── */
  _bindPointer(target) {
    const canvas = document.getElementById('game-canvas') || target;

    canvas.addEventListener('pointerdown', (e) => {
      if (e.target.closest?.('.ui-layer')) return;   /* لا نلتقط سحب الواجهة */
      this._dragging = true;
      this._lastPointer = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture?.(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this._dragging || !this.enabled) return;
      this.cameraYawDelta   += (e.clientX - this._lastPointer.x) * 0.005;
      this.cameraPitchDelta += (e.clientY - this._lastPointer.y) * 0.003;
      this._lastPointer = { x: e.clientX, y: e.clientY };
    });

    const endDrag = () => { this._dragging = false; };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    canvas.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.zoomDelta += Math.sign(e.deltaY) * 0.9;
    }, { passive: false });
  }

  /* ─────────────── عصا اللمس (الجوّال) ─────────────── */

  /**
   * تربط عنصر HTML كعصا تحكّم افتراضية.
   * نحسب الإزاحة من مركز العصا ونطبّعها على نصف قطرها، فيحصل اللاعب
   * على تحكّم تناظري (بطيء قرب المركز، أسرع عند الحافّة).
   */
  attachJoystick(baseEl, knobEl, radius = 46) {
    const reset = () => {
      this._touchId = null;
      knobEl.style.transform = 'translate(0px, 0px)';
      this.axis.x = this.axis.y = 0;
      this.run = false;
    };

    baseEl.addEventListener('pointerdown', (e) => {
      this._touchId = e.pointerId;
      const r = baseEl.getBoundingClientRect();
      this._touchOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      baseEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    baseEl.addEventListener('pointermove', (e) => {
      if (this._touchId !== e.pointerId || !this.enabled) return;
      let dx = e.clientX - this._touchOrigin.x;
      let dy = e.clientY - this._touchOrigin.y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) { dx = dx / dist * radius; dy = dy / dist * radius; }
      knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      this.axis.x = dx / radius;
      this.axis.y = -dy / radius;                    /* الشاشة إلى أسفل = للأمام سالب */
      this.run = dist > radius * 0.85;               /* الدفع للحافّة = ركض */
    });

    baseEl.addEventListener('pointerup', reset);
    baseEl.addEventListener('pointercancel', reset);
  }

  /** تُستدعى في نهاية كل إطار: دلتا الكاميرا تراكمية وتُستهلك مرّة */
  consumeCameraDeltas() {
    const out = { yaw: this.cameraYawDelta, pitch: this.cameraPitchDelta, zoom: this.zoomDelta };
    this.cameraYawDelta = this.cameraPitchDelta = this.zoomDelta = 0;
    return out;
  }

  /** تعطيل الإدخال أثناء الحوارات واللوحات */
  setEnabled(v) {
    this.enabled = v;
    if (!v) { this.keys.clear(); this.axis.x = this.axis.y = 0; this.run = false; }
  }
}

const MOVEMENT_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'
]);
