/**
 * Static dimension catalogue of the fictional business. Row data stores only the index into
 * these arrays (dictionary encoding); `code` is what travels through URLs and messages.
 */
export interface DimensionMember {
  readonly code: string;
  readonly label: string;
}

export interface Region extends DimensionMember {
  /** Relative growth speed; APAC grows fastest in the synthetic story. */
  readonly growth: number;
}

export interface Country extends DimensionMember {
  readonly region: number;
  readonly weight: number;
}

export interface Channel extends DimensionMember {
  /** Target cost to acquire one new customer, USD, at the start of the dataset. */
  readonly cac: number;
  readonly paid: boolean;
}

export interface Category extends DimensionMember {
  readonly margin: number;
  readonly basePrice: number;
  readonly refundRate: number;
}

export interface Segment extends DimensionMember {
  readonly weight: number;
  /** Probability that a customer comes back after an order. */
  readonly repeat: number;
  /** Mean days between orders. */
  readonly gapDays: number;
  readonly basketMultiplier: number;
}

export const REGIONS: readonly Region[] = [
  { code: 'na', label: 'North America', growth: 0.28 },
  { code: 'eu', label: 'Europe', growth: 0.3 },
  { code: 'apac', label: 'Asia-Pacific', growth: 0.55 },
  { code: 'latam', label: 'Latin America', growth: 0.42 },
];

export const COUNTRIES: readonly Country[] = [
  { code: 'US', label: 'United States', region: 0, weight: 30 },
  { code: 'CA', label: 'Canada', region: 0, weight: 5 },
  { code: 'GB', label: 'United Kingdom', region: 1, weight: 8 },
  { code: 'DE', label: 'Germany', region: 1, weight: 9 },
  { code: 'FR', label: 'France', region: 1, weight: 6 },
  { code: 'NL', label: 'Netherlands', region: 1, weight: 3 },
  { code: 'ES', label: 'Spain', region: 1, weight: 3 },
  { code: 'PL', label: 'Poland', region: 1, weight: 2 },
  { code: 'SE', label: 'Sweden', region: 1, weight: 2 },
  { code: 'JP', label: 'Japan', region: 2, weight: 6 },
  { code: 'AU', label: 'Australia', region: 2, weight: 4 },
  { code: 'KR', label: 'South Korea', region: 2, weight: 2 },
  { code: 'SG', label: 'Singapore', region: 2, weight: 1.5 },
  { code: 'IN', label: 'India', region: 2, weight: 3 },
  { code: 'BR', label: 'Brazil', region: 3, weight: 4 },
  { code: 'MX', label: 'Mexico', region: 3, weight: 3 },
  { code: 'AR', label: 'Argentina', region: 3, weight: 1 },
  { code: 'CL', label: 'Chile', region: 3, weight: 1 },
];

export const CHANNELS: readonly Channel[] = [
  { code: 'organic', label: 'Organic search', cac: 22, paid: false },
  { code: 'paid_search', label: 'Paid search', cac: 105, paid: true },
  { code: 'paid_social', label: 'Paid social', cac: 88, paid: true },
  { code: 'email', label: 'Email', cac: 12, paid: false },
  { code: 'referral', label: 'Referral', cac: 42, paid: true },
  { code: 'social', label: 'Organic social', cac: 26, paid: false },
];

export const DEVICES: readonly DimensionMember[] = [
  { code: 'desktop', label: 'Desktop' },
  { code: 'mobile', label: 'Mobile' },
  { code: 'tablet', label: 'Tablet' },
];

export const CATEGORIES: readonly Category[] = [
  { code: 'electronics', label: 'Electronics', margin: 0.22, basePrice: 165, refundRate: 0.07 },
  { code: 'home', label: 'Home & kitchen', margin: 0.38, basePrice: 62, refundRate: 0.05 },
  { code: 'apparel', label: 'Apparel', margin: 0.55, basePrice: 44, refundRate: 0.14 },
  { code: 'beauty', label: 'Beauty', margin: 0.62, basePrice: 27, refundRate: 0.04 },
  { code: 'sports', label: 'Sports & outdoors', margin: 0.4, basePrice: 68, refundRate: 0.06 },
  { code: 'books', label: 'Books', margin: 0.3, basePrice: 19, refundRate: 0.02 },
  { code: 'toys', label: 'Toys & games', margin: 0.42, basePrice: 34, refundRate: 0.04 },
  { code: 'software', label: 'Software & apps', margin: 0.85, basePrice: 58, refundRate: 0.03 },
];

export const SEGMENTS: readonly Segment[] = [
  { code: 'consumer', label: 'Consumer', weight: 62, repeat: 0.4, gapDays: 62, basketMultiplier: 1 },
  { code: 'smb', label: 'Small business', weight: 23, repeat: 0.52, gapDays: 40, basketMultiplier: 1.6 },
  { code: 'enterprise', label: 'Enterprise', weight: 8, repeat: 0.62, gapDays: 34, basketMultiplier: 3.2 },
  { code: 'education', label: 'Education', weight: 7, repeat: 0.46, gapDays: 75, basketMultiplier: 1.3 },
];

