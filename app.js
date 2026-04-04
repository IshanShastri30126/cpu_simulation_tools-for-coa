// ─── APP BOOTSTRAP & SCENE MANAGER ───────────────────────────────────────────

const SCENE_CLASSES = {
  pipelining:        PipeliningScene,
  superscalar:       SuperscalarScene,
  'out-of-order':    OutOfOrderScene,
  'branch-prediction': BranchPredictionScene,
  cache:             CacheScene,
  multicore:         MultiCoreScene,
  simd:              SIMDScene
};

let currentScene   = null;
let currentChart   = null;
let currentIdx     = 0;
let isPlaying      = true;

// ─── DOM REFERENCES ───────────────────────────────────────────────────────────
const heroSection     = document.getElementById('heroSection');
const conceptsSection = document.getElementById('conceptsSection');
const simView         = document.getElementById('simView');
const simCanvas       = document.getElementById('simCanvas');
const conceptsGrid    = document.getElementById('conceptsGrid');

const simTitle    = document.getElementById('simTitle');
const simSubtitle = document.getElementById('simSubtitle');
const simIcon     = document.getElementById('simIcon');
const conceptIdx  = document.getElementById('conceptIndex');

const btnPlay    = document.getElementById('btnPlay');
const btnStep    = document.getElementById('btnStep');
const btnReset   = document.getElementById('btnReset');
const speedSlider= document.getElementById('speedSlider');
const speedLabel = document.getElementById('speedLabel');
const cycleCount = document.getElementById('cycleCount');
const statsOverlay = document.getElementById('statsOverlay');
const infoPanel = document.getElementById('infoPanel');
const togglePanelBtn = document.getElementById('togglePanelBtn');
const graphSlider = document.getElementById('graphSlider');
const graphInputWrap = document.getElementById('graphInputWrap');
const graphInputLabel = document.getElementById('graphInputLabel');
const graphInputValue = document.getElementById('graphInputValue');

const cmpTooltip = document.getElementById('cmpTooltip');
const closeTooltip = document.getElementById('closeTooltip');
const cmpTitle = document.getElementById('cmpTitle');
const cmpDesc = document.getElementById('cmpDesc');
const cmpIcon = document.querySelector('.cmp-icon');

// ─── BUILD CONCEPT CARDS ──────────────────────────────────────────────────────
function buildConceptCards() {
  CONCEPTS.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'concept-card fade-in';
    card.style.setProperty('--card-color', c.color);
    card.style.animationDelay = `${i * 0.08}s`;
    card.innerHTML = `
      <div class="card-icon" style="border-color:${c.color}30;color:${c.color}">${c.icon}</div>
      <div class="card-title">${c.name}</div>
      <div class="card-meta">
        <span class="card-tag">Hardware</span>
        <span class="card-tag">Software</span>
      </div>
      <p class="card-desc">${c.subtitle}</p>
      <div class="card-arrow">↗</div>
    `;
    card.addEventListener('click', () => launchSim(i));
    conceptsGrid.appendChild(card);
  });
}

// ─── HERO THREE.JS BACKGROUND ─────────────────────────────────────────────────
function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 12);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Floating particles
  const geo = new THREE.BufferGeometry();
  const n   = 800;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 40;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0x00f5ff, size: 0.08, transparent: true, opacity: 0.6 });
  scene.add(new THREE.Points(geo, mat));

  // Glowing CPU-like grid
  const lineMat = new THREE.LineBasicMaterial({ color: 0x0a2a4a, transparent: true, opacity: 0.4 });
  for (let x = -8; x <= 8; x += 2) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, -8, 0), new THREE.Vector3(x, 8, 0)]);
    scene.add(new THREE.Line(g, lineMat));
  }
  for (let y = -8; y <= 8; y += 2) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-8, y, 0), new THREE.Vector3(8, y, 0)]);
    scene.add(new THREE.Line(g, lineMat));
  }

  let heroActive = true;
  function heroAnimate() {
    if (!heroActive) return;
    requestAnimationFrame(heroAnimate);
    t += 0.003;
    scene.rotation.z = t * 0.1;
    camera.position.x = Math.sin(t * 0.2) * 1.5;
    camera.position.y = Math.cos(t * 0.15) * 0.8;
    camera.lookAt(0, 0, 0);
    const positions = geo.attributes.position.array;
    for (let i = 0; i < n; i++) {
      positions[i * 3 + 1] += 0.01;
      if (positions[i * 3 + 1] > 20) positions[i * 3 + 1] = -20;
    }
    geo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  }
  heroAnimate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  // store cleanup handle
  initHeroCanvas._stop = () => { heroActive = false; };
}

