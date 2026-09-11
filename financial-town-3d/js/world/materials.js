/* ═══════════════════════════════════════════════════════════════════
   materials.js — خامات PBR موحّدة للبلدة كلّها
   ───────────────────────────────────────────────────────────────────
   كل خامة تُنشأ مرّة واحدة وتُشارَك بين آلاف الأجسام. المبدأ:
   MeshStandardMaterial (فيزيائي) بدل Lambert (مسطّح) — الفرق بين
   سطح يتفاعل مع الضوء والانعكاسات وسطح يبدو كورق ملوّن.

   الواجهات المُجمَّعة (InstancedMesh) تحمل خدعة مهمّة: حقن شيفرة في
   الـvertex shader تحسب إحداثيات الخامة من أبعاد كل مبنى على حدة،
   فتبقى النوافذ بحجمها الحقيقي (طابق = 3.4م) على مبنى قصير أو طويل.
   بدون ذلك تتمدّد النوافذ مع المبنى وتفضح أنّه صندوق.
   ═══════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import * as T from './textures.js';

/** أبعاد بلاطة الواجهة بالمتر: عرض × ارتفاع (طابق واحد بنافذتين) */
export const FACADE_TILE = new THREE.Vector2(6, 3.4);

export function createMaterials() {
  const M = {};

  /* ═══════════════════════════════════════════════════════════════
     الواجهات السكنية — تنويعتان تتناوبان على المباني
     ═══════════════════════════════════════════════════════════════ */
  const facadeA = T.facadeTexture({ tone: '#ebe3d4', shutter: 0.35 });
  const facadeB = T.facadeTexture({ tone: '#e2d6c0', shutter: 0.5 });

  M.facade = [facadeA, facadeB].map(tex => {
    const m = new THREE.MeshStandardMaterial({
      map: tex.map, emissiveMap: tex.emissive, emissive: new THREE.Color(0xffd9a0),
      emissiveIntensity: 0, roughness: 0.86, metalness: 0.02
    });
    injectInstancedFacadeUv(m);
    return m;
  });

  M.roof = new THREE.MeshStandardMaterial({ map: T.roofTexture(), roughness: 0.95, metalness: 0 });
  M.roof.map.repeat.set(2, 2);

  /* ═══════════════════════════════════════════════════════════════
     خامات المؤسسات
     ═══════════════════════════════════════════════════════════════ */
  M.stone = new THREE.MeshStandardMaterial({ map: T.stoneTexture(), roughness: 0.9, metalness: 0 });
  M.stoneWarm = new THREE.MeshStandardMaterial({
    map: T.stoneTexture({ base: '#ead9b6' }), roughness: 0.88, metalness: 0 });

  const office = T.officeGlassTexture({ tint: '#2e4f70' });
  M.officeGlass = new THREE.MeshStandardMaterial({
    map: office.map, emissiveMap: office.emissive, emissive: new THREE.Color(0xe8f0ff),
    emissiveIntensity: 0, roughness: 0.18, metalness: 0.75
  });

  const officeDark = T.officeGlassTexture({ tint: '#1d2b3a', mullion: '#0d1319' });
  M.officeDark = new THREE.MeshStandardMaterial({
    map: officeDark.map, emissiveMap: officeDark.emissive, emissive: new THREE.Color(0x9fd8ff),
    emissiveIntensity: 0, roughness: 0.2, metalness: 0.8
  });

  const shop = T.shopfrontTexture();
  M.shopfront = new THREE.MeshStandardMaterial({
    map: shop.map, emissiveMap: shop.emissive, emissive: new THREE.Color(0xffe2b8),
    emissiveIntensity: 0, roughness: 0.6, metalness: 0.1
  });

  M.plaster = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0 });
  M.concrete = new THREE.MeshStandardMaterial({ color: 0xb8b0a2, roughness: 0.95 });
  M.darkTrim = new THREE.MeshStandardMaterial({ color: 0x2a3440, roughness: 0.55, metalness: 0.3 });
  M.brass = new THREE.MeshStandardMaterial({ color: 0xc9a54a, roughness: 0.35, metalness: 0.85 });
  M.dome = new THREE.MeshStandardMaterial({ color: 0x2f8f78, roughness: 0.4, metalness: 0.15 });

  /* ═══════════════════════════════════════════════════════════════
     الأرض والشوارع
     ═══════════════════════════════════════════════════════════════ */
  M.ground = new THREE.MeshStandardMaterial({ map: T.groundTexture(), roughness: 1, metalness: 0 });
  M.ground.map.repeat.set(48, 48);   /* بلاطة ≈ 8م — تفاصيل واضحة عن قرب */

  M.asphalt = new THREE.MeshStandardMaterial({ map: T.asphaltTexture(), roughness: 0.92, metalness: 0 });
  M.paving = new THREE.MeshStandardMaterial({ map: T.pavingTexture(), roughness: 0.85, metalness: 0 });
  M.curb = new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 0.8 });
  M.lane = new THREE.MeshStandardMaterial({ color: 0xe8e2cc, roughness: 0.7 });
  M.zebra = new THREE.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.7 });

  /* ═══════════════════════════════════════════════════════════════
     الأشجار والنباتات
     ═══════════════════════════════════════════════════════════════ */
  M.trunk = new THREE.MeshStandardMaterial({ color: 0x5e4630, roughness: 0.95 });
  M.oliveDark = new THREE.MeshStandardMaterial({ color: 0x4e6b45, roughness: 0.9, flatShading: true });
  M.oliveLight = new THREE.MeshStandardMaterial({ color: 0x7d9468, roughness: 0.9, flatShading: true });
  M.cypress = new THREE.MeshStandardMaterial({ color: 0x2f4a30, roughness: 0.9, flatShading: true });
  M.hedge = new THREE.MeshStandardMaterial({ color: 0x4f7a3f, roughness: 0.95 });

  /* ═══════════════════════════════════════════════════════════════
     معدن وإنارة وتجهيزات الأسطح
     ═══════════════════════════════════════════════════════════════ */
  M.metal = new THREE.MeshStandardMaterial({ color: 0x5c666e, roughness: 0.45, metalness: 0.8 });
  M.lampHead = new THREE.MeshStandardMaterial({
    color: 0xd9d5cc, emissive: new THREE.Color(0xffd27a), emissiveIntensity: 0, roughness: 0.4 });
  M.whiteTank = new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.55 });
  M.blackTank = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 0.7 });
  M.solarPanel = new THREE.MeshStandardMaterial({ color: 0x12203a, roughness: 0.15, metalness: 0.7 });
  M.railing = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.5, metalness: 0.6 });
  M.acUnit = new THREE.MeshStandardMaterial({ color: 0xd4d2cc, roughness: 0.7 });

  M.awning = (hex) => new THREE.MeshStandardMaterial({
    map: T.awningTexture(hex), roughness: 0.9, side: THREE.DoubleSide });

  /* ═══════════════════════════════════════════════════════════════
     المركبات — طلاء بطبقة لمعان (clearcoat) وزجاج عاكس
     ═══════════════════════════════════════════════════════════════ */
  M.carPaint = (hex) => new THREE.MeshPhysicalMaterial({
    color: hex, roughness: 0.32, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08 });
  M.carGlass = new THREE.MeshPhysicalMaterial({
    color: 0x16232f, roughness: 0.06, metalness: 0.9, clearcoat: 1, clearcoatRoughness: 0.03 });
  M.tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 });
  M.rim = new THREE.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.3, metalness: 0.9 });
  M.headlight = new THREE.MeshStandardMaterial({
    color: 0xfff6dc, emissive: new THREE.Color(0xfff1c8), emissiveIntensity: 0.2, roughness: 0.2 });
  M.taillight = new THREE.MeshStandardMaterial({
    color: 0x8a1212, emissive: new THREE.Color(0xff2a2a), emissiveIntensity: 0.25, roughness: 0.3 });
  M.busPaint = new THREE.MeshPhysicalMaterial({
    color: 0x2b8a6e, roughness: 0.35, metalness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  M.busStripe = new THREE.MeshStandardMaterial({ color: 0xe4c25a, roughness: 0.5, metalness: 0.2 });

  /* ═══════════════════════════════════════════════════════════════
     الشخصية
     ═══════════════════════════════════════════════════════════════ */
  M.skin = new THREE.MeshStandardMaterial({ color: 0xd9b08c, roughness: 0.75 });
  M.shirt = new THREE.MeshStandardMaterial({ color: 0x2f6f9e, roughness: 0.85 });
  M.pants = new THREE.MeshStandardMaterial({ color: 0x33393f, roughness: 0.9 });
  M.hair = new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.9 });
  M.shoes = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.8 });

  /* ═══════════════════════════════════════════════════════════════
     الليل: نوافذ ومصابيح وفاترينات تضيء تدريجياً بعد الغروب
     ═══════════════════════════════════════════════════════════════ */
  const glowing = [
    [M.facade[0], 1.4], [M.facade[1], 1.4],
    [M.officeGlass, 1.6], [M.officeDark, 1.8], [M.shopfront, 1.7], [M.lampHead, 3.2]
  ];
  M.setNight = (t) => {
    for (const [mat, max] of glowing) mat.emissiveIntensity = max * t;
    M.headlight.emissiveIntensity = 0.2 + 2.2 * t;
    M.taillight.emissiveIntensity = 0.25 + 1.4 * t;
  };

  return M;
}

