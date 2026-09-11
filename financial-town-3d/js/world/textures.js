/* ═══════════════════════════════════════════════════════════════════
   textures.js — خامات إجرائية تُرسم على Canvas عند الإقلاع
   ───────────────────────────────────────────────────────────────────
   لماذا لا نحمّل صوراً؟ لأنّ اللعبة يجب أن تعمل بلا إنترنت وبلا
   ملفّات خارجية على أجهزة المدرسة. كل خامة هنا — واجهات المباني،
   الحجر القدسي، الأسفلت، البلاط — تُولَّد برمجياً في أجزاء من الثانية،
   بحجم صفر على القرص، وبتنويع لا نهائي عبر البذرة.

   كل دالة تُعيد THREE.CanvasTexture مضبوط الفضاء اللوني (sRGB)
   والتكرار (RepeatWrapping) والترشيح المتباين الخواص (anisotropy).
   ═══════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { makeRandom, makeNoise2D } from '../core/random.js';

const rnd = makeRandom(7_2026);
const noise = makeNoise2D(9_11);

/* ─────────────── أدوات الرسم ─────────────── */

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = [1, 1], srgb = true, anisotropy = 8 } = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** حبيبات ضوضاء خفيفة تكسر «نظافة» الرسم الرقمي فتبدو المادّة حقيقية */
function grain(ctx, w, h, strength = 14, scale = 1) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = (noise.fbm(x / (18 * scale), y / (18 * scale), 3) - 0.5) * strength * 2;
      const i = (y * w + x) * 4;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** بقع ترابية/رطوبة كبيرة الحجم — تعطي عمراً للجدران والأرصفة */
function stains(ctx, w, h, count, color, alphaMax = 0.10) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * w, y = rnd() * h, r = rnd.range(w * 0.08, w * 0.3);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${rnd.range(0.02, alphaMax)})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/* ═══════════════════════════════════════════════════════════════
   1) واجهة سكنية — بلاطة واحدة = طابق بعرض 6م × ارتفاع 3.4م
      تحتوي نافذتين بشتّرات (تريس) — أيقونة البناء المحلّي
   ═══════════════════════════════════════════════════════════════ */
export function facadeTexture({ tone = '#e9e1d2', shutter = 0.35 } = {}) {
  const W = 512, H = 290;
  const [c, ctx] = canvas(W, H);
  const [ce, ctxE] = canvas(W, H);          /* خريطة الانبعاث: النوافذ المضاءة ليلاً */

  ctx.fillStyle = tone; ctx.fillRect(0, 0, W, H);
  ctxE.fillStyle = '#000'; ctxE.fillRect(0, 0, W, H);

  /* خطّ الطابق: بلاطة خرسانية أغمق قليلاً في الأسفل */
  ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(0, H - 14, W, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, H - 16, W, 2);

  for (let k = 0; k < 2; k++) {
    const wx = 62 + k * 256, wy = 58, ww = 132, wh = 152;

    /* عمق الفتحة: ظلّ داخلي */
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);

    /* إطار ألمنيوم */
    ctx.fillStyle = '#c9c5bd'; ctx.fillRect(wx, wy, ww, wh);

    /* زجاج بتدرّج سماوي وانعكاس مائل */
    const g = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
    g.addColorStop(0, '#5d7f9c'); g.addColorStop(0.45, '#3f5d78');
    g.addColorStop(0.5, '#6f90ab'); g.addColorStop(1, '#2e4359');
    ctx.fillStyle = g; ctx.fillRect(wx + 7, wy + 7, ww - 14, wh - 14);

    /* قاطع أوسط عمودي */
    ctx.fillStyle = '#d5d1c9'; ctx.fillRect(wx + ww / 2 - 3, wy + 7, 6, wh - 14);

    /* شتّر (تريس) منسدل جزئياً — تنويع بين النوافذ */
    const drop = rnd.chance(shutter) ? rnd.range(0.25, 0.7) : rnd.range(0, 0.12);
    const sh = Math.floor((wh - 14) * drop);
    if (sh > 4) {
      ctx.fillStyle = '#d9d3c6'; ctx.fillRect(wx + 7, wy + 7, ww - 14, sh);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = wy + 7; y < wy + 7 + sh; y += 7) ctx.fillRect(wx + 7, y, ww - 14, 2);
    }

    /* عتبة رخامية بارزة */
    ctx.fillStyle = '#f2ede3'; ctx.fillRect(wx - 10, wy + wh, ww + 20, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(wx - 10, wy + wh + 9, ww + 20, 6);

    /* الانبعاث: الجزء غير المغطّى بالشتّر يضيء ليلاً بدرجات دافئة مختلفة */
    const warm = rnd.pick(['#ffd79a', '#ffe7bf', '#ffcf7d', '#fff1d6']);
    ctxE.fillStyle = rnd.chance(0.72) ? warm : '#0a0a0a';
    ctxE.fillRect(wx + 7, wy + 7 + sh, ww - 14, wh - 14 - sh);
  }

  stains(ctx, W, H, 5, '60,50,40', 0.09);
  grain(ctx, W, H, 9);
  return { map: toTexture(c), emissive: toTexture(ce) };
}

