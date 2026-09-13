/* ═══════════════════════════════════════════════════════════════════
   main.js — المنسّق العام
   ───────────────────────────────────────────────────────────────────
   يجمع الطبقات ولا ينفّذ منطقها: العالم ثلاثي الأبعاد (core/world)،
   المحاكاة الاقتصادية (sim)، المحتوى التربوي (content)، والواجهة (ui).
   كل طبقة تجهل الأخرى قدر الإمكان، وهذا الملفّ هو نقطة اللقاء الوحيدة.
   ═══════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { Engine3D } from './core/engine3d.js';
import { Input } from './core/input.js';
import { Town } from './world/town.js';
import { Player, buildFigure } from './world/player.js';
import { STYLES, SKINS, HAIRS, SCARFS, SHIRTS, PANTS, BAGS, randomAppearance, normalizeAppearance, hex } from './content/avatar.js';
import { PlayerCar, Bus } from './world/vehicles.js';
import { createMaterials } from './world/materials.js';
import { Environment } from './world/environment.js';
import { Interiors } from './world/interior.js';
import { ShoppingUI } from './ui/shopping.js';
import { createCart, addToCart, removeFromCart, evaluateCart } from './sim/shopping.js';
import { WEEKLY_MISSION } from './content/shop.data.js';

import { Dialog } from './ui/dialog.js';
import { HUD, Toasts } from './ui/hud.js';
import { Markers } from './ui/markers.js';
import { Panels, renderWidget } from './ui/panels.js';
import { $, esc } from './ui/util.js';

import * as I18N from './content/i18n.js';
import { t } from './content/i18n.js';
import { WORLD, PLAYER, CAR, TIME, ECONOMY } from './content/config.js';
import { LOCATIONS, BUS_STOPS } from './content/world.data.js';
import { SCENES } from './content/dialogues.js';
import { servicesFor } from './content/services.js';
import { checkBadges, activeQuest, QUESTS } from './content/quests.js';

import * as State from './sim/state.js';
import { monthlyCycle, unitsToKm, fuelPrice, round } from './sim/economy.js';
import { createActions } from './sim/actions.js';
import { pickEvent, EVENT_DISTANCE, EVENT_CHANCE, EVENT_COOLDOWN_MIN } from './sim/events.js';

/* ═══════════════════════════════════════════════════════════════════
   اللعبة
   ═══════════════════════════════════════════════════════════════════ */
class Game {
  constructor(state) {
    this.state = state;
    this.state.inCar = false;

    /* ── العالم ── */
    this.engine = new Engine3D($('#game-canvas'));
    /* الترتيب مهمّ: الخامات أوّلاً (تُولَّد مرّة)، ثمّ البيئة (السماء
       وخريطة الانعكاسات)، ثمّ البلدة التي تستهلك الاثنتين */
    this.materials = createMaterials();
    this.environment = new Environment(this.engine);
    this.town = new Town(this.engine.scene, this.materials);
    this.environment.setLampPositions(this.town.lampPositions);
    /* دواخل المؤسسات تُبنى مرّة عند الإقلاع بعيداً عن البلدة */
    this.interiors = new Interiors(this.engine.scene, this.materials);
    this.inside = null;             /* الغرفة الحالية أو null في الخارج */
    this.cart = null;
    this.nearestHotspot = null;
    this.transitioning = false;
    this.fade = $('#fade');
    /* نبدأ على الرصيف أمام البيت لا في منتصف الشارع: أوّل لقطة
       يراها الطالب يجب أن تُظهر البلدة، لا الأسفلت. */
    const spawn = this.town.doors.home;
    this.player = new Player(this.engine.scene, this.materials, { x: spawn.x, z: spawn.z - 4 }, { x: 0, z: 0 }, state.appearance);
    this.car = new PlayerCar(this.engine.scene, this.materials);
    this.bus = new Bus(this.engine.scene, this.materials);
    this.input = new Input(window);

    /* ── الواجهة ── */
    this.ui = {
      dialog: new Dialog($('#dialog-root')),
      hud: new HUD($('#hud')),
      toasts: new Toasts($('#toasts')),
      markers: new Markers($('#markers'), this.engine.camera),
      markersInside: new Markers($('#markers-inside'), this.engine.camera)
    };
    this.ui.panels = new Panels(this.ui.dialog);
    this.ui.shop = new ShoppingUI($('#cart-hud'), this.ui.dialog);
    this.ui.markers.build(this.town.markers);

    this.actions = createActions(this);

    /* ── حالة تشغيل داخلية ── */
    this.nearest = null;            /* أقرب هدف تفاعل */
    this.nearestStopId = null;
    this.eventDistance = 0;
    this.minutesSinceEvent = 999;
    this.recentEvents = [];
    this.pendingCar = null;

    this._restoreWorld();
    this._bindInput();
    this._bindLanguage();
    /* الافتتاحية: الكاميرا تهبط من فوق البلدة إلى خلف الشخصية، مع بطاقة
       تعرّف الطالب بيومه الأوّل ومهمّته. تُعرض مرّة واحدة لكل شخصية جديدة. */
    this.intro = this.state.introSeen ? null : { t: 0, dur: 7.5, skipAt: 0.8 };
    if (this.intro) this._showIntroCard();
    this.engine.onUpdate((dt) => this.update(dt));
    this.engine.start();

    this.ui.dialog.onClose = () => this._setFrozen(false);
  }

