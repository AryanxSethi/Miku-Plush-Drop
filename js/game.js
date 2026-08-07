/**
 * Miku Plush Drop — game loop & physics step.
 *
 * The performance-sensitive core: advances physics at fixed step, caps the
 * Matter.js sleeping-pairs table (leak guard), culls offscreen bodies, animates
 * pitch/yaw/squash back to rest, draws the scene, detects world settle to flip
 * the idle flag, and hosts the frame loop with DPR auto-tuning. Also wires the
 * collision handler that gives colliding plushies a tumble/squash impulse.
 */

import { state } from './state.js';
import { FRAME_STEP } from './config.js';
import { draw } from './view.js';
import { tuneDpr } from './world.js';

/**
 * Advance physics and draw one frame. Steps at fixed FRAME_STEP, applies the
 * pair-table cap (performance fix), removes offscreen bodies, animates
 * pitch/yaw/squash back to rest, and detects when the world is fully settled
 * to flip the idle flag so the frame loop can stop stepping.
 * @param {number} now
 */
export function step(now) {
  const dt = Math.min((now - state.lastStep) / 1000, 0.05);
  state.lastStep = now;
  const { ctx } = state.dom;

  state.Engine.update(state.engine, 16.666);

  // Matter.js 0.19 keeps collision pairs involving sleeping bodies forever,
  // even after the bodies are removed. Cap the pair table (scaled to the
  // adaptive pile cap) so per-frame cost stays bounded regardless of how many
  // plushies have been dropped over time.
  if (state.engine.pairs.list.length > state.maxPlush * 5) {
    state.Pairs.clear(state.engine.pairs);
  }

  const list = [];
  let awake = false;
  let settled = 0;
  for (const [body, v] of state.visuals) {
    if (body.position.y < -260) {
      state.World.remove(state.engine.world, body);
      state.visuals.delete(body);
      continue;
    }
    if (!body.isSleeping) awake = true;
    v.pitchVel += (-v.pitch * 55 - v.pitchVel * 11) * dt;
    v.pitch += v.pitchVel * dt;
    v.yawVel += (-v.yaw * 55 - v.yawVel * 11) * dt;
    v.yaw += v.yawVel * dt;
    v.squashVel += (-v.squash * 130 - v.squashVel * 11) * dt;
    v.squash += v.squashVel * dt;
    if (
      Math.abs(v.pitch) < 0.02 &&
      Math.abs(v.yaw) < 0.02 &&
      Math.abs(v.squash) < 0.008 &&
      Math.abs(v.pitchVel) + Math.abs(v.yawVel) < 0.04
    ) {
      settled++;
    }
    list.push({ b: body, v });
  }
  list.sort((p, q) => p.b.position.y - q.b.position.y);

  // IMPORTANT: clear canvas even if list is empty (fixes pile clear freeze)
  if (!list.length) {
    ctx.setTransform(state.DPR, 0, 0, state.DPR, 0, 0);
    ctx.clearRect(0, 0, state.W, state.H);
    state.idle = true;
    state.physicsDirty = false;
    return;
  }

  if (awake || settled < list.length) {
    draw(list);
    state.idle = false;
  } else {
    state.idle = true;
    // Still draw once to capture the final resting state
    draw(list);
  }
}

/**
 * Animation loop: tune DPR when active, and run the physics step only when
 * there's work to do (world not idle, or physics marked dirty). Begins
 * stepping again whenever a drop/collision/resize sets physicsDirty.
 * @param {number} now
 */
export function frame(now) {
  if (!state.idle) tuneDpr(now);

  // Skip physics & drawing when idle and nothing changed
  if (!state.idle || state.physicsDirty) {
    if (now - state.lastPaint >= FRAME_STEP) {
      state.lastPaint = now;
      step(now);
      if (state.idle) state.physicsDirty = false; // now static, no need for further steps
    }
  }
  requestAnimationFrame(frame);
}

/** Give colliding plushies a tumble/squash impulse scaled by impact speed. */
export function wireCollisions() {
  state.Events.on(state.engine, 'collisionStart', (e) => {
    for (const pair of e.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      if (a.isStatic && b.isStatic) continue;
      const speed = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
      if (speed < 2) continue;
      const kick = Math.min(speed * 0.28, 5.5);
      const squash = Math.min(0.16 + speed * 0.02, 0.3);
      for (const body of [a, b]) {
        const v = state.visuals.get(body);
        if (!v) continue;
        v.pitchVel += (Math.random() - 0.5) * kick;
        v.yawVel += (Math.random() - 0.5) * kick * 0.7;
        v.squash += squash;
        v.baked = null;
      }
    }
    state.physicsDirty = true; // collision wakes bodies up, need physics
  });
}