/* ═══════════════════════════════════════════════════════════════
   2) زجاج مكتبي (Curtain wall) — مركز التشغيل ومركز الأمن الرقمي
   ═══════════════════════════════════════════════════════════════ */
export function officeGlassTexture({ tint = '#2f4f6f', mullion = '#1a2530' } = {}) {
  const W = 512, H = 512;
  const [c, ctx] = canvas(W, H);
  const [ce, ctxE] = canvas(W, H);
  ctxE.fillStyle = '#000'; ctxE.fillRect(0, 0, W, H);

  const cols = 4, rows = 4, pw = W / cols, ph = H / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = col * pw, y = r * ph;
      const g = ctx.createLinearGradient(x, y, x + pw, y + ph);
      const lighten = rnd.range(-12, 18);
      g.addColorStop(0, shade(tint, 22 + lighten));
      g.addColorStop(0.5, shade(tint, lighten));
      g.addColorStop(1, shade(tint, -18 + lighten));
      ctx.fillStyle = g; ctx.fillRect(x, y, pw, ph);
      /* انعكاس السماء في الثلث العلوي */
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x, y, pw, ph * 0.33);
      /* إضاءة مكاتب متفرّقة ليلاً */
      if (rnd.chance(0.55)) {
        ctxE.fillStyle = rnd.pick(['#e8f0ff', '#dfe9ff', '#fff3d9']);
        ctxE.fillRect(x + 6, y + 6, pw - 12, ph - 12);
      }
    }
  }
  ctx.strokeStyle = mullion; ctx.lineWidth = 8;
  for (let i = 0; i <= cols; i++) { ctx.beginPath(); ctx.moveTo(i * pw, 0); ctx.lineTo(i * pw, H); ctx.stroke(); }
  for (let i = 0; i <= rows; i++) { ctx.beginPath(); ctx.moveTo(0, i * ph); ctx.lineTo(W, i * ph); ctx.stroke(); }
  grain(ctx, W, H, 4);
  return { map: toTexture(c), emissive: toTexture(ce) };
}

/* ═══════════════════════════════════════════════════════════════
   3) حجر قدسي (Jerusalem stone) — الجامع، البنك، والبيت
      كتل غير منتظمة الطول بدرجات كريمية ومونة داكنة
   ═══════════════════════════════════════════════════════════════ */
export function stoneTexture({ base = '#e6d9be', rows = 7 } = {}) {
  const W = 512, H = 512;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#8f8270'; ctx.fillRect(0, 0, W, H);        /* المونة */

  const rowH = H / rows;
  for (let r = 0; r < rows; r++) {
    let x = (r % 2) * -rnd.range(20, 80);
    while (x < W) {
      const w = rnd.range(60, 150);
      const y = r * rowH;
      const tone = shade(base, rnd.range(-16, 14));
      ctx.fillStyle = tone;
      ctx.fillRect(x + 3, y + 3, w - 6, rowH - 6);
      /* حافّة مضاءة أعلى/يسار وظلّ أسفل/يمين — يوحي بالبروز */
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x + 3, y + 3, w - 6, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + 3, y + rowH - 6, w - 6, 3);
      /* بقع تجوية داخل الحجر */
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = `rgba(90,70,50,${rnd.range(0.02, 0.07)})`;
        ctx.beginPath();
        ctx.ellipse(x + rnd.range(10, w - 10), y + rnd.range(8, rowH - 8),
                    rnd.range(8, 30), rnd.range(4, 14), rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      x += w;
    }
  }
  grain(ctx, W, H, 10, 0.7);
  return toTexture(c);
}

