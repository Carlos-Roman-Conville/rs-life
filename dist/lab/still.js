/**
 * The operational test: a still in a room (ENGINE.md section 3). A character, a charcoal heater, a copper vessel of water,
 * a worm condenser in a tub, pipes, a collector; the room as a box; a thermometer that drifts; wear.
 */
import { defaultRegistry } from "../registry.js";
import { bodyProcess } from "../physiology.js";
import { World } from "../world.js";
import { Scheduler } from "../scheduler.js";
import { BRICK_WALL, airDensity, C_TO_K, M, pressureAtAltitude } from "../physics.js";
import { evaporationProcess, wallsProcess, boilingProcess, combustionProcess, condensationProcess, controlProcess, lossesProcess, rng, roomProcess, thermometerProcess, wearProcess } from "../process.js";
export function runStill(o = {}) {
    const alt = o.altitudeM ?? 0, outsideC = o.outsideC ?? 26, pressure = pressureAtAltitude(alt);
    const reg = defaultRegistry();
    const w = new World(reg);
    w.env.outsideC = outsideC;
    const V = o.roomM3 ?? 40;
    const rho = airDensity(pressure, outsideC + C_TO_K), airKg = rho * V;
    const room = { id: "room", kind: "room", material: "air_mass", mass: airKg, temperatureC: outsideC, contents: [
            { substance: "o2", phase: "gas", mass: 0.2095 * M.O2 / M.air * airKg }, { substance: "n2", phase: "gas", mass: 0.7905 * M.N2 / M.air * airKg },
            { substance: "co2", phase: "gas", mass: 0.0004 * M.CO2 / M.air * airKg }, { substance: "co", phase: "gas", mass: 0 }, { substance: "water", phase: "gas", mass: 0.012 * airKg }
        ],
        ports: [{ id: "air", kind: "gas", direction: "both" }], condition: { capability: 1, control: 1, accuracy: 1 }, props: { volume_m3: V, ach: o.ach ?? 2, pressurePa: pressure } };
    const heater = { id: "heater", kind: "heater", material: "brick", mass: 20, temperatureC: outsideC, contents: [{ substance: "charcoal", phase: "solid", mass: o.charcoalKg ?? 3 }],
        ports: [{ id: "flame", kind: "heat", direction: "out" }], condition: { capability: 1, control: 1, accuracy: 1 }, props: { efficiency: 0.3, feedKgPerS: 0 } };
    // New geometry assumption: cylindrical vessel height=diameter, so exposed bottom+sides=5*free surface.
    const vessel = { id: "vessel", kind: "vessel", material: "copper", mass: 4, temperatureC: outsideC, contents: [{ substance: "water", phase: "liquid", mass: o.waterKg ?? 5 }],
        ports: [{ id: "heat", kind: "heat", direction: "in" }, { id: "vapour", kind: "gas", direction: "out" }], condition: { capability: 1, control: 1, accuracy: 1 }, props: { freeSurface_m2: 0.25 / 5, area_m2: 0.25, h: 10, wearPerHourAtMax: 0.02 } };
    // New condenser geometry: D=0.09 m, as in F-Chart's water-cylinder example:
    // https://fchart.com/ees/heat_transfer_library/free_convection/hs3040.htm
    // Recirculation 1 kg/min (~1 L/min), the upper operating flow in Euro 30 instructions p.3:
    // https://www.spiritsunlimited.co.nz/upload/euro30_instructions.pdf
    const condenser = { id: "condenser", kind: "condenser", material: "copper", mass: 3, temperatureC: outsideC, contents: [],
        ports: [{ id: "vapour", kind: "gas", direction: "in" }, { id: "liquid", kind: "fluid", direction: "out" }], condition: { capability: 1, control: 1, accuracy: 1 }, props: { area_m2: 0.3, diameter_m: 0.09, coolantKgPerS: 1 / 60 } };
    const tub = { id: "tub", kind: "tub", material: "wood", mass: 15, temperatureC: outsideC, contents: [{ substance: "water", phase: "liquid", mass: o.tubKg ?? 60 }],
        ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: { area_m2: 1.0, h: 10 } };
    const collector = { id: "collector", kind: "collector", material: "glass", mass: 1, temperatureC: outsideC, contents: [{ substance: "water", phase: "liquid", mass: 0 }],
        ports: [{ id: "liquid", kind: "fluid", direction: "in" }], condition: { capability: 1, control: 1, accuracy: 1 }, props: {} };
    const body = { id: "body", kind: "body", material: "flesh", mass: 70, temperatureC: 37.0, contents: [], ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: { area_m2: 1.9, h: 10 } };
    const thermometer = { id: "thermometer", kind: "thermometer", material: "glass", mass: 0.05, temperatureC: outsideC, contents: [], ports: [], condition: { capability: 1, control: 1, accuracy: 1 }, props: { sigmaK: 0.5, driftKPerDay: 0.05 } };
    // New geometry assumption: four walls of a cube of the existing volume; roof/floor omitted.
    const wallArea = 4 * V ** (2 / 3);
    const walls = { id: "walls", kind: "walls", material: "wall_brick",
        mass: wallArea * BRICK_WALL.thicknessM * BRICK_WALL.density, temperatureC: outsideC,
        contents: [], ports: [{ id: "heat", kind: "heat", direction: "both" }],
        condition: { capability: 1, control: 1, accuracy: 1 }, props: { area_m2: wallArea, h: BRICK_WALL.h, U: BRICK_WALL.U } };
    room.ports.push({ id: "heat", kind: "heat", direction: "both" });
    w.graph.connect({ id: "room-walls", kind: "heat", from: "room", fromPort: "heat", to: "walls", toPort: "heat", props: {} });
    for (const c of [room, walls, heater, vessel, condenser, tub, collector, body, thermometer])
        reg.addComponent(c);
    w.graph.connect({ id: "flame", kind: "heat", from: "heater", fromPort: "flame", to: "vessel", toPort: "heat", props: {} });
    w.graph.connect({ id: "pipe", kind: "gas", from: "vessel", fromPort: "vapour", to: "condenser", toPort: "vapour", props: {} });
    w.graph.connect({ id: "spout", kind: "fluid", from: "condenser", fromPort: "liquid", to: "collector", toPort: "liquid", props: {} });
    // water is conserved across the apparatus plus the room (what leaves the room by ventilation is traced)
    w.conserve("water", ["vessel", "condenser", "collector", "room", "tub"], 1e-6);
    w.conserve("charcoal", ["heater"], 1e-9);
    const rand = rng(o.seed ?? 1);
    const s = new Scheduler();
    s.add(controlProcess("heater", o.feedKgPerS ?? 0.4 / 3600, o.skill ?? 60, rand));
    s.add(combustionProcess("heater", "room"));
    s.add(lossesProcess("room", ["vessel", "condenser", "tub", "collector"]));
    s.add(evaporationProcess("vessel", "room"));
    s.add(boilingProcess("vessel", "room"));
    s.add(condensationProcess("condenser", "tub", "collector", "room"));
    s.add(wallsProcess("room", "walls"));
    s.add(roomProcess("room"));
    s.add(bodyProcess("body", "room", 3.3));
    s.add(thermometerProcess("thermometer", "vessel", o.daysSinceCalibration ?? 0, rand));
    s.add(wearProcess(["vessel", "condenser"]));
    const journal = [];
    let firstBoil = null;
    const total = (o.minutes ?? 120) * 60, dt = 1;
    for (let t = 0; t < total; t += 60) {
        s.run(w, 60, dt);
        if (firstBoil === null && reg.contentMass(collector, "water", "liquid") > 0) {
            firstBoil = w.t;
            journal.push(`t=${(w.t / 60).toFixed(0)} min: the water boils; the glass reads ${thermometer.props.reading.toFixed(1)} C`);
        }
    }
    journal.push(`t=${(w.t / 60).toFixed(0)} min: collected ${reg.contentMass(collector, "water", "liquid").toFixed(3)} kg of distillate; the room is ${room.temperatureC.toFixed(1)} C, CO2 ${room.props.co2ppm.toFixed(0)} ppm; the distiller is ${(body.props.waterDeficitPct ?? 0).toFixed(1)}% down on water`);
    return {
        world: w,
        boilingPointC: vessel.props.boilingPointC,
        firstBoilAtS: firstBoil,
        distillateKg: reg.contentMass(collector, "water", "liquid"),
        lostToRoomKg: w.trace.transfers.filter(x => x.quantity === "mass:water" && x.to === "room" && x.process === "condensation").reduce((a, x) => a + x.amount, 0),
        charcoalBurnedKg: w.trace.outOf("heater", "mass:charcoal"),
        vesselC: vessel.temperatureC, tubC: tub.temperatureC, roomC: room.temperatureC,
        co2ppm: room.props.co2ppm, o2frac: room.props.o2frac, coppm: room.props.coppm, rh: room.props.rh,
        bodyC: body.temperatureC, waterDeficitPct: body.props.waterDeficitPct ?? 0, co2ppmMin: body.props.co2ppmMin ?? 0,
        thermometerReading: thermometer.props.reading, thermometerTrue: thermometer.props.trueValue,
        vesselCondition: { ...vessel.condition },
        conservationFailures: w.trace.failed().length,
        journal,
    };
}
