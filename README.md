# Physics Simulation — Kinetics & Dynamics

A browser-based 2D physics simulator with balls, blocks, springs, energy tracking, and per-object elasticity.

## Features

- **Balls**, **blocks**, and **springs** — add and connect objects in the scene
- **Per-object elasticity** — select any object and adjust restitution (0–1)
- **Force vectors** — F_gravity, F_normal, F_spring (white arrows on selected object)
- **Energy bars** — kinetic (KE), gravitational potential (PE), and thermal (dissipated)
- **Damping toggle** — turn damping ON/OFF; when OFF, no air friction and near-elastic collisions
- Pause / resume, drag to reposition, delete selected objects

## Controls

| Action | Input |
|--------|--------|
| Place ball/block | Click **+ Ball** or **+ Block**, then click canvas |
| Add spring | Click **+ Spring**, then click two objects |
| Move object | Drag it |
| Adjust elasticity | Select object, use slider |
| Toggle damping | **Damping: ON/OFF** button |
| Pause | **Pause** or Space |
| Delete | **Delete Selected** or Del |

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).
