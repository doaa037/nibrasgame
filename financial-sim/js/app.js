/* ═══════════════════════════════════════════════════════════════════
   app.js — التشغيل، التوجيه، وربط الأحداث
   ───────────────────────────────────────────────────────────────────
   نمط العمل: حالة واحدة (ctx) تصف الشاشة الحالية والنافذة المفتوحة،
   ودالة render() واحدة تُعيد رسم ما يلزم. كل الأحداث تُلتقط بالتفويض
   (Event Delegation) من مستوى المستند، فلا حاجة لإعادة ربط المستمعين
   بعد كل إعادة رسم.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var I = global.I18N, E = global.ENGINE, U = global.UI, D = global.DATA;

  /* سياق التطبيق: الشاشة الحالية + النافذة المفتوحة + مسوّدة التسجيل */
  var ctx = {
    screen: 'onboarding',       /* onboarding | game | summary */
    name: '', classroom: '',
    drawnProfile: null,
    state: null,
    modal: null                 /* {type:'location'|'scenario'|'month', ...} */
  };

  /* ═══════════════════════════════════════════════════════════════
     التوجيه وإعادة الرسم
     ═══════════════════════════════════════════════════════════════ */

  function show(screen) {
    ctx.screen = screen;
    ['onboarding', 'game', 'summary'].forEach(function (id) {
      document.getElementById('screen-' + id).classList.toggle('hidden', id !== screen);
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
    render();
  }

  function render() {
    if (ctx.screen === 'onboarding') U.renderOnboarding(ctx);
    else if (ctx.screen === 'game')  U.renderGame(ctx.state, ctx);
    else                             U.renderSummary(ctx.state);
    renderModal();
  }

  /** إعادة رسم النافذة المفتوحة (إن وُجدت) اعتماداً على ctx.modal */
  function renderModal() {
    var root = document.getElementById('modalRoot');
    if (!ctx.modal) { root.innerHTML = ''; return; }

    if (ctx.modal.type === 'location') {
      var loc = D.LOCATIONS.filter(function (l) { return l.id === ctx.modal.locId; })[0];
      root.innerHTML = U.locationModal(loc, ctx.state);

    } else if (ctx.modal.type === 'scenario') {
      var sc = scenarioById(ctx.modal.scId);
      root.innerHTML = U.scenarioStep(sc, ctx.modal.step, ctx.state);
      /* إن كان الطالب قد أجاب على هذه الخطوة، نُعيد عرض التغذية الراجعة */
      if (ctx.modal.picked !== null && ctx.modal.picked !== undefined) {
        paintAnswer(sc, ctx.modal.step, ctx.modal.picked);
      }

    } else if (ctx.modal.type === 'month') {
      root.innerHTML = U.monthReport(ctx.modal.log, ctx.state);
    }
  }

  function closeModal() { ctx.modal = null; renderModal(); }
  function scenarioById(id) {
    return global.SCENARIOS.filter(function (s) { return s.id === id; })[0];
  }

  /* ═══════════════════════════════════════════════════════════════
     منطق السيناريو
     ═══════════════════════════════════════════════════════════════ */

  /** تلوين الخيارات وإظهار صندوق التغذية الراجعة (عرض فقط، بلا آثار) */
  function paintAnswer(sc, stepIndex, pickedIndex) {
    var step = sc.steps[stepIndex];
    var opt = step.options[pickedIndex];
    var nodes = document.querySelectorAll('#optList .option');

    Array.prototype.forEach.call(nodes, function (node, i) {
      node.disabled = true;
      if (i === pickedIndex) {
        node.classList.add('picked', opt.quality === 'good' ? 'correct'
                                   : opt.quality === 'bad' ? 'wrong' : 'picked');
      } else {
        node.classList.add('dimmed');
        /* نكشف للطالب الخيار الأمثل حتى لو لم يخترْه — التعلّم من المقارنة */
        if (step.options[i].quality === 'good' && opt.quality !== 'good') {
          node.classList.remove('dimmed');
          node.classList.add('correct');
        }
      }
    });

    document.getElementById('fbZone').innerHTML = U.feedbackBox(opt, sc);
    var next = document.getElementById('btnNext');
    if (next) {
      next.classList.remove('hidden');
      next.textContent = (stepIndex + 1 < sc.steps.length ? I.t('continueBtn') : I.t('backToMap')) + ' ←';
    }
  }

  /** اختيار الطالب: تطبيق الأثر على الحالة مرّة واحدة فقط */
  function choose(pickedIndex) {
    if (ctx.modal.picked !== null && ctx.modal.picked !== undefined) return;  /* منع التكرار */
    var sc = scenarioById(ctx.modal.scId);
    var opt = sc.steps[ctx.modal.step].options[pickedIndex];

    E.applyOption(ctx.state, sc, ctx.modal.step, opt);
    ctx.modal.picked = pickedIndex;

    awardBadges();
    E.save(ctx.state);

    paintAnswer(sc, ctx.modal.step, pickedIndex);
    refreshMetrics();
  }

  /** الانتقال للخطوة التالية أو إنهاء السيناريو */
  function nextStep() {
    var sc = scenarioById(ctx.modal.scId);
    if (ctx.modal.step + 1 < sc.steps.length) {
      ctx.modal.step += 1;
      ctx.modal.picked = null;
      renderModal();
      return;
    }
    E.completeScenario(ctx.state, sc.id, global.SCENARIOS);
    awardBadges();
    E.save(ctx.state);
    closeModal();
    render();

    /* إن أُنجزت كل المهام، ننتقل تلقائياً إلى التقرير الختامي */
    if (ctx.state.flags.allScenariosDone) setTimeout(function () { show('summary'); }, 700);
  }

  function awardBadges() {
    E.checkBadges(ctx.state).forEach(function (b) { U.toast(b); });
  }

  /**
   * تحديث لوحة اللعبة خلف النافذة المفتوحة مع وميض على المؤشّرات.
   * نُعيد رسم الشاشة كاملةً (لا النافذة) ونُعيد موضع التمرير كما كان،
   * لأنّ النافذة تعيش في حاوية مستقلّة (#modalRoot) فلا تتأثّر.
   */
  function refreshMetrics() {
    if (ctx.screen !== 'game') return;
    var scrollY = window.scrollY;
    U.renderGame(ctx.state, ctx);
    window.scrollTo(0, scrollY);
    var m = document.getElementById('metrics');
    if (m) Array.prototype.forEach.call(m.children, function (c) { c.classList.add('flash'); });
  }

  /* ═══════════════════════════════════════════════════════════════
     الإجراءات العامّة
     ═══════════════════════════════════════════════════════════════ */

  function drawProfile() {
    var pool = D.PROFILES.filter(function (p) {
      return !ctx.drawnProfile || p.id !== ctx.drawnProfile.id;
    });
    ctx.drawnProfile = pool[Math.floor(Math.random() * pool.length)];
    captureInputs();
    U.renderOnboarding(ctx);
  }

  /** حفظ ما كتبه الطالب قبل إعادة الرسم (تبديل لغة أو سحب بطاقة) */
  function captureInputs() {
    if (ctx.screen !== 'onboarding') return;
    var n = document.getElementById('inName'), c = document.getElementById('inClass');
    if (n) ctx.name = n.value.trim();
    if (c) ctx.classroom = c.value.trim();
  }

  function startGame() {
    captureInputs();
    if (!ctx.name) {
      var err = document.getElementById('nameErr');
      if (err) { err.classList.remove('hidden'); err.classList.add('anim-up'); }
      var input = document.getElementById('inName');
      if (input) input.focus();
      return;
    }
    ctx.state = E.createState(ctx.name, ctx.classroom, ctx.drawnProfile);
    E.save(ctx.state);
    show('game');
  }

  function endMonth() {
    var log = E.advanceMonth(ctx.state);
    awardBadges();
    E.save(ctx.state);
    ctx.modal = { type: 'month', log: log };
    render();
  }

  function resetAll() {
    if (!confirm(I.t('confirmReset'))) return;
    E.clear();
    ctx.state = null; ctx.drawnProfile = null; ctx.modal = null;
    show('onboarding');
  }

  /** نصّ مختصر يُنسخ للمعلّم أو يُلصق في مجموعة الصف */
  function copyResult() {
    var s = ctx.state, ev = E.evaluate(s);
    var lines = [
      I.t('appName') + ' — ' + I.t('finalReport'),
      s.name + (s.classroom ? ' · ' + s.classroom : ''),
      I.t('finalScore') + ': ' + ev.total + '/100 (' + ev.grade.letter + ')',
      I.t('mIQ') + ': ' + s.iq + ' | ' + I.t('mCredit') + ': ' + Math.round(s.credit),
      I.t('mBalance') + ': ' + Math.round(s.balance) + ' ₪ | ' +
        I.t('savings') + ': ' + Math.round(s.savings) + ' ₪ | ' +
        I.t('loans') + ': ' + Math.round(s.debt) + ' ₪',
      I.t('badges') + ': ' + s.badges.length + '/' + D.BADGES.length
    ];
    var text = lines.join('\n');
    var done = function () {
      var b = document.getElementById('btnCopy');
      if (b) { b.textContent = I.t('copied'); setTimeout(function () { render(); }, 1600); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else fallbackCopy(text, done);
  }

  function fallbackCopy(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) {}
    ta.remove();
  }

  /* ═══════════════════════════════════════════════════════════════
     ربط الأحداث بالتفويض
     ═══════════════════════════════════════════════════════════════ */

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-lang],[data-loc],[data-scenario],[data-opt],button') : null;
    if (!el) return;

    /* تبديل اللغة — يعمل في كل الشاشات وداخل النوافذ */
    if (el.hasAttribute('data-lang')) {
      captureInputs();
      I.setLang(el.getAttribute('data-lang'));
      return;
    }

    switch (el.id) {
      case 'btnDraw':   drawProfile(); return;
      case 'btnStart':  startGame(); return;
      case 'btnMonth':  endMonth(); return;
      case 'btnFinish': closeModal(); show('summary'); return;
      case 'btnReset':  resetAll(); return;
      case 'btnBack':   show('game'); return;
      case 'btnAgain':  resetAll(); return;
      case 'btnPrint':  window.print(); return;
      case 'btnCopy':   copyResult(); return;
      case 'btnNext':   nextStep(); return;
      case 'mClose':
      case 'mClose2':   closeModal(); return;
    }

    if (el.hasAttribute('data-loc')) {
      ctx.modal = { type: 'location', locId: el.getAttribute('data-loc') };
      renderModal(); return;
    }
    if (el.hasAttribute('data-scenario')) {
      ctx.modal = { type: 'scenario', scId: el.getAttribute('data-scenario'), step: 0, picked: null };
      renderModal(); return;
    }
    if (el.hasAttribute('data-opt')) {
      choose(parseInt(el.getAttribute('data-opt'), 10)); return;
    }
  });

  /* إغلاق النافذة بالنقر على الخلفية أو بمفتاح Escape */
  document.addEventListener('mousedown', function (ev) {
    if (ev.target && ev.target.id === 'mBack') closeModal();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && ctx.modal) closeModal();
    if (ev.key === 'Enter' && ctx.screen === 'onboarding' && ctx.drawnProfile) startGame();
  });

  /* إعادة الرسم الكامل عند تبديل اللغة */
  I.onChange(function () { render(); });

  /* ═══════════════════════════════════════════════════════════════
     الإقلاع
     ═══════════════════════════════════════════════════════════════ */

  function boot() {
    I.setLang(I.detect());          /* يضبط lang/dir على <html> */
    var saved = E.load();           /* استئناف جلسة سابقة إن وُجدت */
    if (saved) {
      ctx.state = saved;
      ctx.name = saved.name;
      ctx.classroom = saved.classroom;
      ctx.drawnProfile = D.PROFILES.filter(function (p) { return p.id === saved.profileId; })[0];
      show(saved.flags.allScenariosDone ? 'summary' : 'game');
    } else {
      drawProfileSilently();
      show('onboarding');
    }
  }

  /** سحب بطاقة أولى تلقائياً حتى لا تكون الشاشة فارغة */
  function drawProfileSilently() {
    ctx.drawnProfile = D.PROFILES[Math.floor(Math.random() * D.PROFILES.length)];
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
