export class Scheduler {
    processes = [];
    stepCount = 0;
    add(p) { this.processes.push(p); return p; }
    /** Run one fast step, optionally setting its end time from the host's clock. */
    stepOnce(world, dt, tAfter) {
        this.stepCount++;
        for (const p of this.processes)
            if (this.stepCount % p.every === 0)
                p.step(world, dt * p.every);
        if (tAfter !== undefined)
            world.t = tAfter;
        else
            world.t += dt;
        world.afterStep();
    }
    /** Advance the world by `seconds` in fast steps of `dt`. */
    run(world, seconds, dt) {
        const n = Math.round(seconds / dt);
        for (let i = 0; i < n; i++)
            this.stepOnce(world, dt);
    }
}
