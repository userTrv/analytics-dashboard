import { CHANNELS, COUNTRIES, DEVICES } from './catalog';
import { TrafficCube } from './dataset';
import { Rng } from './rng';

const NC = COUNTRIES.length;
const NCH = CHANNELS.length;
const ND = DEVICES.length;

/** Session → purchase conversion by channel and a device multiplier. */
const CR_CHANNEL = [0.024, 0.03, 0.014, 0.055, 0.035, 0.012];
const CR_DEVICE = [1.25, 0.8, 1.0];
/** Step rates that are fixed per device; view → cart is derived so the product matches CR. */
const SESSION_TO_VIEW = [0.66, 0.58, 0.62];
const CART_TO_CHECKOUT = [0.58, 0.45, 0.52];
const CHECKOUT_TO_PURCHASE = [0.66, 0.52, 0.6];
/** Yearly CAC inflation per channel: paid social gets expensive fastest. */
const CAC_DRIFT = [0.03, 0.1, 0.22, 0.03, 0.05, 0.03];

/** Collects realised (and incident-suppressed) purchases per cube cell during generation. */
export class TrafficAccumulator {
  readonly stride = NC * NCH * ND;
  readonly purchases: Uint32Array;
  readonly newCustomers: Uint32Array;
  readonly revenue: Float64Array;
  readonly lostPurchases: Uint32Array;
  readonly lostNew: Uint32Array;

  constructor(readonly days: number) {
    const n = days * this.stride;
    this.purchases = new Uint32Array(n);
    this.newCustomers = new Uint32Array(n);
    this.revenue = new Float64Array(n);
    this.lostPurchases = new Uint32Array(n);
    this.lostNew = new Uint32Array(n);
  }

  cell(day: number, country: number, channel: number, device: number): number {
    return day * this.stride + (country * NCH + channel) * ND + device;
  }

  purchase(cell: number, isNew: boolean, revenue: number): void {
    this.purchases[cell]++;
    this.revenue[cell] += revenue;
    if (isNew) this.newCustomers[cell]++;
  }

  lost(cell: number, isNew: boolean): void {
    this.lostPurchases[cell]++;
    if (isNew) this.lostNew[cell]++;
  }
}

export function trafficCell(day: number, country: number, channel: number, device: number): number {
  return day * NC * NCH * ND + (country * NCH + channel) * ND + device;
}

/**
 * Derives the upper funnel and ad spend from purchases. Traffic is modelled from *intended*
 * purchases (realised + suppressed), so an incident shows up as a conversion drop with
 * unchanged sessions and spend — exactly how a broken checkout looks in real data.
 */
export function buildTrafficCube(acc: TrafficAccumulator, rng: Rng): TrafficCube {
  const n = acc.days * acc.stride;
  const cube: TrafficCube = {
    sessions: new Uint32Array(n),
    views: new Uint32Array(n),
    carts: new Uint32Array(n),
    checkouts: new Uint32Array(n),
    purchases: acc.purchases,
    newCustomers: acc.newCustomers,
    revenue: acc.revenue,
    spend: new Float64Array(n),
  };
  const byCountry = new Float64Array(NC);
  const byChannel = new Float64Array(NCH);
  const byDevice = new Float64Array(ND);

  for (let d = 0; d < acc.days; d++) {
    const base = d * acc.stride;
    byCountry.fill(0);
    byChannel.fill(0);
    byDevice.fill(0);
    let total = 0;
    let totalNew = 0;
    for (let c = 0, cell = base; c < NC; c++) {
      for (let ch = 0; ch < NCH; ch++) {
        for (let dv = 0; dv < ND; dv++, cell++) {
          const intended = acc.purchases[cell] + acc.lostPurchases[cell];
          byCountry[c] += intended;
          byChannel[ch] += intended;
          byDevice[dv] += intended;
          total += intended;
          totalNew += acc.newCustomers[cell] + acc.lostNew[cell];
        }
      }
    }
    if (total === 0) continue;
    const years = d / 365;

    for (let c = 0, cell = base; c < NC; c++) {
      for (let ch = 0; ch < NCH; ch++) {
        for (let dv = 0; dv < ND; dv++, cell++) {
          const share = (byCountry[c] / total) * (byChannel[ch] / total) * (byDevice[dv] / total);
          const intended = acc.purchases[cell] + acc.lostPurchases[cell];
          const expected = 0.5 * intended + 0.5 * total * share;
          const cr = CR_CHANNEL[ch] * CR_DEVICE[dv];
          const r1 = SESSION_TO_VIEW[dv];
          const r3 = CART_TO_CHECKOUT[dv];
          const r4 = CHECKOUT_TO_PURCHASE[dv];
          const r2 = cr / (r1 * r3 * r4);

          const sessions = Math.round((expected / cr) * rng.logNormal(0.12));
          let views = Math.round(sessions * r1 * rng.logNormal(0.04));
          let carts = Math.round(views * r2 * rng.logNormal(0.06));
          const checkouts = Math.max(acc.purchases[cell], Math.round((expected / r4) * rng.logNormal(0.05)));
          carts = Math.max(carts, checkouts);
          views = Math.max(views, carts);
          cube.sessions[cell] = Math.max(sessions, views);
          cube.views[cell] = views;
          cube.carts[cell] = carts;
          cube.checkouts[cell] = checkouts;

          const intendedNew = acc.newCustomers[cell] + acc.lostNew[cell];
          const expectedNew = 0.5 * intendedNew + 0.5 * totalNew * share;
          const cac = CHANNELS[ch].cac * (1 + CAC_DRIFT[ch] * years);
          cube.spend[cell] = Math.round(expectedNew * cac * rng.logNormal(0.18) * 100) / 100;
        }
      }
    }
  }
  return cube;
}