// ─── LAUNCH SIMULATION ────────────────────────────────────────────────────────
function launchSim(idx) {
  currentIdx = idx;
  const concept = CONCEPTS[idx];

  // Show sim view
  heroSection.style.display     = 'none';
  conceptsSection.style.display = 'none';
  simView.style.display         = 'flex';
  document.querySelector('.site-footer').style.display = 'none';

  // Update header
  simTitle.textContent    = concept.name;
  simSubtitle.textContent = concept.subtitle;
  simIcon.textContent     = concept.icon;
  conceptIdx.textContent  = `${idx + 1} / ${CONCEPTS.length}`;

  // Accent color on header
  simView.style.setProperty('--concept-color', concept.color);

  // Destroy old scene
  if (currentScene) { currentScene.dispose(); currentScene = null; }
  if (currentChart)  { currentChart.destroy(); currentChart = null; }

  // Init new scene — wait 2 frames so canvas has real dimensions
  const SceneClass = SCENE_CLASSES[concept.id];
  if (SceneClass) {
    setTimeout(() => {
      const wrap = document.getElementById('canvasWrap');
      const rect = wrap.getBoundingClientRect();
      simCanvas.width  = rect.width  || 900;
      simCanvas.height = rect.height || 600;
      currentScene = new SceneClass(simCanvas, {
        onCycleUpdate: (n) => { cycleCount.textContent = n; },
        onStatsUpdate: (stats) => { renderStats(stats); },
        onObjectClick: (data) => { showComponentTooltip(data); }
      });
    }, 50);
  }

  // Controls default state
  isPlaying = true;
  btnPlay.textContent = '⏸';
  btnPlay.classList.add('playing');
  speedSlider.value = '1';
  speedLabel.textContent = '1×';
  cycleCount.textContent = '0';

  // Render info panel
  renderTheory(concept);
  renderOptimization(concept);
  setupGraph(concept);
  renderResources(concept);

  // Default to theory tab
  switchTab('theory');

  // Reset side panel state
  infoPanel.classList.remove('collapsed');
  infoPanel.classList.remove('enlarged');

  // Drag hint fade
  const hint = document.getElementById('dragHint');
  hint.style.opacity = '1';
  setTimeout(() => { hint.style.opacity = '0'; }, 4000);

  // Resize listener
  window.addEventListener('resize', handleSimResize);
}

function handleSimResize() {
  const wrap = document.getElementById('canvasWrap');
  if (currentScene) currentScene.resize(wrap.clientWidth, wrap.clientHeight);
}

// ─── BACK BUTTON ──────────────────────────────────────────────────────────────
document.getElementById('backBtn').addEventListener('click', () => {
  if (currentScene) { currentScene.dispose(); currentScene = null; }
  if (currentChart)  { currentChart.destroy(); currentChart = null; }
  simView.style.display         = 'none';
  heroSection.style.display     = '';
  conceptsSection.style.display = '';
  document.querySelector('.site-footer').style.display = '';
  cmpTooltip.classList.remove('active');
  window.removeEventListener('resize', handleSimResize);
  // Stop old hero and restart
  if (initHeroCanvas._stop) initHeroCanvas._stop();
  initHeroCanvas();
});

// ─── NAVIGATION ARROWS ────────────────────────────────────────────────────────
document.getElementById('prevConcept').addEventListener('click', () => {
  launchSim((currentIdx - 1 + CONCEPTS.length) % CONCEPTS.length);
});
document.getElementById('nextConcept').addEventListener('click', () => {
  launchSim((currentIdx + 1) % CONCEPTS.length);
});

// ─── SIMULATION CONTROLS ──────────────────────────────────────────────────────
btnPlay.addEventListener('click', () => {
  isPlaying = !isPlaying;
  if (currentScene) currentScene.setPaused(!isPlaying);
  btnPlay.textContent = isPlaying ? '⏸' : '▶';
  isPlaying ? btnPlay.classList.add('playing') : btnPlay.classList.remove('playing');
});

btnStep.addEventListener('click', () => {
  if (currentScene) {
    currentScene.setPaused(true);
    currentScene.step();
    isPlaying = false;
    btnPlay.textContent = '▶';
    btnPlay.classList.remove('playing');
  }
});

