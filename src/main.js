import { Simulation, Ball, Block, SpringGroup, TORQUE_VECTOR_TTL } from "./physics.js";
import { Renderer } from "./renderer.js";

const canvas = document.getElementById("sim-canvas");
const pauseBtn = document.getElementById("pause-btn");
const resetBtn = document.getElementById("reset-btn");
const dampingBtn = document.getElementById("damping-btn");

const toolBtns = document.querySelectorAll("[data-tool]");
const addBallBtn = document.getElementById("add-ball-btn");
const addBlockBtn = document.getElementById("add-block-btn");
const deleteBtn = document.getElementById("delete-btn");
const springStatus = document.getElementById("spring-status");

const keBar = document.getElementById("ke-bar");
const peBar = document.getElementById("pe-bar");
const speBar = document.getElementById("spe-bar");
const speGroup = document.getElementById("spe-group");
const teBar = document.getElementById("te-bar");
const keValue = document.getElementById("ke-value");
const peValue = document.getElementById("pe-value");
const speValue = document.getElementById("spe-value");
const teValue = document.getElementById("te-value");
const totalValue = document.getElementById("total-value");

const propsPanel = document.getElementById("props-panel");
const propsType = document.getElementById("props-type");
const elasticitySlider = document.getElementById("elasticity-slider");
const elasticityValue = document.getElementById("elasticity-value");

const renderer = new Renderer(canvas);
const sim = new Simulation(renderer.groundY);

let paused = false;
let dragging = false;
let dragBody = null;
let torqueDragging = false;
let torqueBody = null;
let torqueStart = null;
let torquePreview = null;
let torqueDisplays = [];
let selectedId = null;
let maxEnergy = 1;
let forcesMap = new Map();

let tool = "select";
let placePreview = null;

let springPickIds = new Set();
let buildingSpringGroup = null;

function init() {
  sim.reset();
  selectedId = sim.bodies[0]?.id ?? null;
  maxEnergy = 1;
  placePreview = null;
  torquePreview = null;
  torqueDisplays = [];
  clearSpringBuild();
  endTorqueDrag();
  updateToolUI();
  updatePropsPanel();
}

function clearSpringBuild() {
  springPickIds = new Set();
  buildingSpringGroup = null;
  updateSpringStatus();
}

function updateSpringStatus() {
  const count = springPickIds.size;
  if (count === 0) {
    springStatus.textContent = "Hold Ctrl + click objects to connect a spring.";
    springStatus.classList.remove("active");
  } else if (count === 1) {
    springStatus.textContent = "Selected 1 object to connect to a spring.";
    springStatus.classList.add("active");
  } else {
    springStatus.textContent = `Selected ${count} objects — spring connected. Ctrl+click more to add.`;
    springStatus.classList.add("active");
  }
}

function handleSpringPick(body) {
  if (springPickIds.has(body.id)) return;

  if (springPickIds.size === 0) {
    springPickIds.add(body.id);
    updateSpringStatus();
    selectObject(body);
    return;
  }

  if (!buildingSpringGroup) {
    buildingSpringGroup = new SpringGroup();
    sim.addSpringGroup(buildingSpringGroup);
    for (const id of springPickIds) {
      const b = sim.getBodyById(id);
      if (b) buildingSpringGroup.addBody(b);
    }
  }

  if (!buildingSpringGroup.hasBody(body)) {
    buildingSpringGroup.addBody(body);
  }

  springPickIds.add(body.id);
  updateSpringStatus();
  selectObject(body);
}

function togglePause() {
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  pauseBtn.classList.toggle("paused", paused);
}

function toggleDamping() {
  sim.dampingEnabled = !sim.dampingEnabled;
  dampingBtn.textContent = sim.dampingEnabled ? "Damping: ON" : "Damping: OFF";
  dampingBtn.classList.toggle("off", !sim.dampingEnabled);
}

function setTool(next) {
  tool = next;
  placePreview = null;
  updateToolUI();
}

function updateToolUI() {
  toolBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tool === tool);
  });
  canvas.classList.toggle("place-mode", tool === "ball" || tool === "block");
}

function getSelected() {
  if (!selectedId) return null;
  return sim.bodies.find((b) => b.id === selectedId) ?? null;
}

function selectObject(obj) {
  selectedId = obj?.id ?? null;
  updatePropsPanel();
}

function updatePropsPanel() {
  const sel = getSelected();
  if (!sel) {
    propsPanel.hidden = true;
    return;
  }
  propsPanel.hidden = false;
  propsType.textContent = sel.type === "ball" ? "Ball" : "Block";
  elasticitySlider.value = sel.restitution;
  elasticityValue.textContent = sel.restitution.toFixed(2);
}

