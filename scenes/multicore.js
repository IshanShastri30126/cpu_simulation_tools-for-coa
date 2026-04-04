// ─── MULTI-CORE SCENE ─────────────────────────────────────────────────────────
// Accurate NUMA multicore: Each core has private L1/L2, shared L3, interconnect, DRAM
// Shows MESI coherence messages between cores
class MultiCoreScene extends BaseScene {
  createScene() {
    this.theta = 0; this.phi = 0.25; this.radius = 22;
    this._updateCamera();
    this.makeGrid();
    this.addPointLight(0x3b82f6, -8, 10, 4, 2.5);
    this.addPointLight(0x10b981, 8, 10, 4, 2.5);
    this.addPointLight(0xffffff, 0, 15, 0, 1.5);

    this.flowLines = [];
    this.t = 0;
    this.coherenceMessages = [];
    this.coreLoads = [0, 0, 0, 0];

    const CORE_COLORS = [0x3b82f6, 0x10b981, 0xf59e0b, 0xec4899];
    const CORE_POSITIONS = [{ x: -10, y: 5 }, { x: 2, y: 5 }, { x: -10, y: -2 }, { x: 2, y: -2 }];

    this.coreMeshes = [];
    this.l1Meshes   = [];
    this.l2Meshes   = [];

    CORE_POSITIONS.forEach((pos, i) => {
      const col = CORE_COLORS[i];
      // Core die
      const coreGeo = new THREE.BoxGeometry(4.5, 3.5, 1);
      const coreMat = new THREE.MeshPhongMaterial({ color: col, shininess: 80 });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.set(pos.x, pos.y, 0);
      coreMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(coreGeo),
        new THREE.LineBasicMaterial({ color: col, opacity: 0.9, transparent: true })));
      const cLbl = this._multiLabel(`Core ${i}\n(CPU ${i})`, '#fff');
      cLbl.position.set(0, 2.3, 0); cLbl.scale.set(2.4, 0.9, 1); coreMesh.add(cLbl);
      this.scene.add(coreMesh);
      this.coreMeshes.push(coreMesh);
      this.addInteractable(coreMesh, `CPU Core ${i}`, `An independent processing unit with its own execution pipeline, register file, and private L1/L2 caches. Cores share the L3 cache and main memory through the interconnect.`, '🧠');

      // L1 Cache per core
      const l1Geo = new THREE.BoxGeometry(4, 1.2, 0.8);
      const l1Mat = new THREE.MeshPhongMaterial({ color: 0x065f46 });
      const l1 = new THREE.Mesh(l1Geo, l1Mat);
      l1.position.set(pos.x, pos.y - 2.8, 0);
      l1.add(new THREE.LineSegments(new THREE.EdgesGeometry(l1Geo),
        new THREE.LineBasicMaterial({ color: 0x10b981, opacity: 0.8, transparent: true })));
      const l1Lbl = this.makeLabel('L1 D+I Cache (32K)', '#10b981');
      l1Lbl.scale.set(2.5, 0.5, 1); l1Lbl.position.set(0, 0.8, 0); l1.add(l1Lbl);
      this.scene.add(l1);
      this.l1Meshes.push(l1);
      this.addInteractable(l1, `Core ${i} — L1 Cache`, 'Private 32KB D-cache + 32KB I-cache. Virtually the fastest memory in the system (~4 cycles). Cache lines here can be M/E/S/I under MESI coherence protocol.', '🟢');

      // L2 Cache per core
      const l2Geo = new THREE.BoxGeometry(4, 1.0, 0.8);
      const l2Mat = new THREE.MeshPhongMaterial({ color: 0x166534 });
      const l2 = new THREE.Mesh(l2Geo, l2Mat);
      l2.position.set(pos.x, pos.y - 4.4, 0);
      l2.add(new THREE.LineSegments(new THREE.EdgesGeometry(l2Geo),
        new THREE.LineBasicMaterial({ color: 0x84cc16, opacity: 0.8, transparent: true })));
      const l2Lbl = this.makeLabel('L2 Unified Cache (512K)', '#84cc16');
      l2Lbl.scale.set(2.8, 0.5, 1); l2Lbl.position.set(0, 0.7, 0); l2.add(l2Lbl);
      this.scene.add(l2);
      this.l2Meshes.push(l2);
      this.addInteractable(l2, `Core ${i} — L2 Cache`, 'Private 512KB unified cache. Bridges the gap to shared L3. Also participates in MESI coherence for cross-core invalidation.', '🟡');

      // L1 ↔ L2 connector
      this._line(pos.x, pos.y - 2.2, pos.x, pos.y - 3.8, col);
    });

    // Shared Ring Interconnect
    const ringGeo = new THREE.TorusGeometry(7, 0.15, 8, 40);
    const ringMat = new THREE.MeshPhongMaterial({ color: 0x475569, emissive: 0x1e293b, emissiveIntensity: 0.5 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(-4, 0, -0.5);
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);
    this.addInteractable(ring, 'Ring Interconnect / Mesh Bus', 'The high-speed on-chip interconnect connecting all cores to the shared L3 cache slices and memory controllers. Common designs: Intel Ring Bus, AMD Infinity Fabric mesh.', '💍');

    // Shared L3 Cache
    const l3Geo = new THREE.BoxGeometry(16, 1.8, 1);
    const l3Mat = new THREE.MeshPhongMaterial({ color: 0xd97706 });
    const l3 = new THREE.Mesh(l3Geo, l3Mat);
    l3.position.set(-4, -8.5, 0);
    l3.add(new THREE.LineSegments(new THREE.EdgesGeometry(l3Geo),
      new THREE.LineBasicMaterial({ color: 0xf59e0b, opacity: 0.9, transparent: true })));
    const l3Lbl = this._multiLabel('Shared L3 Last-Level Cache (LLC) — 12MB shared across all cores', '#fff');
    l3Lbl.position.set(0, 1.3, 0); l3Lbl.scale.set(12, 0.7, 1); l3.add(l3Lbl);
    this.scene.add(l3);
    this.addInteractable(l3, 'Shared L3 Cache (LLC)', 'All 4 cores share this 12MB LLC. Facilitates <b>zero-copy sharing</b> of data between threads. Divided into cache slices distributed across the die. MESI coherence is enforced here.', '🟠');

    // DRAM
    const dramGeo = new THREE.BoxGeometry(16, 1.5, 1);
    const dramMat = new THREE.MeshPhongMaterial({ color: 0x7f1d1d });
    const dram = new THREE.Mesh(dramGeo, dramMat);
    dram.position.set(-4, -11.2, 0);
    dram.add(new THREE.LineSegments(new THREE.EdgesGeometry(dramGeo),
      new THREE.LineBasicMaterial({ color: 0xef4444, opacity: 0.8, transparent: true })));
    const dramLbl = this._multiLabel('DDR5 DRAM — Main Memory (16–64 GB) — ~200 cycle latency', '#fff');
    dramLbl.position.set(0, 1.1, 0); dramLbl.scale.set(14, 0.6, 1); dram.add(dramLbl);
    this.scene.add(dram);
    this.addInteractable(dram, 'DDR5 DRAM — Main Memory', 'Off-chip main memory. ~200 cycle access time. Organized as channels (dual-channel common) connected to the IMC (Integrated Memory Controller) on the CPU die. Bandwidth: ~50-80 GB/s for modern DDR5.', '🔴');

    // L2 ↔ Ring connectors
    CORE_POSITIONS.forEach(pos => {
      this._line(pos.x, pos.y - 4.9, pos.x, pos.y - 5.8, 0x64748b);
    });

    // Ring ↔ L3
    this._line(-4, -7, -4, -7.6, 0x475569);
    // L3 ↔ DRAM
    this._line(-4, -9.4, -4, -10.45, 0xd97706);

    // MESI state indicator boxes
    const MESI_LABELS = ['M', 'E', 'S', 'I'];
    const MESI_COLORS = [0xf59e0b, 0x3b82f6, 0x10b981, 0x64748b];
    MESI_LABELS.forEach((s, i) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.3),
        new THREE.MeshPhongMaterial({ color: MESI_COLORS[i] }));
      box.position.set(-11.5 + i * 1.1, 8.5, 0);
      this.scene.add(box);
      const lbl = this.makeLabel(s, '#fff'); lbl.position.set(0, 0.7, 0); lbl.scale.set(0.7, 0.45, 1);
      box.add(lbl);
    });
    const mesiLabel = this.makeLabel('MESI States: Modified  Exclusive  Shared  Invalid', '#64748b');
    mesiLabel.position.set(-8, 9.3, 0); mesiLabel.scale.set(7, 0.5, 1); this.scene.add(mesiLabel);

    // Coherence message packets
    this.coherencePkts = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshPhongMaterial({ color: CORE_COLORS[i], emissive: CORE_COLORS[i], emissiveIntensity: 0.6 })));
      const lbl = this.makeLabel(['M', 'E', 'S', 'I'][i], '#fff');
      lbl.scale.set(0.5, 0.3, 1); lbl.position.set(0, 0.4, 0); g.add(lbl);
      g.position.set(-4, 0, 1.2);
      this.scene.add(g);
      this.coherencePkts.push({ g, angle: (i / 4) * Math.PI * 2, speed: 0.6 + i * 0.1 });
    }
  }

  _multiLabel(text, color) {
    const lines = text.split('\n');
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = color; ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 256, 28 + i * 36));
    const tex = new THREE.CanvasTexture(cv);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  }

  _line(x1, y1, x2, y2, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, 0), new THREE.Vector3(x2, y2, 0)]);
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.18 });
    const l = new THREE.Line(geo, mat); l.computeLineDistances(); this.scene.add(l); this.flowLines.push(l);
  }

  update(dt) {
    this.t += dt;
    this.flowLines.forEach(l => { l.material.dashOffset -= dt * 1.5; });

    // Coherence packets orbiting the ring
    this.coherencePkts.forEach(p => {
      p.angle += dt * p.speed;
      const rx = -4 + Math.cos(p.angle) * 7;
      const ry = Math.sin(p.angle) * 4.5;
      p.g.position.set(rx, ry, 1.2);
    });

    // Pulse cores
    this.coreMeshes.forEach((m, i) => {
      const pulse = Math.sin(this.t * 1.5 + i * 0.8);
      this.coreLoads[i] = (pulse + 1) / 2;
      m.material.emissiveIntensity = this.coreLoads[i] * 0.25;
    });

    // L1/L2 cache activity — blink on coherence events
    this.l1Meshes.forEach((m, i) => {
      m.material.emissiveIntensity = Math.abs(Math.sin(this.t * 3 + i * 1.2)) * 0.15;
    });
  }

  getStats() {
    const util = this.coreLoads.map(l => `${(l * 100).toFixed(0)}%`).join(' ');
    return [
      { label: 'Cores', value: '4' },
      { label: 'Core Util', value: util },
      { label: 'L3 Shared', value: '12 MB' }
    ];
  }

  reset() { super.reset(); this.t = 0; }
}
