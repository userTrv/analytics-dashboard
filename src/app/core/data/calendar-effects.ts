import { addDays, dayOfWeek, IsoDate } from './dates';

/**
 * Demand shape of the synthetic business: weekly rhythm, a yearly wave peaking before
 * Christmas, retail events with discounts, and two deliberate incidents for the anomaly
 * detector to find (a tracking outage and a viral spike).
 */
export interface DayEffect {
  /** Multiplier on baseline demand (1 = ordinary day), trend excluded. */
  readonly demand: number;
  /** Share of list price given as discount. */
  readonly discount: number;
  /** Extra multiplier for APAC countries (Singles' Day). */
  readonly apacBoost: number;
  /** Extra multiplier for new customers from paid social (viral campaign). */
  readonly paidSocialBoost: number;
}

const WEEKLY = [1.03, 1.02, 1.0, 0.99, 0.96, 0.86, 0.92];

export const TRACKING_OUTAGE_DAY = '2025-03-14';
export const VIRAL_SPIKE_DAY = '2025-10-02';
/**
 * From this day checkout inside social apps' in-app browsers breaks on mobile: paid-social
 * mobile traffic keeps coming (and costing), but half of its purchases never happen.
 */
export const IN_APP_CHECKOUT_INCIDENT_START = '2026-06-15';

/** Black Friday = the day after the fourth Thursday of November. */
export function blackFriday(year: number): IsoDate {
  const nov1 = `${year}-11-01`;
  const firstThursdayOffset = (3 - dayOfWeek(nov1) + 7) % 7;
  return addDays(nov1, firstThursdayOffset + 21 + 1);
}

export function dayEffect(date: IsoDate): DayEffect {
  const year = Number(date.slice(0, 4));
  const md = date.slice(5);
  const doy = (Date.UTC(year, Number(md.slice(0, 2)) - 1, Number(md.slice(3))) - Date.UTC(year, 0, 1)) / 86_400_000;
  let demand = WEEKLY[dayOfWeek(date)] * (1 + 0.1 * Math.cos((2 * Math.PI * (doy - 350)) / 365.25));
  let discount = 0;
  let apacBoost = 1;
  let paidSocialBoost = 1;

  const bf = blackFriday(year);
  const offset = Math.round((Date.parse(date) - Date.parse(bf)) / 86_400_000);
  if (offset === 0) [demand, discount] = [demand * 2.6, 0.25];
  else if (offset === 1) [demand, discount] = [demand * 1.7, 0.2];
  else if (offset === 2) [demand, discount] = [demand * 1.5, 0.2];
  else if (offset === 3) [demand, discount] = [demand * 2.1, 0.22];
  else if (offset >= -4 && offset <= -1) [demand, discount] = [demand * 1.25, 0.1];
  else if (md >= '12-01' && md <= '12-18') [demand, discount] = [demand * 1.22, 0.08];

  if (md === '12-24') demand *= 0.75;
  if (md === '12-25') demand *= 0.55;
  if (md === '12-31') demand *= 0.8;
  if (md === '01-01') demand *= 0.6;
  if (md === '07-08' || md === '07-09') [demand, discount] = [demand * 1.65, 0.15];
  if (md === '11-11') apacBoost = 3;

  if (date === TRACKING_OUTAGE_DAY) demand *= 0.42;
  if (date === VIRAL_SPIKE_DAY) paidSocialBoost = 6;

  return { demand, discount, apacBoost, paidSocialBoost };
}