function updateEnergyUI() {
  const ke = sim.totalKineticEnergy;
  const gpe = sim.totalGravitationalPotentialEnergy;
  const spe = sim.totalSpringPotentialEnergy;
  const pe = gpe + spe;
  const te = sim.thermalEnergy;
  const total = ke + pe + te;

  maxEnergy = Math.max(maxEnergy, total, 1);

  keBar.style.width = `${(ke / maxEnergy) * 100}%`;
  peBar.style.width = `${(gpe / maxEnergy) * 100}%`;
  teBar.style.width = `${(te / maxEnergy) * 100}%`;
  keValue.textContent = `${ke.toFixed(2)} J`;
  peValue.textContent = `${gpe.toFixed(2)} J`;
  teValue.textContent = `${te.toFixed(2)} J`;
  totalValue.textContent = `${(ke + pe).toFixed(2)} J`;

  speGroup.hidden = !sim.hasSprings;
  if (sim.hasSprings) {
    speBar.style.width = `${(spe / maxEnergy) * 100}%`;
    speValue.textContent = `${spe.toFixed(2)} J`;
  }
}

function clampBody(body) {
  const halfWidth = (canvas.width / 2 - 20) / renderer.scale;
  body.x = Math.max(-halfWidth, Math.min(halfWidth, body.x));
  if (body.type === "ball") {
    body.y = Math.max(body.radius, Math.min(sim.groundY - body.radius, body.y));
  } else {
    body.y = Math.max(body.height / 2, Math.min(sim.groundY - body.height / 2, body.y));
  }
}

function placeAt(clientX, clientY) {
  const { sx, sy } = renderer.pointerToScreen(clientX, clientY);
  const { x, y } = renderer.screenToWorld(sx, sy);

  if (tool === "ball") {
    const ball = new Ball(x, Math.min(y, sim.groundY - 0.25));
    clampBody(ball);
    sim.addBody(ball);
    selectObject(ball);
    setTool("select");
  } else if (tool === "block") {
    const block = new Block(x, Math.min(y, sim.groundY - 0.2));
    clampBody(block);
    sim.addBody(block);
    selectObject(block);
    setTool("select");
  }
}

function rebuildForcesMap() {
  forcesMap = new Map();
  for (const body of sim.bodies) {
    forcesMap.set(body.id, sim.getForces(body));
  }
}

function pruneTorqueDisplays(now) {
  torqueDisplays = torqueDisplays
    .map((d) => {
      const remaining = d.expiresAt - now;
      if (remaining <= 0) return null;
      return { ...d, opacity: Math.min(1, remaining / 800) };
    })
    .filter(Boolean);
}

function addTorqueDisplay(vec) {
  torqueDisplays.push({
    ...vec,
    expiresAt: performance.now() + TORQUE_VECTOR_TTL * 1000,
    opacity: 1,
  });
}

function startTorqueDrag(clientX, clientY) {
  const { sx, sy } = renderer.pointerToScreen(clientX, clientY);
  const hit = renderer.hitTestBody(sim.bodies, sx, sy);
  if (!hit) return;

  torqueDragging = true;
  torqueBody = hit;
  const { x, y } = renderer.screenToWorld(sx, sy);
  torqueStart = { x, y };
  torquePreview = { x1: x, y1: y, x2: x, y2: y };
  selectObject(hit);
  canvas.classList.add("torque-mode");
}

function updateTorqueDrag(clientX, clientY) {
  if (!torqueDragging || !torqueStart) return;
  const { sx, sy } = renderer.pointerToScreen(clientX, clientY);
  const { x, y } = renderer.screenToWorld(sx, sy);
  torquePreview = { x1: torqueStart.x, y1: torqueStart.y, x2: x, y2: y };
}

function endTorqueDrag(clientX, clientY) {
  if (!torqueDragging || !torqueBody || !torqueStart) {
    torqueDragging = false;
    torqueBody = null;
    torqueStart = null;
    torquePreview = null;
    canvas.classList.remove("torque-mode");
    return;
  }

  if (clientX != null && clientY != null) {
    const { sx, sy } = renderer.pointerToScreen(clientX, clientY);
    const { x, y } = renderer.screenToWorld(sx, sy);
    const dx = x - torqueStart.x;
    const dy = y - torqueStart.y;
    if (Math.hypot(dx, dy) > 0.02) {
      const vec = torqueBody.applyTorqueFromDrag(torqueStart.x, torqueStart.y, x, y);
      addTorqueDisplay(vec);
      torqueBody.onGround = false;
    }
  }

  torqueDragging = false;
  torqueBody = null;
  torqueStart = null;
  torquePreview = null;
  canvas.classList.remove("torque-mode");
}

let lastTime = null;
const FIXED_DT = 1 / 120;
let accumulator = 0;

