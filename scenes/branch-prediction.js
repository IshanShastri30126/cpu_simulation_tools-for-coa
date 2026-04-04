// ─── BRANCH PREDICTION SCENE ──────────────────────────────────────────────────
// Accurate: PC → BTB (target lookup) + BHT (2-bit saturating counter direction)
// → MUX → Next PC. On resolution: Update BHT + BTB, or Flush pipeline
class BranchPredictionScene extends BaseScene {
  createScene() {
    this.theta = 0; this.phi = 0.2; this.radius = 18;
    this._updateCamera();
    this.makeGrid();
    this.addPointLight(0x10b981, -6, 8, 4, 2);
    this.addPointLight(0xef4444, 6, 8, 4, 2);

    this.flowLines = [];
    this.t = 0;
    this.prediction = 'TAKEN';
    this.predictionTimer = 0;
    this.correctPredictions = 0;
    this.totalPredictions = 0;

    const comps = [
      // Fetch side
      { id: 'PC',  label: 'Program\nCounter (PC)', color: 0x3b82f6, x: -12, y: 0, w: 2.5, h: 3,
        title: 'Program Counter (PC)', icon: '📍',
        desc: 'Holds the address of the <b>current instruction</b> being fetched. The PC is simultaneously sent to the BTB and BHT so the CPU can predict the next address <em>before</em> the instruction has even been decoded.' },
      { id: 'BTB', label: 'Branch Target\nBuffer (BTB)', color: 0x7c3aed, x: -6, y: 2.5, w: 3, h: 3.5,
        title: 'Branch Target Buffer (BTB)', icon: '🎯',
        desc: 'A cache indexed by PC bits. Stores the <b>target address</b> of recently-seen branches. If a BTB hit occurs, the CPU knows this PC is a branch instruction and retrieves the predicted destination address immediately — before decode.' },
      { id: 'BHT', label: '2-Bit Counter\nPredictor (BHT)', color: 0x2563eb, x: -6, y: -2.5, w: 3, h: 3.5,
        title: 'Branch History Table (BHT) — 2-Bit Saturating Counter', icon: '🧮',
        desc: 'A table of 2-bit saturating counters (00=StrongNT, 01=WeakNT, 10=WeakT, 11=StrongT). The MSB predicts direction. <b>Two consecutive mispredictions</b> are needed to flip the prediction, providing hysteresis for loops and reducing thrash.' },
      { id: 'MUX', label: 'Next-PC\nSelector MUX', color: 0x0891b2, x: 0, y: 0, w: 2.5, h: 3,
        title: 'Next-PC Multiplexer', icon: '🔀',
        desc: 'Selects the next PC value based on the prediction outcome: either the <b>BTB target address</b> (if predicted Taken) or <b>PC + 4</b> (if predicted Not-Taken). This allows the CPU to continue fetching speculatively.' },
      { id: 'IF',  label: 'Instruction\nFetch (Speculative)', color: 0x10b981, x: 5, y: 0, w: 3, h: 3,
        title: 'Speculative Instruction Fetch', icon: '⚡',
        desc: 'After the MUX selects the predicted next PC, the CPU <b>speculatively fetches</b> from that address. If the prediction is wrong, all speculatively fetched instructions are discarded (pipeline flush). This is the performance gamble of branch prediction.' },
      // Resolution path
      { id: 'EX',  label: 'Execute\n(Branch Resolve)', color: 0xf59e0b, x: 5, y: -5, w: 3, h: 3,
        title: 'Execute Stage — Branch Resolution', icon: '✅',
        desc: 'The actual branch condition is evaluated in the ALU (e.g., is Register A == 0?). This produces the <b>actual taken/not-taken outcome</b>. If it differs from the prediction, a <b>pipeline flush</b> is triggered, discarding misspeculated instructions.' },
      { id: 'UPD', label: 'Update\nBHT + BTB', color: 0x16a34a, x: -2, y: -5, w: 3, h: 3,
        title: 'Predictor Update Logic', icon: '🔄',
        desc: 'After the branch resolves, the BHT counter for this PC is <b>incremented (Taken) or decremented (Not-Taken)</b>, clipping at 11 or 00. If the BTB did not have this target, it is inserted. This learning improves future predictions for repeated patterns.' },
      { id: 'FLH', label: '⚠ Pipeline\nFlush', color: 0xef4444, x: -2, y: 5, w: 3, h: 3,
        title: 'Pipeline Flush on Misprediction', icon: '🔥',
        desc: 'When prediction is WRONG, all instructions fetched after the branch are <b>squashed (killed)</b>. The CPU wastes the cycles spent fetching/decoding wrong-path instructions. Cost = pipeline depth × branch frequency × misprediction rate.' },
    ];

    this.meshMap = {};
    comps.forEach(c => {
      const geo = new THREE.BoxGeometry(c.w, c.h, 1);
      const mat = new THREE.MeshPhongMaterial({ color: c.color, shininess: 80 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(c.x, c.y, 0);
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: c.color, opacity: 0.9, transparent: true })));
      const lbl = this._multiLabel(c.label, '#fff');
      lbl.position.set(0, c.h / 2 + 0.6, 0); lbl.scale.set(2.5, 0.95, 1); mesh.add(lbl);
      this.scene.add(mesh); this.meshMap[c.id] = mesh;
      if (c.title) this.addInteractable(mesh, c.title, c.desc, c.icon);
    });

    // 2-bit counter state display
    this.counterMesh = this._buildCounterDisplay();
    this.counterMesh.position.set(-6, -2.5, 0.6);
    this.scene.add(this.counterMesh);

    // ── Flowchart lines ──
    // PC → BTB and PC → BHT (parallel lookup)
    this._line(-10.75, 0.8, -7.5, 2.5, 0x7c3aed);   // PC → BTB
    this._line(-10.75, -0.8, -7.5, -2.5, 0x2563eb);  // PC → BHT
    // BTB & BHT → MUX
    this._line(-4.5, 2.5, -1.25, 0.4, 0x7c3aed);
    this._line(-4.5, -2.5, -1.25, -0.4, 0x2563eb);
    // MUX → Spec Fetch
    this._line(1.25, 0, 3.5, 0, 0x0891b2);
    // Spec Fetch → Execute (downward)
    this._line(5, -1.5, 5, -3.5, 0xf59e0b);
    // Execute → Update BHT+BTB (left path)
    this._line(3.5, -5, -0.5, -5, 0x16a34a);
    // Update → BHT (back to predictor)
    this._line(-2, -6.5, -6, -4.25, 0x16a34a);
    // Execute → Flush (upward when wrong)
    this._polyLine([
      new THREE.Vector3(3.5, -5, 0),
      new THREE.Vector3(9, -5, 0),
      new THREE.Vector3(9, 5, 0),
      new THREE.Vector3(-0.5, 5, 0)
    ], 0xef4444);
    // Flush back to IF (arrows back to spec fetch)
    this._line(-0.5, 5, 3.5, 0.8, 0xef4444);

    // Labels
    const l = (text, x, y, col) => {
      const s = this.makeLabel(text, col); s.position.set(x, y, 0); s.scale.set(3, 0.55, 1); this.scene.add(s);
    };
    l('CORRECT → 2-bit++', -2, -6.2, '#16a34a');
    l('WRONG → FLUSH PIPELINE', 5.5, 3, '#ef4444');

    // Animated packets (instructions in flight)
    this.packets = [];
    ['TAKEN', 'NOT-TAKEN', 'TAKEN', 'TAKEN', 'NOT-TAKEN'].forEach((pred, i) => {
      const g = new THREE.Group();
      const col = pred === 'TAKEN' ? 0x10b981 : 0xef4444;
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12),
        new THREE.MeshPhongMaterial({ color: col, emissive: col, emissiveIntensity: 0.5 })));
      const lbl = this.makeLabel(pred, '#fff'); lbl.scale.set(1, 0.4, 1); lbl.position.set(0, 0.7, 0);
      g.add(lbl);
      g.position.set(-15, 0, 1.2);
      this.scene.add(g);
      this.packets.push({ g, phase: -i * 1.5, pred });
    });
  }

  _buildCounterDisplay() {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 180;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.clearRect(0, 0, 256, 180);
    // Draw counter states
    const states = [['11', 'Strongly\nTaken', '#10b981'], ['10', 'Weakly\nTaken', '#84cc16'],
                    ['01', 'Weakly\nNot Taken', '#f59e0b'], ['00', 'Strongly\nNT', '#ef4444']];
    states.forEach(([val, name, col], i) => {
      ctx.fillStyle = col;
      ctx.fillRect(8, 10 + i * 42, 50, 34);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(val, 24, 34 + i * 42);
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText(name.split('\n')[0], 70, 32 + i * 42);
    });
    const tex = new THREE.CanvasTexture(cv);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  }

  _multiLabel(text, color) {
    const lines = text.split('\n');
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 100;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = color; ctx.font = 'bold 24px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 150, 28 + i * 36));
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    return sp;
  }

  _line(x1, y1, x2, y2, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, 0), new THREE.Vector3(x2, y2, 0)]);
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.35, gapSize: 0.2 });
    const l = new THREE.Line(geo, mat); l.computeLineDistances(); this.scene.add(l); this.flowLines.push(l);
  }
  
  _polyLine(pts, color) {
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.35, gapSize: 0.2 });
    const l = new THREE.Line(geo, mat); l.computeLineDistances(); this.scene.add(l); this.flowLines.push(l);
  }

  update(dt) {
    this.t += dt;
    this.flowLines.forEach(l => { l.material.dashOffset -= dt * 2.5; });

    this.predictionTimer += dt;
    if (this.predictionTimer > 3) {
      this.predictionTimer = 0;
      this.totalPredictions++;
      // Simulate ~88% accuracy
      const correct = Math.random() < 0.88;
      this.prediction = correct ? 'HIT ✓' : 'MISS ✗';
      if (correct) this.correctPredictions++;
      const m = this.meshMap['FLH'];
      if (m) {
        m.material.emissiveIntensity = correct ? 0 : 0.6;
        m.material.emissive.setHex(correct ? 0x000000 : 0xef4444);
      }
    }

    // Packets flow: PC → MUX → SpecIF → EX then back
    const PATH = [{ x: -12, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: -5 }, { x: -2, y: -5 }];
    this.packets.forEach((p, pi) => {
      p.phase += dt / 1.2;
      const si = Math.floor(p.phase);
      const fr = p.phase - si;
      if (si >= PATH.length - 1) { p.phase = -pi * 1.2; p.g.position.set(-15, 0, 1.2); return; }
      if (si < 0) { p.g.position.set(-15, 0, 1.2); return; }
      const a = PATH[si], b = PATH[si + 1];
      const py = Math.sin(fr * Math.PI) * 0.5;
      p.g.position.set(a.x + fr * (b.x - a.x), a.y + fr * (b.y - a.y) + py, 1.2);
    });

    const pm = this.meshMap['BHT'];
    if (pm) { pm.material.emissiveIntensity = Math.abs(Math.sin(this.t * 2)) * 0.2; }
  }

  getStats() {
    const acc = this.totalPredictions > 0 ? ((this.correctPredictions / this.totalPredictions) * 100).toFixed(1) : '88.0';
    return [
      { label: 'Last Prediction', value: this.prediction },
      { label: 'Accuracy', value: `${acc}%` },
      { label: 'Flush Cost', value: '~14 cycles' }
    ];
  }

  reset() { super.reset(); this.t = 0; this.correctPredictions = 0; this.totalPredictions = 0; }
}
