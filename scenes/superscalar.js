// ─── SUPERSCALAR SCENE ────────────────────────────────────────────────────────
// Accurate: Fetch (wide) → Decode (4-wide) → Dispatch → Issue Queue
//           → Multiple EU Lanes (ALU×2, AGU, FPU, Branch) running IN PARALLEL
// Key insight: same pipeline stages but MULTIPLE instructions simultaneously
class SuperscalarScene extends BaseScene {
  createScene() {
    this.theta = 0; this.phi = 0.2; this.radius = 20;
    this._updateCamera();
    this.makeGrid();
    this.addPointLight(0x7c3aed, -6, 8, 4, 2.5);
    this.addPointLight(0x10b981, 6, 8, 4, 2.5);

    this.flowLines = [];
    this.t = 0;
    this.cycleIPC = 0;

    // Wide fetch block
    const COMPS_WIDE = [
      { id: 'FETCH', label: '4-Wide\nInstruction Fetch', color: 0x3b82f6, x: -12, y: 0, w: 4, h: 4,
        title: 'Wide Fetch Unit (4-wide)', icon: '📡',
        desc: 'A superscalar CPU fetches <b>multiple instructions per cycle</b> — typically 4 or 6. This is the key difference from scalar CPUs. Requires a wide instruction cache port and advanced branch prediction to fill the pipeline efficiently.' },
      { id: 'DEC',  label: '4-Wide\nDecode', color: 0x6366f1, x: -7, y: 0, w: 4, h: 4,
        title: '4-Wide Decode', icon: '🔤',
        desc: 'Decodes up to 4 instructions simultaneously per cycle. Complex instructions (e.g., x86) are broken into 1–4 micro-ops each. Decoder complexity scales with width, so very-wide (8+) decode is hardware-expensive.' },
      { id: 'DISP', label: 'Dispatch &\nRegister Rename', color: 0x8b5cf6, x: -2, y: 0, w: 4, h: 4,
        title: 'Dispatch & Register Rename', icon: '🗺️',
        desc: 'Dispatches up to 4 instructions per cycle to the <b>Issue Queue</b>, allocating ROB entries and renaming registers. Bottlenecks here reduce IPC. Modern CPUs have 6–8 dispatch ports.' },
    ];

    // Execution lanes (running in parallel)
    const LANES = [
      { id: 'EU0', label: 'ALU 0\n(INT)', color: 0x10b981, x: 5, y:  5.5, w: 2.5, h: 2.5,
        title: 'Execution Lane 0 — Integer ALU', icon: '➕',
        desc: 'Handles integer arithmetic (ADD, SUB, CMP). Runs every cycle independently. Instruction packing ensures this unit never stalls when there is sufficient independent work.' },
      { id: 'EU1', label: 'ALU 1\n(INT)', color: 0x10b981, x: 5, y:  2.2, w: 2.5, h: 2.5,
        title: 'Execution Lane 1 — Integer ALU', icon: '✖️',
        desc: 'A second independent integer ALU. When the compiler generates independent instructions (no data dependencies), BOTH ALU 0 and ALU 1 execute simultaneously in the same cycle, doubling effective throughput.' },
      { id: 'EU2', label: 'AGU\n(MEM)', color: 0x0891b2, x: 5, y: -1.0, w: 2.5, h: 2.5,
        title: 'Execution Lane 2 — Address Generation (AGU)', icon: '📍',
        desc: 'Dedicated to computing memory addresses for LOAD/STORE operations. Having a separate AGU means memory address calculation does not compete with ALU cycles for integer instructions.' },
      { id: 'EU3', label: 'FPU\n(FLOAT)', color: 0xd97706, x: 5, y: -4.2, w: 2.5, h: 2.5,
        title: 'Execution Lane 3 — Floating Point Unit', icon: '🔢',
        desc: 'Pipelined floating-point execution. FP operations are independent of the integer pipeline, allowing simultaneous integer + floating-point execution (common in scientific and graphics workloads).' },
      { id: 'EU4', label: 'Branch\nUnit', color: 0xdc2626, x: 5, y: -7.5, w: 2.5, h: 2.5,
        title: 'Execution Lane 4 — Branch Unit', icon: '🔀',
        desc: 'Dedicated branch execution unit. Evaluates branch conditions and computes actual branch targets. Generates the "correct vs predicted" signal to flush the pipeline on misprediction. Runs in parallel with integer/FP work.' },
    ];

    const WRITE = [
      { id: 'WB', label: 'Write-Back\n& Commit', color: 0xec4899, x: 11, y: 0, w: 3, h: 4,
        title: 'Write-Back & Commit ROB', icon: '✍️',
        desc: 'Results from ALL execution lanes are collected and written back to the register file in program order (via ROB). Multiple results can commit per cycle to match the wide dispatch width.' },
    ];

    [...COMPS_WIDE, ...LANES, ...WRITE].forEach(c => {
      const geo = new THREE.BoxGeometry(c.w, c.h, 1);
      const mat = new THREE.MeshPhongMaterial({ color: c.color, shininess: 80 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(c.x, c.y, 0);
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: c.color, opacity: 0.9, transparent: true })));
      const lbl = this._multiLabel(c.label, '#fff');
      lbl.position.set(0, c.h / 2 + 0.6, 0); lbl.scale.set(2.5, 0.95, 1); mesh.add(lbl);
      this.scene.add(mesh);
      if (!c._nochk && c.title) this.addInteractable(mesh, c.title, c.desc, c.icon);
    });

    // Flowchart connections
    this._line(-10, 0, -9, 0, 0x3b82f6);       // FETCH → DEC
    this._line(-5, 0, -4, 0, 0x6366f1);         // DEC → DISP
    // Fan-out: DISP → 5 lanes
    [5.5, 2.2, -1.0, -4.2, -7.5].forEach(y => {
      this._line(0, y < 0 ? -0.5 : 0.5, 3.75, y, 0x8b5cf6);
    });
    // All lanes → WB
    [5.5, 2.2, -1.0, -4.2, -7.5].forEach(y => {
      this._line(6.25, y, 9.5, y < 0 ? -0.5 : 0.5, 0xec4899);
    });

    // "4 instructions / cycle" arrows
    for (let i = 0; i < 4; i++) {
      const yOff = (i - 1.5) * 0.8;
      this._line(-14, yOff, -14, yOff, 0x3b82f6); // tiny markers at left
    }

    // IPC meter ring
    this.ipcRing = this._buildRingMeter();
    this.ipcRing.position.set(0, -9, 0);
    this.scene.add(this.ipcRing);

    // Instruction packets — 4 per batch
    this.batches = [];
    const COLS = [0xffcc00, 0x00ff88, 0xff4466, 0x44aaff];
    for (let b = 0; b < 3; b++) {
      const batch = [];
      for (let i = 0; i < 4; i++) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12),
          new THREE.MeshPhongMaterial({ color: COLS[i], emissive: COLS[i], emissiveIntensity: 0.5 })));
        const lbl = this.makeLabel(`I${i}`, '#fff'); lbl.scale.set(0.6, 0.35, 1); lbl.position.set(0, 0.55, 0);
        g.add(lbl);
        g.position.set(-16, (i - 1.5) * 0.8, 1.2);
        this.scene.add(g);
        batch.push({ g, lane: [5.5, 2.2, -1.0, -4.2][i] });
      }
      this.batches.push({ batch, phase: -b * 2.5 });
    }
  }

  _buildRingMeter() {
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 60;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#7c3aed'; ctx.font = 'bold 22px monospace';
    ctx.fillText('IPC Target: 4.0 (Peak Superscalar)', 10, 40);
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sp.scale.set(6, 1, 1); return sp;
  }

  _multiLabel(text, color) {
    const lines = text.split('\n');
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 96;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = color; ctx.font = 'bold 24px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 150, 28 + i * 36));
    const tex = new THREE.CanvasTexture(cv);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  }

  _line(x1, y1, x2, y2, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, 0), new THREE.Vector3(x2, y2, 0)]);
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.35, gapSize: 0.18 });
    const l = new THREE.Line(geo, mat); l.computeLineDistances(); this.scene.add(l); this.flowLines.push(l);
  }

  update(dt) {
    this.t += dt;
    this.flowLines.forEach(l => { l.material.dashOffset -= dt * 2.5; });
    this.cycleIPC = 2 + Math.sin(this.t * 0.3) * 1.2;

    const PATH_ENDS = { y_vals: [5.5, 2.2, -1.0, -4.2] };

    this.batches.forEach((b, bi) => {
      b.phase += dt / 1.4;
      const si = Math.floor(b.phase);
      const fr = b.phase - si;
      if (si >= 5) { b.phase = -bi * 2.5; b.batch.forEach((p, i) => p.g.position.set(-16, (i - 1.5) * 0.8, 1.2)); return; }
      b.batch.forEach((p, i) => {
        const laneY = PATH_ENDS.y_vals[i] || 0;
        const path = [
          { x: -16, y: (i - 1.5) * 0.8 }, { x: -12, y: (i - 1.5) * 0.5 },
          { x: -7, y: (i - 1.5) * 0.4 }, { x: -2, y: (i - 1.5) * 0.3 },
          { x: 5, y: laneY }, { x: 11, y: (i - 1.5) * 0.4 }
        ];
        if (si < 0) { p.g.position.set(-16, (i - 1.5) * 0.8, 1.2); return; }
        const ss = Math.max(0, Math.min(si, path.length - 2));
        const a = path[ss], bk = path[ss + 1];
        const py = Math.sin(fr * Math.PI) * 0.4;
        p.g.position.set(a.x + fr * (bk.x - a.x), a.y + fr * (bk.y - a.y) + py, 1.2);
        p.g.rotation.z += dt * 0.5;
      });
    });
  }

  getStats() {
    return [
      { label: 'Width', value: '4-wide' },
      { label: 'IPC', value: this.cycleIPC.toFixed(2) },
      { label: 'Exec Ports', value: '5' }
    ];
  }

  reset() { super.reset(); this.t = 0; }
}
