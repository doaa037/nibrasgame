/* ═══════════════════════════════════════════════════════════════════
   shop.data.js — بضائع السوبرماركت ومهمّة التسوّق الأسبوعية
   ───────────────────────────────────────────────────────────────────
   كل منتج على الرفّ قرار مصغّر. الرفوف مصمَّمة بالطريقة التي تُصمَّم
   بها في الواقع: لكل حاجة خياران أو ثلاثة بأسعار مختلفة للوحدة،
   عروض تُغري بشراء ما لا يلزم، وأصناف اندفاعية عند صناديق الدفع.

   kind:
     basic   منتج عادي/ماركة خاصّة — الأرخص للوحدة غالباً
     brand   ماركة معروفة — نفس الوظيفة بسعر أعلى
     bulk    عبوة كبيرة — أرخص للوحدة لكنّها تجمّد نقداً أكثر
     promo   عرض (3 بـ2، 2 بـ1) — مربح فقط إن كان الصنف مطلوباً
     impulse صنف اندفاعي عند الصندوق
     want    رغبة مشروعة لكنّها ليست في القائمة
   need: فئة الحاجة التي يلبّيها (null للرغبات)
   unit: كمّية ووحدة لحساب السعر للوحدة
   spot: موضع الرفّ داخل المتجر [x, z, tier] — يُقرأ في interior.js
   ═══════════════════════════════════════════════════════════════════ */

export const NEED_CATEGORIES = [
  { id: 'bread',    icon: '🍞', name: { ar: 'خبز',            he: 'לחם' } },
  { id: 'milk',     icon: '🥛', name: { ar: 'حليب',           he: 'חלב' } },
  { id: 'rice',     icon: '🍚', name: { ar: 'أرز',            he: 'אורז' } },
  { id: 'eggs',     icon: '🥚', name: { ar: 'بيض',            he: 'ביצים' } },
  { id: 'veg',      icon: '🥬', name: { ar: 'خضار',           he: 'ירקות' } },
  { id: 'protein',  icon: '🍗', name: { ar: 'دجاج / بروتين',  he: 'עוף / חלבון' } },
  { id: 'oil',      icon: '🫒', name: { ar: 'زيت للطبخ',      he: 'שמן לבישול' } },
  { id: 'cleaning', icon: '🧴', name: { ar: 'منظّف',          he: 'חומר ניקוי' } }
];

