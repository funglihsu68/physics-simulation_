export const GRAVITY = 9.8;
export const LINEAR_DAMPING = 1.2;
export const TORQUE_IMPULSE_SCALE = 3.0;
export const TORQUE_VECTOR_TTL = 3.0;
export const DEFAULT_SPRING_STIFFNESS = 40;

let nextId = 1;
export function genId() {
  return nextId++;
}

export function resetIds() {
  nextId = 1;
}

export class Ball {
  constructor(x, y, radius = 0.25, mass = 1, restitution = 0.78) {
    this.id = genId();
    this.type = "ball";
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.mass = mass;
    this.restitution = restitution;
    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;
    this.angle = 0;
    this.omega = 0;
    this.onGround = false;
  }

  get inertia() {
    return (2 / 5) * this.mass * this.radius ** 2;
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  get kineticEnergy() {
    const linear = 0.5 * this.mass * this.speed ** 2;
    const rotational = 0.5 * this.inertia * this.omega ** 2;
    return linear + rotational;
  }

  potentialEnergy(groundY) {
    const height = Math.max(0, groundY - (this.y + this.radius));
    return this.mass * GRAVITY * height;
  }

  get bottom() {
    return this.y + this.radius;
  }

  getForces(groundY, springForces) {
    const gravity = { fx: 0, fy: this.mass * GRAVITY, label: "F_gravity" };
    const inContact = this.bottom >= groundY - 0.002;
    let normal = null;
    if (inContact) {
      normal = { fx: 0, fy: -this.mass * GRAVITY, label: "F_normal" };
    }
    const springs = springForces?.filter((f) => f.bodyId === this.id) ?? [];
    return { gravity, normal, springs, inContact };
  }

  applyTorqueFromDrag(startX, startY, endX, endY) {
    const rx = startX - this.x;
    const ry = startY - this.y;
    const fx = endX - startX;
    const fy = endY - startY;
    const torque = rx * fy - ry * fx;
    this.omega += (torque * TORQUE_IMPULSE_SCALE) / this.inertia;
    this.onGround = false;
    return { x1: startX, y1: startY, x2: endX, y2: endY };
  }
}

export class Block {
  constructor(x, y, width = 0.8, height = 0.4, mass = 2, restitution = 0.65) {
    this.id = genId();
    this.type = "block";
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.mass = mass;
    this.restitution = restitution;
    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;
    this.angle = 0;
    this.omega = 0;
    this.onGround = false;
  }

  get inertia() {
    return (1 / 12) * this.mass * (this.width ** 2 + this.height ** 2);
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  get kineticEnergy() {
    const linear = 0.5 * this.mass * this.speed ** 2;
    const rotational = 0.5 * this.inertia * this.omega ** 2;
    return linear + rotational;
  }

  potentialEnergy(groundY) {
    const height = Math.max(0, groundY - (this.y + this.height / 2));
    return this.mass * GRAVITY * height;
  }

  get bottom() {
    return this.y + this.height / 2;
  }

  get left() {
    return this.x - this.width / 2;
  }

  get right() {
    return this.x + this.width / 2;
  }

  get top() {
    return this.y - this.height / 2;
  }

  getForces(groundY, springForces) {
    const gravity = { fx: 0, fy: this.mass * GRAVITY, label: "F_gravity" };
    const inContact = this.bottom >= groundY - 0.002;
    let normal = null;
    if (inContact) {
      normal = { fx: 0, fy: -this.mass * GRAVITY, label: "F_normal" };
    }
    const springs = springForces?.filter((f) => f.bodyId === this.id) ?? [];
    return { gravity, normal, springs, inContact };
  }

  applyTorqueFromDrag(startX, startY, endX, endY) {
    const rx = startX - this.x;
    const ry = startY - this.y;
    const fx = endX - startX;
    const fy = endY - startY;
    const torque = rx * fy - ry * fx;
    this.omega += (torque * TORQUE_IMPULSE_SCALE) / this.inertia;
    this.onGround = false;
    return { x1: startX, y1: startY, x2: endX, y2: endY };
  }
}

export class SpringGroup {
  constructor(stiffness = DEFAULT_SPRING_STIFFNESS) {
    this.id = genId();
    this.type = "spring";
    this.bodies = [];
    this.links = [];
    this.stiffness = stiffness;
  }

  hasBody(body) {
    return this.bodies.some((b) => b.id === body.id);
  }

