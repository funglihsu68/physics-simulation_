const COLORS = {
  ground: "#2a2f3d",
  groundLine: "#4b5563",
  ball: "#a78bfa",
  ballHighlight: "#c4b5fd",
  block: "#38bdf8",
  blockHighlight: "#7dd3fc",
  spring: "#f472b6",
  force: "#ffffff",
  torque: "#a3e635",
  velocity: "#fbbf24",
  label: "#e8eaed",
  labelBg: "rgba(15, 17, 23, 0.82)",
  selected: "#5b8def",
};

const FORCE_ARROW_SCALE = 5.5;
const FORCE_LINE_WIDTH = 4;
const FORCE_HEAD_LEN = 16;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.scale = 80;
    this.groundY = 5;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const wrap = this.canvas.parentElement;
    const width = wrap.clientWidth;
    const height = Math.min(560, Math.max(400, width * 0.55));
    this.canvas.width = width;
    this.canvas.height = height;
    this.originX = width / 2;
    this.originY = 40;
    this.groundPx = this.originY + this.groundY * this.scale;
  }

  worldToScreen(x, y) {
    return {
      sx: this.originX + x * this.scale,
      sy: this.originY + y * this.scale,
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.originX) / this.scale,
      y: (sy - this.originY) / this.scale,
    };
  }

  pointerToScreen(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      sx: ((clientX - rect.left) / rect.width) * this.canvas.width,
      sy: ((clientY - rect.top) / rect.height) * this.canvas.height,
    };
  }

  hitTestBody(bodies, sx, sy) {
    for (let i = bodies.length - 1; i >= 0; i--) {
      const body = bodies[i];
      if (body.type === "ball") {
        const { sx: bx, sy: by } = this.worldToScreen(body.x, body.y);
        const r = body.radius * this.scale;
        if (Math.hypot(sx - bx, sy - by) <= r + 6) return body;
      } else if (body.type === "block") {
        const { x: wx, y: wy } = this.screenToWorld(sx, sy);
        const dx = wx - body.x;
        const dy = wy - body.y;
        const cos = Math.cos(-body.angle);
        const sin = Math.sin(-body.angle);
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;
        if (Math.abs(lx) <= body.width / 2 + 0.05 && Math.abs(ly) <= body.height / 2 + 0.05) {
          return body;
        }
      }
    }
    return null;
  }

  draw(sim, selectedId, forcesMap, paused, placePreview, torquePreview, torqueDisplays, springHighlightIds) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.drawGrid();
    this.drawGround();

    for (const group of sim.springGroups) {
      for (const link of group.links) {
        this.drawSpringLink(link.bodyA, link.bodyB);
      }
    }

    for (const body of sim.bodies) {
      const isSpringPick = springHighlightIds?.has(body.id);
      if (body.type === "ball") this.drawBall(body, body.id === selectedId, isSpringPick);
      else if (body.type === "block") this.drawBlock(body, body.id === selectedId, isSpringPick);
    }

    for (const vec of torqueDisplays ?? []) {
      this.drawTorqueVector(vec, false, vec.opacity ?? 1);
    }

    if (torquePreview) {
      this.drawTorqueVector(torquePreview, true);
    }

    if (selectedId && forcesMap.has(selectedId)) {
      const body = sim.getBodyById(selectedId);
      if (body) this.drawForces(body, forcesMap.get(selectedId));
    }

    if (placePreview) this.drawPlacePreview(placePreview);
    if (paused) this.drawPausedOverlay();
  }

  drawSpringLink(bodyA, bodyB) {
    const { ctx } = this;
    const a = this.worldToScreen(bodyA.x, bodyA.y);
    const b = this.worldToScreen(bodyB.x, bodyB.y);
    const coils = 10;
    const dx = b.sx - a.sx;
    const dy = b.sy - a.sy;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    const nx = -dy / len;
    const ny = dx / len;
    const amplitude = Math.min(12, len / (coils * 2));

    ctx.strokeStyle = COLORS.spring;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    for (let i = 1; i <= coils; i++) {
      const t = i / coils;
      const px = a.sx + dx * t;
      const py = a.sy + dy * t;
      const side = i % 2 === 0 ? 1 : -1;
      ctx.lineTo(px + nx * amplitude * side, py + ny * amplitude * side);
    }
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  }

  drawPlacePreview(preview) {
    const { ctx } = this;
    const { sx, sy } = this.worldToScreen(preview.x, preview.y);
    ctx.strokeStyle = COLORS.selected;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    if (preview.type === "ball") {
      ctx.beginPath();
      ctx.arc(sx, sy, preview.radius * this.scale, 0, Math.PI * 2);
      ctx.stroke();
    } else if (preview.type === "block") {
      const hw = (preview.width * this.scale) / 2;
      const hh = (preview.height * this.scale) / 2;
      ctx.strokeRect(sx - hw, sy - hh, hw * 2, hh * 2);
    }
    ctx.setLineDash([]);
  }

  drawTorqueVector(vec, preview, opacity = 1) {
    const { ctx } = this;
    const a = this.worldToScreen(vec.x1, vec.y1);
    const b = this.worldToScreen(vec.x2, vec.y2);
    const dx = b.sx - a.sx;
    const dy = b.sy - a.sy;
    const len = Math.hypot(dx, dy);
    if (len < 2) return;

    const angle = Math.atan2(dy, dx);
    const alpha = preview ? 0.7 : opacity;
    ctx.strokeStyle = preview ? `rgba(163, 230, 53, ${alpha})` : `rgba(163, 230, 53, ${alpha})`;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = preview ? 2.5 : 3.5;
    ctx.lineCap = "round";
    if (preview) ctx.setLineDash([8, 6]);

    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
    ctx.setLineDash([]);

    const headLen = preview ? 10 : 12;
    const headAngle = Math.PI / 7;
    ctx.beginPath();
    ctx.moveTo(b.sx, b.sy);
    ctx.lineTo(
      b.sx - headLen * Math.cos(angle - headAngle),
      b.sy - headLen * Math.sin(angle - headAngle)
    );
    ctx.lineTo(
      b.sx - headLen * Math.cos(angle + headAngle),
      b.sy - headLen * Math.sin(angle + headAngle)
    );
    ctx.closePath();
    ctx.fill();

    if (!preview) {
      this.drawFloatingLabel(b.sx + 10, b.sy - 10, "τ (applied)", COLORS.torque, true);
    }
  }

  drawBall(ball, selected, springPick) {
    const { ctx } = this;
    const { sx, sy } = this.worldToScreen(ball.x, ball.y);
    const r = ball.radius * this.scale;

    if (ball.y + ball.radius < this.groundY - 0.05) {
      const shadowScale = 1 - (this.groundY - ball.y - ball.radius) / (this.groundY + 2);
      const shadowW = r * 1.4 * Math.max(0.2, shadowScale);
      ctx.beginPath();
      ctx.ellipse(sx, this.groundPx + 3, shadowW, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fill();
    }

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ball.angle);

    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    grad.addColorStop(0, COLORS.ballHighlight);
    grad.addColorStop(1, COLORS.ball);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 0.75, 0);
    ctx.stroke();

    ctx.restore();

    if (selected || springPick) {
      ctx.strokeStyle = springPick ? COLORS.spring : COLORS.selected;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    const velText = `${ball.speed.toFixed(1)} m/s`;
    this.drawFloatingLabel(sx + r + 14, sy - 8, velText, COLORS.velocity);
  }

  drawBlock(block, selected, springPick) {
    const { ctx } = this;
    const { sx, sy } = this.worldToScreen(block.x, block.y);
    const hw = (block.width * this.scale) / 2;
    const hh = (block.height * this.scale) / 2;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(block.angle);

    ctx.fillStyle = COLORS.block;
    ctx.fillRect(-hw, -hh, hw * 2, hh * 2);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(-hw, -hh, hw * 2, hh * 0.35);

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(hw * 0.7, 0);
    ctx.stroke();

    ctx.restore();

    if (selected || springPick) {
      ctx.strokeStyle = springPick ? COLORS.spring : COLORS.selected;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(hw, hh) + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    const velText = `${block.speed.toFixed(1)} m/s`;
    this.drawFloatingLabel(sx + hw + 14, sy - 8, velText, COLORS.velocity);
  }

  drawForces(body, forces) {
    const { sx, sy } = this.worldToScreen(body.x, body.y);
    this.drawForceArrow(sx, sy, forces.gravity, "F_gravity");
    if (forces.normal) {
      this.drawForceArrow(sx, sy, forces.normal, "F_normal");
    }
    for (const sf of forces.springs ?? []) {
      this.drawForceArrow(sx, sy, sf, sf.label);
    }
  }

  drawForceArrow(cx, cy, force, label) {
    const magnitude = Math.hypot(force.fx, force.fy);
    if (magnitude < 0.01) return;

    const len = magnitude * FORCE_ARROW_SCALE;
    const angle = Math.atan2(force.fy, force.fx);
    const ex = cx + Math.cos(angle) * len;
    const ey = cy + Math.sin(angle) * len;

    const { ctx } = this;
    ctx.strokeStyle = COLORS.force;
    ctx.fillStyle = COLORS.force;
    ctx.lineWidth = FORCE_LINE_WIDTH;
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 4;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    const headAngle = Math.PI / 7;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(
      ex - FORCE_HEAD_LEN * Math.cos(angle - headAngle),
      ey - FORCE_HEAD_LEN * Math.sin(angle - headAngle)
    );
    ctx.lineTo(
      ex - FORCE_HEAD_LEN * Math.cos(angle + headAngle),
      ey - FORCE_HEAD_LEN * Math.sin(angle + headAngle)
    );
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    const labelX = ex + Math.cos(angle) * 14;
    const labelY = ey + Math.sin(angle) * 14;
    this.drawFloatingLabel(labelX, labelY, label, COLORS.force, true);
  }

  drawGrid() {
    const { ctx, canvas } = this;
    ctx.strokeStyle = "rgba(42, 47, 61, 0.6)";
    ctx.lineWidth = 1;
    const step = this.scale;
    for (let x = this.originX % step; x < canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = this.originY % step; y < canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  drawGround() {
    const { ctx, canvas } = this;
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, this.groundPx, canvas.width, canvas.height - this.groundPx);
    ctx.strokeStyle = COLORS.groundLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.groundPx);
    ctx.lineTo(canvas.width, this.groundPx);
    ctx.stroke();
  }

  drawFloatingLabel(x, y, text, color, small = false) {
    const { ctx } = this;
    ctx.font = small
      ? "11px Segoe UI, system-ui, sans-serif"
      : "bold 13px Segoe UI, system-ui, sans-serif";
    const metrics = ctx.measureText(text);
    const padX = 6;
    const w = metrics.width + padX * 2;
    const h = (small ? 14 : 18) + 4;

    ctx.fillStyle = COLORS.labelBg;
    ctx.beginPath();
    ctx.roundRect(x - padX, y - h / 2, w, h, 4);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  }

  drawPausedOverlay() {
    const { ctx, canvas } = this;
    ctx.fillStyle = "rgba(15, 17, 23, 0.35)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "600 22px Segoe UI, system-ui, sans-serif";
    ctx.fillStyle = "#e8eaed";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
    ctx.textAlign = "start";
  }
}