/* ═══════════════════════════════════════════════════════════════
   4) أسفلت — بلاطة 8م × 8م
   ═══════════════════════════════════════════════════════════════ */
export function asphaltTexture() {
  const W = 512, H = 512;
  const [c, ctx] = canvas(W, H);
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = noise.fbm(x / 9, y / 9, 4) * 0.55 + noise.fbm(x / 60, y / 60, 2) * 0.45;
      const v = 48 + n * 34;
      const i = (y * W + x) * 4;
      d[i] = v; d[i + 1] = v + 1; d[i + 2] = v + 3; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  /* شقوق رفيعة وترقيعات أغمق */
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    let x = rnd() * W, y = rnd() * H;
    ctx.moveTo(x, y);
    for (let s = 0; s < 8; s++) { x += rnd.range(-40, 40); y += rnd.range(-40, 40); ctx.lineTo(x, y); }
    ctx.stroke();
  }
  stains(ctx, W, H, 4, '0,0,0', 0.18);
  stains(ctx, W, H, 3, '120,110,95', 0.06);
  return toTexture(c, { anisotropy: 16 });
}

/* ═══════════════════════════════════════════════════════════════
   5) بلاط رصيف — بلاطات 40×40 سم بلونين متناوبين
   ═══════════════════════════════════════════════════════════════ */
export function pavingTexture() {
  const W = 512, H = 512, n = 8, s = W / n;
  const [c, ctx] = canvas(W, H);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const even = (x + y) % 2 === 0;
      ctx.fillStyle = shade(even ? '#cfc7b6' : '#bfb6a3', rnd.range(-8, 8));
      ctx.fillRect(x * s, y * s, s, s);
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x * s, y * s, s, 2); ctx.fillRect(x * s, y * s, 2, s);
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x * s + 2, y * s + 2, s - 3, 1);
    }
  }
  stains(ctx, W, H, 6, '70,60,45', 0.1);
  grain(ctx, W, H, 7);
  return toTexture(c, { anisotropy: 16 });
}

/* ═══════════════════════════════════════════════════════════════
   6) أرض — تربة جافّة بعشب متفرّق (منظر الجليل صيفاً)
   ═══════════════════════════════════════════════════════════════ */
export function groundTexture() {
  const W = 1024, H = 1024;
  const [c, ctx] = canvas(W, H);
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      /* ثلاث طبقات: بقع كبيرة، حبيبات تربة متوسّطة، وحصى دقيق */
      const macro = noise.fbm(x / 160 + 7, y / 160 + 7, 2);
      const soil  = noise.fbm(x / 26, y / 26, 4);
      const fine  = noise.fbm(x / 5.5 + 3, y / 5.5 + 3, 2);
      const grassMask = noise.fbm(x / 210 + 40, y / 210 + 40, 3);
      const i = (y * W + x) * 4;
      const v = soil * 0.55 + fine * 0.3 + macro * 0.15;
      /* تربة كلسية مصفرّة — لون أرض الجليل صيفاً */
      let r = 168 + v * 40, g = 152 + v * 34, b = 118 + v * 26;
      /* عشب جافّ زيتوني على رقع قليلة وبتباين منخفض */
      const m = Math.max(0, Math.min(1, (grassMask - 0.5) * 2.4)) * 0.55;
      r = r + (138 + v * 30 - r) * m; g = g + (146 + v * 32 - g) * m; b = b + (92 + v * 18 - b) * m;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  /* حصى وأعشاب صغيرة متناثرة */
  for (let k = 0; k < 900; k++) {
    ctx.fillStyle = rnd.chance(0.5) ? 'rgba(60,50,35,0.35)' : 'rgba(215,205,180,0.4)';
    ctx.fillRect(rnd() * W, rnd() * H, rnd.range(1, 3), rnd.range(1, 3));
  }
  return toTexture(c, { anisotropy: 16 });
}