btnReset.addEventListener('click', () => {
  if (currentScene) {
    currentScene.reset();
    cycleCount.textContent = '0';
  }
  isPlaying = true;
  btnPlay.textContent = '⏸';
  btnPlay.classList.add('playing');
});

speedSlider.addEventListener('input', () => {
  const v = parseFloat(speedSlider.value);
  speedLabel.textContent = `${v}×`;
  if (currentScene) currentScene.setSpeed(v);
});

// ─── STATS RENDERING ──────────────────────────────────────────────────────────
function renderStats(stats) {
  statsOverlay.innerHTML = stats.map(s =>
    `<div class="stat-chip"><span class="stat-label">${s.label}:</span><span>${s.value}</span></div>`
  ).join('');
}

// ─── THEORY PANEL ─────────────────────────────────────────────────────────────
function renderTheory(concept) {
  document.getElementById('theoryContent').innerHTML = concept.theory || '';
}

// ─── OPTIMIZATION PANEL ───────────────────────────────────────────────────────
function renderOptimization(concept) {
  document.getElementById('optimizationContent').innerHTML = concept.optimization || '';
}

// ─── GRAPH PANEL & DATA GENERATION ────────────────────────────────────────────
function generateGraphData(conceptId, inputValue) {
  let labels = [], datasets = [];
  
  if (conceptId === 'pipelining') {
    const s = parseInt(inputValue);
    labels = Array.from({length: s}, (_, i) => `S${i+1}`);
    const ideal = labels.map((_, i) => i + 1);
    const real = labels.map((_, i) => { const x = i+1; return x < 3 ? x : x < 7 ? x * 0.75 : x * 0.6; });
    datasets = [
      { label: 'Ideal Throughput', data: ideal, borderColor: '#00f5ff', backgroundColor: 'rgba(0,245,255,0.15)', tension: 0.4, fill: true },
      { label: 'Real Throughput', data: real, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', tension: 0.4, fill: true }
    ];
  } else if (conceptId === 'superscalar') {
    const eu = parseInt(inputValue);
    labels = Array.from({length: eu}, (_, i) => `EU${i+1}`);
    const peak = labels.map((_, i) => i + 1);
    const practical = labels.map((_, i) => { const x = i+1; return Math.min(x, 1 + Math.log2(x)*1.5); });
    datasets = [
      { label: 'Peak IPC', data: peak, borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.1)', tension: 0.4, fill: true },
      { label: 'Practical IPC', data: practical, borderColor: '#f472b6', backgroundColor: 'rgba(244,114,182,0.1)', tension: 0.4, fill: true }
    ];
  } else if (conceptId === 'out-of-order') {
    const memLat = parseInt(inputValue);
    labels = ['Int Math', 'Light Branches', 'Mixed Load', 'Heavy Load'];
    datasets = [
      { label: 'In-Order', data: [1.0, 0.8, Math.max(0.2, 0.9 - memLat/200), Math.max(0.1, 0.7 - memLat/100)], backgroundColor: 'rgba(100,116,139,0.8)' },
      { label: 'OoO', data: [1.2, 1.1, Math.max(0.5, 1.8 - memLat/400), Math.max(0.3, 1.3 - memLat/300)], backgroundColor: 'rgba(245,158,11,0.8)' }
    ];
  } else if (conceptId === 'branch-prediction') {
    const prob = parseInt(inputValue) / 100;
    labels = ['Predictor Active'];
    datasets = [
      { label: 'Correct Guesses', data: [prob * 100], backgroundColor: 'rgba(16,185,129,0.8)' },
      { label: 'Pipeline Flushes', data: [(1 - prob) * 100], backgroundColor: 'rgba(239,68,68,0.8)' }
    ];
  } else if (conceptId === 'cache') {
    const hit = parseInt(inputValue) / 100;
    labels = ['Avg Access Time (Cycles)'];
    const avg = hit * 4 + (1 - hit) * 200;
    datasets = [{ label: 'Latency', data: [avg], backgroundColor: 'rgba(245,158,11,0.8)' }];
  } else if (conceptId === 'multicore') {
    const par = parseInt(inputValue) / 100;
    labels = ['1', '2', '4', '8', '16', '32'];
    const s = labels.map(c => 1 / ((1 - par) + par / parseInt(c)));
    datasets = [{ label: `Speedup (${par*100}% parallel)`, data: s, borderColor: '#3b82f6', tension: 0.4, fill: false }];
  } else if (conceptId === 'simd') {
    const arr = parseInt(inputValue);
    labels = ['Scalar', 'SIMD (8x)'];
    datasets = [{ label: 'Cycles Taken', data: [arr * 2, arr / 8 * 2.5], backgroundColor: ['rgba(100,116,139,0.8)', 'rgba(249,115,22,0.8)'] }];
  }
  return { labels, datasets };
}

function renderGraph(concept, inputValue) {
  const g = concept.graph;
  document.getElementById('graphTitle').textContent = g.title;
  document.getElementById('graphDesc').textContent  = g.desc;

  const data = generateGraphData(concept.id, inputValue);

  const ctx = document.getElementById('conceptChart').getContext('2d');
  if (currentChart) currentChart.destroy();

  currentChart = new Chart(ctx, {
    type: g.type,
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 11, family: 'Inter' }, boxWidth: 16 } }
      },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
        y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' }, beginAtZero: true }
      }
    }
  });
}