  addBody(body) {
    if (this.hasBody(body)) return false;
    for (const existing of this.bodies) {
      const restLength = Math.hypot(body.x - existing.x, body.y - existing.y);
      this.links.push({ bodyA: existing, bodyB: body, restLength });
    }
    this.bodies.push(body);
    return true;
  }

  potentialEnergy() {
    let pe = 0;
    for (const link of this.links) {
      const dist = Math.hypot(
        link.bodyB.x - link.bodyA.x,
        link.bodyB.y - link.bodyA.y
      );
      const stretch = dist - link.restLength;
      pe += 0.5 * this.stiffness * stretch ** 2;
    }
    return pe;
  }
}

function isResting(body, groundY) {
  return (
    body.bottom >= groundY - 0.002 &&
    Math.abs(body.vy) < 0.15 &&
    Math.abs(body.vx) < 0.15 &&
    Math.abs(body.omega) < 0.05
  );
}

function snapToGround(body, groundY) {
  if (body.type === "ball") {
    body.y = groundY - body.radius;
  } else {
    body.y = groundY - body.height / 2;
  }
  body.vx = 0;
  body.vy = 0;
  body.ax = 0;
  body.ay = 0;
  body.onGround = true;
}

function applyLinearDamping(body, dt, dampingEnabled, thermalSink) {
  if (!dampingEnabled) return;
  const keBefore = 0.5 * body.mass * (body.vx ** 2 + body.vy ** 2);
  const factor = Math.max(0, 1 - LINEAR_DAMPING * dt);
  body.vx *= factor;
  body.vy *= factor;
  const keAfter = 0.5 * body.mass * (body.vx ** 2 + body.vy ** 2);
  thermalSink.value += Math.max(0, keBefore - keAfter);
}

function applyAngularDamping(body, dt, dampingEnabled, thermalSink) {
  if (!dampingEnabled) return;
  const rotKeBefore = 0.5 * body.inertia * body.omega ** 2;
  const factor = Math.max(0, 1 - LINEAR_DAMPING * dt);
  body.omega *= factor;
  const rotKeAfter = 0.5 * body.inertia * body.omega ** 2;
  thermalSink.value += Math.max(0, rotKeBefore - rotKeAfter);
}

function applyGroundFriction(body, dt, dampingEnabled, thermalSink) {
  if (!body.onGround || !dampingEnabled) return;
  const rotKeBefore = 0.5 * body.inertia * body.omega ** 2;
  body.omega *= Math.max(0, 1 - 4 * dt);
  if (Math.abs(body.omega) < 0.02) body.omega = 0;
  const rotKeAfter = 0.5 * body.inertia * body.omega ** 2;
  thermalSink.value += Math.max(0, rotKeBefore - rotKeAfter);
}

function resolveGround(body, groundY, restitution, thermalSink, dampingEnabled) {
  if (body.type === "ball") {
    if (body.y + body.radius > groundY) {
      body.y = groundY - body.radius;
      if (body.vy > 0) {
        const keBefore = 0.5 * body.mass * body.vy ** 2;
        body.vy = -body.vy * restitution;
        const keAfter = 0.5 * body.mass * body.vy ** 2;
        if (dampingEnabled) thermalSink.value += Math.max(0, keBefore - keAfter);
        if (Math.abs(body.vy) < 0.12) {
          body.vy = 0;
          body.onGround = true;
        }
      }
    } else {
      body.onGround = false;
    }
  } else if (body.type === "block") {
    const bottom = body.y + body.height / 2;
    if (bottom > groundY) {
      body.y = groundY - body.height / 2;
      if (body.vy > 0) {
        const keBefore = 0.5 * body.mass * body.vy ** 2;
        body.vy = -body.vy * restitution;
        const keAfter = 0.5 * body.mass * body.vy ** 2;
        if (dampingEnabled) thermalSink.value += Math.max(0, keBefore - keAfter);
        if (Math.abs(body.vy) < 0.12) {
          body.vy = 0;
          body.onGround = true;
        }
      }
    } else {
      body.onGround = false;
    }
  }
}

function circleBlockCollision(ball, block, thermalSink, dampingEnabled) {
  const closestX = Math.max(block.left, Math.min(ball.x, block.right));
  const closestY = Math.max(block.top, Math.min(ball.y, block.bottom));
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= ball.radius * ball.radius) return;

  const dist = Math.sqrt(distSq) || 0.001;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = ball.radius - dist;
  ball.x += nx * overlap;

