/* ═══════════════════════════════════════════════════════════════════
   avatar.js — خيارات بناء الشخصية
   ───────────────────────────────────────────────────────────────────
   الطالب يبني أفاتاره قبل دخول البلدة: النمط (فتى / فتاة)، لون البشرة،
   الشعر، القميص، البنطال، والحقيبة. الخيارات
   محدودة عمداً — كافية ليتعرّف الطالب على نفسه في الشاشة، وقليلة بما
   يكفي كي لا يستهلك المصمّم الحصّة في التلوين.
   ═══════════════════════════════════════════════════════════════════ */

export const STYLES = [
  { id: 'boy',   icon: '🧑', name: { ar: 'فتى',        he: 'נער' } },
  { id: 'girl',  icon: '👩', name: { ar: 'فتاة',       he: 'נערה' } }
];

/* درجات بشرة واقعية للمنطقة */
export const SKINS  = [0xf1d6b8, 0xe3bd95, 0xd0a074, 0xb8865e, 0x8f6446, 0x5e4030];
export const HAIRS  = [0x1a1410, 0x3a2a1c, 0x6b4a2a, 0xa5733c, 0x7a1f1f, 0x4a4a4a];
export const SHIRTS = [0x2f6f9e, 0xc0392b, 0x2f8f5e, 0xe0a23f, 0x8e44ad, 0x34495e, 0xf1f1ef, 0x1abc9c];
export const PANTS  = [0x33393f, 0x2c3e50, 0x5a3e2b, 0x1f5a8a, 0x6d6d6d];
export const BAGS   = [0x8a3a3a, 0x2f6f9e, 0x2f8f5e, 0xe0a23f, 0x3a3a3a];

export const DEFAULT_APPEARANCE = {
  style: 'boy', skin: SKINS[1], hair: HAIRS[0],
  shirt: SHIRTS[0], pants: PANTS[0], bag: BAGS[0]
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** شخصية عشوائية — زرّ «فاجئني» في المُنشئ */
export function randomAppearance() {
  return {
    style: pick(STYLES).id, skin: pick(SKINS), hair: pick(HAIRS),
    shirt: pick(SHIRTS), pants: pick(PANTS), bag: pick(BAGS)
  };
}

/** يُكمل مظهراً ناقصاً (حفظ قديم) بالقيم الافتراضية */
export function normalizeAppearance(a) {
  const out = { ...DEFAULT_APPEARANCE, ...(a || {}) };
  if (!STYLES.some(s => s.id === out.style)) out.style = DEFAULT_APPEARANCE.style;
  return out;
}

export const hex = (n) => '#' + n.toString(16).padStart(6, '0');
