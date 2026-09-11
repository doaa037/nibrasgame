/* ═══════════════════════════════════════════════════════════════════
   i18n.js — إدارة اللغة والاتجاه (عربي / עברית)
   ───────────────────────────────────────────────────────────────────
   كل نص في التطبيق يُخزَّن ككائن {ar, he}. الدالة t() تختار النص
   حسب اللغة الفعّالة. تصميم اللغات كجدول (LANGS) يجعل إضافة لغة
   ثالثة — بما فيها لغة LTR كالإنجليزية — تغييراً في البيانات فقط
   لا في منطق الواجهة.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /** جدول اللغات المدعومة: الاتجاه والخط يُشتقّان منه ديناميكياً */
  var LANGS = {
    ar: { code: 'ar', dir: 'rtl', label: 'العربية',  short: 'ع'  },
    he: { code: 'he', dir: 'rtl', label: 'עברית',    short: 'ע'  }
    // مثال للتوسعة مستقبلاً:
    // en: { code:'en', dir:'ltr', label:'English', short:'EN' }
  };

  var current = 'ar';
  var listeners = [];

  /* ─────────────── نصوص الواجهة ─────────────── */
  var UI = {
    /* --- شاشة البداية --- */
    appName:      { ar: 'بلدتي المالية',                 he: 'העיירה הפיננסית שלי' },
    appTagline:   { ar: 'محاكاة مالية تفاعلية لطلاب الصف الثاني عشر',
                    he: 'סימולציה פיננסית אינטראקטיבית לתלמידי כיתה י״ב' },
    appIntro:     { ar: 'ادخل البلدة، استلم راتبك الأول، واجه إغراءات السوق، وتعلّم كيف تُتخذ القرارات المالية الذكية — دون أن تدفع ثمن الخطأ في الحياة الحقيقية.',
                    he: 'היכנסו לעיירה, קבלו את המשכורת הראשונה, התמודדו עם פיתויי השוק, ולמדו כיצד מקבלים החלטות פיננסיות חכמות — בלי לשלם על הטעות בחיים האמיתיים.' },
    poweredBy:    { ar: 'كلية القاسمي الأكاديمية · قسم التربية غير المنهجية',
                    he: 'המכללה האקדמית אלקאסמי · המחלקה לחינוך בלתי פורמלי' },
    alignedWith:  { ar: 'متوافق مع إطار التربية المالية — OECD/PISA ووزارة المعارف',
                    he: 'מותאם למסגרת האוריינות הפיננסית — OECD/PISA ומשרד החינוך' },
    yourName:     { ar: 'اسمك',                          he: 'השם שלך' },
    namePlace:    { ar: 'اكتب اسمك هنا…',                he: 'כתבו את שמכם כאן…' },
    classroom:    { ar: 'الصف / المجموعة',              he: 'כיתה / קבוצה' },
    drawCard:     { ar: 'اسحب بطاقة وضعي المالي',       he: 'שלוף/י כרטיס מצב פיננסי' },
    redraw:       { ar: 'بطاقة أخرى',                    he: 'כרטיס אחר' },
    startGame:    { ar: 'ابدأ المحاكاة',                 he: 'התחל/י את הסימולציה' },
    nameRequired: { ar: 'رجاءً اكتب اسمك أولاً',         he: 'נא לכתוב את השם תחילה' },
    yourStart:    { ar: 'وضعك المالي الابتدائي',        he: 'המצב הפיננסי ההתחלתי שלך' },
    randomNote:   { ar: 'يُوزَّع الوضع المالي عشوائياً — تماماً كما في الحياة: لا نختار نقطة انطلاقنا، بل نختار ما نفعله بها.',
                    he: 'המצב הפיננסי מוגרל — בדיוק כמו בחיים: איננו בוחרים את נקודת הפתיחה, אלא מה עושים איתה.' },

    /* --- المؤشرات --- */
    mBalance:     { ar: 'الرصيد البنكي',        he: 'יתרה בבנק' },
    mWellness:    { ar: 'الأمان والرفاهية',     he: 'ביטחון ורווחה' },
    mIQ:          { ar: 'الذكاء المالي',        he: 'אינטליגנציה פיננסית' },
    mDebt:        { ar: 'الديون والتوتر',       he: 'חובות ולחץ' },
    mCredit:      { ar: 'تقرير الائتمان',       he: 'דוח נתוני אשראי' },
    pts:          { ar: 'نقطة',                 he: 'נק׳' },
    stressLabel:  { ar: 'التوتر',               he: 'לחץ' },
    overdraftOn:  { ar: 'أنت في السحب المكشوف', he: 'את/ה במינוס' },

    /* --- الخريطة ودورة الشهر --- */
    townMap:      { ar: 'خريطة البلدة',          he: 'מפת העיירה' },
    townMapSub:   { ar: 'اختر مؤسسة لتخوض مهمتها المالية',
                    he: 'בחרו מוסד כדי להתמודד עם המשימה הפיננסית שלו' },
    month:        { ar: 'الشهر',                 he: 'חודש' },
    monthOf:      { ar: 'من',                    he: 'מתוך' },
    tasksLeft:    { ar: 'مهمة متبقية',           he: 'משימות שנותרו' },
    endMonth:     { ar: 'أنهِ الشهر',            he: 'סיום החודש' },
    endMonthHint: { ar: 'عند إنهاء الشهر: يُودَع الراتب، وتُخصم المصروفات الثابتة، وتُحتسب فوائد الديون.',
                    he: 'בסיום החודש: המשכורת מופקדת, ההוצאות הקבועות יורדות, וריביות החובות מחושבות.' },
    monthReport:  { ar: 'تقرير نهاية الشهر',     he: 'דוח סוף חודש' },
    finishAll:    { ar: 'أنهِ المحاكاة واعرض تقريري',
                    he: 'סיום הסימולציה והצגת הדוח' },
    doneTask:     { ar: 'أنجزت',                 he: 'הושלם' },
    openTask:     { ar: 'ابدأ المهمة',           he: 'התחל/י משימה' },

    /* --- السيناريوهات --- */
    situation:    { ar: 'الموقف',                he: 'המצב' },
    whatDoYouDo:  { ar: 'ماذا تفعل؟',            he: 'מה תעשה/י?' },
    continueBtn:  { ar: 'متابعة',                he: 'המשך' },
    backToMap:    { ar: 'العودة إلى الخريطة',    he: 'חזרה למפה' },
    correct:      { ar: 'قرار سليم',             he: 'החלטה נכונה' },
    partial:      { ar: 'قرار مقبول جزئياً',     he: 'החלטה חלקית' },
    wrong:        { ar: 'قرار مكلف',             he: 'החלטה יקרה' },
    whyRule:      { ar: 'القاعدة المالية',       he: 'הכלל הפיננסי' },
    impactOn:     { ar: 'أثر القرار',            he: 'השפעת ההחלטה' },
    creditImpact: { ar: 'تقرير الائتمان',        he: 'דוח אשראי' },
    competency:   { ar: 'الكفاية',               he: 'מיומנות' },

    /* --- التحفيز --- */
    badges:       { ar: 'أوسمة الإنجاز',         he: 'אותות הצטיינות' },
    badgesSub:    { ar: 'تُفتح تلقائياً عند اتخاذ قرارات مالية سليمة',
                    he: 'נפתחים אוטומטית בעקבות החלטות פיננסיות נכונות' },
    leaderboard:  { ar: 'لوحة المتصدرين الصفية', he: 'טבלת המובילים הכיתתית' },
    leaderboardSub:{ ar: 'ترتيب افتراضي يُحدَّث مع كل قرار تتخذه',
                    he: 'דירוג מדומה המתעדכן עם כל החלטה' },
    newBadge:     { ar: 'وسام جديد!',            he: 'אות חדש!' },
    you:          { ar: 'أنت',                   he: 'את/ה' },

    /* --- التقرير الختامي --- */
    finalReport:  { ar: 'تقريرك الختامي',        he: 'הדוח המסכם שלך' },
    finalScore:   { ar: 'النتيجة النهائية',      he: 'הציון הסופי' },
    skillsMap:    { ar: 'خريطة الكفايات المالية',he: 'מפת המיומנויות הפיננסיות' },
    skillsMapSub: { ar: 'وفق مجالات الكفاية المالية في إطار OECD/PISA',
                    he: 'לפי תחומי האוריינות הפיננסית במסגרת OECD/PISA' },
    decisionLog:  { ar: 'سجل قراراتك',           he: 'יומן ההחלטות שלך' },
    decisionsMade:{ ar: 'قراراً اتّخذته خلال المحاكاة',
                    he: 'החלטות שקיבלת במהלך הסימולציה' },
    backToTown:   { ar: 'العودة إلى البلدة',     he: 'חזרה לעיירה' },
    playAgain:    { ar: 'إعادة التجربة',         he: 'שחק/י שוב' },
    printReport:  { ar: 'طباعة / حفظ PDF',       he: 'הדפסה / שמירת PDF' },
    shareClass:   { ar: 'نسخ النتيجة للمعلّم',   he: 'העתקת התוצאה למורה' },
    copied:       { ar: 'تم النسخ ✓',            he: 'הועתק ✓' },
    reset:        { ar: 'مسح البيانات والبدء من جديد',
                    he: 'מחיקת נתונים והתחלה מחדש' },
    confirmReset: { ar: 'هل تريد مسح تقدّمك والبدء من جديد؟',
                    he: 'למחוק את ההתקדמות ולהתחיל מחדש?' },

    /* --- عام --- */
    close:        { ar: 'إغلاق',                 he: 'סגירה' },
    net:          { ar: 'الصافي',                he: 'נטו' },
    gross:        { ar: 'الإجمالي',              he: 'ברוטו' },
    perMonth:     { ar: 'شهرياً',                he: 'לחודש' },
    fixedCosts:   { ar: 'مصروفات ثابتة',        he: 'הוצאות קבועות' },
    savings:      { ar: 'المدخرات',              he: 'חיסכון' },
    loans:        { ar: 'القروض',                he: 'הלוואות' },
    andMore:      { ar: 'وغيرها',                he: 'ועוד' }
  };

  /* ─────────────── المنطق ─────────────── */

  /** يعيد النص المناسب للغة الحالية. يقبل مفتاح UI أو كائن {ar,he}. */
  function t(key, fallbackLang) {
    var entry = typeof key === 'string' ? UI[key] : key;
    if (!entry) return typeof key === 'string' ? key : '';
    return entry[current] || entry[fallbackLang || 'ar'] || '';
  }

  /** يبدّل اللغة، يحدّث lang/dir على <html>، ثم يُخطر المشتركين */
  function setLang(code) {
    if (!LANGS[code]) return;
    current = code;
    var cfg = LANGS[code];
    var html = document.documentElement;
    html.setAttribute('lang', cfg.code);
    html.setAttribute('dir', cfg.dir);
    html.setAttribute('data-lang', cfg.code);
    try { localStorage.setItem('finTown.lang', code); } catch (e) {}
    listeners.forEach(function (fn) { fn(code, cfg); });
  }

  function getLang()   { return current; }
  function getDir()    { return LANGS[current].dir; }
  function onChange(fn){ listeners.push(fn); }
  function list()      { return Object.keys(LANGS).map(function (k) { return LANGS[k]; }); }

  /** اللغة المحفوظة من جلسة سابقة، وإلا لغة المتصفح، وإلا العربية */
  function detect() {
    var saved;
    try { saved = localStorage.getItem('finTown.lang'); } catch (e) {}
    if (saved && LANGS[saved]) return saved;
    var nav = (navigator.language || 'ar').slice(0, 2);
    return LANGS[nav] ? nav : 'ar';
  }

  global.I18N = { t: t, setLang: setLang, getLang: getLang, getDir: getDir,
                  onChange: onChange, list: list, detect: detect, UI: UI, LANGS: LANGS };
})(window);
