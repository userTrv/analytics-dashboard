import { CATEGORIES, CHANNELS, COUNTRIES, DEVICES, PRODUCTS, REGIONS, SEGMENT_CATEGORY_WEIGHTS, SEGMENTS } from './catalog';
import { IN_APP_CHECKOUT_INCIDENT_START, dayEffect, DayEffect } from './calendar-effects';
import { Dataset, OrderColumns } from './dataset';
import { DATASET_END, DATASET_SEED, DATASET_START } from './dataset-config';
import { addDays, diffDays, IsoDate } from './dates';
import { cumulative, Rng } from './rng';
import { buildTrafficCube, TrafficAccumulator } from './traffic';

export interface GeneratorOptions {
  readonly seed: number;
  readonly start: IsoDate;
  readonly end: IsoDate;
  /** Baseline new customers per day at the start of the dataset. */
  readonly newCustomersPerDay: number;
}

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  seed: DATASET_SEED,
  start: DATASET_START,
  end: DATASET_END,
  newCustomersPerDay: 86,
};

const YEARLY_GROWTH = 0.3;
const NEW_CHANNEL_BASE = [30, 24, 14, 6, 12, 10];
const NEW_CHANNEL_DRIFT = [-4, -2, 12, 0, 0, 4]; // weight change per year: paid social takes share
const RETURNING_CHANNEL = cumulative([22, 12, 8, 38, 6, 14]);
const PAID_SOCIAL = CHANNELS.findIndex((c) => c.code === 'paid_social');
const MOBILE = DEVICES.findIndex((d) => d.code === 'mobile');
const APAC = REGIONS.findIndex((r) => r.code === 'apac');

/** Growable typed-array columns so we never guess the final row count up front. */
class OrderBuilder {
  length = 0;
  cols: { -readonly [K in keyof OrderColumns]: OrderColumns[K] };

  constructor(capacity: number) {
    this.cols = OrderBuilder.alloc(capacity);
  }

  private static alloc(n: number): OrderBuilder['cols'] {
    return {
      day: new Uint16Array(n),
      customer: new Uint32Array(n),
      product: new Uint16Array(n),
      category: new Uint8Array(n),
      country: new Uint8Array(n),
      channel: new Uint8Array(n),
      device: new Uint8Array(n),
      segment: new Uint8Array(n),
      isNew: new Uint8Array(n),
      refunded: new Uint8Array(n),
      qty: new Uint16Array(n),
      revenue: new Float64Array(n),
      cost: new Float64Array(n),
      discount: new Float64Array(n),
    };
  }

  reserve(): number {
    if (this.length === this.cols.day.length) {
      const next = OrderBuilder.alloc(this.length * 2);
      for (const key of Object.keys(next) as (keyof OrderColumns)[]) {
        (next[key] as Uint8Array).set(this.cols[key] as Uint8Array);
      }
      this.cols = next;
    }
    return this.length++;
  }

  finish(): OrderColumns {
    const out = {} as OrderBuilder['cols'];
    for (const key of Object.keys(this.cols) as (keyof OrderColumns)[]) {
      (out as Record<string, unknown>)[key] = this.cols[key].slice(0, this.length);
    }
    return out;
  }
}

/**
 * Generates the whole synthetic business deterministically from `options.seed`.
 * Customers are simulated day by day: new customers place a first order, then each order
 * schedules the next one with a segment-specific repeat probability and gap.
 */
