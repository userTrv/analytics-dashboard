import { cohortRetention, ltvCurves } from './cohorts';

/**
 * Hand-made example, months 0..3 (month 3 is the last with data):
 *   customer 0: cohort 0, orders in months 0, 1, 1, 3
 *   customer 1: cohort 0, orders in month 0 only
 *   customer 2: cohort 1, orders in months 1, 2
 *   customer 3: cohort 1, orders in month 1 only
 *   customer 4: excluded by filters (−1), orders in months 0, 1
 */
const input = {
  cohortCount: 2,
  maxOffset: 3,
  lastMonth: 3,
  customerCohort: [0, 0, 1, 1, -1],
  orderCustomer: [0, 1, 4, 0, 0, 2, 3, 4, 2, 0],
  orderMonth: [0, 0, 0, 1, 1, 1, 1, 1, 2, 3],
};

describe('cohortRetention', () => {
  const { sizes, retention } = cohortRetention(input);

  it('sizes cohorts from included customers only', () => {
    expect(sizes).toEqual([2, 2]);
  });

  it('counts each customer once per month and leaves future cells unknown', () => {
    expect(retention[0]).toEqual([1, 0.5, 0, 0.5]);
    // Cohort 1 started in month 1, so offset 3 would be month 4 — not observed yet.
    expect(retention[1]).toEqual([1, 0.5, 0, null]);
  });

  it('does not depend on order sequence', () => {
    const shuffled = cohortRetention({ ...input, orderCustomer: [...input.orderCustomer].reverse(), orderMonth: [...input.orderMonth].reverse() });
    expect(shuffled.retention).toEqual(retention);
  });
});

describe('ltvCurves', () => {
  it('accumulates average revenue per customer and stays monotonic', () => {
    const curves = ltvCurves({
      ...input,
      groupCount: 1,
      customerGroup: [0, 0, 0, 0, -1],
      orderValue: [10, 20, 99, 5, 5, 30, 40, 99, 10, 50],
    });
    // Offset 0: cohort 0 (10+20)/2 and cohort 1 (30+40)/2 → 100/4 = 25.
    // Offset 1: cohort 0 (5+5) + cohort 1 (10) → 20/4 = 5 → cumulative 30.
    // Offset 2: cohort 0 only (0) + cohort 1 (0) → 30. Offset 3: cohort 0 only (50/2) → 55.
    expect(curves[0]).toEqual([25, 30, 30, 55]);
  });
});