export const PRODUCTS = [
  /* ─── خبز ─── */
  { id: 'breadLocal', need: 'bread', kind: 'basic', price: 6, unit: { qty: 1, label: { ar: 'رغيف', he: 'כיכר' } },
    name: { ar: 'خبز طابون بلدي', he: 'לחם טאבון מקומי' }, color: 0xd9a35c, spot: [-13, -7, 1] },
  { id: 'breadBrand', need: 'bread', kind: 'brand', price: 12, unit: { qty: 1, label: { ar: 'رغيف', he: 'כיכר' } },
    name: { ar: 'خبز معبّأ ماركة', he: 'לחם ארוז ממותג' }, color: 0xefd9a8, spot: [-13, -4, 1] },

  /* ─── حليب (سعر مراقب — מחיר מפוקח) ─── */
  { id: 'milkBasic', need: 'milk', kind: 'basic', price: 6.2, unit: { qty: 1, label: { ar: 'لتر', he: 'ליטר' } },
    name: { ar: 'حليب 3% — سعر مراقب', he: 'חלב 3% — מחיר מפוקח' }, color: 0xf4f4f0, spot: [-9, -11, 2] },
  { id: 'milkBrand', need: 'milk', kind: 'brand', price: 9.5, unit: { qty: 1, label: { ar: 'لتر', he: 'ליטר' } },
    name: { ar: 'حليب ماركة بنكهة', he: 'חלב ממותג בטעמים' }, color: 0xe8d8f4, spot: [-5, -11, 2] },

  /* ─── أرز ─── */
  { id: 'rice1kg', need: 'rice', kind: 'basic', price: 9, unit: { qty: 1, label: { ar: 'كغ', he: 'ק״ג' } },
    name: { ar: 'أرز 1 كغ', he: 'אורז 1 ק״ג' }, color: 0xf0e6c8, spot: [-7, -6, 1] },
  { id: 'rice5kg', need: 'rice', kind: 'bulk', price: 36, unit: { qty: 5, label: { ar: 'كغ', he: 'ק״ג' } },
    name: { ar: 'أرز 5 كغ — عبوة اقتصادية', he: 'אורז 5 ק״ג — אריזה חסכונית' }, color: 0xe6d8a8, spot: [-7, -3, 0] },

  /* ─── بيض ─── */
  { id: 'eggs12', need: 'eggs', kind: 'basic', price: 13, unit: { qty: 12, label: { ar: 'حبّة', he: 'יח׳' } },
    name: { ar: 'بيض 12 حبّة', he: 'ביצים 12 יח׳' }, color: 0xf2e2c4, spot: [-1, -11, 1] },
  { id: 'eggs30', need: 'eggs', kind: 'bulk', price: 28, unit: { qty: 30, label: { ar: 'حبّة', he: 'יח׳' } },
    name: { ar: 'بيض 30 حبّة — كرتونة', he: 'ביצים 30 יח׳ — מגש' }, color: 0xe9d4b0, spot: [3, -11, 1] },

  /* ─── خضار ─── */
  { id: 'vegSeason', need: 'veg', kind: 'basic', price: 14, unit: { qty: 2, label: { ar: 'كغ', he: 'ק״ג' } },
    name: { ar: 'خضار موسمية (طماطم وخيار)', he: 'ירקות עונה (עגבניות ומלפפונים)' }, color: 0xd94f3a, spot: [-13, 2, 0] },
  { id: 'saladReady', need: 'veg', kind: 'brand', price: 22, unit: { qty: 0.5, label: { ar: 'كغ', he: 'ק״ג' } },
    name: { ar: 'سلطة مقطّعة جاهزة', he: 'סלט חתוך מוכן' }, color: 0x8fc46a, spot: [-13, 5, 1] },

  /* ─── بروتين ─── */
  { id: 'chicken', need: 'protein', kind: 'basic', price: 24, unit: { qty: 1, label: { ar: 'كغ', he: 'ק״ג' } },
    name: { ar: 'دجاج طازج 1 كغ', he: 'עוף טרי 1 ק״ג' }, color: 0xf3c9b0, spot: [7, -11, 1] },
  { id: 'schnitzel', need: 'protein', kind: 'brand', price: 26, unit: { qty: 0.5, label: { ar: 'كغ', he: 'ק״ג' } },
    name: { ar: 'شنيتسل مصنّع 500 غ', he: 'שניצל מעובד 500 ג׳' }, color: 0xe0a86a, spot: [11, -11, 1] },

  /* ─── زيت ─── */
  { id: 'canola', need: 'oil', kind: 'basic', price: 14, unit: { qty: 1, label: { ar: 'لتر', he: 'ליטר' } },
    name: { ar: 'زيت كانولا 1 ل', he: 'שמן קנולה 1 ל׳' }, color: 0xf2d24a, spot: [0, -6, 1] },
  { id: 'oliveOil', need: 'oil', kind: 'brand', price: 45, unit: { qty: 1, label: { ar: 'لتر', he: 'ליטר' } },
    name: { ar: 'زيت زيتون بلدي 1 ل', he: 'שמן זית מקומי 1 ל׳' }, color: 0x9bb04a, spot: [0, -3, 1] },

  /* ─── منظّفات ─── */
  { id: 'cleaner', need: 'cleaning', kind: 'basic', price: 11, unit: { qty: 1, label: { ar: 'عبوة', he: 'בקבוק' } },
    name: { ar: 'منظّف أرضيات', he: 'חומר ניקוי לרצפה' }, color: 0x4fa3d9, spot: [7, -6, 1] },
  { id: 'cleaner3for2', need: 'cleaning', kind: 'promo', price: 22, unit: { qty: 3, label: { ar: 'عبوات', he: 'בקבוקים' } },
    promo: { ar: 'عرض 3 بـ2', he: 'מבצע 3 ב-2' },
    name: { ar: 'منظّفات — 3 بـ2', he: 'חומרי ניקוי — 3 ב-2' }, color: 0x2f7fc4, spot: [7, -3, 0] },

  /* ─── رغبات ─── */
  { id: 'cola', need: null, kind: 'want', price: 9, unit: { qty: 2, label: { ar: 'لتر', he: 'ליטר' } },
    name: { ar: 'كولا 2 ل', he: 'קולה 2 ל׳' }, color: 0x3b1f1a, spot: [13, -7, 1] },
  { id: 'chips', need: null, kind: 'want', price: 13, unit: { qty: 1, label: { ar: 'كيس عائلي', he: 'שקית משפחתית' } },
    name: { ar: 'شيبس عائلي', he: 'צ׳יפס משפחתי' }, color: 0xf0b428, spot: [13, -4, 1] },
  { id: 'water6', need: null, kind: 'want', price: 14, unit: { qty: 9, label: { ar: 'لتر', he: 'ליטר' } },
    name: { ar: 'مياه معدنية 6×1.5 ل', he: 'מים מינרליים 6×1.5 ל׳' }, color: 0xa8d8f0, spot: [13, -1, 0] },
  { id: 'coffee', need: null, kind: 'want', price: 25, unit: { qty: 200, label: { ar: 'غ', he: 'ג׳' } },
    name: { ar: 'قهوة عربية 200 غ', he: 'קפה ערבי 200 ג׳' }, color: 0x5a3a22, spot: [0, 0, 1] },
  { id: 'biscuits2for1', need: null, kind: 'promo', price: 18, unit: { qty: 2, label: { ar: 'علبة', he: 'קופסה' } },
    promo: { ar: 'عرض 2 بـ1', he: 'מבצע 2 ב-1' },
    name: { ar: 'بسكويت — 2 بـ1', he: 'ביסקוויטים — 2 ב-1' }, color: 0xc98a4a, spot: [-4, 5, 1] },
  { id: 'earbuds', need: null, kind: 'want', price: 89, unit: { qty: 1, label: { ar: 'قطعة', he: 'יח׳' } },
    promo: { ar: 'عرض اليوم فقط!', he: 'מבצע להיום בלבד!' },
    name: { ar: 'سمّاعات بلوتوث', he: 'אוזניות בלוטות׳' }, color: 0x2a2a2e, spot: [4, 5, 1] },

  /* ─── اندفاعي عند الصندوق ─── */
  { id: 'energy', need: null, kind: 'impulse', price: 12, unit: { qty: 1, label: { ar: 'علبة', he: 'פחית' } },
    name: { ar: 'مشروب طاقة', he: 'משקה אנרגיה' }, color: 0x3aa0d9, spot: [-1.5, 8.6, 1] },
  { id: 'chocolate', need: null, kind: 'impulse', price: 7, unit: { qty: 1, label: { ar: 'لوح', he: 'חפיסה' } },
    name: { ar: 'شوكولاتة', he: 'שוקולד' }, color: 0x6b3a1e, spot: [1.5, 8.6, 1] },
  { id: 'gum', need: null, kind: 'impulse', price: 4, unit: { qty: 1, label: { ar: 'علبة', he: 'חפיסה' } },
    name: { ar: 'علكة', he: 'מסטיק' }, color: 0x5bd98a, spot: [12.2, 8.6, 1] }
];

/** المهمّة الأسبوعية: قائمة حاجات وميزانية — الميزانية أقلّ من «كل شيء» عمداً */
export const WEEKLY_MISSION = {
  budget: 180,
  needs: NEED_CATEGORIES.map(c => c.id),
  title: { ar: 'مشتريات الأسبوع', he: 'קניות השבוע' },
  brief: { ar: 'اشترِ حاجات الأسبوع الثماني من القائمة دون تجاوز 180 ₪. الرفوف مليئة بما ليس في قائمتك — هذا هو الاختبار.',
           he: 'קנו את שמונת הצרכים השבועיים מהרשימה בלי לחרוג מ-180 ₪. המדפים מלאים במה שאינו ברשימה — זה המבחן.' }
};
