/**
 * Service 4: the scheduler. Processes are grouped by rate: fast (every step, seconds) and slow (every N steps). Within a
 * step the order is fixed and declared, so each process reads finished inputs (gears/process-order.md).
 */
import type { World } from "./world.ts";
export interface Process {
    name: string;
    every: number;
    step(world: World, dt: number): void;
}
export declare class Scheduler {
    processes: Process[];
    stepCount: number;
    add(p: Process): Process;
    /** Run one fast step, optionally setting its end time from the host's clock. */
    stepOnce(world: World, dt: number, tAfter?: number): void;
    /** Advance the world by `seconds` in fast steps of `dt`. */
    run(world: World, seconds: number, dt: number): void;
}
