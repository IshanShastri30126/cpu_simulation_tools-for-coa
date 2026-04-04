// ─── PIPELINING SCENE ─────────────────────────────────────────────────────────
// Accurate 5-stage RISC pipeline: IF → ID → EX → MEM → WB
// Flowchart: Linear left-to-right with data path + writeback loop
// Sources: Patterson & Hennessy "Computer Organization and Design"
class PipeliningScene extends BaseScene {
  createScene() {
    this.theta = 0.0; this.phi = 0.15; this.radius = 20;
    this._updateCamera();
    this.makeGrid();
    this.addPointLight(0x00f5ff, -8, 6, 4, 2);
    this.addPointLight(0xf59e0b,  8, 6, 4, 2);
    this.addPointLight(0xffffff,  0, 10, 0, 1);

    // ── Stage definitions (accurate RISC components) ──
    const STAGES = [
      { id: 'IF',  label: 'IF\nFetch',     color: 0x3b82f6, x: -9,  subLabel: 'I-Cache',
        title: 'Instruction Fetch (IF)',
        icon: '📡',
        desc: 'The CPU reads the next instruction from the <b>Instruction Cache</b> using the address stored in the <b>Program Counter (PC)</b>. The PC is then incremented to point to the next instruction (PC + 4 for 32-bit ISAs). This happens every clock cycle.' },
      { id: 'LT1', label: 'IF/ID\nReg',    color: 0x475569, x: -5.5, subLabel: 'Buffer',
        title: 'IF/ID Pipeline Register',
        icon: '📦',
        desc: 'A hardware register that sits between the Fetch and Decode stages. It captures the fetched raw instruction bits and the PC+4 value, holding them until the Decode stage is ready in the next clock cycle.' },
      { id: 'ID',  label: 'ID\nDecode',    color: 0x8b5cf6, x: -2,  subLabel: 'Reg File + Ctrl',
        title: 'Instruction Decode (ID)',
        icon: '🔤',
        desc: 'The binary instruction is decoded into control signals. The <b>Register File</b> is read to retrieve the input values (operands). Read happens here speculatively — the CPU reads ALL possible register sources in parallel.' },
      { id: 'LT2', label: 'ID/EX\nReg',    color: 0x475569, x: 1.5, subLabel: 'Buffer',
        title: 'ID/EX Pipeline Register',
        icon: '📦',
        desc: 'Carries the decoded control signals, the fetched register values (A and B), and the sign-extended immediate to the Execute stage.' },
      { id: 'EX',  label: 'EX\nExecute',   color: 0x10b981, x: 5,   subLabel: 'ALU',
        title: 'Execute / ALU (EX)',
        icon: '⚡',
        desc: 'The <b>Arithmetic Logic Unit (ALU)</b> performs the computation: addition, subtraction, bitwise ops, or address calculation. A <b>MUX</b> selects between the registered value and an immediate operand. ALU also computes the branch target address.' },
      { id: 'LT3', label: 'EX/MEM\nReg',   color: 0x475569, x: 8.5, subLabel: 'Buffer',
        title: 'EX/MEM Pipeline Register',
        icon: '📦',
        desc: 'Carries the ALU result, the data for a potential store instruction, the branch target, and the Zero flag signal to the Memory stage.' },
      { id: 'MEM', label: 'MEM\nMemory',   color: 0xf59e0b, x: 12,  subLabel: 'D-Cache',
        title: 'Memory Access (MEM)',
        icon: '🗄️',
        desc: 'For <code>LOAD</code> instructions, reads data from the <b>Data Cache</b>. For <code>STORE</code> instructions, writes data to the Data Cache. The Zero flag from the ALU is used here to decide if a branch should be taken, triggering a potential pipeline flush.' },
      { id: 'LT4', label: 'MEM/WB\nReg',   color: 0x475569, x: 15.5, subLabel: 'Buffer',
        title: 'MEM/WB Pipeline Register',
        icon: '📦',
        desc: 'Carries the loaded data (from LOAD instruction) or the ALU result (for arithmetic) to the final Write-Back stage.' },
      { id: 'WB',  label: 'WB\nWriteback', color: 0xec4899, x: 19,  subLabel: 'Reg File',
        title: 'Write Back (WB)',
        icon: '✍️',
        desc: 'The final result is written back to the <b>Register File</b>. A MUX selects between the ALU result (arithmetic) and the memory read data (LOAD). After this stage, the instruction has fully committed.' },
    ];

    this.stageMeshes = [];
    this.flowLines   = [];

    const Y_TOP = 2, Y_BOT = -2;

    STAGES.forEach((s) => {
      const isBuffer = s.id.startsWith('LT');
      const w = isBuffer ? 0.6 : 2.5;
      const h = isBuffer ? 6   : 4;

      const geo  = new THREE.BoxGeometry(w, h, 1.2);
      const mat  = new THREE.MeshPhongMaterial({ color: s.color, shininess: 80 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(s.x, 0, 0);

      // Glowing edge
      const edges = new THREE.EdgesGeometry(geo);
      mesh.add(new THREE.LineSegments(edges,
        new THREE.LineBasicMaterial({ color: s.color, transparent: true, opacity: 0.8 })));

      // Label sprite
      const lbl = this._makeMultilineLabel(s.label, '#ffffff', isBuffer ? 24 : 28);
      lbl.position.set(0, h / 2 + 0.7, 0);
      lbl.scale.set(isBuffer ? 1.2 : 2.2, isBuffer ? 0.8 : 1.0, 1);
      mesh.add(lbl);

      // Sub-label
      if (s.subLabel && !isBuffer) {
        const sub = this.makeLabel(s.subLabel, '#94a3b8');
        sub.scale.set(1.8, 0.5, 1);
        sub.position.set(0, -1.5, 0.65);
        mesh.add(sub);
      }

      this.scene.add(mesh);
      this.stageMeshes.push({ mesh, s });

      if (!isBuffer && s.title) {
        this.addInteractable(mesh, s.title, s.desc, s.icon);
      }
    });

    // ── Animated flowchart arrows between stages ──
    this._addFlowLine(-10.5, 0, -10, 0, 0x00f5ff);    // Incoming
    for (let i = 0; i < STAGES.length - 1; i++) {
      const from = STAGES[i], to = STAGES[i + 1];
      const xEnd = to.x - (to.id.startsWith('LT') ? 0.3 : 1.25);
      const xStart = from.x + (from.id.startsWith('LT') ? 0.3 : 1.25);
      this._addFlowLine(xStart, 0, xEnd, 0, from.color);
    }

    // PC feedback loop (writeback to IF – the program ordering loop)
    const loopPts = [
      new THREE.Vector3(19 + 1.25, 0, 0),
      new THREE.Vector3(21, 0, 0),
      new THREE.Vector3(21, -4, 0),
      new THREE.Vector3(-11, -4, 0),
      new THREE.Vector3(-11, 0, 0),
      new THREE.Vector3(-10, 0, 0),
    ];
    this._addPolyFlowLine(loopPts, 0xcc44ff);

    // Branch flush feedback (EX → IF flush path, top)
    const branchPts = [
      new THREE.Vector3(5 + 1.25, 2, 0),
      new THREE.Vector3(5 + 2.5, 4.5, 0),
      new THREE.Vector3(-11, 4.5, 0),
      new THREE.Vector3(-11, 0, 0),
    ];
    this._addPolyFlowLine(branchPts, 0xef4444, true);
    const brLabel = this.makeLabel('Branch Flush', '#ef4444');
    brLabel.position.set(-3, 5.2, 0);
    brLabel.scale.set(2.5, 0.6, 1);
    this.scene.add(brLabel);

    // PC Label
    const pcLabel = this.makeLabel('PC Counter', '#3b82f6');
    pcLabel.position.set(-10.8, 0.8, 0);
    pcLabel.scale.set(2.2, 0.5, 1);
    this.scene.add(pcLabel);

    // ── Instruction packets ──
    const COLORS = [0xffcc00, 0x00ff88, 0xff4466, 0x44aaff, 0xff8800, 0xcc44ff, 0x00ffcc, 0xff66aa];
    this.packets = [];
    const PIPE_X = [-9, -2, 5, 12, 19];
    for (let i = 0; i < 8; i++) {
      const grp = new THREE.Group();
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 16, 16),
        new THREE.MeshPhongMaterial({ color: COLORS[i % 8], emissive: COLORS[i % 8], emissiveIntensity: 0.6 })
      );
      grp.add(sphere);
      const ilbl = this.makeLabel(`I${i}`, '#fff');
      ilbl.scale.set(0.6, 0.35, 1); ilbl.position.set(0, 0.8, 0);
      grp.add(ilbl);
      grp.position.set(-15, 0, 1.5);
      this.scene.add(grp);
      this.packets.push({ grp, stageProgress: -i * 1.0 });
    }

    this.stageActiveTime = new Array(5).fill(0);
    this.hazardTimer = 0;
    this.stallLabel = this.makeLabel('⚠ DATA HAZARD – STALL', '#ef4444');
    this.stallLabel.position.set(0, 6.5, 0);
    this.stallLabel.scale.set(4, 0.8, 1);
    this.stallLabel.material.opacity = 0;
    this.scene.add(this.stallLabel);
  }

