import { describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import validation from '../data/library/validation.json';
import * as library from '../src/library.ts';
import { World } from '../src/world.ts';
import { defaultRegistry, type Component } from '../src/registry.ts';
import { addBodyWater, bodyOutputs, ingest, physiologyProcess, totalBodyWaterKg } from '../src/physiology.ts';
import { bodyMassDelta, eat, foodContent, foodRow, glycogenBoundWaterKg, GLYCOGEN_BOUND_WATER, nutritionProcess } from '../src/nutrition.ts';
import { bleed, bleedingClass, bleedFactor, circulationProcess, initialiseCirculation, loseBlood, normalBloodVolume } from '../src/circulation.ts';
import { airContents, roomAirProcess } from '../src/atmosphere.ts';
import { airDensity, C_TO_K, P_SEA_LEVEL } from '../src/physics.ts';
import { FIXTURE, runHumanWeek } from '../examples/human-week.ts';

function fixture(water: number | null = 40, male = 1) {
  const w = new World(defaultRegistry());
  const body: Component = { id: 'body', kind: 'body', material: 'flesh', mass: 70, temperatureC: 37,
    contents: water === null ? [] : [{ substance: 'water', phase: 'liquid', mass: water }], ports: [],
    condition: { capability: 1, control: 1, accuracy: 1 }, props: { male, height_cm: 175, age_y: 30, fat_kg: 15 } };
  w.registry.addComponent(body);
  w.registry.addComponent({ ...body, id: 'room', kind: 'room', material: 'air_mass', mass: 1e6, temperatureC: 22, contents: [], props: { rh: 0.5 } });
  const out = bodyOutputs(body); out.sao2 = 0.97; out.cohb = 0;
  return { w, body, out };
}
const waterKg = (w: World) => w.registry.contentMass(w.registry.component('body'), 'water');
function expectClosed(w: World, mass = 70, water = 40) {
  expect(Math.abs(mass + w.trace.into('body', 'mass:body') - w.trace.outOf('body', 'mass:body') - w.registry.component('body').mass)).toBeLessThan(1e-9);
  expect(Math.abs(water + w.trace.into('body', 'mass:water') - w.trace.outOf('body', 'mass:water') - waterKg(w))).toBeLessThan(1e-9);
  expect(w.trace.failed()).toEqual([]);
}
const fit = () => {
  const value = library.libraryRow('circulation', 'quantities', 'circulation.quantities.plasma-volume-per-dehydration')['Normal (70 kg man)'];
  const match = /y = ([\d.]+) \+ ([\d.]+)x/.exec(String(value))!;
  return { intercept: Number(match[1]), slope: Number(match[2]) };
};

describe('one body water ledger (2623)', () => {
  it.each([18, 22, 24])('dry sedentary day at %s C counts traced water loss and body mass once (2677)', temperatureC => {
    const { w, body, out } = fixture();
    const room = w.registry.component('room');
    const physiology = physiologyProcess('body', 'room', { met: 1, dayStartH: 0 });
    for (w.t = 0; w.t < 86400; w.t += 60) {
      room.temperatureC = temperatureC;
      physiology.step(w, 60);
    }
    const water = w.trace.transfers.filter(t => t.quantity === 'mass:water');
    const sum = (note: string) => water.filter(t => t.note === note).reduce((n, t) => n + t.amount, 0);
    const losses = { urine: sum('urine'), breath: sum('breath'), skin: sum('skin diffusion'), sweat: sum('sweat') };
    const metabolic = sum('metabolic water');
    const loss = Object.values(losses).reduce((a, b) => a + b, 0) - metabolic;
    expect(w.trace.outOf('body', 'mass:water') - w.trace.into('body', 'mass:water')).toBeCloseTo(loss, 9);
    expect(40 - waterKg(w)).toBeCloseTo(loss, 9);
    expect(70 - body.mass).toBeCloseTo(loss, 9);
    expect(body.props.waterDeficitKg).toBeCloseTo(loss, 9);
    expect(out.water_deficit_pct).toBeCloseTo(loss / 70 * 100, 9);
    expectClosed(w);
    // The reference rows have no zero-intake sedentary cohort or scaling rule.
    // Intake ranges cannot validate loss during fasting; mixed-population means cannot supply one.
    console.log('(2677) dry day', JSON.stringify({ temperatureC, losses, metabolic, loss, deficitPct: out.water_deficit_pct }));
  });

  it('dry sedentary day matches the pirate standing-watch body while glycogen releases water (2677)', () => {
    const { w, body, out } = fixture();
    const room = w.registry.component('room');
    room.temperatureC = 24;
    room.mass = airDensity(P_SEA_LEVEL, 24 + C_TO_K) * 40;
    room.contents = airContents(40, P_SEA_LEVEL, 24);
    room.props = { volume_m3: 40, pressurePa: P_SEA_LEVEL, ach: 2 };
    w.env.outsideC = 24;
    const air = roomAirProcess('room');
    const physiology = physiologyProcess('body', 'room', { met: 1.5, clockH0: 12, dayStartH: 12 });
    const nutrition = nutritionProcess('body', { clockH0: 12, dayStartH: 12 });
    for (w.t = 0; w.t < 86400; w.t += 60) {
      air.step(w, 60);
      physiology.step(w, 60);
      nutrition.step(w, 60);
    }
    const glycogenWater = 0.4 * (GLYCOGEN_BOUND_WATER ?? 0);
    const water = w.trace.transfers.filter(t => t.quantity === 'mass:water' && t.note !== 'glycogen-bound water');
    const outflows = water.filter(t => t.from === 'body').reduce((s, t) => s + t.amount, 0);
    const metabolic = water.filter(t => t.from === 'oxidation').reduce((s, t) => s + t.amount, 0);
    const loss = outflows - metabolic;
    expect(body.props.glycogen_g).toBe(0);
    expect(40 + glycogenWater - totalBodyWaterKg(w, body)).toBeCloseTo(loss, 9);
    expect(body.props.waterDeficitKg).toBeCloseTo(loss, 9);
    expect(out.water_deficit_pct).toBeCloseTo(loss / 70 * 100, 9);
    expect(out.water_deficit_pct).toBeCloseTo(1.57, 1);
    expect(body.mass - 70).toBeCloseTo(body.props.fat_kg - 15 - 0.4 - loss, 9);
    expect(w.trace.transfers.filter(t => t.from === 'body:glycogen-bound')).toEqual([
      expect.objectContaining({ to: 'body', quantity: 'mass:water', amount: glycogenWater }),
    ]);
    expectClosed(w);
    console.log('(2677) pirate dry day', JSON.stringify({ outflows, metabolic, loss, deficitPct: out.water_deficit_pct }));
  });

  it.each([0, 1])('initialises missing water once from the row for male=%s, without adding initial body mass', male => {
    const { w, body } = fixture(null, male);
    const fraction = library.libraryRow('physiology', 'body_water', `physiology.body_water.total-body-water-fraction-${male ? 'men' : 'women'}`).Value as number;
    const process = physiologyProcess('body', 'room', { met: 1 });
    process.step(w, 1); process.step(w, 1);
    expect(body.props.water_start_kg).toBe(70 * fraction);
    expect(w.trace.transfers.filter(t => t.from === 'initial-body-water')).toHaveLength(1);
    expectClosed(w, 70, 0);
  });

  it.each([
    { water: null, male: 0 }, { water: null, male: 1 },
    { water: 38, male: 0 }, { water: 38, male: 1 },
  ])('preserves a 2 kg host deficit at the first step and counts subsequent transfers (2687): $water, male=$male', ({ water, male }) => {
    const { w, body, out } = fixture(water, male);
    body.props.waterDeficitKg = 2;
    const fraction = library.libraryRow('physiology', 'body_water', `physiology.body_water.total-body-water-fraction-${male ? 'men' : 'women'}`).Value as number;
    const referenceKg = 70 * fraction;
    const process = physiologyProcess('body', 'room', { met: 1 });
    // Observe initialization without accruing any new interval's water loss.
    process.step(w, 0);
    expect(body.props.water_start_kg).toBe(referenceKg);
    expect(Math.abs(body.props.waterDeficitKg - 2)).toBeLessThan(1e-9);
    expect(out.water_deficit_pct).toBeCloseTo(2 / 70 * 100, 9);
    expect(totalBodyWaterKg(w, body)).toBeCloseTo(referenceKg - 2, 9);
    expect(waterKg(w)).toBeCloseTo(referenceKg - 2 - glycogenBoundWaterKg(body), 9);
    expect(body.mass).toBe(70);

    ingest(w, 'body', { waterKg: 0.5 });
    expect(body.props.waterDeficitKg).toBeCloseTo(1.5, 9);
    addBodyWater(w, 'body', -0.25, 'fixture', 'subsequent loss');
    expect(body.props.waterDeficitKg).toBeCloseTo(1.75, 9);
    const mark = w.trace.transfers.length;
    process.step(w, 60);
    const transfers = w.trace.transfers.slice(mark).filter(t => t.quantity === 'mass:water');
    const loss = transfers.filter(t => t.from === 'body').reduce((s, t) => s + t.amount, 0)
      - transfers.filter(t => t.to === 'body').reduce((s, t) => s + t.amount, 0);
    expect(body.props.water_start_kg).toBe(referenceKg);
    expect(body.props.waterDeficitKg).toBeCloseTo(1.75 + loss, 9);
    expect(out.water_deficit_pct).toBeCloseTo((1.75 + loss) / 70 * 100, 9);
    expect(body.mass).toBeCloseTo(70.25 - loss, 9);
    expect(w.trace.transfers.filter(t => t.from === 'initial-body-water' || t.to === 'initial-body-water')).toHaveLength(1);
    expectClosed(w, 70, water ?? 0);
  });

  it('names a missing body-water row and preserves the body when it cannot initialise', () => {
    const { w, body } = fixture(null);
    const original = library.libraryRow;
    const mock = vi.spyOn(library, 'libraryRow').mockImplementation((file, table, id) => {
      const row = original(file, table, id);
      return table === 'body_water' ? { ...row, Value: null } : row;
    });
    try {
      expect(() => physiologyProcess('body', 'room', { met: 1 }).step(w, 1)).toThrow('physiology.body_water.total-body-water-fraction-men');
      expect(body.mass).toBe(70); expect(body.contents).toEqual([]);
    } finally { mock.mockRestore(); }
  });

  it('a pre-step drink preserves the reference and adds 1 L exactly once', () => {
    const { w, body } = fixture(null);
    const fraction = library.libraryRow('physiology', 'body_water', 'physiology.body_water.total-body-water-fraction-men').Value as number;
    ingest(w, 'body', { waterKg: 1 });
    expect(waterKg(w)).toBeCloseTo(70 * fraction - glycogenBoundWaterKg(body) + 1, 9);
    expect(body.mass).toBe(71); expect(body.props.waterDeficitKg).toBe(-1);
    physiologyProcess('body', 'room', { met: 1 }).step(w, 1);
    expect(body.props.water_start_kg).toBe(70 * fraction);
    expectClosed(w, 70, 0);
  });

  it('drinking 1 L moves water, deficit, mass and plasma by their expected amounts within 1e-9', () => {
    const { w, body, out } = fixture();
    addBodyWater(w, 'body', 0, 'fixture', 'reference');
    initialiseCirculation(w, 'body');
    const circulation = circulationProcess('body', { cardiacOutputLMin: 5 });
    circulation.step(w, 0);
    const plasma0 = out['circulation.quantities.plasma-volume'] as number;
    addBodyWater(w, 'body', -1.4, 'fixture', '2% water loss');
    circulation.step(w, 0);
    const before = { mass: body.mass, water: waterKg(w), plasma: out['circulation.quantities.plasma-volume'] as number };
    ingest(w, 'body', { waterKg: 1 }); circulation.step(w, 0);
    const { intercept, slope } = fit(), pct = 0.4 / 70 * 100;
    expect(body.mass - before.mass).toBeCloseTo(1, 9);
    expect(waterKg(w) - before.water).toBeCloseTo(1, 9);
    expect(body.props.waterDeficitKg).toBeCloseTo(0.4, 9);
    expect(body.props.waterDeficitPct).toBeCloseTo(pct, 9);
    expect(out['circulation.quantities.plasma-volume']).toBeCloseTo(plasma0 * (1 - Math.max(0, slope * pct - intercept) / 100), 9);
    expect((out['circulation.quantities.plasma-volume'] as number) - before.plasma).toBeCloseTo(plasma0 * ((slope * 2 - intercept) - Math.max(0, slope * pct - intercept)) / 100, 9);
    const volume = body.props.blood_volume_ml;
    circulation.step(w, 0); expect(body.props.blood_volume_ml).toBe(volume); // no compounding
    expectClosed(w);
  });

  it('checks the signed plasma regression at 2% loss, constant red cells and fixed-flow DO2 (evidence level 5)', () => {
    // https://www.comprehensivephysiology.com/WileyCDA/CompPhysArticle/refId-c130017/
    // Source caption units/sign unconfirmed: this is arithmetic verification, not independent validation.
    const { w, body, out } = fixture();
    addBodyWater(w, 'body', 0, 'fixture', 'reference');
    const circulation = circulationProcess('body', { cardiacOutputLMin: 5 });
    circulation.step(w, 0);
    const plasma = out['circulation.quantities.plasma-volume'] as number, cells = body.props.blood_red_cells_ml;
    const hb = body.props.blood_hb_g, delivery = out['circulation.quantities.oxygen-delivery-do2'] as number;
    addBodyWater(w, 'body', -70 * 0.02, 'fixture', '2% loss'); circulation.step(w, 0);
    const { intercept, slope } = fit(), expected = plasma * (1 + (intercept + slope * -2) / 100);
    expect(out['circulation.quantities.plasma-volume']).toBeCloseTo(expected, 9);
    expect(body.props.blood_red_cells_ml).toBe(cells); expect(body.props.blood_hb_g).toBe(hb);
    expect(out['circulation.quantities.haemoglobin']).toBeCloseTo(hb * 100 / (cells + expected), 9);
    expect(out['circulation.quantities.oxygen-delivery-do2']).toBeGreaterThan(delivery);
    expect(out['circulation.quantities.plasma-volume-evidence-level']).toBe(5);
    // No quantitative fall of cardiac output is sourced. With no host flow, DO2 stays unknown.
    circulationProcess('body').step(w, 0); expect(out['circulation.quantities.oxygen-delivery-do2']).toBeNull();
    ingest(w, 'body', { waterKg: 1.4 }); circulation.step(w, 0);
    expect(out['circulation.quantities.plasma-volume']).toBeCloseTo(plasma, 9);
    expectClosed(w);
  });

  it('keeps the old volume and haemoglobin behaviour while the plasma row is null', () => {
    const { w, body, out } = fixture();
    addBodyWater(w, 'body', 0, 'fixture', 'reference'); initialiseCirculation(w, 'body');
    const initial = body.props.blood_volume_ml;
    addBodyWater(w, 'body', -1.4, 'fixture', 'dehydration');
    const original = library.libraryRow;
    const mock = vi.spyOn(library, 'libraryRow').mockImplementation((file, table, id) => {
      const row = original(file, table, id);
      return id.endsWith('.plasma-volume-per-dehydration') ? { ...row, 'Normal (70 kg man)': null } : row;
    });
    try {
      circulationProcess('body').step(w, 0);
      expect(body.props.blood_volume_ml).toBe(initial);
      expect(out['circulation.quantities.haemoglobin']).toBeCloseTo(15, 12);
      expectClosed(w);
    } finally { mock.mockRestore(); }
  });

  it('sheds blood after dehydration without losing red cells twice or applying a second body mass change', () => {
    const { w, body } = fixture();
    addBodyWater(w, 'body', 0, 'fixture', 'reference'); initialiseCirculation(w, 'body');
    addBodyWater(w, 'body', -1.4, 'fixture', 'dehydration');
    const circulation = circulationProcess('body'); circulation.step(w, 0);
    const volume = body.props.blood_volume_ml, cells = body.props.blood_red_cells_ml, before = body.mass;
    loseBlood(w, 'body', 100); circulation.step(w, 0);
    expect(body.props.blood_volume_ml).toBeCloseTo(volume - 100, 9);
    expect(body.props.blood_red_cells_ml).toBeCloseTo(cells * (1 - 100 / volume), 9);
    expect(before - body.mass).toBeCloseTo(w.trace.outOf('body', 'mass:blood'), 9);
    expectClosed(w);
  });

  it.each([100, 400])('moves glycogen water through the same ledger using the row convention (start %s g)', start => {
    const { w, body } = fixture();
    body.props.glycogen_g = start;
    body.props.nut_carb_eaten_g = start === 100 ? 200 : 0;
    body.props.intake_kcal = start === 100 ? 2000 : 0;
    body.props.expenditure_kcal = start === 400 ? 2000 : 0;
    const nutrition = nutritionProcess('body', { dayStartH: 0 });
    nutrition.step(w, 86400);
    const delta = (body.props.glycogen_g - start) / 1000;
    expect(Math.abs(delta)).toBeGreaterThan(0);
    expect(waterKg(w) - 40).toBeCloseTo(-delta * (GLYCOGEN_BOUND_WATER ?? 0), 9);
    expect(body.props.waterDeficitKg).toBeCloseTo(0, 9);
    expect(body.mass - 70).toBeCloseTo(body.props.fat_kg - 15 + delta, 9);
    expectClosed(w);
  });

  it('glycogen refill binds existing water and adds only dry glycogen plus meal water to mass (2677)', () => {
    const { w, body } = fixture();
    body.props.glycogen_g = 0;
    const food = foodRow('muscovado-sugar'), mealKg = 500 / foodContent(food, 'carb', 1);
    const mealWater = foodContent(food, 'water', mealKg) / 1000;
    eat(w, 'body', food.id, mealKg);
    // Leave exactly the 1,600 kcal needed for 400 g glycogen after this day's use.
    body.props.expenditure_kcal = body.props.intake_kcal - 1600;
    nutritionProcess('body', { dayStartH: 0 }).step(w, 86400);
    expect(body.props.glycogen_g).toBeCloseTo(400, 9);
    expect(body.props.fat_kg).toBeCloseTo(15, 9);
    expect(body.mass - 70).toBeCloseTo(0.4 + mealWater, 9);
    expect(totalBodyWaterKg(w, body) - 40).toBeCloseTo(mealWater, 9);
    expect(body.props.waterDeficitKg).toBeCloseTo(-mealWater, 9);
    expect(waterKg(w) - 40).toBeCloseTo(mealWater - 0.4 * (GLYCOGEN_BOUND_WATER ?? 0), 9);
    expect(w.trace.transfers.filter(t => t.to === 'body:glycogen-bound')).toEqual([
      expect.objectContaining({ from: 'body', quantity: 'mass:water', amount: 0.4 * (GLYCOGEN_BOUND_WATER ?? 0) }),
    ]);
    expect(w.trace.transfers.some(t => t.quantity === 'mass:body' && t.note === 'glycogen-bound water')).toBe(false);
    expectClosed(w);
  });

  it('a pre-circulation meal does not move the blood baseline or delay a wound crisis (2677)', () => {
    const { w, body } = fixture();
    ingest(w, 'body', { waterKg: 3 });
    initialiseCirculation(w, 'body');
    const baseline = normalBloodVolume(70, true), rate = 100, clotting = 0.5, dt = 60;
    expect(body.props.circulation_initial_ml).toBe(baseline);
    const circulation = circulationProcess('body');
    let reachS = 0;
    while (bleedingClass(rate / 60 * (bleedFactor() - clotting) * reachS, baseline).Class !== 'IV') reachS++;
    while (body.props.blood_lost_ml <= baseline * 0.4) {
      bleed(w, 'body', rate, dt, clotting);
      circulation.step(w, dt);
      w.t += dt;
    }
    const crisis = w.trace.crises.find(c => c.cause === 'circulation.bleeding.iv')!;
    expect(crisis).toBeDefined();
    expect(crisis.startedAt + dt - reachS).toBeGreaterThanOrEqual(0);
    expect(crisis.startedAt + dt - reachS).toBeLessThanOrEqual(dt);
    expectClosed(w);
  });

  it('rejects nonfinite or overdrawn deltas', () => {
    const { w } = fixture();
    expect(() => bodyMassDelta(w, 'body', NaN, 'fixture', 'bad')).toThrow();
    expect(() => bodyMassDelta(w, 'body', -71, 'fixture', 'bad')).toThrow();
    expect(() => addBodyWater(w, 'body', -41, 'fixture', 'bad')).toThrow();
    expectClosed(w);
  });

  it('preserves an explicitly empty water content rather than reinitialising it', () => {
    const { w, body } = fixture(0);
    physiologyProcess('body', 'room', { met: 1 }).step(w, 1);
    expect(body.props.water_start_kg).toBe(glycogenBoundWaterKg(body));
    expect(w.trace.transfers.some(t => t.from === 'initial-body-water')).toBe(false);
    expectClosed(w, 70, 0);
  });

  it('disables and flags glycogen water when the convention row is null', async () => {
    vi.resetModules();
    vi.doMock('../src/library.ts', async importOriginal => {
      const original = await importOriginal<typeof library>();
      return { ...original, libraryRow(file: string, table: string, id: string) {
        const row = original.libraryRow(file, table, id);
        return id === 'nutrition.body_composition.glycogen-bound-water' ? { ...row, Rule: null } : row;
      } };
    });
    try {
      const nutrition = await import('../src/nutrition.ts');
      const { w, body, out } = fixture(); body.props.expenditure_kcal = 2000;
      nutrition.nutritionProcess('body', { dayStartH: 0 }).step(w, 86400);
      expect(nutrition.GLYCOGEN_BOUND_WATER).toBeNull();
      expect(waterKg(w)).toBe(40); expect(out.glycogen_bound_water_kg).toBeNull();
      expect(w.trace.notes.some(n => n.text.includes('null glycogen-bound-water'))).toBe(true);
      expect(body.mass - 70).toBeCloseTo(body.props.fat_kg - 15 + (body.props.glycogen_g - 400) / 1000, 9);
      expectClosed(w);
    } finally { vi.doUnmock('../src/library.ts'); vi.resetModules(); }
  });

  it('closes the human-week mass balance within 1e-6 kg', () => {
    const { w, body } = runHumanWeek();
    expect(Math.abs(FIXTURE.massKg + w.trace.into('body', 'mass:body') - w.trace.outOf('body', 'mass:body') - body.mass)).toBeLessThan(1e-6);
    expect(body.props.waterDeficitKg).toBeCloseTo(FIXTURE.waterKg + 0.4 * (GLYCOGEN_BOUND_WATER ?? 0) - totalBodyWaterKg(w, body), 9);
    expect(w.trace.failed()).toEqual([]);
  }, 20_000);

  it('validation (2623): preformed intake lies in Raman temperate adults range; sedentary turnover remains unvalidated', () => {
    // https://pubmed.ncbi.nlm.nih.gov/14600032/ (opened by 2645, data/library/validation.json).
    // 1.4–7.7 L/day is PREformed intake, not total turnover or a sedentary-only range.
    const table = validation.water_turnover;
    const row = Object.fromEntries(table.columns.map((key, i) => [key, table.rows.find(r => r[0] === 'validation.water_turnover.raman-intake-men')![i]]));
    const run = runHumanWeek();
    for (const day of run.days) {
      const preformed = day.waterInKg - day.metabolicWaterKg;
      expect(preformed).toBeGreaterThanOrEqual(row.Low as number);
      expect(preformed).toBeLessThanOrEqual(row.High as number);
    }
    expect(row.URL).toBe('https://pubmed.ncbi.nlm.nih.gov/14600032/');
  }, 20_000);

  it('allows body .mass assignments only inside bodyMassDelta (registry content entries are separate)', () => {
    interface Fs { readdirSync(p: string): string[]; statSync(p: string): { isDirectory(): boolean }; readFileSync(p: string, encoding: string): string }
    const fs = (globalThis as unknown as { process: { getBuiltinModule(id: string): Fs } }).process.getBuiltinModule('node:fs');
    const root = decodeURIComponent(new URL('../src', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
    const walk = (dir: string): string[] => fs.readdirSync(dir).flatMap(f => fs.statSync(`${dir}/${f}`).isDirectory() ? walk(`${dir}/${f}`) : f.endsWith('.ts') ? [`${dir}/${f}`] : []);
    const writes: string[] = [];
    for (const file of walk(root)) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node, owner = '') => {
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) owner = node.name?.getText(source) ?? '';
        if (ts.isBinaryExpression(node) && ts.isPropertyAccessExpression(node.left) && node.left.name.text === 'mass'
          && [ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken].includes(node.operatorToken.kind)) {
          if (file.endsWith('/registry.ts') && owner === 'addContent' && node.left.expression.getText(source) === 'x') return;
          writes.push(`${file.slice(root.length + 1)}:${owner}`);
        }
        ts.forEachChild(node, child => visit(child, owner));
      };
      visit(source);
    }
    expect(writes).toEqual(['nutrition.ts:bodyMassDelta']);
  });
});
