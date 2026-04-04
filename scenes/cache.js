// ─── CACHE MEMORY SCENE ─────────────────────────────────────────────────────
// Accurate cache hierarchy: CPU → L1 → L2 → L3 → DRAM
// Flowchart: Top-down diamond decision nodes showing HIT/MISS path
class CacheScene extends BaseScene {
  createScene() {
    this.theta = 0; this.phi = 0.25; this.radius = 16;
    this._updateCamera();
    this.makeGrid();
    this.addPointLight(0x00f5ff, -6, 8, 4, 2);
    this.addPointLight(0xff8800, 6, 8, 4, 2);

    this.flowLines = [];
    this.t = 0;
    this.lastHit = 'L1';
    this.hitTimer = 0;
    this.hitCounts = { L1: 0, L2: 0, L3: 0, DRAM: 0 };

    const COMPS = [
      { id: 'CPU',  label: 'CPU Core\n(Requesting Data)', color: 0x3b82f6, x: 0, y: 9,  w: 3.5, h: 2.5,
        title: 'CPU Core — Memory Request', icon: '🧠',
        desc: 'The processor core issues a <b>Load instruction</b> to request data at a specific memory address. The memory subsystem then searches the hierarchy from fastest to slowest to find that data.' },
      { id: 'L1',  label: 'L1 Cache\n(~4 cycles)', color: 0x10b981, x: 0, y: 5.5, w: 3.5, h: 2.5,
        title: 'L1 Data Cache', icon: '🟢',
        desc: '<b>Fastest and smallest</b> cache, private to each CPU core. Typically 32–64 KB. Latency ~4 cycles. High temporal/spatial locality means most accesses hit here. Organized as a set-associative structure (e.g., 8-way).' },
      { id: 'L2',  label: 'L2 Cache\n(~12 cycles)', color: 0x84cc16, x: 0, y: 1.5, w: 3.5, h: 2.5,
        title: 'L2 Unified Cache', icon: '🟡',
        desc: 'Larger but slower than L1. Typically 256 KB–1 MB, private per core. Acts as a victim cache for L1 misses. Latency ~12 cycles. Holds both instruction and data (unified).' },
      { id: 'L3',  label: 'L3 LLC\n(~40 cycles)', color: 0xf59e0b, x: 0, y: -2.5, w: 3.5, h: 2.5,
        title: 'L3 Last-Level Cache (LLC)', icon: '🟠',
        desc: '<b>Shared between all cores</b> on the chip. Typically 8–64 MB. Latency ~40 cycles. When L3 misses, data must be fetched from off-chip DRAM. Cross-core data sharing and MESI coherence happen at this level.' },
      { id: 'DRAM', label: 'Main Memory\n(DRAM, ~200 cycles)', color: 0xef4444, x: 0, y: -6.5, w: 3.5, h: 2.5,
        title: 'DRAM — Main Memory', icon: '🔴',
        desc: '<b>Slowest and largest</b> memory in the hierarchy. ~8–64 GB, latency ~200+ cycles. When DRAM is accessed, the cache line is loaded back into L3, L2, and L1 progressively. A page fault causes even slower disk access.' },
      // HIT boxes (right side)
      { id: 'H1',  label: '✓ L1 HIT\nReturn Data', color: 0x065f46, x:  7.5, y: 5.5, w: 2.8, h: 2.5,
        title: 'L1 Cache HIT', icon: '⚡',
        desc: 'Data found in L1! Returned to the CPU in ~4 cycles. This is the ideal case (~95% of accesses in typical workloads). Enables CPU to sustain high IPC.' },
      { id: 'H2',  label: '✓ L2 HIT\n+ Fill L1', color: 0x166534, x:  7.5, y: 1.5, w: 2.8, h: 2.5,
        title: 'L2 Cache HIT', icon: '✅',
        desc: 'Data found in L2. The cache line is promoted to L1 (write-allocate), then returned to the CPU. ~12 cycle latency. CPU may stall or issue other independent instructions.' },
      { id: 'H3',  label: '✓ L3 HIT\n+ Fill L2,L1', color: 0x854d0e, x:  7.5, y: -2.5, w: 2.8, h: 2.5,
        title: 'L3 Cache HIT', icon: '⚠️',
        desc: 'Data found in L3. Cache line loaded into L2 and L1 before returning. ~40 cycle latency. The Out-of-Order engine works hard to hide this latency by executing other independent work.' },
      { id: 'HD',  label: '✗ DRAM\nFetch Penalty', color: 0x7f1d1d, x:  7.5, y: -6.5, w: 2.8, h: 2.5,
        title: 'DRAM Fetch — Cache Miss Penalty', icon: '🐢',
        desc: 'Worst case: data not in any cache. DRAM fetch takes ~200+ cycles, stalling the CPU. The fetched cache line (64 bytes) is installed in L3, L2, L1. This is why efficient memory access patterns (good cache locality) are critical for performance.' },
      // MISS labels (left diamonds)
      { id: 'M1',  label: 'MISS\n↓', color: 0xdc2626, x: -4.5, y: 3.5, w: 1.5, h: 1.5,
        title: 'L1 Miss', icon: '❌', desc: 'Data not found in L1. Search escalates to L2.' },
      { id: 'M2',  label: 'MISS\n↓', color: 0xdc2626, x: -4.5, y: -0.5, w: 1.5, h: 1.5,
        title: 'L2 Miss', icon: '❌', desc: 'Data not found in L2. Search escalates to L3.' },
      { id: 'M3',  label: 'MISS\n↓', color: 0xdc2626, x: -4.5, y: -4.5, w: 1.5, h: 1.5,
        title: 'L3 Miss — DRAM Access', icon: '💀', desc: 'Data not found in any on-chip cache. DRAM access required — maximum penalty.' },
    ];

    this.meshMap = {};
    COMPS.forEach(c => {
      const shape = (c.id.startsWith('M'))
        ? new THREE.OctahedronGeometry(0.9, 0)   // Diamond shape for MISS nodes
        : new THREE.BoxGeometry(c.w, c.h, 0.9);   // Boxes for main components
      const mat = new THREE.MeshPhongMaterial({ color: c.color, shininess: 80 });
      const mesh = new THREE.Mesh(shape, mat);
      mesh.position.set(c.x, c.y, 0);
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(shape),
        new THREE.LineBasicMaterial({ color: c.color, opacity: 0.9, transparent: true })));
      if (!c.id.startsWith('M')) {
        const lbl = this._multiLabel(c.label, '#fff');
        lbl.position.set(0, c.h / 2 + 0.6, 0); lbl.scale.set(2.5, 0.95, 1); mesh.add(lbl);
      } else {
        const lbl = this.makeLabel(c.label, '#ff6666');
        lbl.position.set(0, 1.3, 0); lbl.scale.set(1.5, 0.6, 1); mesh.add(lbl);
      }
      this.scene.add(mesh); this.meshMap[c.id] = mesh;
      if (c.title) this.addInteractable(mesh, c.title, c.desc, c.icon);
    });

    // ── Flowchart Lines ──
    // Main vertical spine (request path)
    this._line(0, 7.75, 0, 6.75, 0x3b82f6);   // CPU → L1
    this._line(0, 4.25, 0, 2.75, 0x10b981);   // L1 miss → L2
    this._line(0, 0.25, 0, -1.25, 0x84cc16);  // L2 miss → L3
    this._line(0, -3.75, 0, -5.25, 0xf59e0b); // L3 miss → DRAM

    // MISS branch connectors (left)
    this._line(0, 3.5,  -3.75, 3.5,  0xdc2626); // L1→MISS node
    this._line(0, -0.5, -3.75, -0.5, 0xdc2626); // L2→MISS node
    this._line(0, -4.5, -3.75, -4.5, 0xdc2626); // L3→MISS node

    // HIT branch connectors (right)
    this._line(1.75, 5.5,  4.65, 5.5,  0x10b981); // L1 HIT
    this._line(1.75, 1.5,  4.65, 1.5,  0x84cc16); // L2 HIT
    this._line(1.75, -2.5, 4.65, -2.5, 0xf59e0b); // L3 HIT
    this._line(1.75, -6.5, 4.65, -6.5, 0xef4444); // DRAM HIT

    // Return path (right side, going upward back to CPU)
    const returnPts = [
      new THREE.Vector3(8.9, -6.5, 0), new THREE.Vector3(11, -6.5, 0),
      new THREE.Vector3(11, 9, 0),     new THREE.Vector3(1.75, 9, 0)
    ];
    this._polyLine(returnPts, 0x00ff88);
    const retLabel = this.makeLabel('Data returned to CPU', '#00ff88');
    retLabel.position.set(11.5, 1, 0); retLabel.scale.set(3, 0.6, 1);
    this.scene.add(retLabel);

    // Latency labels
    [['L1: ~4 cycles', 0, 5.5], ['L2: ~12 cycles', 0, 1.5], ['L3: ~40 cycles', 0, -2.5], ['DRAM: ~200+ cycles', 0, -6.5]]
      .forEach(([text, x, y]) => {
        const l = this.makeLabel(text, '#64748b'); l.position.set(x - 8, y, 0); l.scale.set(2.5, 0.5, 1); this.scene.add(l);
      });

    // Packet (cache line being accessed)
    this.packet = (() => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.7),
        new THREE.MeshPhongMaterial({ color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 0.6 })));
      const lbl = this.makeLabel('64B\nLine', '#fff'); lbl.scale.set(0.9, 0.55, 1); lbl.position.set(0, 0.7, 0); g.add(lbl);
      return g;
    })();
    this.scene.add(this.packet);
    this.packetPhase = 0;
    this.currentPath  = 'L1';  // default path
  }

  _multiLabel(text, color) {
    const lines = text.split('\n');
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 100;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = color; ctx.font = 'bold 24px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 150, 28 + i * 38));
    const tex = new THREE.CanvasTexture(cv);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  }

  _line(x1, y1, x2, y2, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, 0.1), new THREE.Vector3(x2, y2, 0.1)]);
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.15 });
    const l = new THREE.Line(geo, mat); l.computeLineDistances(); this.scene.add(l); this.flowLines.push(l);
  }

  _polyLine(pts, color) {
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.15 });
    const l = new THREE.Line(geo, mat); l.computeLineDistances(); this.scene.add(l); this.flowLines.push(l);
  }

  update(dt) {
    this.t += dt;
    this.flowLines.forEach(l => { l.material.dashOffset -= dt * 2; });

    this.hitTimer += dt;
    if (this.hitTimer > 4) {
      this.hitTimer = 0;
      // Weighted random: 85% L1, 10% L2, 4% L3, 1% DRAM
      const r = Math.random();
      this.currentPath = r < 0.85 ? 'L1' : r < 0.95 ? 'L2' : r < 0.99 ? 'L3' : 'DRAM';
      this.hitCounts[this.currentPath]++;
      this.lastHit = this.currentPath;
      this.packetPhase = 0;
    }

    // Animate packet down based on currentPath
    this.packetPhase += dt;
    const pathDepth = { L1: 1, L2: 2, L3: 3, DRAM: 4 }[this.currentPath];
    const yPositions = [9, 5.5, 1.5, -2.5, -6.5];
    const target = yPositions[Math.min(pathDepth, 4)];
    const py = 9 - (9 - target) * Math.min(this.packetPhase / 1.5, 1);
    this.packet.position.set(0.5, py, 1.2);
    this.packet.children[0].material.emissiveIntensity = 0.4 + Math.sin(this.t * 3) * 0.3;

    // Briefly highlight the level on hit
    ['L1', 'L2', 'L3', 'DRAM'].forEach(id => {
      const m = this.meshMap[id]; if (!m) return;
      const level = id === 'L1' ? 1 : id === 'L2' ? 2 : id === 'L3' ? 3 : 4;
      m.material.emissiveIntensity = (level === pathDepth && this.packetPhase > 1.4) ? 0.4 : 0;
    });
  }

  getStats() {
    const t = Object.values(this.hitCounts).reduce((a, b) => a + b, 0) || 1;
    return [
      { label: 'L1 Hit Rate', value: `${(this.hitCounts.L1 / t * 100).toFixed(0)}%` },
      { label: 'Last Access', value: this.lastHit },
      { label: 'Current Latency', value: this.lastHit === 'L1' ? '4 cyc' : this.lastHit === 'L2' ? '12 cyc' : this.lastHit === 'L3' ? '40 cyc' : '200 cyc' }
    ];
  }

  reset() { super.reset(); this.t = 0; this.hitCounts = { L1: 0, L2: 0, L3: 0, DRAM: 0 }; this.packetPhase = 0; }
}
