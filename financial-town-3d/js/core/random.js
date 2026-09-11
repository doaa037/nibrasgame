/* ═══════════════════════════════════════════════════════════════════
   random.js — مولّد أرقام شبه عشوائي ذو بذرة ثابتة (mulberry32)
   ───────────────────────────────────────────────────────────────────
   كل ما يبدو «عشوائياً» في البلدة — مواضع المباني، تنويعات الخامات،
   الأشجار — يُشتقّ من هذا المولّد. البذرة الثابتة تعني أنّ البلدة
   متطابقة عند كل طالب وفي كل تشغيل، فيصحّ للمعلّم أن يقول «البنك
   على يسار الجامع» للصفّ كلّه.
   ═══════════════════════════════════════════════════════════════════ */

export function makeRandom(seed) {
  let s = seed | 0;
  const next = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (a, b) => a + (b - a) * next();
  next.int   = (a, b) => Math.floor(next.range(a, b + 1));
  next.pick  = (arr) => arr[Math.floor(next() * arr.length)];
  next.chance = (p) => next() < p;
  return next;
}

/** ضوضاء قيمية ثنائية الأبعاد ناعمة — تكفي لخامات الأسفلت والأرض والتلال */
export function makeNoise2D(seed) {
  const rnd = makeRandom(seed);
  const SIZE = 256;
  const grid = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();

  const at = (x, y) => grid[((y & (SIZE - 1)) * SIZE) + (x & (SIZE - 1))];
  const fade = (t) => t * t * (3 - 2 * t);

  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = fade(x - xi), yf = fade(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
  };

  /** ضوضاء كسورية: عدّة أوكتافات متراكبة تعطي تفاصيل على كل المقاييس */
  noise.fbm = (x, y, octaves = 4, lacunarity = 2, gain = 0.5) => {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += noise(x * freq, y * freq) * amp;
      norm += amp; amp *= gain; freq *= lacunarity;
    }
    return sum / norm;
  };
  return noise;
}
