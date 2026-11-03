/** Run the still-in-a-room scenario and print the result and the trace summary.  node --experimental-strip-types src/cli.ts [altitudeM] [skill] */
import { runStill } from "./lab/still.js";
const argv = globalThis.process?.argv ?? [];
const altitudeM = Number(argv[2] ?? 0), skill = Number(argv[3] ?? 60);
const r = runStill({ altitudeM, skill, minutes: 120, daysSinceCalibration: 30 });
const { world, ...rest } = r;
console.log(JSON.stringify(rest, null, 1));
console.log(world.trace.summary());
for (const n of world.trace.notes.slice(0, 10))
    console.log(`note t=${n.t}: ${n.text}`);