  const e = Math.min(ball.restitution, block.restitution);
  const rvx = ball.vx - block.vx;
  const rvy = ball.vy - block.vy;
  const velAlongNormal = rvx * nx + rvy * ny;
  if (velAlongNormal >= 0) return;

  const j = (-(1 + e) * velAlongNormal) / (1 / ball.mass + 1 / block.mass);
  const keBefore = ball.kineticEnergy + block.kineticEnergy;

  ball.vx += (j * nx) / ball.mass;
  ball.vy += (j * ny) / ball.mass;
  block.vx -= (j * nx) / block.mass;
  block.vy -= (j * ny) / block.mass;

  if (dampingEnabled) {
    thermalSink.value += Math.max(0, keBefore - ball.kineticEnergy - block.kineticEnergy);
  }
}

function circleCircleCollision(a, b, thermalSink, dampingEnabled) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = a.radius + b.radius;
  if (dist >= minDist) return;

  const nx = dx / dist || 0;
  const ny = dy / dist || 1;
  const overlap = minDist - dist;
  a.x -= nx * (overlap / 2);
  a.y -= ny * (overlap / 2);
  b.x += nx * (overlap / 2);
  b.y += ny * (overlap / 2);

  const e = Math.min(a.restitution, b.restitution);
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;
  if (velAlongNormal >= 0) return;

  const j = (-(1 + e) * velAlongNormal) / (1 / a.mass + 1 / b.mass);
  const keBefore = a.kineticEnergy + b.kineticEnergy;

  a.vx -= (j * nx) / a.mass;
  a.vy -= (j * ny) / a.mass;
  b.vx += (j * nx) / b.mass;
  b.vy += (j * ny) / b.mass;

  if (dampingEnabled) {
    thermalSink.value += Math.max(0, keBefore - a.kineticEnergy - b.kineticEnergy);
  }
}

function blockBlockCollision(a, b, thermalSink, dampingEnabled) {
  if (
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  ) {
    return;
  }

  const overlapX = Math.min(a.right - b.left, b.right - a.left);
  const overlapY = Math.min(a.bottom - b.top, b.bottom - a.top);

  let nx = 0;
  let ny = 0;
  if (overlapX < overlapY) {
    nx = a.x < b.x ? -1 : 1;
    a.x -= nx * (overlapX / 2);
    b.x += nx * (overlapX / 2);
  } else {
    ny = a.y < b.y ? -1 : 1;
    a.y -= ny * (overlapY / 2);
    b.y += ny * (overlapY / 2);
  }

  const e = Math.min(a.restitution, b.restitution);
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;
  if (velAlongNormal >= 0) return;

  const j = (-(1 + e) * velAlongNormal) / (1 / a.mass + 1 / b.mass);
  const keBefore = a.kineticEnergy + b.kineticEnergy;

  a.vx -= (j * nx) / a.mass;
  a.vy -= (j * ny) / a.mass;
  b.vx += (j * nx) / b.mass;
  b.vy += (j * ny) / b.mass;

  if (dampingEnabled) {
    thermalSink.value += Math.max(0, keBefore - a.kineticEnergy - b.kineticEnergy);
  }
}

export class Simulation {
  constructor(groundY = 5) {
    this.groundY = groundY;
    this.bodies = [];
    this.springGroups = [];
    this.thermalEnergy = 0;
    this.dampingEnabled = true;
    this.springForceDisplay = [];
  }

  addBody(body) {
    this.bodies.push(body);
    return body;
  }

  addSpringGroup(group) {
    this.springGroups.push(group);
    return group;
  }

  removeBody(id) {
    this.bodies = this.bodies.filter((b) => b.id !== id);
    for (const group of this.springGroups) {
      group.bodies = group.bodies.filter((b) => b.id !== id);
      group.links = group.links.filter(
        (l) => l.bodyA.id !== id && l.bodyB.id !== id
      );
    }
    this.springGroups = this.springGroups.filter((g) => g.bodies.length >= 2);
  }

  removeSpringGroup(id) {
    this.springGroups = this.springGroups.filter((g) => g.id !== id);
  }

  findSpringGroupForBody(body) {
    return this.springGroups.find((g) => g.hasBody(body));
  }

  getBodyById(id) {
    return this.bodies.find((b) => b.id === id);
  }

  get totalKineticEnergy() {
    return this.bodies.reduce((sum, b) => sum + b.kineticEnergy, 0);
  }

