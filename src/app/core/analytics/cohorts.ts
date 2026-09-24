/**
 * Cohort maths on plain arrays so it can be tested with hand-made data.
 * Months are integer indices on a shared timeline; a customer's cohort is the month of
 * their first order and "offset k" is the k-th month after it.
 */
export interface CohortInput {
  readonly cohortCount: number;
  /** Largest month offset to report (columns = maxOffset + 1). */
  readonly maxOffset: number;
  /** Month index (cohort timeline) of the last month with data — later cells are unknown. */
  readonly lastMonth: number;
  /** Per customer: cohort index, or −1 when the customer is excluded by filters / window. */
  readonly customerCohort: ArrayLike<number>;
  readonly orderCustomer: ArrayLike<number>;
  /** Per order: month index on the cohort timeline (cohort 0 = month 0). */
  readonly orderMonth: ArrayLike<number>;
}

export interface RetentionMatrix {
  readonly sizes: number[];
  /** retention[c][k] = share of cohort c that ordered in month c + k; null when not observable yet. */
  readonly retention: (number | null)[][];
}

export function cohortRetention(input: CohortInput): RetentionMatrix {
  const { cohortCount, maxOffset, lastMonth, customerCohort, orderCustomer, orderMonth } = input;
  const width = maxOffset + 1;
  const sizes = new Array<number>(cohortCount).fill(0);
  for (let c = 0; c < customerCohort.length; c++) if (customerCohort[c] >= 0) sizes[customerCohort[c]]++;

  const active = Array.from({ length: cohortCount }, () => new Array<number>(width).fill(0));
  // One bit per (customer, offset) so repeat orders in the same month count once.
  const seen = new Uint8Array(customerCohort.length * width);
  for (let i = 0; i < orderCustomer.length; i++) {
    const customer = orderCustomer[i];
    const cohort = customerCohort[customer];
    if (cohort < 0) continue;
    const offset = orderMonth[i] - cohort;
    if (offset < 0 || offset > maxOffset) continue;
    const bit = customer * width + offset;
    if (seen[bit]) continue;
    seen[bit] = 1;
    active[cohort][offset]++;
  }

  const retention = active.map((row, c) =>
    row.map((count, k) => (c + k > lastMonth || sizes[c] === 0 ? null : count / sizes[c])),
  );
  return { sizes, retention };
}

export interface LtvInput extends CohortInput {
  readonly groupCount: number;
  /** Per customer: group index (segment, channel…), −1 excluded. */
  readonly customerGroup: ArrayLike<number>;
  readonly orderValue: ArrayLike<number>;
}

/**
 * Average cumulative revenue per customer by months since acquisition, per group.
 * Point k only averages cohorts that have been observed for k months, so young cohorts
 * don't drag the tail of the curve down.
 */
export function ltvCurves(input: LtvInput): (number | null)[][] {
  const { cohortCount, maxOffset, lastMonth, customerCohort, customerGroup, groupCount, orderCustomer, orderMonth, orderValue } = input;
  const width = maxOffset + 1;
  const size = Array.from({ length: groupCount }, () => new Float64Array(cohortCount));
  const revenue = Array.from({ length: groupCount }, () => Array.from({ length: cohortCount }, () => new Float64Array(width)));

  for (let c = 0; c < customerCohort.length; c++) {
    if (customerCohort[c] >= 0 && customerGroup[c] >= 0) size[customerGroup[c]][customerCohort[c]]++;
  }
  for (let i = 0; i < orderCustomer.length; i++) {
    const customer = orderCustomer[i];
    const cohort = customerCohort[customer];
    const group = customerGroup[customer];
    if (cohort < 0 || group < 0) continue;
    const offset = orderMonth[i] - cohort;
    if (offset >= 0 && offset <= maxOffset) revenue[group][cohort][offset] += orderValue[i];
  }

  // Month k's increment is averaged over the cohorts observed at k, then increments are
  // summed. The curve stays monotonic even though older cohorts dominate the tail.
  return size.map((groupSize, g) => {
    const out: (number | null)[] = [];
    let cumulative = 0;
    for (let k = 0; k < width; k++) {
      let rev = 0;
      let customers = 0;
      for (let c = 0; c < cohortCount; c++) {
        if (c + k > lastMonth) continue;
        rev += revenue[g][c][k];
        customers += groupSize[c];
      }
      if (customers === 0) {
        out.push(null);
        continue;
      }
      cumulative += rev / customers;
      out.push(cumulative);
    }
    return out;
  });
}