  _makeMultilineLabel(text, color, fontSize = 28) {
    const lines = text.split('\n');
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 96;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 128, 28 + i * 36));
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sp.scale.set(2.5, 0.9, 1);
    return sp;
  }

  _addFlowLine(x1, y1, x2, y2, color, dashed = false) {
    const pts = [new THREE.Vector3(x1, y1, 0), new THREE.Vector3(x2, y2, 0)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.4, gapSize: 0.2, linewidth: 2 });
    const line = new THREE.Line(geo, mat); line.computeLineDistances();
    this.scene.add(line); this.flowLines.push(line);
  }

  _addPolyFlowLine(pts, color, dashed = false) {
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({ color, dashSize: dashed ? 0.3 : 0.5, gapSize: dashed ? 0.3 : 0.15, linewidth: 2 });
    const line = new THREE.Line(geo, mat); line.computeLineDistances();
    this.scene.add(line); this.flowLines.push(line);
  }

  update(dt) {
    this.flowLines.forEach(l => { l.material.dashOffset -= dt * 2.5; });

    const STAGE_X = [-9, -2, 5, 12, 19];
    this.packets.forEach((p, pi) => {
      p.stageProgress += dt / 1.3;
      const si = Math.floor(p.stageProgress);
      const fr = p.stageProgress - si;
      if (si >= 5) { p.stageProgress = -pi * 0.7 - 0.5; p.grp.position.set(-15, 0, 1.5); return; }
      if (si < 0)  { p.grp.position.set(-15 + fr * 6, 0, 1.5); return; }
      const fromX = STAGE_X[si], toX = si < 4 ? STAGE_X[si + 1] : STAGE_X[si] + 7;
      const px = fromX + fr * (toX - fromX);
      const py = Math.sin(fr * Math.PI) * 0.8;
      p.grp.position.set(px, py, 1.5);
      p.grp.rotation.z += dt * 0.5;
      this.stageActiveTime[si] = 0.2;
    });

    this.stageActiveTime.forEach((t, i) => {
      const s = this.stageMeshes.filter(sm => ['IF', 'ID', 'EX', 'MEM', 'WB'][i] === sm.s.id);
      if (!s.length) return;
      const m = s[0].mesh;
      if (t > 0) { this.stageActiveTime[i] -= dt; m.material.emissive.setHex(0x222222); m.scale.set(1.06, 1.06, 1.06); }
      else { m.material.emissive.setHex(0x000000); m.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1); }
    });

    this.hazardTimer += dt;
    if (this.hazardTimer > 9) {
      this.hazardTimer = 0;
      this.stallLabel.material.opacity = 1;
      this.packets.forEach(p => { if (p.stageProgress > 0 && p.stageProgress < 2) p.stageProgress -= 1.5; });
    }
    if (this.stallLabel.material.opacity > 0) this.stallLabel.material.opacity -= dt * 0.4;
  }

  getStats() {
    const a = this.stageActiveTime.filter(t => t > 0).length;
    return [
      { label: 'Active Stages', value: `${a}/5` },
      { label: 'Throughput', value: `${(a / 5 * 100).toFixed(0)}%` },
      { label: 'IPC', value: a > 0 ? '~1.0' : '0.0' }
    ];
  }

  reset() { super.reset(); this.packets.forEach((p, i) => { p.stageProgress = -i; p.grp.position.set(-15, 0, 1.5); }); this.hazardTimer = 0; }
}
