/* ═══════════════════════════════════════════════════════════════════
   ui.js — طبقة العرض
   ───────────────────────────────────────────────────────────────────
   مبدأ التصميم: الواجهة دالة في الحالة — render(state) تُعيد بناء
   الأقسام من جديد. هذا يجعل تبديل اللغة أو تغيّر أيّ مؤشّر ينعكس
   فوراً دون منطق تحديث جزئي متناثر.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var t = global.I18N.t;
  var E = global.ENGINE;
  var D = global.DATA;

  /* ─────────────── أدوات مساعدة ─────────────── */

  function $(sel) { return document.querySelector(sel); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /** تنسيق مبلغ بالشيكل بأرقام لاتينية معزولة اتجاهياً */
  function money(n) {
    var v = Math.round(n);
    var sign = v < 0 ? '−' : '';
    var s = Math.abs(v).toLocaleString('en-US');
    return '<span class="num">' + sign + s + ' ₪</span>';
  }
  function num(n) { return '<span class="num">' + n + '</span>'; }

  /**
   * كسر مثل 63/100 يجب أن يبقى داخل عزل اتجاهي واحد.
   * لو تُرك «/100» خارج العزل لعرضه المتصفّح في نصّ RTL بترتيب مقلوب.
   */
  function frac(a, b) { return '<span class="num">' + a + '/' + b + '</span>'; }

  /** لون دلالي حسب موقع القيمة بين حدّين */
  function tone(v, goodAbove, badBelow) {
    if (v >= goodAbove) return 'good';
    if (v <= badBelow) return 'bad';
    return 'warn';
  }

  /* ═══════════════════════════════════════════════════════════════
     1) شاشة البداية
     ═══════════════════════════════════════════════════════════════ */

  function renderOnboarding(ctx) {
    var langs = global.I18N.list(), cur = global.I18N.getLang();
    var p = ctx.drawnProfile;

    $('#screen-onboarding').innerHTML =
      '<div class="onb-bg"></div>' +
      '<div class="onb-inner">' +
        '<div class="lang-switch" role="group" aria-label="Language">' +
          langs.map(function (l) {
            return '<button data-lang="' + l.code + '" aria-pressed="' + (l.code === cur) + '">' +
                   esc(l.label) + '</button>';
          }).join('') +
        '</div>' +

        '<div class="brand-mark">🏘️</div>' +
        '<h1 class="onb-title"><span>' + esc(t('appName')) + '</span></h1>' +
        '<p class="chip mb-16">' + esc(t('appTagline')) + '</p>' +
        '<p class="onb-sub">' + esc(t('appIntro')) + '</p>' +

        '<div class="card card-soft" style="text-align:start">' +
          '<div class="field">' +
            '<label for="inName">' + esc(t('yourName')) + '</label>' +
            '<input id="inName" type="text" maxlength="28" autocomplete="off" ' +
                   'placeholder="' + esc(t('namePlace')) + '" value="' + esc(ctx.name || '') + '"/>' +
          '</div>' +
          '<div class="field">' +
            '<label for="inClass">' + esc(t('classroom')) + '</label>' +
            '<input id="inClass" type="text" maxlength="20" autocomplete="off" ' +
                   'placeholder="י״ב 3" value="' + esc(ctx.classroom || '') + '"/>' +
          '</div>' +
          '<p id="nameErr" class="field-hint txt-bad hidden">' + esc(t('nameRequired')) + '</p>' +

          (p ? profileCard(p) : '') +

          '<div class="row wrap mt-20" style="justify-content:space-between">' +
            '<button id="btnDraw" class="btn btn-ghost btn-sm">🎲 ' +
              esc(p ? t('redraw') : t('drawCard')) + '</button>' +
            '<button id="btnStart" class="btn btn-gold"' + (p ? '' : ' disabled') + '>' +
              esc(t('startGame')) + ' ←</button>' +
          '</div>' +
          '<p class="field-hint mt-14">' + esc(t('randomNote')) + '</p>' +
        '</div>' +

        '<p class="txt-muted mt-20" style="font-size:.76rem">' + esc(t('poweredBy')) + '</p>' +
        '<p class="txt-muted" style="font-size:.72rem">' + esc(t('alignedWith')) + '</p>' +
      '</div>';
  }

  /** بطاقة الوضع المالي الابتدائي المسحوبة عشوائياً */
  function profileCard(p) {
    var slip = E.computePayslip(p.gross, p.creditPoints);
    return '<div class="profile-card anim-pop mt-20">' +
      '<div class="profile-head">' +
        '<div class="profile-emoji">' + p.emoji + '</div>' +
        '<div><div class="profile-name">' + esc(t(p.name)) + '</div>' +
             '<div class="profile-tag">' + esc(t(p.tag)) + '</div></div>' +
      '</div>' +
      '<p class="profile-story">' + esc(t(p.story)) + '</p>' +
      '<div class="profile-grid">' +
        stat(money(slip.net + (p.allowance || 0)), t('net') + ' · ' + t('perMonth')) +
        stat(money(p.fixed), t('fixedCosts')) +
        stat(money(p.balance), t('mBalance')) +
        stat(num(p.credit), t('mCredit')) +
      '</div></div>';
  }
  function stat(v, label) {
    return '<div class="profile-stat"><b>' + v + '</b><small>' + esc(label) + '</small></div>';
  }

  /* ═══════════════════════════════════════════════════════════════
     2) شاشة اللعبة: الشريط العلوي والمؤشّرات
     ═══════════════════════════════════════════════════════════════ */

  function renderGame(s, ctx) {
    $('#screen-game').innerHTML =
      '<div class="app-shell">' +
        topBar(s) +
        metricsGrid(s) +
        monthBar(s) +
        mapSection(s) +
        '<div class="grid-2 mt-20">' + badgesCard(s) + leaderboardCard(s) + '</div>' +
      '</div>';
  }

  function topBar(s) {
    var langs = global.I18N.list(), cur = global.I18N.getLang();
    var p = profileOf(s);
    return '<header class="top-bar no-print">' +
      '<div class="top-id">' +
        '<div class="avatar">' + p.emoji + '</div>' +
        '<div class="top-name">' + esc(s.name) +
          '<small>' + esc(t(p.name)) + (s.classroom ? ' · ' + esc(s.classroom) : '') + '</small>' +
        '</div>' +
      '</div>' +
      '<div class="top-actions">' +
        '<div class="lang-switch" style="margin:0">' +
          langs.map(function (l) {
            return '<button data-lang="' + l.code + '" aria-pressed="' + (l.code === cur) + '">' +
                   esc(l.short) + '</button>'; }).join('') +
        '</div>' +
        '<button id="btnFinish" class="btn btn-ghost btn-sm">🏁 ' + esc(t('finishAll')) + '</button>' +
        '<button id="btnReset" class="btn btn-ghost btn-sm" title="' + esc(t('reset')) + '">🔄</button>' +
      '</div>' +
    '</header>';
  }

  function profileOf(s) {
    return D.PROFILES.filter(function (p) { return p.id === s.profileId; })[0] || D.PROFILES[0];
  }

  /** المؤشّرات الحيّة الأربعة + تقرير الائتمان */
  function metricsGrid(s) {
    var overdraft = s.balance < 0;
    return '<div class="metrics" id="metrics">' +
      metric('balance', '💰', t('mBalance'), money(s.balance),
             overdraft ? '#e05c5c' : '#3fbf7f',
             overdraft ? t('overdraftOn') : t('savings') + ': ' + money(s.savings)) +

      metric('wellness', '🌿', t('mWellness'), frac(Math.round(s.wellness), 100),
             '#6aaae0', '', s.wellness) +

      metric('iq', '🧠', t('mIQ'), num(s.iq) + ' <small style="font-size:.7rem">' + esc(t('pts')) + '</small>',
             '#d4af37', t('mCredit') + ': ' + num(Math.round(s.credit))) +

      metric('debt', '⚠️', t('mDebt'), money(s.debt),
             s.stress > 55 ? '#e05c5c' : '#e0a23f',
             t('stressLabel') + ': ' + num(Math.round(s.stress)) + '%', s.stress) +
    '</div>';
  }

  function metric(id, icon, label, value, accent, note, barPct) {
    return '<div class="metric" data-metric="' + id + '" style="--accent:' + accent + '">' +
      '<div class="metric-top"><span class="metric-label">' + esc(label) + '</span>' +
        '<span class="metric-icon">' + icon + '</span></div>' +
      '<div class="metric-value">' + value + '</div>' +
      (note ? '<div class="metric-note">' + note + '</div>' : '') +
      (typeof barPct === 'number'
        ? '<div class="bar"><i style="width:' + E.clamp(barPct, 0, 100) + '%"></i></div>' : '') +
    '</div>';
  }

  /** شريط الشهر: يعرض التقدّم ويتيح إغلاق الشهر */
  function monthBar(s) {
    var total = global.SCENARIOS.length;
    var done = Object.keys(s.completed).length;
    return '<div class="month-bar no-print">' +
      '<div>' +
        '<div class="m-title">📅 ' + esc(t('month')) + ' ' + num(s.month) +
          ' · ' + num(total - done) + ' ' + esc(t('tasksLeft')) + '</div>' +
        '<div class="m-sub">' + esc(t('endMonthHint')) + '</div>' +
      '</div>' +
      '<button id="btnMonth" class="btn btn-ghost btn-sm">⏭️ ' + esc(t('endMonth')) + '</button>' +
    '</div>';
  }

  /* ═══════════════════════════════════════════════════════════════
     3) خريطة البلدة
     ═══════════════════════════════════════════════════════════════ */

  function mapSection(s) {
    return '<section class="card card-soft mb-22">' +
      '<div class="section-title">🗺️ ' + esc(t('townMap')) + '</div>' +
      '<p class="section-sub">' + esc(t('townMapSub')) + '</p>' +
      '<div class="map-wrap"><div class="map-canvas">' + townSvg() + poiLayer(s) + '</div></div>' +
    '</section>';
  }

  /**
   * رسم توضيحي لبلدة عربية: تلال، مسجد البلدة، بيوت حجرية، شارع
   * رئيسي وأشجار زيتون. نسبة اللوحة عريضة (840×350) لتناسب شريطاً
   * أفقياً يظهر كاملاً على الشاشة دون تمرير، والتكوين موزَّع على كامل
   * الارتفاع حتى تستقرّ أيقونات المؤسسات فوق مبانٍ لا في فراغ السماء.
   */
  function townSvg() {
    return '<svg viewBox="0 0 840 350" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><linearGradient id="ftSky" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#0d2b46"/><stop offset="100%" stop-color="#17466d"/>' +
      '</linearGradient></defs>' +
      '<rect width="840" height="350" fill="url(#ftSky)"/>' +
      '<ellipse cx="420" cy="34" rx="340" ry="78" fill="#6aaae0" opacity=".06"/>' +

      /* تلال بعيدة */
      '<path d="M0 82 Q140 40 280 76 T560 66 T840 86 L840 350 L0 350Z" fill="#11304a" opacity=".95"/>' +
      '<path d="M0 116 Q180 80 360 112 T700 104 L840 120 L840 350 L0 350Z" fill="#153a5b"/>' +

      /* الصفّ الخلفي من البيوت */
      houses([[46,128,48,34],[110,138,36,24],[168,124,44,32],[224,140,34,22],
              [590,126,46,34],[650,138,38,24],[704,122,50,34],[770,140,42,24]], .55, 2) +

      /* مسجد البلدة — معلم مركزي */
      '<g opacity=".95">' +
        '<rect x="374" y="112" width="88" height="66" rx="6" fill="#1c4570"/>' +
        '<path d="M374 112 Q418 70 462 112Z" fill="#245a89"/>' +
        '<rect x="474" y="76" width="15" height="102" rx="5" fill="#1c4570"/>' +
        '<path d="M474 76 L481.5 60 L489 76Z" fill="#245a89"/>' +
        '<circle cx="481.5" cy="56" r="6" fill="#d4af37" opacity=".9"/>' +
        '<circle cx="418" cy="80" r="6" fill="#d4af37" opacity=".9"/>' +
        '<rect x="410" y="146" width="16" height="32" rx="8" fill="#0f2c47"/>' +
      '</g>' +

      /* الشارع الرئيسي */
      '<path d="M-20 204 Q210 174 420 198 T860 188" stroke="#0b2135" stroke-width="28" fill="none"/>' +
      '<path d="M-20 204 Q210 174 420 198 T860 188" stroke="#d4af37" stroke-width="1.6" fill="none" ' +
            'stroke-dasharray="13 19" opacity=".34"/>' +

      /* الصفّ الأمامي من البيوت — أكبر حجماً لإيحاء العمق */
      houses([[40,238,72,56],[130,252,56,42],[204,232,64,52],[288,256,50,38],
              [500,248,60,46],[578,232,70,56],[670,250,56,44],[746,236,64,52]], .95, 4) +

      /* شارع فرعي أمامي */
      '<path d="M-20 322 Q230 306 440 320 T860 312" stroke="#0b2135" stroke-width="22" fill="none" opacity=".9"/>' +

      /* أشجار زيتون */
      trees([[20,216],[176,212],[300,208],[356,214],[470,208],[540,212],[630,208],[724,212],[806,216],
             [88,304],[264,300],[418,306],[586,302],[706,304]]) +
    '</svg>';
  }

  /** مجموعة بيوت حجرية بنوافذ مضاءة */
  function houses(spec, opacity, winCount) {
    return spec.map(function (h) {
      var x = h[0], y = h[1], w = h[2], ht = h[3], win = '';
      for (var i = 0; i < winCount; i++) {
        var cx = x + 9 + (i % 2) * (w - 28);
        var cy = y + 11 + Math.floor(i / 2) * 19;
        if (cy + 12 > y + ht) break;
        win += '<rect x="' + cx + '" y="' + cy + '" width="10" height="12" rx="2" fill="#d4af37" ' +
               'opacity="' + (0.22 + (i % 3) * 0.16).toFixed(2) + '"/>';
      }
      return '<g opacity="' + opacity + '">' +
        '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + ht + '" rx="4" fill="#1a3f66"/>' +
        '<rect x="' + (x - 4) + '" y="' + (y - 7) + '" width="' + (w + 8) + '" height="8" rx="3" fill="#245a89"/>' +
        win + '</g>';
    }).join('');
  }

  /** أشجار زيتون بسيطة تعطي إحساس المكان */
  function trees(spec) {
    return spec.map(function (p) {
      return '<g opacity=".82">' +
        '<rect x="' + (p[0] - 2) + '" y="' + p[1] + '" width="4" height="16" fill="#102b42"/>' +
        '<circle cx="' + p[0] + '" cy="' + (p[1] - 6) + '" r="11" fill="#1d5744" opacity=".9"/>' +
        '<circle cx="' + (p[0] - 8) + '" cy="' + (p[1] + 1) + '" r="7.5" fill="#1d5744" opacity=".72"/>' +
        '<circle cx="' + (p[0] + 8) + '" cy="' + (p[1] + 1) + '" r="7.5" fill="#1d5744" opacity=".72"/>' +
      '</g>';
    }).join('');
  }

  /** طبقة أيقونات المؤسسات فوق الخريطة */
  function poiLayer(s) {
    return D.LOCATIONS.map(function (loc) {
      var list = global.SCENARIOS.filter(function (sc) { return sc.loc === loc.id; });
      var left = list.filter(function (sc) { return !s.completed[sc.id]; }).length;
      var done = left === 0;
      return '<button class="poi ' + (done ? 'done' : 'pulse') + '" data-loc="' + loc.id + '" ' +
        'style="inset-inline-start:' + loc.x + '%;top:' + loc.y + '%" ' +
        'title="' + esc(t(loc.desc)) + '">' +
        '<span class="poi-badge">' + loc.emoji +
          '<span class="poi-count">' + (done ? '✓' : left) + '</span></span>' +
        '<span class="poi-label">' + esc(t(loc.name)) + '</span>' +
      '</button>';
    }).join('');
  }

  /* ═══════════════════════════════════════════════════════════════
     4) الأوسمة ولوحة المتصدّرين
     ═══════════════════════════════════════════════════════════════ */

  function badgesCard(s) {
    return '<section class="card card-soft">' +
      '<div class="section-title">🏅 ' + esc(t('badges')) +
        ' <span class="chip">' + frac(s.badges.length, D.BADGES.length) + '</span></div>' +
      '<p class="section-sub">' + esc(t('badgesSub')) + '</p>' +
      '<div class="badges-grid">' + D.BADGES.map(function (b) {
        var got = s.badges.indexOf(b.id) !== -1;
        return '<div class="badge' + (got ? ' earned' : '') + '">' +
          '<div class="b-icon">' + (got ? b.icon : '🔒') + '</div>' +
          '<div class="b-name">' + esc(t(b.name)) + '</div>' +
          '<div class="b-desc">' + esc(t(b.desc)) + '</div>' +
        '</div>'; }).join('') +
      '</div></section>';
  }

  /**
   * لوحة المتصدّرين: زملاء افتراضيون بنقاط ثابتة (base) + تذبذب
   * مشتقّ من طول اسم اللاعب، حتى يبقى الترتيب مستقرّاً عبر الجلسات.
   */
  function leaderboardCard(s) {
    var myScore = E.leaderboardScore(s);
    var rows = D.CLASSMATES.map(function (c, i) {
      return { name: t(c), score: c.base + ((s.name.length * 37 + i * 53) % 120), me: false };
    });
    rows.push({ name: s.name + ' (' + t('you') + ')', score: myScore, me: true });
    rows.sort(function (a, b) { return b.score - a.score; });

    return '<section class="card card-soft">' +
      '<div class="section-title">📊 ' + esc(t('leaderboard')) + '</div>' +
      '<p class="section-sub">' + esc(t('leaderboardSub')) + '</p>' +
      rows.map(function (r, i) {
        return '<div class="lb-row' + (r.me ? ' me' : '') + '">' +
          '<span class="lb-rank">' + (i + 1) + '</span>' +
          '<span class="lb-name">' + esc(r.name) + '</span>' +
          '<span class="lb-score">' + num(r.score) + '</span>' +
        '</div>'; }).join('') +
    '</section>';
  }

  /* ═══════════════════════════════════════════════════════════════
     5) نافذة السيناريو
     ═══════════════════════════════════════════════════════════════ */

  /** قائمة مهام مؤسسة عند الضغط على أيقونتها في الخريطة */
  function locationModal(loc, s) {
    var list = global.SCENARIOS.filter(function (sc) { return sc.loc === loc.id; });
    return modalShell(loc.emoji, t(loc.name), t(loc.desc),
      list.map(function (sc) {
        var done = !!s.completed[sc.id];
        return '<button class="option" data-scenario="' + sc.id + '"' + (done ? ' disabled' : '') + '>' +
          '<span class="opt-key">' + sc.emoji + '</span>' +
          '<span class="grow"><b>' + esc(t(sc.title)) + '</b>' +
            '<div class="txt-dim" style="font-size:.8rem">' + esc(t(sc.brief)) + '</div></span>' +
          '<span class="chip ' + (done ? 'chip-good' : 'chip-info') + '">' +
            esc(done ? t('doneTask') + ' ✓' : t('openTask')) + '</span>' +
        '</button>'; }).join('') , '');
  }

  /** خطوة داخل سيناريو: نصّ الموقف + الخيارات (+ أداة تفاعلية اختيارية) */
  function scenarioStep(sc, stepIndex, s) {
    var step = sc.steps[stepIndex];
    var comp = D.COMPETENCIES[sc.competency];
    var body =
      '<div class="steps">' + sc.steps.map(function (_, i) {
        return '<i class="' + (i < stepIndex ? 'done' : i === stepIndex ? 'on' : '') + '"></i>';
      }).join('') + '</div>' +
      (step.widget === 'payslip' ? payslipWidget(s) : '') +
      (step.widget === 'loanCompare' ? loanWidget() : '') +
      '<div class="scenario-text">' + t(step.text) + '</div>' +
      '<div class="section-title" style="font-size:.95rem">❓ ' + esc(t('whatDoYouDo')) + '</div>' +
      '<div class="options mt-14" id="optList">' +
        step.options.map(function (o, i) {
          return '<button class="option" data-opt="' + i + '">' +
            '<span class="opt-key">' + String.fromCharCode(65 + i) + '</span>' +
            '<span class="grow">' + esc(t(o.text)) + '</span></button>';
        }).join('') +
      '</div>' +
      '<div id="fbZone"></div>';

    return modalShell(sc.emoji, t(sc.title),
      comp.icon + ' ' + t('competency') + ': ' + t(comp.name), body,
      '<button id="btnNext" class="btn btn-gold hidden">' + esc(t('continueBtn')) + ' ←</button>');
  }

  /**
   * مبدّل لغة مصغّر يُوضع داخل رأس كل نافذة.
   * ضروري لأنّ خلفية النافذة تحجب مبدّل اللغة في الشريط العلوي،
   * والمطلوب أن يبقى التبديل متاحاً في أيّ لحظة — حتى في منتصف سيناريو.
   */
  function langMini() {
    var cur = global.I18N.getLang();
    return '<div class="lang-switch lang-mini">' + global.I18N.list().map(function (l) {
      return '<button data-lang="' + l.code + '" aria-pressed="' + (l.code === cur) + '">' +
             esc(l.short) + '</button>'; }).join('') + '</div>';
  }

  function modalShell(icon, title, sub, body, foot) {
    return '<div class="modal-backdrop" id="mBack"><div class="modal" role="dialog" aria-modal="true">' +
      '<div class="modal-head">' +
        '<div class="mh-icon">' + icon + '</div>' +
        '<div class="grow"><h3>' + esc(title) + '</h3><p>' + esc(sub) + '</p></div>' +
        langMini() +
        '<button class="modal-close" id="mClose" aria-label="' + esc(t('close')) + '">✕</button>' +
      '</div>' +
      '<div class="modal-body">' + body + '</div>' +
      (foot ? '<div class="modal-foot"><span class="txt-muted" style="font-size:.74rem">' +
              esc(t('backToMap')) + '</span>' + foot + '</div>' : '') +
    '</div></div>';
  }

  /** التغذية الراجعة بعد اختيار الطالب */
  function feedbackBox(opt, sc) {
    var cls = opt.quality === 'good' ? 'ok' : opt.quality === 'mid' ? 'mid' : 'bad';
    var head = opt.quality === 'good' ? '✅ ' + t('correct')
             : opt.quality === 'mid'  ? '🟡 ' + t('partial')
             :                          '❌ ' + t('wrong');
    return '<div class="feedback ' + cls + '">' +
      '<h4>' + esc(head) + '</h4>' +
      '<p>' + t(opt.feedback) + '</p>' +
      (opt.rule ? '<div class="rule"><b>📌 ' + esc(t('whyRule')) + '</b>' + t(opt.rule) + '</div>' : '') +
      impactChips(opt.fx || {}) +
    '</div>';
  }

  /** ترجمة أثر القرار إلى شارات مرئية */
  function impactChips(fx) {
    var map = [
      ['balance', '💰', t('mBalance'), true],
      ['savings', '🏦', t('savings'), true],
      ['debt',    '📉', t('loans'), false],
      ['monthly', '🔁', t('fixedCosts'), false],
      ['iq',      '🧠', t('mIQ'), true],
      ['wellness','🌿', t('mWellness'), true],
      ['stress',  '😰', t('stressLabel'), false],
      ['credit',  '📊', t('creditImpact'), true]
    ];
    var chips = map.filter(function (m) { return fx[m[0]]; }).map(function (m) {
      var v = fx[m[0]];
      var positive = m[3] ? v > 0 : v < 0;   /* بعض المؤشّرات ارتفاعها سيّئ */
      var sign = v > 0 ? '+' : '−';
      var isMoney = ['balance', 'savings', 'debt', 'monthly'].indexOf(m[0]) !== -1;
      var val = isMoney ? Math.abs(Math.round(v)).toLocaleString('en-US') + ' ₪'
                        : Math.abs(Math.round(v));
      return '<span class="impact ' + (positive ? 'up' : 'down') + '">' + m[1] + ' ' +
             esc(m[2]) + ' <span class="num">' + sign + val + '</span></span>';
    }).join('');
    return chips ? '<div class="impacts">' + chips + '</div>' : '';
  }

  /* ─────────────── أدوات تفاعلية داخل السيناريوهات ─────────────── */

  /** قسيمة راتب حقيقية محسوبة من معطيات اللاعب نفسه */
  function payslipWidget(s) {
    var p = profileOf(s);
    var slip = E.computePayslip(s.gross, p.creditPoints);
    var row = function (label, why, val, cls) {
      return '<tr class="' + (cls || '') + '"><td>' + esc(label) +
             (why ? '<span class="why">' + esc(why) + '</span>' : '') +
             '</td><td>' + money(val) + '</td></tr>';
    };
    var L = global.I18N.getLang() === 'he';
    return '<div class="payslip">' +
      '<div class="payslip-head"><b>🧾 ' + (L ? 'תלוש שכר' : 'قسيمة راتب — תלוש שכר') + '</b>' +
        '<small>' + esc(s.name) + ' · ' + esc(t(p.name)) + '</small></div>' +
      '<table><tbody>' +
        row(L ? 'שכר ברוטו' : 'الراتب الإجمالي (ברוטו)', '', slip.gross) +
        row(L ? 'מס הכנסה' : 'ضريبة الدخل (מס הכנסה)',
            L ? 'לאחר ' + p.creditPoints + ' נקודות זיכוי'
              : 'بعد خصم ' + p.creditPoints + ' نقاط تزكية', -slip.tax, 'ded') +
        row(L ? 'ביטוח לאומי' : 'التأمين الوطني (ביטוח לאומי)',
            L ? '0.4% עד הסף, 7% מעליו' : '0.4% حتى العتبة و7% فوقها', -slip.ni, 'ded') +
        row(L ? 'מס בריאות' : 'ضريبة الصحّة (מס בריאות)',
            L ? '3.1% / 5%' : '3.1% تحت العتبة و5% فوقها', -slip.health, 'ded') +
        row(L ? 'הפרשה לפנסיה (עובד)' : 'خصم المعاش (עובד 6%)',
            L ? 'נחסך עבורך — לא מס' : 'يُدَّخر لك — ليس ضريبة', -slip.pension, 'ded') +
        '<tr class="sum"><td>' + (L ? 'נטו לתשלום' : 'الصافي المستحقّ (נטו)') +
          '</td><td>' + money(slip.net) + '</td></tr>' +
      '</tbody></table>' +
      '<div class="payslip-head" style="border-top:1px solid var(--border);border-bottom:none">' +
        '<small>' + (L ? 'המעסיק מפקיד בנוסף' : 'يودع المشغّل إضافةً لذلك') + ': ' +
        (L ? 'פנסיה' : 'معاش') + ' ' + money(slip.employerPension) + ' · ' +
        (L ? 'פיצויים' : 'تعويضات') + ' ' + money(slip.employerSeverance) + '</small></div>' +
    '</div>';
  }

  /** مقارنة عرضَي تمويل بالأرقام الحقيقية (استهلاك متساوٍ) */
  function loanWidget() {
    var L = global.I18N.getLang() === 'he';
    var a = E.loanCost(24000, 0.11, 60);
    var b = E.loanCost(24000, 0.085, 36);
    var col = function (title, o, best) {
      return '<div class="profile-stat" style="' + (best ? 'border-color:var(--good)' : '') + '">' +
        '<b style="font-size:.9rem">' + esc(title) + '</b>' +
        '<div style="font-size:.78rem;line-height:2;margin-top:6px">' +
          (L ? 'החזר חודשי' : 'القسط الشهري') + ': ' + money(o.monthly) + '<br>' +
          (L ? 'סה״כ תשלום' : 'إجمالي المدفوع') + ': ' + money(o.total) + '<br>' +
          '<span class="' + (best ? 'txt-good' : 'txt-bad') + '">' +
          (L ? 'ריבית' : 'الفوائد') + ': ' + money(o.interest) + '</span>' +
        '</div></div>';
    };
    return '<div class="profile-grid mb-16">' +
      col((L ? 'הצעה א׳ · 60 ת׳ · 11%' : 'العرض أ · 60 قسطاً · 11%'), a, false) +
      col((L ? 'הצעה ב׳ · 36 ת׳ · 8.5%' : 'العرض ب · 36 قسطاً · 8.5%'), b, true) +
    '</div>';
  }

  /* ═══════════════════════════════════════════════════════════════
     6) تقرير نهاية الشهر
     ═══════════════════════════════════════════════════════════════ */

  function monthReport(log, s) {
    var L = global.I18N.getLang() === 'he';
    var line = function (label, val, neg) {
      return '<tr><td>' + esc(label) + '</td><td class="' + (neg ? 'txt-bad' : 'txt-good') + '">' +
             money(val) + '</td></tr>'; };
    var body = '<div class="payslip"><table><tbody>' +
      line(L ? 'הכנסה נטו' : 'الدخل الصافي', log.income) +
      line(L ? 'הוצאות קבועות והתחייבויות' : 'مصروفات ثابتة والتزامات', -log.spend, true) +
      (log.overdraftInterest ? line(L ? 'ריבית מינוס' : 'فائدة السحب المكشوف', -log.overdraftInterest, true) : '') +
      (log.debtInterest ? line(L ? 'ריבית על חוב' : 'فائدة الدَّين', -log.debtInterest, true) : '') +
      (log.debtPaid ? line(L ? 'החזר קרן החוב' : 'سداد أصل الدَّين', -log.debtPaid, true) : '') +
      (log.savingsYield ? line(L ? 'תשואת חיסכון' : 'عائد المدّخرات', log.savingsYield) : '') +
      line(L ? 'התייקרות עקב אינפלציה' : 'ارتفاع المصروفات بسبب التضخّم', -log.inflation, true) +
      '<tr class="sum"><td>' + (L ? 'יתרה בסוף החודש' : 'الرصيد في نهاية الشهر') +
        '</td><td>' + money(log.endBalance) + '</td></tr>' +
      '</tbody></table></div>' +
      '<p class="txt-dim mt-14" style="font-size:.84rem">' +
        (L ? 'שימו לב: האינפלציה מייקרת את ההוצאות הקבועות מדי חודש גם אם ההתנהגות שלכם לא השתנתה.'
           : 'انتبه: التضخّم يرفع مصروفاتك الثابتة كلّ شهر حتى لو لم يتغيّر سلوكك إطلاقاً.') +
      '</p>';
    return modalShell('📅', t('monthReport') + ' — ' + t('month') + ' ' + log.month,
      t('endMonthHint'), body,
      '<button id="mClose2" class="btn btn-gold">' + esc(t('continueBtn')) + '</button>');
  }

  /* ═══════════════════════════════════════════════════════════════
     7) التقرير الختامي
     ═══════════════════════════════════════════════════════════════ */

  function renderSummary(s) {
    var ev = E.evaluate(s);
    var comps = E.competencyBreakdown(s);

    $('#screen-summary').innerHTML = '<div class="app-shell">' +
      '<div class="report-hero mt-20">' +
        '<div class="report-grade">' + ev.grade.letter + '</div>' +
        '<div class="chip mb-16">' + esc(t('finalScore')) + ': ' + frac(ev.total, 100) + '</div>' +
        '<h2 class="report-title">' + esc(t(ev.grade.title)) + ' — ' + esc(s.name) + '</h2>' +
        '<p class="report-text">' + esc(t(ev.grade.text)) + '</p>' +
      '</div>' +

      '<div class="grid-3 mb-22">' +
        summaryTile('💰', t('mBalance'), money(s.balance)) +
        summaryTile('🏦', t('savings'), money(s.savings)) +
        summaryTile('📉', t('loans'), money(s.debt)) +
        summaryTile('🧠', t('mIQ'), num(s.iq)) +
        summaryTile('📊', t('mCredit'), frac(Math.round(s.credit), 1000)) +
        summaryTile('🌿', t('mWellness'), frac(Math.round(s.wellness), 100)) +
      '</div>' +

      '<div class="grid-2 mb-22">' +
        '<section class="card card-soft">' +
          '<div class="section-title">🎯 ' + esc(t('skillsMap')) + '</div>' +
          '<p class="section-sub">' + esc(t('skillsMapSub')) + '</p>' +
          comps.map(function (c) {
            var meta = D.COMPETENCIES[c.key];
            var accent = c.pct >= 75 ? '#3fbf7f' : c.pct >= 50 ? '#e0a23f' : '#e05c5c';
            return '<div class="skill-row">' +
              '<div class="skill-head"><span class="skill-name">' + meta.icon + ' ' +
                esc(t(meta.name)) + '</span>' +
                '<span class="skill-val">' + num(c.pct) + '%</span></div>' +
              '<div class="bar" style="--accent:' + accent + '"><i style="width:' + c.pct + '%"></i></div>' +
            '</div>'; }).join('') +
        '</section>' +
        badgesCard(s) +
      '</div>' +

      '<section class="card card-soft mb-22">' +
        '<div class="section-title">📝 ' + esc(t('decisionLog')) + '</div>' +
        '<p class="section-sub">' + num(s.decisions.length) + ' ' + esc(t('decisionsMade')) + '</p>' +
        s.decisions.map(function (d) {
          var cls = d.quality === 'good' ? 'ok' : d.quality === 'mid' ? 'mid' : 'bad';
          var ico = d.quality === 'good' ? '✅' : d.quality === 'mid' ? '🟡' : '❌';
          return '<div class="log-item ' + cls + '"><span>' + ico + '</span>' +
            '<span class="grow">' + esc(t(d.title)) +
              '<small>' + esc(t(d.text)) + '</small></span></div>';
        }).join('') +
      '</section>' +

      '<div class="row wrap no-print" style="justify-content:center;gap:12px">' +
        /* ما دامت هناك مهام لم تُنجَز، نُبقي باب العودة إلى البلدة مفتوحاً */
        (s.flags.allScenariosDone ? '' :
          '<button id="btnBack" class="btn btn-gold">🗺️ ' + esc(t('backToTown')) + '</button>') +
        '<button id="btnAgain" class="btn btn-ghost">🔄 ' + esc(t('playAgain')) + '</button>' +
        '<button id="btnPrint" class="btn btn-ghost">🖨️ ' + esc(t('printReport')) + '</button>' +
        '<button id="btnCopy" class="btn btn-ghost">📋 ' + esc(t('shareClass')) + '</button>' +
      '</div>' +
      '<p class="txt-muted center mt-20" style="font-size:.74rem">' + esc(t('poweredBy')) + '</p>' +
    '</div>';
  }

  function summaryTile(icon, label, value) {
    return '<div class="metric" style="--accent:#d4af37">' +
      '<div class="metric-top"><span class="metric-label">' + esc(label) + '</span>' +
      '<span class="metric-icon">' + icon + '</span></div>' +
      '<div class="metric-value">' + value + '</div></div>';
  }

  /* ═══════════════════════════════════════════════════════════════
     8) إشعارات الأوسمة
     ═══════════════════════════════════════════════════════════════ */

  function toast(badge) {
    var zone = $('#toastZone');
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span class="t-icon">' + badge.icon + '</span>' +
      '<span><b>🏅 ' + esc(t('newBadge')) + '</b><small>' + esc(t(badge.name)) + '</small></span>';
    zone.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 320);
    }, 4200);
  }

  global.UI = {
    $: $, esc: esc, money: money, num: num, frac: frac,
    renderOnboarding: renderOnboarding, profileCard: profileCard,
    renderGame: renderGame, renderSummary: renderSummary,
    locationModal: locationModal, scenarioStep: scenarioStep,
    feedbackBox: feedbackBox, monthReport: monthReport,
    toast: toast
  };
})(window);
