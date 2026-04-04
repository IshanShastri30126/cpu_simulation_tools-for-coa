// ─── OUT-OF-ORDER EXECUTION SCENE ─────────────────────────────────────────────
// Accurate OoO pipeline: Fetch → Decode → Rename(RAT) → ROB+IQ → Exec Units → CDB → Commit
// Based on Tomasulo Algorithm & modern RISC OoO microarchitecture
class OutOfOrderScene extends BaseScene {
  createScene() {
    this.theta = 0; this.phi = 0.2; this.radius = 22;
    this._updateCamera();
    this.makeGrid();
    this.addPointLight(0xf59e0b, -5, 8, 4, 2);
    this.addPointLight(0x7c3aed, 5, 8, 4, 2);
    this.addPointLight(0xffffff, 0, 12, 0, 1);

    this.flowLines = [];
    this.pendingInstructions = [];
    this.execTimers = new Array(4).fill(0);
    this.t = 0;

    const COMPS = [
      // In-Order Front End
      { id: 'IF',  label: 'Fetch\nUnit',     color: 0x3b82f6,  x: -15, y: 0, w: 2.5, h: 3.5,
        title: 'Instruction Fetch', icon: '📡',
        desc: 'Fetches multiple instructions per clock cycle from the <b>L1 Instruction Cache</b>. Relies on the <b>Branch Predictor</b> to speculatively fetch from the predicted path before branches are resolved.' },
      { id: 'ID',  label: 'Decode\nUnit',    color: 0x6366f1,  x: -11, y: 0, w: 2.5, h: 3.5,
        title: 'Decode & Micro-op Fusion', icon: '🔤',
        desc: 'Translates complex ISA instructions (e.g., x86) into simpler internal <b>micro-operations (μops)</b>. Modern CPUs fuse certain patterns (macro-fusion) for higher throughput. Up to 4-6 instructions decoded per cycle.' },
      { id: 'RAT', label: 'Register\nRename (RAT)', color: 0x8b5cf6, x: -6.5, y: 0, w: 3, h: 3.5,
        title: 'Register Alias Table (RAT)', icon: '🗺️',
        desc: 'Eliminates <b>false dependencies (WAR, WAW)</b> by mapping logical architectural registers to a larger pool of physical registers. This is what enables true out-of-order parallelism by removing artificial conflicts.' },
      // Speculative Engine
      { id: 'ROB', label: 'Reorder\nBuffer (ROB)', color: 0xd97706, x: -1.5, y: 2, w: 3, h: 3.5,
        title: 'Reorder Buffer (ROB)', icon: '🔄',
        desc: 'A circular buffer holding all in-flight instructions in <b>original program order</b>. Instructions are added at the tail and committed from the head, ensuring the CPU handles exceptions precisely and branch mispredictions cleanly.' },
      { id: 'IQ',  label: 'Issue Queue\n(Reservation Stations)', color: 0xb45309, x: -1.5, y: -2.5, w: 3.5, h: 3,
        title: 'Issue Queue / Reservation Stations', icon: '🎯',
        desc: 'Instructions wait here until all their <b>input operands are ready</b> and an execution unit is free. Instructions do NOT wait in order — any instruction whose inputs are ready is immediately "woken up" and dispatched, enabling out-of-order execution.' },
      // Execution Units
      { id: 'ALU1', label: 'INT\nALU 0',    color: 0x10b981, x: 5, y: 3.5, w: 2.2, h: 2.5,
        title: 'Integer ALU 0', icon: '➕',
        desc: 'Executes integer arithmetic (ADD, SUB), logical operations (AND, OR, XOR), and comparison instructions. Modern CPUs have 3-6 such units to enable instruction-level parallelism.' },
      { id: 'ALU2', label: 'INT\nALU 1',    color: 0x10b981, x: 5, y: 0.5, w: 2.2, h: 2.5,
        title: 'Integer ALU 1', icon: '✖️',
        desc: 'A second dedicated integer execution unit running in parallel with ALU 0. Having multiple identical units allows the CPU to execute several integer instructions simultaneously in the same cycle.' },
      { id: 'FPU',  label: 'FP / SIMD\nUnit',    color: 0x0891b2, x: 5, y: -2.5, w: 2.2, h: 2.5,
        title: 'Floating Point / SIMD Unit', icon: '🔢',
        desc: 'Handles floating-point arithmetic (IEEE 754) and SIMD vector instructions (SSE/AVX). FP operations typically have longer latency (3-5 cycles) than integer ops but are fully pipelined.' },
      { id: 'AGU',  label: 'Load/Store\nUnit (AGU)',  color: 0xdc2626, x: 5, y: -5.5, w: 2.2, h: 2.5,
        title: 'Load/Store Unit (Memory AGU)', icon: '💾',
        desc: 'The Address Generation Unit (AGU) computes memory addresses for LOAD/STORE operations. It interfaces with the <b>Data Cache</b> and the <b>Load-Store Queue</b> to maintain memory ordering.' },
      // Common Data Bus & Commit
      { id: 'CDB', label: 'Common\nData Bus',  color: 0xf472b6, x: 10.5, y: 0, w: 2.2, h: 5,
        title: 'Common Data Bus (CDB)', icon: '🚌',
        desc: 'After execution, results are <b>broadcast on the CDB</b> to all reservation stations simultaneously. Any instruction waiting for that result is immediately "woken up" and becomes eligible to execute, achieving true dynamic scheduling.' },
      { id: 'CMT', label: 'Commit /\nRetire',    color: 0xec4899, x: 15, y: 0, w: 2.8, h: 3.5,
        title: 'Commit / Retire Logic', icon: '✅',
        desc: 'Reads from the <b>head of the ROB</b>. When the oldest instruction is marked "done" and no exceptions occurred, it <b>permanently commits</b> its result to the architectural register file, maintaining program-order correctness despite out-of-order execution.' },
    ];

    this.meshMap = {};
    COMPS.forEach(c => {
      const geo = new THREE.BoxGeometry(c.w, c.h, 1);
      const mat = new THREE.MeshPhongMaterial({ color: c.color, shininess: 80 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(c.x, c.y, 0);
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: c.color, transparent: true, opacity: 0.9 })));
      const lbl = this._multiLabel(c.label, '#fff');
      lbl.position.set(0, c.h / 2 + 0.6, 0); lbl.scale.set(2.4, 1.0, 1);
      mesh.add(lbl);
      this.scene.add(mesh);
      this.meshMap[c.id] = mesh;
      if (c.title) this.addInteractable(mesh, c.title, c.desc, c.icon);
    });

    // ── Flowchart connections ──
    // Front-end in-order chain
    this._line(-13.75, 0, -12.25, 0, 0x3b82f6);            // IF→ID
    this._line(-9.75, 0, -8, 0, 0x6366f1);                   // ID→RAT
    // Fan out: RAT → ROB + IQ
    this._line(-5, 1.2, -3, 2, 0x8b5cf6);                    // RAT→ROB
    this._line(-5, -0.5, -3.25, -2.5, 0x8b5cf6);             // RAT→IQ
    // IQ → Execution Units
    this._line(0, 3.5, 3.9, 3.5, 0xd97706);                  // IQ→ALU1
    this._line(0, 0.5, 3.9, 0.5, 0xd97706);                  // IQ→ALU2
    this._line(0, -2.5, 3.9, -2.5, 0xd97706);                // IQ→FPU
    this._line(0, -5.5, 3.9, -5.5, 0xd97706);                // IQ→AGU
    // All Exec Units → CDB
    [3.5, 0.5, -2.5, -5.5].forEach(y => this._line(6.1, y, 9.4, y, 0xf472b6));
    // CDB → Commit
    this._line(11.6, 0, 13.6, 0, 0xf472b6);
    // ROB → Commit
    this._line(0, 2, 15, 2, 0xd97706);
    // Commit writeback arc (bottom loop back to RAT)
    const wbPts = [
      new THREE.Vector3(16.4, 0, 0), new THREE.Vector3(18, 0, 0),
      new THREE.Vector3(18, -8, 0), new THREE.Vector3(-6.5, -8, 0),
      new THREE.Vector3(-6.5, -1.75, 0)
    ];
    this._polyLine(wbPts, 0xcc44ff);
    const wbLbl = this.makeLabel('Write-Back to Arch Reg File', '#cc44ff');
    wbLbl.position.set(5.75, -8.7, 0); wbLbl.scale.set(4, 0.6, 1);
    this.scene.add(wbLbl);

    // Section labels
    const sectionLabel = (text, x, y, col) => {
      const lbl = this.makeLabel(text, col);
      lbl.position.set(x, y, 0); lbl.scale.set(3, 0.55, 1);
      this.scene.add(lbl);
    };
    sectionLabel('IN-ORDER FRONT-END', -11, -3.5, '#3b82f6');
    sectionLabel('OoO ENGINE', 1.5, 5, '#f59e0b');
    sectionLabel('EXECUTE', 5, 6.5, '#10b981');
    sectionLabel('COMMIT', 15, -2.5, '#ec4899');

    // Particle packets
    this.packets = [];
    const COLS = [0xffcc00, 0x00ff88, 0xff4466, 0x44aaff, 0xff8800, 0xcc44ff];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12),
        new THREE.MeshPhongMaterial({ color: COLS[i], emissive: COLS[i], emissiveIntensity: 0.5 })));
      const lbl = this.makeLabel(`μop${i}`, '#fff');
      lbl.scale.set(0.8, 0.35, 1); lbl.position.set(0, 0.6, 0); g.add(lbl);
      g.position.set(-18, 0, 1.2);
      this.scene.add(g);
      this.packets.push({ g, phase: -i * 1.2, color: COLS[i] });
    }
  }

  _multiLabel(text, color) {
    const lines = text.split('\n');
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 96;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = 'bold 26px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 150, 26 + i * 36));
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    return sp;
  }

  _line(x1, y1, x2, y2, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, 0), new THREE.Vector3(x2, y2, 0)]);
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.4, gapSize: 0.2 });
    const l = new THREE.Line(geo, mat); l.computeLineDistances();
    this.scene.add(l); this.flowLines.push(l);
  }

  _polyLine(pts, color) {
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.4, gapSize: 0.2 });
    const l = new THREE.Line(geo, mat); l.computeLineDistances();
    this.scene.add(l); this.flowLines.push(l);
  }

  update(dt) {
    this.t += dt;
    this.flowLines.forEach(l => { l.material.dashOffset -= dt * 2; });

    // Path phases for packets: IF → ID → RAT → IQ → (one of 4 EU) → CDB → CMT
    const PATH = [
      { x: -15, y: 0 }, { x: -11, y: 0 }, { x: -6.5, y: 0 },
      { x: -1.5, y: -2.5 }, { x: 5, y: 0.5 },  // IQ then ALU
      { x: 10.5, y: 0 }, { x: 15, y: 0 }
    ];

    this.packets.forEach((p, pi) => {
      p.phase += dt / 1.1;
      const si = Math.floor(p.phase);
      const fr = p.phase - si;
      if (si >= PATH.length - 1) { p.phase = -pi * 0.9; p.g.position.set(-18, 0, 1.2); return; }
      if (si < 0) { p.g.position.set(-18 + fr * 3, 0, 1.2); return; }
      const a = PATH[si], b = PATH[si + 1];
      const py = Math.sin(fr * Math.PI) * 0.5;
      p.g.position.set(a.x + fr * (b.x - a.x), a.y + fr * (b.y - a.y) + py, 1.2);
      p.g.children[0].material.emissiveIntensity = 0.4 + Math.sin(this.t * 5 + pi) * 0.3;
    });

    // Pulse exec units randomly
    ['ALU1', 'ALU2', 'FPU', 'AGU'].forEach((id, i) => {
      const m = this.meshMap[id];
      if (!m) return;
      const pulse = Math.abs(Math.sin(this.t * 2 + i * 1.3));
      m.material.emissiveIntensity = pulse * 0.25;
    });
  }

  getStats() {
    const ipc = (2 + Math.sin(this.t * 0.4) * 0.8).toFixed(1);
    return [
      { label: 'IPC (OoO)', value: ipc },
      { label: 'ROB Entries', value: '224' },
      { label: 'Issue Ports', value: '6' }
    ];
  }

  reset() { super.reset(); this.t = 0; this.packets.forEach((p, i) => { p.phase = -i * 0.9; p.g.position.set(-18, 0, 1.2); }); }
}