  /** يعيد بناء ما في العالم اعتماداً على حالة محفوظة */
  _restoreWorld() {
    if (this.state.car) {
      this.car.deliver(this.town.doors.home.x + 8, this.town.doors.home.z, this.state.car.color);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     حلقة التحديث
     ═══════════════════════════════════════════════════════════════ */
  update(dt) {
    if (this.intro) { this._updateIntro(dt); return; }
    const frozen = this.ui.dialog.open || this.transitioning;
    this._setFrozen(frozen);
    const colliders = this.inside ? this.inside.colliders : this.town.colliders;

    if (this.state.inCar && !this.inside) {
      this.car.update(dt, this.input, this.town.colliders, frozen);
      /* اللاعب يركب: نُبقي جسده مخفياً ونثبّته على موضع السيارة */
      this.player.teleport(this.car.position.x, this.car.position.z);
      this.player.update(dt, this.input, [], true);
      this.player.applyCamera(this.engine.camera, dt, this.car.position, this.town.colliders);
      if (!frozen) this._consumeFuel();
    } else {
      this.player.update(dt, this.input, colliders, frozen);
      this.player.applyCamera(this.engine.camera, dt, null, colliders);
    }

    this.bus.update(dt);

    /* الجوّ يتبع ساعة اللعبة: الشمس تتحرّك، والليل يُضيء النوافذ */
    this.environment.setHour(this.state.hour + this.state.minute / 60);
    this.environment.update(dt, this.player.position);
    this.materials.setNight(this.environment.nightFactor);

    if (this.inside) this.ui.markersInside.update(this.engine.camera.position);
    else this.ui.markers.update(this.engine.camera.position);

    if (!frozen) {
      this._advanceTime(dt);
      this._drainEnergy(dt);
      this._checkProximity();
      if (!this.inside) this._maybeTriggerEvent();
    }

    this.ui.hud.update(this.state);
  }

  /* ─────────────── الافتتاحية ─────────────── */
  _updateIntro(dt) {
    const it = this.intro;
    it.t += dt;
    this._setFrozen(true);
    const p = this.player, cam = this.engine.camera;
    /* من علوّ 70 م فوق وسط البلدة إلى موضع كاميرا المتابعة خلف اللاعب */
    const k = Math.min(1, it.t / it.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const yaw = p.camYaw, dist = p.camDistance;
    const end = new THREE.Vector3(p.position.x + Math.sin(yaw) * dist, PLAYER.CAM_HEIGHT + p.camPitch * dist, p.position.z + Math.cos(yaw) * dist);
    const start = new THREE.Vector3(p.position.x * 0.35 + 30, 72, p.position.z * 0.35 + 90);
    cam.position.lerpVectors(start, end, e);
    const look = new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 4, -10), new THREE.Vector3(p.position.x, p.position.y + 1.9, p.position.z), e);
    cam.lookAt(look);
    p.update(dt, this.input, [], true);
    this.environment.setHour(this.state.hour + this.state.minute / 60);
    this.environment.update(dt, this.player.position);
    this.materials.setNight(this.environment.nightFactor);
    this.ui.markers.update(cam.position);
    this.ui.hud.update(this.state);
    if (k >= 1) this._endIntro();
  }

  _showIntroCard() {
    const el = document.createElement('div');
    el.id = 'intro-overlay';
    const goal = QUESTS[0];
    el.innerHTML = `
      <div class="intro-card">
        <div class="intro-chip">${esc(t('hDay'))} 1 · 08:00</div>
        <h2>${esc(t('introHello').replace('{name}', this.state.name))}</h2>
        <p>${esc(t('introBody'))}</p>
        <div class="intro-goal"><b>${esc(t('introFirstGoal'))}</b><span>${esc(t(goal.title))}</span></div>
        <small>${esc(t('introSkip'))}</small>
      </div>`;
    document.body.appendChild(el);
    const skip = () => { if (this.intro && this.intro.t > this.intro.skipAt) this._endIntro(); };
    el.addEventListener('click', skip);
    this._introKey = (e) => { if (!e.repeat) skip(); };
    window.addEventListener('keydown', this._introKey);
  }

  _endIntro() {
    if (!this.intro) return;
    this.intro = null;
    this.state.introSeen = true;
    State.save(this.state);
    window.removeEventListener('keydown', this._introKey);
    const el = $('#intro-overlay');
    if (el) { el.classList.add('out'); setTimeout(() => el.remove(), 600); }
    this._setFrozen(false);
  }

  _setFrozen(v) {
    if (this._frozen === v) return;
    this._frozen = v;
    this.input.setEnabled(!v);
    document.body.classList.toggle('modal-open', v);
  }

  /* ─────────────── الزمن ─────────────── */
  _advanceTime(dt) {
    const minutes = dt * TIME.MINUTES_PER_SECOND;
    this.minutesSinceEvent += minutes;
    const dayOver = State.advanceMinutes(this.state, minutes);

    /* الإيجار يُخصم تلقائياً في يومه — تماماً كأمر ثابت في الواقع */
    if (this.state.day === TIME.RENT_DAY && !this.state.flags.rentChargedThisMonth) {
      this.state.flags.rentChargedThisMonth = true;
      this.state.flags.rentPaid = true;
      State.charge(this.state, ECONOMY.RENT);
      this.ui.toasts.show({ icon: '🏠',
        title: { ar: 'خُصم الإيجار', he: 'שכר הדירה ירד' },
        body:  { ar: `−${ECONOMY.RENT} ₪ · أمر ثابت`, he: `−${ECONOMY.RENT} ₪ · הוראת קבע` } });
      this._afterStateChange();
    }

    if (dayOver) this.endDay();
  }

  /* ─────────────── الطاقة ─────────────── */
  _drainEnergy(dt) {
    /* المشي يستهلك أكثر من القيادة، والركض أكثر من المشي.
       الطاقة ليست زينة: انخفاضها يدفع اللاعب لشراء طعام — وهذا
       بند حقيقي في ميزانيته. */
    const rate = this.state.inCar ? 0.12
               : this.input.run ? 0.75
               : this.player.speed > 0.2 ? 0.42 : 0.10;
    this.state.energy = Math.max(0, this.state.energy - rate * dt);
  }

  /* ─────────────── الوقود ─────────────── */
  _consumeFuel() {
    const units = this.car.consumeDistance();
    if (units <= 0) return;
    const km = unitsToKm(units);
    const consumption = this.state.car?.consumption ?? CAR.CONSUMPTION_PER_KM;
    this.state.fuel = Math.max(0, this.state.fuel - km * consumption);
    this.state.kmDriven += km;
    this.eventDistance += units;

    if (this.state.fuel <= 0 && !this.state.flags.outOfFuelWarned) {
      this.state.flags.outOfFuelWarned = true;
      this.ui.toasts.show({ icon: '⛽',
        title: { ar: 'نفد الوقود', he: 'הדלק אזל' },
        body:  { ar: 'توجّه إلى محطّة الوقود', he: 'סעו לתחנת הדלק' } });
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     القرب والتفاعل
     ═══════════════════════════════════════════════════════════════ */
  _checkProximity() {
    if (this.inside) { this._checkHotspots(); return; }
    let best = null, bestDist = PLAYER.INTERACT_RANGE;

    for (const loc of LOCATIONS) {
      const d = this.player.distanceTo(this.town.doors[loc.id]);
      if (d < bestDist) { bestDist = d; best = { kind: 'location', id: loc.id }; }
    }
    for (const stop of BUS_STOPS) {
      const d = this.player.distanceTo(this.town.doors[stop.id]);
      if (d < bestDist) { bestDist = d; best = { kind: 'busStop', id: stop.id }; }
    }

    this.nearest = best;
    this.nearestStopId = best?.kind === 'busStop' ? best.id : null;

    /* السيارة لها تلميح خاصّ لأنّها تُستخدم بمفتاح مختلف (F) */
    if (this.state.inCar) { this.ui.hud.showPrompt(`<kbd>F</kbd> ${esc(t('pressToExit'))}`); return; }
    if (this.state.car && this.car.distanceTo(this.player.position) < 4) {
      this.ui.hud.showPrompt(`<kbd>F</kbd> ${esc(t('pressToDrive'))}`);
      return;
    }
    if (!best) { this.ui.hud.showPrompt(null); return; }

    const label = best.kind === 'busStop' ? t('locBusStop')
                : t(LOCATIONS.find(l => l.id === best.id).nameKey);
    this.ui.hud.showPrompt(`<kbd>E</kbd> ${esc(t('pressToEnter'))} — ${esc(label)}`);
  }

  interact() {
    if (this.ui.dialog.open || this.transitioning) return;
    if (this.inside) { this._useHotspot(); return; }
    if (!this.nearest) return;
    if (this.nearest.kind === 'busStop') { this.openLocation('busStop'); return; }

    const loc = LOCATIONS.find(l => l.id === this.nearest.id);
    if (!loc.alwaysOpen && !State.isOpenNow(this.state)) {
      this.ui.toasts.show({ icon: '🔒', title: 'closedNow', body: { ar: '', he: '' } });
      return;
    }
    this.state.visited[loc.id] = true;
    /* المؤسسات ذات الداخل يُدخَل إليها فعلاً؛ الباقي (محطّة الوقود) يفتح خدماته مباشرةً */
    if (this.interiors.has(loc.id)) this.enterInterior(loc.id);
    else this.openLocation(loc.id);
  }

  /* ═══════════════════════════════════════════════════════════════
     الدخول إلى المؤسسات والتفاعل داخلها
     ═══════════════════════════════════════════════════════════════ */

  enterInterior(id) {
    this._fade(() => {
      if (this.state.inCar) this.toggleCar();
      const room = this.interiors.enter(id);
      this.inside = room;
      this.environment.setInterior(true);

      /* اللاعب عند الباب من الداخل، والكاميرا خلفه تنظر إلى عمق الغرفة */
      this.player.teleport(room.spawn.x, room.spawn.z);
      this.player.setBounds(room.bounds);
      this.player.camMaxY = room.ceiling - 0.35;
      this._outsideCam = { dist: this.player.camDistance, pitch: this.player.camPitch };
      this.player.facing = Math.PI;
      this.player.camYaw = 0;
      this.player.camDistance = 6.5;
      this.player.camPitch = 0.26;
      this.engine.camera.position.set(room.spawn.x, 3.2, room.spawn.z + 6.5);

      this.ui.markers.setVisible(false);
      this.ui.markersInside.build(room.markers);
      this.ui.markersInside.setVisible(true);

      if (id === 'market') this._startShopping();
      this.state.visited[id] = true;
      this._afterStateChange();
    });
  }

  exitInterior() {
    this._fade(() => {
      const id = this.inside.id;
      this.interiors.exit();
      this.inside = null;
      this.nearestHotspot = null;
      this.environment.setInterior(false);
      this.player.setBounds(null);
      this.player.camMaxY = null;

      /* نخرج أمام الباب، متّجهين نحو الشارع */
      const door = this.town.doors[id];
      const loc = LOCATIONS.find(l => l.id === id);
      const dx = door.x - loc.pos[0], dz = door.z - loc.pos[1];
      const len = Math.hypot(dx, dz) || 1;
      this.player.teleport(door.x + dx / len * 2.2, door.z + dz / len * 2.2);
      this.player.facing = Math.atan2(dx, dz);
      this.player.camYaw = this.player.facing + Math.PI;
      this.player.camDistance = this._outsideCam?.dist ?? PLAYER.CAM_DISTANCE;
      this.player.camPitch = this._outsideCam?.pitch ?? 0.3;
      this.engine.camera.position.set(
        this.player.position.x + Math.sin(this.player.camYaw) * this.player.camDistance, 5.5,
        this.player.position.z + Math.cos(this.player.camYaw) * this.player.camDistance);

      this.ui.markersInside.clear();
      this.ui.markersInside.setVisible(false);
      this.ui.markers.setVisible(true);
      this.ui.shop.hide();
      this.cart = null;
      this.ui.hud.showPrompt(null);
      State.advanceMinutes(this.state, 5);
    });
  }

  /** إظلام قصير يخفي القفزة بين الخارج والداخل */
  _fade(fn) {
    this.transitioning = true;
    this.fade.classList.add('on');
    setTimeout(() => {
      fn();
      setTimeout(() => { this.fade.classList.remove('on'); this.transitioning = false; }, 140);
    }, 300);
  }

  _checkHotspots() {
    let best = null, bestDist = Infinity;
    for (const h of this.inside.hotspots) {
      const d = this.player.distanceTo(h);
      if (d < h.radius && d < bestDist) { bestDist = d; best = h; }
    }
    this.nearestHotspot = best;
    if (!best) { this.ui.hud.showPrompt(null); return; }
    switch (best.kind) {
      case 'exit':     this.ui.hud.showPrompt(`<kbd>E</kbd> ${esc(t('exitBuilding'))}`); break;
      case 'product':  this.ui.hud.showPrompt(this.ui.shop.productPrompt(best.product)); break;
      case 'checkout': this.ui.hud.showPrompt(`<kbd>E</kbd> ${esc(t('checkoutHere'))}`); break;
      default:         this.ui.hud.showPrompt(`<kbd>E</kbd> ${esc(t('talkTo'))}`);
    }
  }

  _useHotspot() {
    const h = this.nearestHotspot;
    if (!h) return;
    switch (h.kind) {
      case 'exit': this.exitInterior(); return;
      case 'product':
        addToCart(this.cart, h.product.id);
        this.ui.shop.update();
        this.ui.toasts.show({ icon: '🛒', title: h.product.name,
          body: { ar: `+${h.product.price} ₪ · ${esc(t('cart'))}`, he: `+${h.product.price} ₪ · ${esc(t('cart'))}` } });
        return;
      case 'checkout': this._openCheckout(); return;
      default: this._hotspotAction(h);
    }
  }

  _hotspotAction(h) {
    switch (h.action) {
      case 'location': this.openLocation(h.target); break;
      case 'services': this.openServices(h.target); break;
      case 'sleep':    this.runAction('sleep'); break;
      case 'budget':   this.ui.panels.showBudget(this.state, this); break;
      case 'atm': {
        const items = servicesFor('bank', this.state).filter(sv => ['deposit', 'withdraw', 'credit'].includes(sv.id));
        this.ui.dialog.showMenu({
          icon: '🏧', title: 'atm', state: this.state, items,
          onPick: (item) => { this.ui.dialog.close(); this.runAction(item.action, item.data); }
        });
        break;
      }
    }
  }

  /* ─────────────── تجربة التسوّق بميزانية ─────────────── */

  _startShopping() {
    this.cart = createCart();
    this.ui.shop.show(this.cart, WEEKLY_MISSION, (op, id) => {
      if (op === 'remove') removeFromCart(this.cart, id);
    });
    this.ui.toasts.show({ icon: '📋', title: WEEKLY_MISSION.title,
      body: { ar: `الميزانية ${WEEKLY_MISSION.budget} ₪ · 8 حاجات`, he: `התקציב ${WEEKLY_MISSION.budget} ₪ · 8 צרכים` } });
  }

  _openCheckout() {
    const ev = evaluateCart(this.cart, WEEKLY_MISSION);
    if (!ev.lines.length) { this.ui.toasts.show({ icon: '🛒', title: 'cartEmpty', body: { ar: '', he: '' } }); return; }
    this.ui.shop.openCheckout(ev, this.state, { onPay: () => this._payCart(ev) });
  }

  _payCart(ev) {
    const s = this.state;
    State.charge(s, ev.total);
    s.energy = Math.min(100, s.energy + 45);
    for (const k of Object.keys(ev.flags)) if (ev.flags[k]) s.flags[k] = true;
    s.flags.groceriesDone = true;
    s.flags.cooksAtHome = true;
    s.iq += ev.iq;
    s.decisions.push({
      id: 'weeklyShop', competency: 'money', step: 0, quality: ev.quality, title: WEEKLY_MISSION.title,
      text: { ar: `مشتريات بـ${ev.total} ₪ من ميزانية ${ev.budget} ₪ — ${ev.score}/100`,
              he: `קניות ב-${ev.total} ₪ מתקציב ${ev.budget} ₪ — ${ev.score}/100` }
    });
    this.ui.toasts.show({ icon: '🧾', title: 'receipt',
      body: { ar: `−${ev.total} ₪ · +${ev.iq} 🧠`, he: `−${ev.total} ₪ · +${ev.iq} 🧠` } });
    this._startShopping();          /* سلّة جديدة لمن يريد الاستمرار */
    this._afterStateChange();
  }

  toggleCar() {
    if (this.inside) return;
    if (!this.state.car) {
      if (!this.state.inCar) this.ui.toasts.show({ icon: '🚗', title: 'needCar', body: { ar: '', he: '' } });
      return;
    }
    if (this.state.inCar) {
      const p = this.car.exitPoint();
      this.state.inCar = false;
      this.player.setVisible(true);
      this.player.teleport(p.x, p.z);
    } else if (this.car.distanceTo(this.player.position) < 4) {
      this.state.inCar = true;
      this.car.occupied = true;
      this.player.setVisible(false);
    }
    this.car.occupied = this.state.inCar;
  }

  /* ═══════════════════════════════════════════════════════════════
     فتح مؤسسة: مشهد قصّة إن وُجد، وإلّا قائمة الخدمات
     ═══════════════════════════════════════════════════════════════ */
  openLocation(locationId) {
    const scene = SCENES.find(sc =>
      sc.location === locationId &&
      !(sc.once && this.state.flags[`scene_${sc.id}`]) &&
      (!sc.requires || sc.requires(this.state)));

    if (scene) { this.playScene(scene); return; }
    this.openServices(locationId);
  }

  playScene(scene) {
    this.ui.dialog.showScene(scene, {
      state: this.state,
      renderWidget: (name) => renderWidget(name, this.state),
      onChoose: (option, source, step) => this.applyOption(option, source, step),
      onFinish: () => {
        this.state.flags[`scene_${scene.id}`] = true;
        this._afterStateChange();
        /* بعد انتهاء مشهد القصّة نفتح خدمات المكان مباشرةً */
        this.openServices(scene.location);
      }
    });
  }

  openServices(locationId) {
    const items = servicesFor(locationId, this.state);
    if (!items.length) return;

    const meta = locationId === 'busStop'
      ? { icon: '🚌', nameKey: 'locBusStop', descKey: 'busPick' }
      : LOCATIONS.find(l => l.id === locationId);

    this.ui.dialog.showMenu({
      icon: meta.icon, title: meta.nameKey, sub: meta.descKey,
      state: this.state, items,
      onPick: (item) => {
        this.ui.dialog.close();
        this.runAction(item.action, item.data);
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     تطبيق قرار
     ═══════════════════════════════════════════════════════════════ */
  applyOption(option, source, step = 0) {
    State.applyEffects(this.state, option.fx || {}, {
      id: source.id, competency: source.competency, step,
      quality: option.quality, title: source.title, text: option.text
    });
    if (option.action) this.runAction(option.action, option.data);
    this._afterStateChange();
  }

  runAction(name, data) {
    const fn = this.actions[name];
    if (!fn) { console.warn('إجراء غير معروف:', name); return; }
    const result = fn(this, data || {});
    if (result?.toast) this.ui.toasts.show(result.toast);
    this._afterStateChange();
  }

  /** بعد أيّ تغيير في الحالة: أوسمة، حفظ، وتحديث هدف المهمّة */
  _afterStateChange() {
    for (const b of checkBadges(this.state)) this.ui.toasts.show({
      icon: b.icon, title: { ar: `🏅 ${t('newBadge')}`, he: `🏅 ${t('newBadge')}` }, body: b.name });

    const q = activeQuest(this.state);
    this.ui.markers.setHighlight(q ? q.target : null);
    State.save(this.state);
  }

  /* ═══════════════════════════════════════════════════════════════
     الأحداث العشوائية
     ═══════════════════════════════════════════════════════════════ */
  _maybeTriggerEvent() {
    if (!this.state.inCar) this.eventDistance += this.player.speed * 0.02;
    if (this.eventDistance < EVENT_DISTANCE) return;
    if (this.minutesSinceEvent < EVENT_COOLDOWN_MIN) return;

    this.eventDistance = 0;
    if (Math.random() > EVENT_CHANCE) return;

    const event = pickEvent(this.state, this.recentEvents);
    if (!event) return;

    this.minutesSinceEvent = 0;
    this.recentEvents = [event.id, ...this.recentEvents].slice(0, 3);

    this.ui.dialog.showEvent(event, {
      state: this.state,
      onChoose: (option, source) => this.applyOption(option, source),
      onFinish: () => this._afterStateChange()
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     نهاية اليوم ونهاية الشهر
     ═══════════════════════════════════════════════════════════════ */
  endDay() {
    const s = this.state;
    s.day += 1;
    s.hour = TIME.DAY_START;
    s.minute = 0;
    /* النوم يستعيد الطاقة، لكن لا يستعيدها كاملةً إن كان الرصيد سالباً:
       الضغط المالي يُنهك فعلاً، وهذه ليست استعارة بل نتيجة موثّقة */
    s.energy = Math.min(100, s.energy + (s.balance < 0 ? 55 : 80));

    if (s.day > TIME.DAYS_PER_MONTH) {
      const lines = monthlyCycle(s);
      s.flags.rentChargedThisMonth = false;
      s.busTripsThisMonth = 0;
      s.monthLog.push(lines);
      this.ui.panels.showMonthReport(lines, s);
    }

    this._afterStateChange();

    /* عند إنجاز كل المهامّ نعرض التقرير الختامي مرّة واحدة */
    if (QUESTS.every(q => q.done(s)) && !s.flags.reportShown) {
      s.flags.reportShown = true;
      setTimeout(() => this.ui.panels.showFinalReport(s, this), 900);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     السفر بالحافلة وتسليم السيارة
     ═══════════════════════════════════════════════════════════════ */
  travelTo(stopId) {
    const door = this.town.doors[stopId];
    if (!door) return;
    if (this.state.inCar) this.toggleCar();
    this.player.teleport(door.x, door.z + 3);
    State.advanceMinutes(this.state, 25);   /* الرحلة تستغرق وقتاً */
  }

  deliverCar(car) {
    const spot = this.town.doors.dealer;
    this.car.deliver(spot.x + 9, spot.z + 4, car.color);
  }

  /* ═══════════════════════════════════════════════════════════════
     الإدخال واللغة
     ═══════════════════════════════════════════════════════════════ */
  _bindInput() {
    this.input.onPress('KeyE', () => this.interact());
    this.input.onPress('KeyF', () => this.toggleCar());
    this.input.onPress('KeyP', () => this.ui.panels.showBudget(this.state, this));
    this.input.onPress('KeyB', () => this.ui.panels.showBadges(this.state));
    this.input.onPress('Escape', () => { if (!this.ui.dialog.open) this.togglePause(); });

    $('#btn-phone')?.addEventListener('click', () => this.ui.panels.showBudget(this.state, this));
    $('#btn-badges')?.addEventListener('click', () => this.ui.panels.showBadges(this.state));
    $('#btn-report')?.addEventListener('click', () => this.ui.panels.showFinalReport(this.state, this));
    $('#btn-interact')?.addEventListener('click', () => this.interact());
    $('#btn-car')?.addEventListener('click', () => this.toggleCar());

    const base = $('#joy-base'), knob = $('#joy-knob');
    if (base && knob) this.input.attachJoystick(base, knob);
  }

  _bindLanguage() {
    /* تبديل اللغة يعيد كتابة كل نصّ ظاهر: الواجهة، اللافتات، والحوار
       المفتوح — مع الحفاظ على حالة الحوار الداخلية (الخطوة والإجابة) */
    I18N.onChange(() => {
      this.ui.hud.relabel(this.state);
      this.ui.markers.relabel();
      this.ui.dialog.refresh();
      const q = activeQuest(this.state);
      this.ui.markers.setHighlight(q ? q.target : null);
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest?.('[data-lang]');
      if (btn) I18N.setLang(btn.dataset.lang);
    });
  }

  togglePause() {
    const paused = !this.engine.paused;
    this.engine.setPaused(paused);
    $('#pause-overlay').classList.toggle('hidden', !paused);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   الإقلاع
   ═══════════════════════════════════════════════════════════════════ */
function boot() {
  I18N.setLang(I18N.detectLang());
  renderStartScreen();
}

function renderStartScreen() {
  const saved = State.load();
  const root = $('#start-screen');
  let step = 'intro';                                   /* intro → avatar */
  let appearance = normalizeAppearance(saved?.appearance || randomAppearance());
  let preview = null;                                   /* معاينة ثلاثية الأبعاد */

  const langSwitch = () => `<div class="lang-switch">
    ${I18N.list().map(l => `<button data-lang="${l.code}" aria-pressed="${l.code === I18N.getLang()}">${esc(l.label)}</button>`).join('')}
  </div>`;

  /* ── الخطوة 1: الافتتاحية — القصّة والهدف والتحكّم ── */
  const renderIntro = () => `
    <div class="start-bg"></div>
    <div class="start-inner wide">
      ${langSwitch()}
      <div class="brand">🏘️</div>
      <h1>${esc(t('gameName'))}</h1>
      <p class="chip">${esc(t('tagline'))}</p>
      <p class="lead">${esc(t('intro'))}</p>

      <div class="story">
        ${[['💼', 'story1'], ['🚌', 'story2'], ['🏦', 'story3'], ['🛒', 'story4']].map(([ic, k]) =>
          `<div class="story-card"><span>${ic}</span><p>${esc(t(k))}</p></div>`).join('')}
      </div>

      <div class="goals">
        <b>${esc(t('monthGoalsTitle'))}</b>
        <ul>${['goal1', 'goal2', 'goal3'].map(k => `<li>${esc(t(k))}</li>`).join('')}</ul>
      </div>

      <div class="row center">
        ${saved ? `<button id="btn-resume" class="btn btn-ghost">${esc(t('resume'))} · ${esc(saved.name)}</button>` : ''}
        <button id="btn-next" class="btn btn-gold">${esc(t('buildCharacter'))} ←</button>
      </div>

      <div class="controls-help">
        <b>${esc(t('controls'))}</b>
        <span><kbd>W A S D</kbd> ${esc(t('ctrlMove'))}</span>
        <span><kbd>Shift</kbd> ${esc(t('ctrlRun'))}</span>
        <span><kbd>E</kbd> ${esc(t('ctrlInteract'))}</span>
        <span><kbd>F</kbd> ${esc(t('ctrlCar'))}</span>
        <span><kbd>P</kbd> ${esc(t('ctrlPhone'))}</span>
        <span>🖱️ ${esc(t('dragToLook'))}</span>
      </div>
      <p class="fine">${esc(t('college'))}</p>
      <p class="fine">${esc(t('oecdNote'))}</p>
    </div>`;

  /* ── الخطوة 2: مُنشئ الشخصية ── */
  const swatches = (key, list) => `<div class="swatches" data-key="${key}">
    ${list.map(c => `<button type="button" class="sw" data-val="${c}" aria-pressed="${appearance[key] === c}" style="background:${hex(c)}"></button>`).join('')}
  </div>`;
  const renderAvatar = () => `
    <div class="start-bg"></div>
    <div class="start-inner wide">
      ${langSwitch()}
      <h1 class="small">${esc(t('buildCharacter'))}</h1>
      <p class="lead">${esc(t('buildLead'))}</p>
      <div class="builder">
        <div class="preview">
          <canvas id="avatar-canvas" width="320" height="400"></canvas>
          <button id="btn-random" class="btn btn-ghost sm">🎲 ${esc(t('surpriseMe'))}</button>
        </div>
        <div class="panel">
          <label for="in-name">${esc(t('yourName'))}</label>
          <input id="in-name" maxlength="28" autocomplete="off" placeholder="${esc(t('namePlace'))}" value="${esc(saved?.name || '')}"/>
          <label for="in-class">${esc(t('classroom'))}</label>
          <input id="in-class" maxlength="20" autocomplete="off" placeholder="י״ב 3" value="${esc(saved?.classroom || '')}"/>
          <p id="name-err" class="err hidden">${esc(t('nameNeeded'))}</p>

          <label>${esc(t('avStyle'))}</label>
          <div class="styles">${STYLES.map(st => `<button type="button" class="style-btn" data-style="${st.id}" aria-pressed="${appearance.style === st.id}"><span>${st.icon}</span>${esc(t(st.name))}</button>`).join('')}</div>
          <label>${esc(t('avSkin'))}</label>${swatches('skin', SKINS)}
          <label class="hair-l ${appearance.style === 'hijab' ? 'hidden' : ''}">${esc(t('avHair'))}</label>${appearance.style === 'hijab' ? '' : swatches('hair', HAIRS)}
          <label class="scarf-l ${appearance.style !== 'hijab' ? 'hidden' : ''}">${esc(t('avScarf'))}</label>${appearance.style === 'hijab' ? swatches('scarf', SCARFS) : ''}
          <label>${esc(t('avShirt'))}</label>${swatches('shirt', SHIRTS)}
          <label>${esc(t('avPants'))}</label>${swatches('pants', PANTS)}
          <label>${esc(t('avBag'))}</label>${swatches('bag', BAGS)}

          <div class="row">
            <button id="btn-back" class="btn btn-ghost">→ ${esc(t('back'))}</button>
            <button id="btn-start" class="btn btn-gold">${esc(t('enterTown'))} ←</button>
          </div>
        </div>
      </div>
    </div>`;

  /* معاينة ثلاثية الأبعاد صغيرة تدور ببطء — نفس بنّاء الشخصية في اللعبة */
  const startPreview = () => {
    const canvas = $('#avatar-canvas');
    if (!canvas || !Engine3D.isSupported()) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(320, 400, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 320 / 400, 0.1, 50);
    camera.position.set(0, 1.35, 5.2); camera.lookAt(0, 1.05, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.1));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.6); sun.position.set(2, 4, 3); scene.add(sun);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 40), new THREE.MeshStandardMaterial({ color: 0x1c4570, roughness: 0.6 }));
    disc.position.y = -0.04; scene.add(disc);
    let fig = null;
    const rebuild = () => { if (fig) scene.remove(fig.group); fig = buildFigure(appearance); scene.add(fig.group); };
    rebuild();
    let phase = 0, alive = true, last = performance.now();
    const loop = (now) => {
      if (!alive) return;
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; phase += dt;
      /* وجه الشخصية نحو −z، فنديرها نصف دورة لتواجه الكاميرا وتتمايل يميناً ويساراً */
      fig.group.rotation.y = Math.PI + Math.sin(phase * 0.7) * 0.8;
      const swing = Math.sin(phase * 2.2) * 0.12;
      fig.armL.rotation.x = swing; fig.armR.rotation.x = -swing;
      renderer.render(scene, camera);
    };
    requestAnimationFrame(loop);
    preview = { rebuild, stop: () => { alive = false; renderer.dispose(); } };
  };

  const render = () => {
    preview?.stop(); preview = null;
    root.innerHTML = step === 'intro' ? renderIntro() : renderAvatar();
    root.scrollTop = 0;

    if (step === 'intro') {
      $('#btn-next').addEventListener('click', () => { step = 'avatar'; render(); });
      $('#btn-resume')?.addEventListener('click', () => launch(saved));
      return;
    }

    startPreview();
    root.querySelectorAll('.style-btn').forEach(b => b.addEventListener('click', () => {
      appearance.style = b.dataset.style; render(); $('#in-name').blur();
    }));
    root.querySelectorAll('.swatches').forEach(sw => sw.addEventListener('click', (e) => {
      const b = e.target.closest('.sw'); if (!b) return;
      appearance[sw.dataset.key] = +b.dataset.val;
      sw.querySelectorAll('.sw').forEach(x => x.setAttribute('aria-pressed', x === b));
      preview?.rebuild();
    }));
    $('#btn-random').addEventListener('click', () => { appearance = randomAppearance(); render(); });
    $('#btn-back').addEventListener('click', () => { step = 'intro'; render(); });
    $('#btn-start').addEventListener('click', () => {
      const name = $('#in-name').value.trim();
      if (!name) { $('#name-err').classList.remove('hidden'); $('#in-name').focus(); return; }
      preview?.stop(); preview = null;
      launch(State.createState(name, $('#in-class').value.trim(), appearance));
    });
  };

  I18N.onChange(render);
  render();
}

function launch(state) {
  if (!Engine3D.isSupported()) {
    $('#start-screen').innerHTML = `<div class="start-inner"><p class="lead">${esc(t('webglError'))}</p></div>`;
    return;
  }
  $('#start-screen').classList.add('hidden');
  $('#game-layer').classList.remove('hidden');
  window.game = new Game(state);   /* مرجع عامّ يفيد في التشخيص والاختبار */
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