/* ═══════════════════════════════════════════════════════════════
   7) سطح مستوٍ — خرسانة مع حصى وبقع قار
   ═══════════════════════════════════════════════════════════════ */
export function roofTexture() {
  const W = 256, H = 256;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#9d968a'; ctx.fillRect(0, 0, W, H);
  stains(ctx, W, H, 8, '30,28,26', 0.2);
  stains(ctx, W, H, 4, '200,195,185', 0.12);
  grain(ctx, W, H, 16, 0.5);
  return toTexture(c);
}

/* ═══════════════════════════════════════════════════════════════
   8) مظلّة قماشية مخطّطة — واجهات المحلّات
   ═══════════════════════════════════════════════════════════════ */
export function awningTexture(color = '#c0392b') {
  const W = 256, H = 64;
  const [c, ctx] = canvas(W, H);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#f4efe4' : color;
    ctx.fillRect(i * (W / 8), 0, W / 8, H);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, H - 8, W, 8);
  grain(ctx, W, H, 8);
  return toTexture(c);
}

/* ═══════════════════════════════════════════════════════════════
   9) سحابة — كتل ناعمة بشفافية متدرّجة، تُستخدم كـSprite
   ═══════════════════════════════════════════════════════════════ */
export function cloudTexture() {
  const W = 256, H = 128;
  const [c, ctx] = canvas(W, H);
  for (let i = 0; i < 14; i++) {
    const x = rnd.range(40, W - 40), y = rnd.range(48, H - 30), r = rnd.range(22, 48);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ═══════════════════════════════════════════════════════════════
   10) واجهة محلّات — طابق أرضي بفاترينات ولافتات (الشارع التجاري)
   ═══════════════════════════════════════════════════════════════ */
export function shopfrontTexture() {
  const W = 1024, H = 256;
  const [c, ctx] = canvas(W, H);
  const [ce, ctxE] = canvas(W, H);
  ctxE.fillStyle = '#000'; ctxE.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ded4c2'; ctx.fillRect(0, 0, W, H);
  const shops = 4, sw = W / shops;
  const signColors = ['#b23a3a', '#2f6f5e', '#c9891f', '#2f4f8f'];
  for (let i = 0; i < shops; i++) {
    const x = i * sw;
    /* لافتة علوية ملوّنة */
    ctx.fillStyle = signColors[i % signColors.length]; ctx.fillRect(x + 8, 14, sw - 16, 46);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let k = 0; k < 5; k++) ctx.fillRect(x + 40 + k * 34, 28, rnd.range(14, 26), 18);
    /* فاترينة زجاجية كبيرة */
    ctx.fillStyle = '#1f2d3a'; ctx.fillRect(x + 14, 70, sw - 28, H - 84);
    const g = ctx.createLinearGradient(x, 70, x + sw, H);
    g.addColorStop(0, 'rgba(120,160,200,0.55)'); g.addColorStop(0.5, 'rgba(60,90,120,0.35)');
    g.addColorStop(1, 'rgba(30,45,60,0.6)');
    ctx.fillStyle = g; ctx.fillRect(x + 20, 76, sw - 40, H - 96);
    /* باب */
    ctx.fillStyle = '#b8b1a4'; ctx.fillRect(x + sw / 2 - 22, 100, 44, H - 114);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + sw / 2 - 2, 100, 4, H - 114);
    /* الفاترينات مضاءة ليلاً */
    ctxE.fillStyle = '#ffe9c2'; ctxE.fillRect(x + 20, 76, sw - 40, H - 96);
  }
  grain(ctx, W, H, 6);
  return { map: toTexture(c), emissive: toTexture(ce) };
}

/* ─────────────── مساعدات لونية ─────────────── */

/** تفتيح/تغميق لون سداسي بمقدار (‎-255..255‎) */
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amount), g = clamp(((n >> 8) & 255) + amount), b = clamp((n & 255) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
