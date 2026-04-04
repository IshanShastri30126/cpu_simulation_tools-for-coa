// ─── SIMD SCENE ───────────────────────────────────────────────────────────────
// Accurate SSE/AVX: Scalar vs Vector registers, SIMD ALU lanes, data parallelism
// Flowchart: Memory load → Pack into vector register → SIMD ALU (8 lanes) → Unpack
class SIMDScene extends BaseScene {
  createScene() {
    this.theta = 0; this.phi = 0.2; this.radius = 20;
    this._updateCamera();
    this.makeGrid();
    this.addPointLight(0xff8800, -6, 8, 4, 2.5);
    this.addPointLight(0x3b82f6, 6, 8, 4, 2.5);

    this.flowLines = [];
    this.t = 0;
    this.frameCount = 0;

    // ── SCALAR path (top half) ──
    const scalarY = 5;
    this._buildBlock('Memory\n(Load Array)', 0x475569, -12, scalarY, 3, 2.8,
      'Memory — Source Array', '💾',
      'The source data array sits in the <b>Data Cache or DRAM</b>. For scalar code, only a single element is loaded at a time into a general-purpose register (GPR). For SIMD, an entire aligned 256-bit chunk (8 floats) is loaded at once to fill a YMM register.');

    // Scalar registers (8 individual boxes)
    this.scalarRegs = [];
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.BoxGeometry(0.8, 0.8, 0.6);
      const mat = new THREE.MeshPhongMaterial({ color: 0x64748b });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(-7.5 + i * 1.0, scalarY, 0);
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.8 })));
      this.scene.add(mesh);
      this.scalarRegs.push(mesh);
    }
    const scRLbl = this.makeLabel('8 Scalar GPRs (one element each)', '#64748b');
    scRLbl.position.set(-3.5, scalarY + 1.0, 0); scRLbl.scale.set(4.5, 0.5, 1);
    this.scene.add(scRLbl);

    // Scalar ALU (8 sequential operations)
    this.scalarALUs = [];
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.BoxGeometry(0.8, 0.8, 0.6);
      const mat = new THREE.MeshPhongMaterial({ color: 0x4b5563 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(-7.5 + i * 1.0, scalarY - 2.2, 0);
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x6b7280, transparent: true, opacity: 0.8 })));
      this.scene.add(mesh);
      this.scalarALUs.push(mesh);
    }
    const scALbl = this.makeLabel('8 ALU Ops (sequential, 8 cycles!)', '#ef4444');
    scALbl.position.set(-3.5, scalarY - 2.9, 0); scALbl.scale.set(4.5, 0.5, 1);
    this.scene.add(scALbl);

    // Scalar output  
    this._buildBlock('8× Scalar\nResult', 0x374151, 3, scalarY - 2.2, 2.5, 2,
      'Scalar Output', '📦', 'After 8 sequential ALU operations (one per loop iteration), all 8 results are available. Total: 8 cycles.');

    // ── SIMD path (bottom half) ──
    const simdY = -1;
    this._buildBlock('Memory\n(Load Vector)', 0x1e40af, -12, simdY, 3, 2.8,
      'Memory — Vector Load', '💾',
      'A <b>single 256-bit VMOVUPS or VMOVAPS instruction</b> loads 8 single-precision floats from a 32-byte aligned memory address simultaneously into one YMM register. This is the "multiple data" part of SIMD — one load, 8 values.');

    // YMM register (wide)
    const ymmGeo = new THREE.BoxGeometry(8.1, 1.2, 0.8);
    const ymmMat = new THREE.MeshPhongMaterial({ color: 0x1d4ed8 });
    this.ymmMesh = new THREE.Mesh(ymmGeo, ymmMat);
    this.ymmMesh.position.set(-3.5, simdY, 0);
    this.ymmMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(ymmGeo),
      new THREE.LineBasicMaterial({ color: 0x3b82f6, opacity: 0.9, transparent: true })));
    this.scene.add(this.ymmMesh);
    this.addInteractable(this.ymmMesh, 'YMM Register — 256-bit Vector Register',
      'A 256-bit YMM register holds <b>8 × 32-bit floats</b> simultaneously (or 4 × 64-bit doubles, or 32 × 8-bit integers). It is the core of AVX (Advanced Vector Extensions). The lower 128 bits form the XMM register for SSE compatibility.',
      '📏');

    // 8 lanes inside YMM
    this.laneBoxes = [];
    const LANE_COLORS = [0xef4444, 0xf97316, 0xeab308, 0x22c55e, 0x06b6d4, 0x6366f1, 0xec4899, 0x8b5cf6];
    for (let i = 0; i < 8; i++) {
      const lGeo = new THREE.BoxGeometry(0.85, 1.0, 0.6);
      const lMat = new THREE.MeshPhongMaterial({ color: LANE_COLORS[i], emissive: LANE_COLORS[i], emissiveIntensity: 0.3 });
      const lm = new THREE.Mesh(lGeo, lMat);
      lm.position.set(-7.5 + 0.5 + i * 1.05, simdY, 0.5);
      const lbl = this.makeLabel(`F${i}`, '#fff'); lbl.scale.set(0.5, 0.38, 1); lbl.position.set(0, 0.7, 0); lm.add(lbl);
      this.scene.add(lm);
      this.laneBoxes.push(lm);
    }
    const ymmLbl = this.makeLabel('YMM0 — 256-bit (8× float32 lanes)', '#3b82f6');
    ymmLbl.position.set(-3.5, simdY + 1.0, 0); ymmLbl.scale.set(5, 0.5, 1); this.scene.add(ymmLbl);

    // SIMD ALU (all 8 lanes, ONE wide block)
    const simdAluGeo = new THREE.BoxGeometry(8.1, 1.5, 0.9);
    const simdAluMat = new THREE.MeshPhongMaterial({ color: 0x065f46 });
    this.simdALU = new THREE.Mesh(simdAluGeo, simdAluMat);
    this.simdALU.position.set(-3.5, simdY - 2.5, 0);
    this.simdALU.add(new THREE.LineSegments(new THREE.EdgesGeometry(simdAluGeo),
      new THREE.LineBasicMaterial({ color: 0x10b981, opacity: 0.9, transparent: true })));
    const simdAluLbl = this._multiLabel('AVX Vector ALU — 8 lanes operate simultaneously in 1 cycle', '#10b981');
    simdAluLbl.position.set(0, 1.2, 0); simdAluLbl.scale.set(8, 0.7, 1); this.simdALU.add(simdAluLbl);
    this.scene.add(this.simdALU);
    this.addInteractable(this.simdALU, 'SIMD Vector ALU (AVX) — All 8 Lanes',
      'A single <b>VADDPS instruction</b> feeds all 8 float lanes into 8 parallel adder circuits <em>simultaneously</em>. The result is 8 additions completed in the <b>same single cycle</b>. This is why SIMD delivers up to 8× speedup on float-heavy code.',
      '⚡');

    // SIMD output register
    this._buildBlock('YMM Result\n(8 results, 1 cycle!)', 0x166534, 4, simdY - 2.5, 3, 2,
      'SIMD Output — YMM Result Register', '🚀',
      'All 8 results are stored back into a YMM result register in a <b>single clock cycle</b>. Compare this to the 8 cycles needed for scalar! VSTORE then saves the 256 bits back to memory in one instruction.');

    // Labels for the two paths
    const pathLabel = (text, x, y, col) => {
      const lbl = this.makeLabel(text, col); lbl.position.set(x, y, 0); lbl.scale.set(3.5, 0.6, 1); this.scene.add(lbl);
    };
    pathLabel('SCALAR PATH → 8 cycles total', -4, scalarY + 2.2, '#ef4444');
    pathLabel('SIMD (AVX) PATH → 1 cycle total (8× faster!)', -4, simdY + 2.2, '#10b981');

    // Flowchart lines
    // Scalar path
    this._line(-10.5, scalarY, -7.9, scalarY, 0x64748b);   // Mem→Regs
    for (let i = 0; i < 8; i++) this._line(-7.5 + i, scalarY - 0.4, -7.5 + i, scalarY - 1.8, 0x64748b);
    this._line(-3.5, scalarY - 2.2, 1.75, scalarY - 2.2, 0x4b5563); // ALUs→Out

    // SIMD path
    this._line(-10.5, simdY, -7.6, simdY, 0x1d4ed8);       // Mem→YMM
    this._line(-3.5, simdY - 0.6, -3.5, simdY - 1.75, 0x3b82f6); // YMM → SIMDalu
    this._line(0.55, simdY - 2.5, 2.5, simdY - 2.5, 0x10b981); // SIMD→Result

    // Speedup arrow
    const speedLine = [
      new THREE.Vector3(6, simdY - 2.5, 0), new THREE.Vector3(8, simdY - 2.5, 0),
      new THREE.Vector3(8, scalarY - 2.2, 0), new THREE.Vector3(6, scalarY - 2.2, 0)
    ];
    const sGeo = new THREE.BufferGeometry().setFromPoints(speedLine);
    const sMat = new THREE.LineDashedMaterial({ color: 0xffd700, dashSize: 0.3, gapSize: 0.2 });
    const sl = new THREE.Line(sGeo, sMat); sl.computeLineDistances();
    this.scene.add(sl); this.flowLines.push(sl);
    const speedLbl = this.makeLabel('8× Speedup', '#ffd700');
    speedLbl.position.set(9.2, scalarY - 4, 0); speedLbl.scale.set(2.5, 0.55, 1); this.scene.add(speedLbl);

    // Scalar packets (one at a time)
    this.scalarPackets = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshPhongMaterial({ color: 0x94a3b8, emissive: 0x94a3b8, emissiveIntensity: 0.4 })));
      g.position.set(-12, scalarY, 1.5);
      this.scene.add(g);
      this.scalarPackets.push({ g, phase: -i * 0.8 });
    }

    // SIMD packet (wide, moves as unit)
    this.simdPacket = (() => {
      const g = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
          new THREE.MeshPhongMaterial({ color: LANE_COLORS[i], emissive: LANE_COLORS[i], emissiveIntensity: 0.5 }));
        m.position.set((i - 3.5) * 0.65, 0, 0);
        g.add(m);
      }
      return g;
    })();
    this.scene.add(this.simdPacket);
    this.simdPacketPhase = 0;
  }

  _buildBlock(label, color, x, y, w, h, title, icon, desc) {
    const geo = new THREE.BoxGeometry(w, h, 0.9);
    const mat = new THREE.MeshPhongMaterial({ color, shininess: 80 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, 0);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color, opacity: 0.9, transparent: true })));
    const lbl = this._multiLabel(label, '#fff');
    lbl.position.set(0, h / 2 + 0.6, 0); lbl.scale.set(w + 0.5, 0.9, 1); mesh.add(lbl);
    this.scene.add(mesh);
    if (title) this.addInteractable(mesh, title, desc, icon);
    return mesh;
  }

  _multiLabel(text, color) {
    const lines = text.split('\n');
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 100;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = color; ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 200, 28 + i * 36));
    const tex = new THREE.CanvasTexture(cv);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  }

  _line(x1, y1, x2, y2, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, 0.1), new THREE.Vector3(x2, y2, 0.1)]);
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.2 });
    const l = new THREE.Line(geo, mat); l.computeLineDistances(); this.scene.add(l); this.flowLines.push(l);
  }

  update(dt) {
    this.t += dt;
    this.flowLines.forEach(l => { l.material.dashOffset -= dt * 2; });

    // Scalar packets (one by one, left to right, sequential)
    this.scalarPackets.forEach((p, i) => {
      p.phase += dt / 0.9;
      if (p.phase > 3) p.phase = -i * 0.8;
      const x = p.phase < 0 ? -12 : -12 + (p.phase / 3) * 20;
      const y = 5;
      p.g.position.set(x, y, 1.5);
      if (p.phase > 1) this.scalarALUs[i % 8].material.emissiveIntensity = 0.5;
      else             this.scalarALUs[i % 8].material.emissiveIntensity = 0;
    });

    // Lane boxes pulsing
    this.laneBoxes.forEach((lb, i) => {
      lb.material.emissiveIntensity = 0.2 + Math.sin(this.t * 3 + i * 0.4) * 0.2;
    });

    // SIMD packet (all 8 float lanes moving together)
    this.simdPacketPhase += dt / 1.5;
    if (this.simdPacketPhase > 3) this.simdPacketPhase = 0;
    const sx = -12 + (this.simdPacketPhase / 3) * 18;
    const sy = -1 - (this.simdPacketPhase > 1.5 ? (this.simdPacketPhase - 1.5) / 1.5 * 1.5 : 0);
    this.simdPacket.position.set(sx, sy, 1.5);

    // SIMD ALU flash when packet reaches it
    if (this.simdPacketPhase > 1.8 && this.simdPacketPhase < 2.3) {
      this.simdALU.material.emissiveIntensity = 0.5;
      this.simdALU.material.emissive.setHex(0x10b981);
    } else {
      this.simdALU.material.emissiveIntensity = 0.1;
    }
    this.frameCount++;
  }

  getStats() {
    const speedup = 8;
    return [
      { label: 'Scalar', value: '8 cycles' },
      { label: 'AVX SIMD', value: '1 cycle' },
      { label: 'Speedup', value: `${speedup}× (float32)` }
    ];
  }

  reset() { super.reset(); this.t = 0; this.simdPacketPhase = 0; }
}