/* ═══════════════════════════════════════════════════════════════════
   حقن إحداثيات الواجهة لكل نسخة
   ───────────────────────────────────────────────────────────────────
   الهندسة المشتركة صندوق 1×1×1 تُكبَّر بمصفوفة كل نسخة. إحداثيات UV
   الأصلية ‎0..1‎ على كل وجه، فنضربها في امتداد الوجه الحقيقي (من
   السمة instDims) ونقسمها على حجم البلاطة. الوجه يُعرَف من اتّجاه
   الـnormal: وجوه ±X عرضها هو العمق، ووجوه ±Z عرضها هو العرض.
   ═══════════════════════════════════════════════════════════════════ */
function injectInstancedFacadeUv(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.facadeTile = { value: FACADE_TILE };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
        '#include <common>\nattribute vec3 instDims;\nuniform vec2 facadeTile;')
      .replace('#include <uv_vertex>', `
        #include <uv_vertex>
        vec2 faceExtent = abs(normal.x) > 0.5 ? vec2(instDims.z, instDims.y)
                        : abs(normal.z) > 0.5 ? vec2(instDims.x, instDims.y)
                        : vec2(instDims.x, instDims.z);
        vec2 facadeUv = uv * faceExtent / facadeTile;
        #ifdef USE_MAP
          vMapUv = facadeUv;
        #endif
        #ifdef USE_EMISSIVEMAP
          vEmissiveMapUv = facadeUv;
        #endif`);
  };
  /* مفتاح مميّز حتى لا يُعاد استخدام برنامج مُصرَّف لخامة أخرى بلا الحقن */
  material.customProgramCacheKey = () => 'instanced-facade';
}