function loop(timestamp) {
  if (lastTime === null) lastTime = timestamp;
  let frameDt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  frameDt = Math.min(frameDt, 0.05);

  pruneTorqueDisplays(timestamp);

  if (!paused && !dragging && !torqueDragging) {
    accumulator += frameDt;
    while (accumulator >= FIXED_DT) {
      sim.step(FIXED_DT);
      accumulator -= FIXED_DT;
    }
  }

  rebuildForcesMap();
  renderer.draw(
    sim,
    selectedId,
    forcesMap,
    paused,
    placePreview,
    torquePreview,
    torqueDisplays,
    springPickIds
  );
  updateEnergyUI();

  requestAnimationFrame(loop);
}

pauseBtn.addEventListener("click", togglePause);
resetBtn.addEventListener("click", () => {
  init();
  if (paused) togglePause();
});
dampingBtn.addEventListener("click", toggleDamping);

addBallBtn.addEventListener("click", () => setTool("ball"));
addBlockBtn.addEventListener("click", () => setTool("block"));

deleteBtn.addEventListener("click", () => {
  const sel = getSelected();
  if (!sel) return;
  sim.removeBody(sel.id);
  springPickIds.delete(sel.id);
  if (buildingSpringGroup && !buildingSpringGroup.bodies.length) {
    buildingSpringGroup = null;
  }
  selectedId = sim.bodies[0]?.id ?? null;
  updateSpringStatus();
  updatePropsPanel();
});

elasticitySlider.addEventListener("input", () => {
  const sel = getSelected();
  if (!sel) return;
  const val = parseFloat(elasticitySlider.value);
  sel.restitution = val;
  elasticityValue.textContent = val.toFixed(2);
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    togglePause();
  }
  if (e.code === "Delete" || e.code === "Backspace") {
    deleteBtn.click();
  }
  if (e.code === "Escape") {
    clearSpringBuild();
  }
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

function onLeftPointerDown(clientX, clientY, ctrlKey) {
  const { sx, sy } = renderer.pointerToScreen(clientX, clientY);
  const hit = renderer.hitTestBody(sim.bodies, sx, sy);

  if (ctrlKey && hit) {
    handleSpringPick(hit);
    return;
  }

  if (tool === "ball" || tool === "block") {
    placeAt(clientX, clientY);
    return;
  }

  if (hit) {
    dragging = true;
    dragBody = hit;
    canvas.classList.add("dragging");
    hit.vx = 0;
    hit.vy = 0;
    hit.omega = 0;
    hit.ax = 0;
    hit.ay = 0;
    accumulator = 0;
    selectObject(hit);
    moveDraggedBody(clientX, clientY);
  } else {
    selectObject(null);
    if (!ctrlKey) clearSpringBuild();
  }
}

function moveDraggedBody(clientX, clientY) {
  if (!dragBody) return;
  const { sx, sy } = renderer.pointerToScreen(clientX, clientY);
  const { x, y } = renderer.screenToWorld(sx, sy);
  dragBody.x = x;
  dragBody.y = y;
  clampBody(dragBody);
}

function endDrag() {
  if (!dragging) return;
  dragging = false;
  dragBody = null;
  canvas.classList.remove("dragging");
}

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 2) {
    startTorqueDrag(e.clientX, e.clientY);
    return;
  }
  if (e.button === 0) onLeftPointerDown(e.clientX, e.clientY, e.ctrlKey);
});

window.addEventListener("mousemove", (e) => {
  if (torqueDragging) {
    updateTorqueDrag(e.clientX, e.clientY);
    return;
  }
  if (dragging) {
    moveDraggedBody(e.clientX, e.clientY);
    return;
  }
  if (tool === "ball" || tool === "block") {
    const { sx, sy } = renderer.pointerToScreen(e.clientX, e.clientY);
    const { x, y } = renderer.screenToWorld(sx, sy);
    placePreview =
      tool === "ball"
        ? { type: "ball", x, y: Math.min(y, sim.groundY - 0.25), radius: 0.25 }
        : { type: "block", x, y: Math.min(y, sim.groundY - 0.2), width: 0.8, height: 0.4 };
  } else {
    placePreview = null;
  }
  if (tool !== "select" || dragging || torqueDragging) {
    canvas.classList.remove("grab-hover");
    return;
  }
  const { sx, sy } = renderer.pointerToScreen(e.clientX, e.clientY);
  canvas.classList.toggle("grab-hover", !!renderer.hitTestBody(sim.bodies, sx, sy));
});

window.addEventListener("mouseup", (e) => {
  if (e.button === 2) {
    endTorqueDrag(e.clientX, e.clientY);
    return;
  }
  endDrag();
});

canvas.addEventListener("mouseleave", () => {
  canvas.classList.remove("grab-hover");
  placePreview = null;
  if (torqueDragging) endTorqueDrag();
});

init();
dampingBtn.textContent = sim.dampingEnabled ? "Damping: ON" : "Damping: OFF";
dampingBtn.classList.toggle("off", !sim.dampingEnabled);
requestAnimationFrame(loop);
