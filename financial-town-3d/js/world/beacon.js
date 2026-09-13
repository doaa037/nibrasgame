/* ═══════════════════════════════════════════════════════════════════
   beacon.js — منارة الهدف: عمود ضوء وحلقة نابضة وسهم عند باب المهمّة
   ───────────────────────────────────────────────────────────────────
   مرئية من أيّ مكان في البلدة تقريباً، فلا يضيع الطالب بين المباني
   المتشابهة. لا تُضاء المشهد (لا PointLight) — مادّة مضافة شفّافة فقط.
   ═══════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

export class Beacon {
  constructor(scene) {
    this.group = new THREE.Group();
    this.t = 0;

    const glow = new THREE.MeshBasicMaterial({
      color: 0xffd766, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    /* عمود يخفت نحو الأعلى: مخروط مقلوب طويل يعطي إحساس الشعاع */
    this.pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.8, 46, 18, 1, true), glow);
    this.pillar.position.y = 23;
    this.group.add(this.pillar);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd766, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 40), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.06;
    this.group.add(this.ring);

    /* سهم يشير إلى الأسفل ويطفو فوق الباب */
    const arrowMat = new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: new THREE.Color(0xffa500), emissiveIntensity: 0.9, roughness: 0.4 });
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 4), arrowMat);
    this.arrow.rotation.x = Math.PI;
    this.arrow.position.y = 7;
    this.group.add(this.arrow);

    this.group.visible = false;
    scene.add(this.group);
  }

  setPosition(x, z) { this.group.position.set(x, 0, z); this.group.visible = true; }
  hide() { this.group.visible = false; }
  setVisible(v) { this.group.visible = v && this._has; }

  update(dt) {
    if (!this.group.visible) return;
    this.t += dt;
    const p = (Math.sin(this.t * 2.2) + 1) / 2;
    this.ring.scale.setScalar(1 + p * 0.45);
    this.ring.material.opacity = 0.9 - p * 0.6;
    this.arrow.position.y = 6.6 + Math.sin(this.t * 2.6) * 0.5;
    this.arrow.rotation.y += dt * 1.4;
    this.pillar.material.opacity = 0.1 + p * 0.07;
  }
}