export function generateDataset(options: GeneratorOptions = DEFAULT_GENERATOR_OPTIONS): Dataset {
  const rng = new Rng(options.seed);
  const days = diffDays(options.start, options.end) + 1;
  const effects: DayEffect[] = [];
  for (let d = 0; d < days; d++) effects.push(dayEffect(addDays(options.start, d)));
  const incidentDay = diffDays(options.start, IN_APP_CHECKOUT_INCIDENT_START);

  const segmentCum = cumulative(SEGMENTS.map((s) => s.weight));
  const categoryCum = SEGMENT_CATEGORY_WEIGHTS.map((w) => cumulative(w));
  const productsByCategory = CATEGORIES.map((_, ci) => PRODUCTS.map((p, pi) => ({ p, pi })).filter((x) => x.p.category === ci));
  const productCum = productsByCategory.map((list) => cumulative(list.map((x) => x.p.popularity)));

  const orders = new OrderBuilder(Math.ceil(days * options.newCustomersPerDay * 3.5));
  let customerCap = Math.ceil(days * options.newCustomersPerDay * 2);
  let custFirstDay = new Uint16Array(customerCap);
  let custCountry = new Uint8Array(customerCap);
  let custChannel = new Uint8Array(customerCap);
  let custDevice = new Uint8Array(customerCap);
  let custSegment = new Uint8Array(customerCap);
  let custOrders = new Uint16Array(customerCap);
  let customerCount = 0;

  const schedule: (number[] | null)[] = Array.from({ length: days }, () => null);
  const traffic = new TrafficAccumulator(days);

  let countryCum = cumulative([]);
  let newChannelWeights: number[] = [];

  const emit = (customer: number, d: number, isNew: boolean, channel: number, device: number): boolean => {
    const segment = custSegment[customer];
    const country = custCountry[customer];
    const cell = traffic.cell(d, country, channel, device);
    if (d >= incidentDay && channel === PAID_SOCIAL && device === MOBILE && rng.chance(0.5)) {
      traffic.lost(cell, isNew);
      return false;
    }
    const category = rng.pickCumulative(categoryCum[segment]);
    const choice = productsByCategory[category][rng.pickCumulative(productCum[category])];
    const seg = SEGMENTS[segment];
    let qty = 1 + (rng.chance(0.2) ? 1 : 0) + (rng.chance(0.06) ? 1 : 0);
    if (seg.basketMultiplier > 1) qty = Math.max(1, Math.round(qty * seg.basketMultiplier * rng.logNormal(0.35)));
    const effect = effects[d];
    const discountRate = effect.discount > 0 && rng.chance(0.8) ? effect.discount : 0;
    const list = choice.p.price * rng.logNormal(0.04) * qty;
    const revenue = Math.round(list * (1 - discountRate) * 100) / 100;
    const refundP = CATEGORIES[category].refundRate * (discountRate > 0 ? 1.25 : 1) * (device === MOBILE ? 1.1 : 1);

    const i = orders.reserve();
    const c = orders.cols;
    c.day[i] = d;
    c.customer[i] = customer;
    c.product[i] = choice.pi;
    c.category[i] = category;
    c.country[i] = country;
    c.channel[i] = channel;
    c.device[i] = device;
    c.segment[i] = segment;
    c.isNew[i] = isNew ? 1 : 0;
    c.refunded[i] = rng.chance(refundP) ? 1 : 0;
    c.qty[i] = qty;
    c.revenue[i] = revenue;
    c.cost[i] = Math.round(choice.p.unitCost * qty * 100) / 100;
    c.discount[i] = Math.round((list - revenue) * 100) / 100;
    traffic.purchase(cell, isNew, revenue);
    custOrders[customer]++;
    scheduleNext(customer, d);
    return true;
  };

  const scheduleNext = (customer: number, d: number): void => {
    const seg = SEGMENTS[custSegment[customer]];
    // Customers who came back once are much more likely to stay (retention curves flatten).
    const p = custOrders[customer] >= 2 ? Math.min(0.86, seg.repeat * 1.65) : seg.repeat;
    if (!rng.chance(p)) return;
    // Rejection-sample the gap so returning orders follow the same seasonality as demand.
    let target = d;
    for (let attempt = 0; attempt < 4; attempt++) {
      target = d + 3 + Math.round(rng.exponential(seg.gapDays));
      if (target >= days || rng.chance(Math.min(1, effects[target].demand / 1.25))) break;
    }
    if (target >= days) return;
    (schedule[target] ??= []).push(customer);
  };

  const growCustomers = (): void => {
    customerCap *= 2;
    const grow = <T extends Uint8Array | Uint16Array>(a: T, make: (n: number) => T): T => {
      const next = make(customerCap);
      next.set(a);
      return next;
    };
    custFirstDay = grow(custFirstDay, (n) => new Uint16Array(n));
    custOrders = grow(custOrders, (n) => new Uint16Array(n));
    custCountry = grow(custCountry, (n) => new Uint8Array(n));
    custChannel = grow(custChannel, (n) => new Uint8Array(n));
    custDevice = grow(custDevice, (n) => new Uint8Array(n));
    custSegment = grow(custSegment, (n) => new Uint8Array(n));
  };

  for (let d = 0; d < days; d++) {
    const years = d / 365;
    if (d % 7 === 0) {
      countryCum = cumulative(COUNTRIES.map((c) => c.weight * Math.pow(1 + REGIONS[c.region].growth, years)));
      newChannelWeights = NEW_CHANNEL_BASE.map((w, i) => Math.max(1, w + NEW_CHANNEL_DRIFT[i] * years));
    }
    const effect = effects[d];
    const channelWeights = newChannelWeights.slice();
    channelWeights[PAID_SOCIAL] *= effect.paidSocialBoost;
    const channelCum = cumulative(channelWeights);
    const boostShare = channelWeights[PAID_SOCIAL] / newChannelWeights[PAID_SOCIAL];
    const mobileShare = 0.46 + 0.14 * (d / days);

    const expectedNew =
      options.newCustomersPerDay * Math.pow(1 + YEARLY_GROWTH, years) * effect.demand * rng.logNormal(0.07) *
      (1 + ((boostShare - 1) * newChannelWeights[PAID_SOCIAL]) / newChannelWeights.reduce((a, b) => a + b, 0));
    const newCount = rng.poisson(expectedNew);

    for (let k = 0; k < newCount; k++) {
      if (customerCount === customerCap) growCustomers();
      const id = customerCount++;
      const segment = rng.pickCumulative(segmentCum);
      let country = rng.pickCumulative(countryCum);
      if (effect.apacBoost > 1 && COUNTRIES[country].region !== APAC && rng.chance(0.25)) {
        // Singles' Day: re-draw part of the traffic towards APAC.
        do country = rng.pickCumulative(countryCum);
        while (COUNTRIES[country].region !== APAC);
      }
      const business = segment === 1 || segment === 2;
      const desktopP = Math.min(0.85, 1 - mobileShare - 0.08 + (business ? 0.25 : 0));
      const r = rng.next();
      const device = r < desktopP ? 0 : r < desktopP + 0.08 ? 2 : 1;
      custFirstDay[id] = d;
      custSegment[id] = segment;
      custCountry[id] = country;
      custChannel[id] = rng.pickCumulative(channelCum);
      custDevice[id] = device;
      // A suppressed first order means the customer was never acquired.
      if (!emit(id, d, true, custChannel[id], device)) customerCount--;
    }

    const returning = schedule[d];
    schedule[d] = null;
    if (returning) {
      for (const customer of returning) {
        const channel = rng.pickCumulative(RETURNING_CHANNEL);
        const device = rng.chance(0.75) ? custDevice[customer] : rng.chance(mobileShare) ? MOBILE : 0;
        emit(customer, d, false, channel, device);
      }
    }
  }

  const orderCols = orders.finish();
  const dayStart = new Uint32Array(days + 1);
  for (let i = 0, d = 0; d <= days; d++) {
    while (i < orders.length && orderCols.day[i] < d) i++;
    dayStart[d] = i;
  }

  return {
    start: options.start,
    end: options.end,
    days,
    orderCount: orders.length,
    customerCount,
    orders: orderCols,
    customers: {
      firstDay: custFirstDay.slice(0, customerCount),
      country: custCountry.slice(0, customerCount),
      channel: custChannel.slice(0, customerCount),
      device: custDevice.slice(0, customerCount),
      segment: custSegment.slice(0, customerCount),
    },
    dayStart,
    traffic: buildTrafficCube(traffic, rng),
    trafficStride: traffic.stride,
  };
}
