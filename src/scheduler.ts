/**
 * Service 4: the scheduler. Processes are grouped by rate: fast (every step, seconds) and slow (every N steps). Within a
 * step the order is fixed and declared, so each process reads finished inputs (BODY.md section 4's rule).
 */
import type { World } from "./world.ts";

export interface Process {
  name: string;
  every: number;                 // run every N fast steps (1 = every step)
  step(world: World, dt: number): void; // dt is the elapsed seconds since this process last ran
}

export class Scheduler {
  processes: Process[] = [];
  stepCount = 0;
  add(p: Process) { this.processes.push(p); return p; }
  /** Run one fast step, optionally setting its end time from the host's clock. */
  stepOnce(world: World, dt: number, tAfter?: number) {
    this.stepCount++;
    for (const p of this.processes) if (this.stepCount % p.every === 0) p.step(world, dt * p.every);
    if (tAfter !== undefined) world.t = tAfter;
    else world.t += dt;
    world.afterStep();
  }
  /** Advance the world by `seconds` in fast steps of `dt`. */
  run(world: World, seconds: number, dt: number) {
    const n = Math.round(seconds / dt);
    for (let i = 0; i < n; i++) this.stepOnce(world, dt);
  }
}