function setupGraph(concept) {
  if (concept.graphInput) {
    graphInputWrap.style.display = 'flex';
    graphInputLabel.textContent = concept.graphInput.label;
    graphSlider.min = concept.graphInput.min;
    graphSlider.max = concept.graphInput.max;
    graphSlider.step = concept.graphInput.step;
    graphSlider.value = concept.graphInput.default;
    graphInputValue.textContent = concept.graphInput.default;
    
    // Remove old listeners to avoid multiple binds
    const newSlider = graphSlider.cloneNode(true);
    graphSlider.parentNode.replaceChild(newSlider, graphSlider);
    
    newSlider.addEventListener('input', (e) => {
      document.getElementById('graphInputValue').textContent = e.target.value;
      renderGraph(concept, e.target.value);
    });
    
    renderGraph(concept, concept.graphInput.default);
  } else {
    graphInputWrap.style.display = 'none';
    renderGraph(concept, 0);
  }
}

// ─── RESOURCES PANEL ──────────────────────────────────────────────────────────
function renderResources(concept) {
  const list = document.getElementById('resourcesList');
  list.innerHTML = concept.resources.map(r => `
    <a class="res-card" href="${r.url}" target="_blank" rel="noopener">
      <div class="res-card-type">${r.icon} ${r.type}</div>
      <div class="res-card-title">${r.title}</div>
      <div class="res-card-desc">${r.desc}</div>
    </a>
  `).join('');
}

// ─── TAB & PANEL UI LOGIC ─────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.ptab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === `pane-${name}`));
  
  if (name === 'graph') {
    infoPanel.classList.add('enlarged');
    // Important: Chart.js sometimes needs a resize event to layout correctly
    setTimeout(() => handleSimResize(), 400); 
  } else {
    infoPanel.classList.remove('enlarged');
  }
}

document.getElementById('panelTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.ptab');
  if (btn) switchTab(btn.dataset.tab);
});

togglePanelBtn.addEventListener('click', () => {
  infoPanel.classList.toggle('collapsed');
  setTimeout(() => handleSimResize(), 400); 
});

// ─── EXPLORE BUTTON ───────────────────────────────────────────────────────────
document.getElementById('exploreBtn').addEventListener('click', () => {
  document.getElementById('conceptsSection').scrollIntoView({ behavior: 'smooth' });
});

// ─── KEYBOARD NAVIGATION ──────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (simView.style.display === 'none' || !simView.style.display) return;
  if (e.key === 'ArrowRight') launchSim((currentIdx + 1) % CONCEPTS.length);
  if (e.key === 'ArrowLeft')  launchSim((currentIdx - 1 + CONCEPTS.length) % CONCEPTS.length);
  if (e.key === ' ') { e.preventDefault(); btnPlay.click(); }
  if (e.key === 'r' || e.key === 'R') btnReset.click();
  if (e.key === 's' || e.key === 'S') btnStep.click();
});

// ─── INIT & COMPONENT TOOLTIP ─────────────────────────────────────────────────
function showComponentTooltip(data) {
  if (!data) return;
  cmpTitle.textContent = data.title;
  cmpDesc.innerHTML = data.desc;
  cmpIcon.textContent = data.icon || '🔍';
  cmpTooltip.classList.add('active');
}

closeTooltip.addEventListener('click', () => {
  cmpTooltip.classList.remove('active');
});

buildConceptCards();
initHeroCanvas();
