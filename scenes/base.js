// ─── BASE SCENE CLASS ─────────────────────────────────────────────────────────
class BaseScene {
  constructor(canvas, callbacks = {}) {
    this.canvas    = canvas;
    this.callbacks = callbacks;
    this.active    = true;
    this.paused    = false;
    this.speed     = 1;
    this.cycles    = 0;
    this.clock     = new THREE.Clock();
    // Mouse orbit
    this.theta  = 0.3;
    this.phi    = 0.2;
    this.radius = 14;
    this.dragging = false;
    this.px = 0; this.py = 0;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.interactables = [];
    this.hoveredObject = null;
    
    this._initThree();
    this._initMouse();
    this.createScene();
    this._loop();
  }

  _initThree() {
    this.scene    = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020208);
    this.scene.fog = new THREE.Fog(0x020208, 20, 60);

    const rect = this.canvas.getBoundingClientRect();
    const w = (rect.width  > 0 ? rect.width  : this.canvas.width)  || 900;
    const h = (rect.height > 0 ? rect.height : this.canvas.height) || 600;
    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100);
    this._updateCamera();

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    // Lights
    this.scene.add(new THREE.AmbientLight(0x111133, 3));
    const dl = new THREE.DirectionalLight(0xffffff, 1);
    dl.position.set(5, 10, 5);
    this.scene.add(dl);
  }

  _updateCamera() {
    this.camera.position.x = this.radius * Math.sin(this.theta) * Math.cos(this.phi);
    this.camera.position.y = this.radius * Math.sin(this.phi);
    this.camera.position.z = this.radius * Math.cos(this.theta) * Math.cos(this.phi);
    this.camera.lookAt(0, 0, 0);
  }

  _initMouse() {
    const cv = this.canvas;
    
    let dragDist = 0;
    cv.addEventListener('mousedown',  e => { 
      this.dragging = true; 
      this.px = e.clientX; 
      this.py = e.clientY; 
      dragDist = 0;
    });
    
    window.addEventListener('mouseup', () => this.dragging = false);
    
    window.addEventListener('mousemove', e => {
      // Update mouse for raycasting
      const rect = cv.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      this._checkHover();

      if (!this.dragging) return;
      
      const dx = e.clientX - this.px;
      const dy = e.clientY - this.py;
      dragDist += Math.abs(dx) + Math.abs(dy);
      
      this.theta -= dx * 0.007;
      this.phi   -= dy * 0.005;
      this.phi    = Math.max(-1.1, Math.min(1.1, this.phi));
      this.px = e.clientX; this.py = e.clientY;
      this._updateCamera();
    });
    
    cv.addEventListener('click', e => {
      // If we dragged to rotate, don't trigger click
      if (dragDist > 10) return;
      
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.interactables, false);
      if (intersects.length > 0) {
        const obj = intersects[0].object;
        if (this.callbacks.onObjectClick) {
          this.callbacks.onObjectClick(obj.userData);
        }
      }
    });

    cv.addEventListener('wheel', e => {
      this.radius = Math.max(5, Math.min(25, this.radius + e.deltaY * 0.02));
      this._updateCamera();
    });

    // Touch
    cv.addEventListener('touchstart',  e => { 
      this.dragging = true; 
      this.px = e.touches[0].clientX; 
      this.py = e.touches[0].clientY; 
      
      // Update mouse for mobile click
      const rect = cv.getBoundingClientRect();
      this.mouse.x = ((this.px - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((this.py - rect.top) / rect.height) * 2 + 1;
    });
    cv.addEventListener('touchend', () => {
       // On mobile, trigger click manually on touchend if it wasn't a drag
       if (this.dragging && dragDist < 10) {
          this.raycaster.setFromCamera(this.mouse, this.camera);
          const intersects = this.raycaster.intersectObjects(this.interactables, false);
          if (intersects.length > 0 && this.callbacks.onObjectClick) {
             this.callbacks.onObjectClick(intersects[0].object.userData);
          }
       }
       this.dragging = false;
       dragDist = 0;
    });
    cv.addEventListener('touchmove',   e => {
      e.preventDefault();
      if (!this.dragging) return;
      const dx = e.touches[0].clientX - this.px;
      const dy = e.touches[0].clientY - this.py;
      dragDist += Math.abs(dx) + Math.abs(dy);
      
      this.theta -= dx * 0.007;
      this.phi   -= dy * 0.005;
      this.phi    = Math.max(-1.1, Math.min(1.1, this.phi));
      this.px = e.touches[0].clientX; this.py = e.touches[0].clientY;
      this._updateCamera();
    }, { passive: false });
  }

  _checkHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactables, false);
    
    if (intersects.length > 0) {
      document.body.style.cursor = 'pointer';
      const obj = intersects[0].object;
      if (this.hoveredObject !== obj) {
        if (this.hoveredObject && this.hoveredObject.material) {
           this.hoveredObject.material.emissiveIntensity = this.hoveredObject._baseEmissive || 0;
        }
        this.hoveredObject = obj;
        if (obj.material) {
           obj._baseEmissive = obj.material.emissiveIntensity;
           obj.material.emissiveIntensity = Math.min(1.0, obj._baseEmissive + 0.3);
        }
      }
    } else {
      document.body.style.cursor = 'default';
      if (this.hoveredObject && this.hoveredObject.material) {
         this.hoveredObject.material.emissiveIntensity = this.hoveredObject._baseEmissive || 0;
      }
      this.hoveredObject = null;
    }
  }

  addInteractable(mesh, title, desc, icon = '🔍') {
    mesh.userData = { title, desc, icon };
    this.interactables.push(mesh);
  }

  _loop() {
    if (!this.active) return;
    requestAnimationFrame(() => this._loop());
    if (!this.paused) {
      const dt = Math.min(this.clock.getDelta() * this.speed, 0.1);
      this.cycles += dt * 10;
      if (this.callbacks.onCycleUpdate) this.callbacks.onCycleUpdate(Math.floor(this.cycles));
      this.update(dt);
      if (this.callbacks.onStatsUpdate) this.callbacks.onStatsUpdate(this.getStats());
    }
    this.renderer.render(this.scene, this.camera);
  }

  // Override these:
  createScene() {}
  update(dt) {}
  getStats()   { return []; }
  reset()      { this.cycles = 0; }
  
  // Clean up interactables on reset or dispose
  clearInteractables() { this.interactables = []; this.hoveredObject = null; }

  setPaused(v) { this.paused = v; if (!v) this.clock.getDelta(); }
  setSpeed(v)  { this.speed = v; }
  step()       { this.update(0.016 * this.speed); this.renderer.render(this.scene, this.camera); }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    this.active = false;
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
    this.renderer.dispose();
  }

  // ── Helpers ──
  makeBox(w, h, d, color, emissive = 0.3) {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, metalness: 0.7, roughness: 0.2, transparent: true, opacity: 0.85 });
    return new THREE.Mesh(g, m);
  }

  makeSphere(r, color, emissive = 0.5) {
    const g = new THREE.SphereGeometry(r, 16, 16);
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, metalness: 0.5, roughness: 0.3 });
    return new THREE.Mesh(g, m);
  }

  makeLabel(text, color = '#00f5ff') {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = 'bold 28px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(cv);
    const sp  = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sp.scale.set(2, 0.5, 1);
    return sp;
  }

  makeGlow(mesh, scaleFactor = 1.3) {
    const gm = mesh.geometry.clone();
    const gc = mesh.material.color ? mesh.material.color.getHex() : 0x00f5ff;
    const gmat = new THREE.MeshBasicMaterial({ color: gc, transparent: true, opacity: 0.06, side: THREE.BackSide });
    const glow = new THREE.Mesh(gm, gmat);
    glow.scale.setScalar(scaleFactor);
    mesh.add(glow);
    return glow;
  }

  makeGrid() {
    const g = new THREE.GridHelper(30, 30, 0x112244, 0x0a1628);
    g.position.y = -3.5;
    this.scene.add(g);
  }

  addPointLight(color, x, y, z, intensity = 3, distance = 20) {
    const pl = new THREE.PointLight(color, intensity, distance);
    pl.position.set(x, y, z);
    this.scene.add(pl);
    return pl;
  }
}