  get totalGravitationalPotentialEnergy() {
    return this.bodies.reduce(
      (sum, b) => sum + b.potentialEnergy(this.groundY),
      0
    );
  }

  get totalSpringPotentialEnergy() {
    return this.springGroups.reduce((sum, g) => sum + g.potentialEnergy(), 0);
  }

  get totalPotentialEnergy() {
    return this.totalGravitationalPotentialEnergy + this.totalSpringPotentialEnergy;
  }

  get hasSprings() {
    return this.springGroups.length > 0;
  }

  applySpringForces(dt) {
    this.springForceDisplay = [];
    const forceAccum = new Map();

    for (const group of this.springGroups) {
      for (const link of group.links) {
        const a = link.bodyA;
        const b = link.bodyB;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const nx = dx / dist;
        const ny = dy / dist;
        const stretch = dist - link.restLength;
        let forceMag = group.stiffness * stretch;

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const relVel = rvx * nx + rvy * ny;
        const dampCoeff = this.dampingEnabled ? 0.8 : 0;
        forceMag += dampCoeff * relVel;

        const fx = forceMag * nx;
        const fy = forceMag * ny;

        a.vx += (fx / a.mass) * dt;
        a.vy += (fy / a.mass) * dt;
        b.vx -= (fx / b.mass) * dt;
        b.vy -= (fy / b.mass) * dt;

        if (!forceAccum.has(a.id)) forceAccum.set(a.id, { fx: 0, fy: 0 });
        if (!forceAccum.has(b.id)) forceAccum.set(b.id, { fx: 0, fy: 0 });
        forceAccum.get(a.id).fx += fx;
        forceAccum.get(a.id).fy += fy;
        forceAccum.get(b.id).fx -= fx;
        forceAccum.get(b.id).fy -= fy;
      }
    }

    for (const [bodyId, f] of forceAccum) {
      if (Math.hypot(f.fx, f.fy) > 0.01) {
        this.springForceDisplay.push({
          bodyId,
          fx: f.fx,
          fy: f.fy,
          label: "F_spring",
        });
      }
    }
  }

  step(dt) {
    const thermalSink = { value: 0 };

    for (const body of this.bodies) {
      if (isResting(body, this.groundY)) {
        snapToGround(body, this.groundY);
        applyGroundFriction(body, dt, this.dampingEnabled, thermalSink);
        body.angle += body.omega * dt;
        applyAngularDamping(body, dt, this.dampingEnabled, thermalSink);
        continue;
      }
      body.onGround = false;
      body.ax = 0;
      body.ay = GRAVITY;
      body.vy += GRAVITY * dt;
    }

    this.applySpringForces(dt);

    for (const body of this.bodies) {
      if (body.onGround && body.speed > 0.08) body.onGround = false;
      if (body.onGround && Math.abs(body.omega) > 0.08) body.onGround = false;
    }

    for (const body of this.bodies) {
      if (body.onGround) continue;
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      applyLinearDamping(body, dt, this.dampingEnabled, thermalSink);
    }

    for (const body of this.bodies) {
      body.angle += body.omega * dt;
      applyAngularDamping(body, dt, this.dampingEnabled, thermalSink);
    }

    for (const body of this.bodies) {
      if (body.onGround) {
        applyGroundFriction(body, dt, this.dampingEnabled, thermalSink);
        continue;
      }
      const restitution = this.dampingEnabled
        ? body.restitution
        : Math.max(body.restitution, 0.98);
      resolveGround(body, this.groundY, restitution, thermalSink, this.dampingEnabled);
      if (body.onGround) applyGroundFriction(body, dt, this.dampingEnabled, thermalSink);
    }

    const balls = this.bodies.filter((b) => b.type === "ball");
    const blocks = this.bodies.filter((b) => b.type === "block");

    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        circleCircleCollision(balls[i], balls[j], thermalSink, this.dampingEnabled);
      }
    }

    for (const ball of balls) {
      for (const block of blocks) {
        circleBlockCollision(ball, block, thermalSink, this.dampingEnabled);
      }
    }

    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        blockBlockCollision(blocks[i], blocks[j], thermalSink, this.dampingEnabled);
      }
    }

    this.thermalEnergy += thermalSink.value;
  }

  getForces(body) {
    return body.getForces(this.groundY, this.springForceDisplay);
  }

  reset() {
    resetIds();
    this.bodies = [];
    this.springGroups = [];
    this.thermalEnergy = 0;
    this.springForceDisplay = [];
    this.addBody(new Ball(0, 1.5));
  }
}