/** Category affinity per segment (rows = segments, columns = categories). */
export const SEGMENT_CATEGORY_WEIGHTS: readonly (readonly number[])[] = [
  [16, 15, 20, 14, 11, 8, 10, 6],
  [24, 16, 6, 5, 8, 9, 3, 29],
  [34, 10, 3, 2, 5, 6, 1, 39],
  [22, 8, 5, 3, 9, 30, 8, 15],
];

export const PRODUCTS_PER_CATEGORY = 20;

const PRODUCT_NOUNS: Readonly<Record<string, readonly string[]>> = {
  electronics: ['Headphones', 'Smartwatch', 'Speaker', 'Monitor', 'Keyboard', 'Webcam', 'Tablet', 'Charger', 'Router', 'Earbuds'],
  home: ['Kettle', 'Blender', 'Cookware Set', 'Lamp', 'Knife Block', 'Coffee Grinder', 'Air Purifier', 'Throw Blanket', 'Planter', 'Toaster'],
  apparel: ['Hoodie', 'Rain Jacket', 'Chinos', 'Sneakers', 'Wool Sweater', 'T-Shirt', 'Denim Jeans', 'Beanie', 'Parka', 'Running Shorts'],
  beauty: ['Serum', 'Moisturizer', 'Sunscreen', 'Face Mask', 'Lip Balm', 'Shampoo', 'Body Lotion', 'Cleanser', 'Eye Cream', 'Hair Oil'],
  sports: ['Yoga Mat', 'Dumbbells', 'Tent', 'Backpack', 'Bike Light', 'Water Bottle', 'Trail Shoes', 'Resistance Bands', 'Climbing Rope', 'Headlamp'],
  books: ['Cookbook', 'Novel', 'Field Guide', 'Atlas', 'Design Handbook', 'Travel Journal', 'Poetry Collection', 'Biography', 'Sketchbook', 'History Primer'],
  toys: ['Puzzle', 'Board Game', 'Building Kit', 'Plush Bear', 'Card Game', 'Robot Kit', 'Kite', 'Train Set', 'Art Set', 'Science Kit'],
  software: ['Photo Editor', 'VPN Plan', 'Password Vault', 'Cloud Backup', 'Office Suite', 'Antivirus', 'Video Studio', 'Language Course', 'Budget App', 'Note Pro'],
};

const PRODUCT_PREFIXES = ['Aurora', 'Nimbus', 'Vertex', 'Solace', 'Kestrel', 'Lumen', 'Harbor', 'Cobalt', 'Juniper', 'Onyx', 'Tidal', 'Ember'];

export interface Product extends DimensionMember {
  readonly category: number;
  readonly price: number;
  readonly unitCost: number;
  /** Relative popularity inside its category (Zipf-like). */
  readonly popularity: number;
}

/**
 * Builds the product catalogue deterministically from the category list. Prices spread
 * around the category base price; margins jitter around the category margin.
 */
export function buildProducts(): Product[] {
  const products: Product[] = [];
  CATEGORIES.forEach((category, ci) => {
    const nouns = PRODUCT_NOUNS[category.code];
    for (let i = 0; i < PRODUCTS_PER_CATEGORY; i++) {
      const noun = nouns[i % nouns.length];
      const prefix = PRODUCT_PREFIXES[(i * 7 + ci * 3) % PRODUCT_PREFIXES.length];
      const tier = i < nouns.length ? '' : ' Pro';
      // Deterministic pseudo-random spread without consuming the generator's RNG stream.
      const wobble = ((i * 37 + ci * 11) % 17) / 16; // 0..1
      const price = Math.round(category.basePrice * (0.55 + wobble * 1.1) * (tier ? 1.45 : 1) * 100) / 100;
      const margin = Math.min(0.92, Math.max(0.08, category.margin + (wobble - 0.5) * 0.12));
      products.push({
        code: `${category.code}-${String(i + 1).padStart(2, '0')}`,
        label: `${prefix} ${noun}${tier}`,
        category: ci,
        price,
        unitCost: Math.round(price * (1 - margin) * 100) / 100,
        popularity: 1 / Math.pow(i + 1, 0.85),
      });
    }
  });
  return products;
}

export const PRODUCTS: readonly Product[] = buildProducts();

export type DimensionKey = 'region' | 'country' | 'channel' | 'device' | 'category' | 'segment';

export const DIMENSION_MEMBERS: Readonly<Record<DimensionKey, readonly DimensionMember[]>> = {
  region: REGIONS,
  country: COUNTRIES,
  channel: CHANNELS,
  device: DEVICES,
  category: CATEGORIES,
  segment: SEGMENTS,
};

export function indexByCode(members: readonly DimensionMember[]): ReadonlyMap<string, number> {
  return new Map(members.map((m, i) => [m.code, i]));
}

export function labelOf(members: readonly DimensionMember[], code: string): string {
  return members.find((m) => m.code === code)?.label ?? code;
}
