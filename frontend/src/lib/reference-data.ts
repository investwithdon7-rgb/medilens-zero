/**
 * MediLens Reference Data
 * Country populations, minimum wages, income class, and exchange rates.
 * Used for Affordability Index and Population Without Access calculations.
 * Sources: ILO ILOSTAT 2024, UN World Population Prospects 2024, World Bank classifications.
 */

export type IncomeClass = 'HIC' | 'UMIC' | 'LMIC' | 'LIC';

export interface CountryRef {
  name: string;
  /** Population in millions */
  population_m: number;
  /** Approximate monthly minimum wage in USD (ILO 2024) */
  monthly_wage_usd: number;
  /** World Bank income classification */
  income_class: IncomeClass;
  /** Dominant currency code */
  currency: string;
  /** Region */
  region: string;
}

export const COUNTRY_DATA: Record<string, CountryRef> = {
  AUS: { name: 'Australia',       population_m: 26,   monthly_wage_usd: 2_600, income_class: 'HIC',  currency: 'AUD', region: 'Oceania' },
  AUT: { name: 'Austria',         population_m: 9,    monthly_wage_usd: 1_700, income_class: 'HIC',  currency: 'EUR', region: 'Europe' },
  BGD: { name: 'Bangladesh',      population_m: 170,  monthly_wage_usd: 95,    income_class: 'LMIC', currency: 'BDT', region: 'Asia' },
  BEL: { name: 'Belgium',         population_m: 12,   monthly_wage_usd: 1_960, income_class: 'HIC',  currency: 'EUR', region: 'Europe' },
  BRA: { name: 'Brazil',          population_m: 215,  monthly_wage_usd: 255,   income_class: 'UMIC', currency: 'BRL', region: 'South America' },
  CAN: { name: 'Canada',          population_m: 38,   monthly_wage_usd: 1_820, income_class: 'HIC',  currency: 'CAD', region: 'North America' },
  DNK: { name: 'Denmark',         population_m: 6,    monthly_wage_usd: 2_150, income_class: 'HIC',  currency: 'DKK', region: 'Europe' },
  EGY: { name: 'Egypt',           population_m: 105,  monthly_wage_usd: 100,   income_class: 'LMIC', currency: 'EGP', region: 'Africa' },
  FIN: { name: 'Finland',         population_m: 6,    monthly_wage_usd: 1_740, income_class: 'HIC',  currency: 'EUR', region: 'Europe' },
  FRA: { name: 'France',          population_m: 68,   monthly_wage_usd: 1_766, income_class: 'HIC',  currency: 'EUR', region: 'Europe' },
  DEU: { name: 'Germany',         population_m: 84,   monthly_wage_usd: 1_944, income_class: 'HIC',  currency: 'EUR', region: 'Europe' },
  GRC: { name: 'Greece',          population_m: 10,   monthly_wage_usd: 950,   income_class: 'HIC',  currency: 'EUR', region: 'Europe' },
  IND: { name: 'India',           population_m: 1_420,monthly_wage_usd: 120,   income_class: 'LMIC', currency: 'INR', region: 'Asia' },
  ITA: { name: 'Italy',           population_m: 59,   monthly_wage_usd: 1_100, income_class: 'HIC',  currency: 'EUR', region: 'Europe' },
  JPN: { name: 'Japan',           population_m: 125,  monthly_wage_usd: 1_300, income_class: 'HIC',  currency: 'JPY', region: 'Asia' },
  KEN: { name: 'Kenya',           population_m: 55,   monthly_wage_usd: 115,   income_class: 'LMIC', currency: 'KES', region: 'Africa' },
  NLD: { name: 'Netherlands',     population_m: 18,   monthly_wage_usd: 1_950, income_class: 'HIC',  currency: 'EUR', region: 'Europe' },
  NGA: { name: 'Nigeria',         population_m: 220,  monthly_wage_usd: 55,    income_class: 'LMIC', currency: 'NGN', region: 'Africa' },
  PAK: { name: 'Pakistan',        population_m: 230,  monthly_wage_usd: 75,    income_class: 'LMIC', currency: 'PKR', region: 'Asia' },
  POL: { name: 'Poland',          population_m: 37,   monthly_wage_usd: 760,   income_class: 'HIC',  currency: 'PLN', region: 'Europe' },
  PRT: { name: 'Portugal',        population_m: 10,   monthly_wage_usd: 820,   income_class: 'HIC',  currency: 'EUR', region: 'Europe' },
  ZAF: { name: 'South Africa',    population_m: 60,   monthly_wage_usd: 250,   income_class: 'UMIC', currency: 'ZAR', region: 'Africa' },
  ESP: { name: 'Spain',           population_m: 47,   monthly_wage_usd: 1_134, income_class: 'HIC',  currency: 'EUR', region: 'Europe' },
  LKA: { name: 'Sri Lanka',       population_m: 22,   monthly_wage_usd: 115,   income_class: 'LMIC', currency: 'LKR', region: 'Asia' },
  SWE: { name: 'Sweden',          population_m: 10,   monthly_wage_usd: 2_050, income_class: 'HIC',  currency: 'SEK', region: 'Europe' },
  GBR: { name: 'United Kingdom',  population_m: 68,   monthly_wage_usd: 1_850, income_class: 'HIC',  currency: 'GBP', region: 'Europe' },
  USA: { name: 'United States',   population_m: 335,  monthly_wage_usd: 1_257, income_class: 'HIC',  currency: 'USD', region: 'North America' },
};

/** Approximate USD exchange rates (2024 averages). */
export const USD_RATES: Record<string, number> = {
  USD: 1, GBP: 1.27, EUR: 1.08, AUD: 0.65, CAD: 0.74,
  JPY: 0.0066, INR: 0.012, NGN: 0.00065, KES: 0.0077,
  BRL: 0.20, ZAR: 0.055, PLN: 0.25, DKK: 0.145, SEK: 0.095,
  LKR: 0.0033, PKR: 0.0036, BDT: 0.009, EGP: 0.021,
};

/**
 * Convert a price in any currency to approximate USD.
 */
export function toUSD(price: number, currency: string): number {
  const rate = USD_RATES[currency.toUpperCase()] ?? 1;
  return price * rate;
}

/**
 * Returns population (millions) in countries NOT registered for a drug,
 * along with the top countries by population.
 */
export function getPopulationWithoutDrug(
  approvals: Array<{ country: string; approval_date: string | null }>
): { totalM: number; topCountries: string[] } {
  let totalM = 0;
  const entries: { name: string; pop: number }[] = [];

  for (const a of approvals) {
    if (!a.approval_date) {
      const ref = COUNTRY_DATA[a.country];
      if (ref) {
        totalM += ref.population_m;
        entries.push({ name: ref.name, pop: ref.population_m });
      }
    }
  }

  entries.sort((a, b) => b.pop - a.pop);
  return {
    totalM,
    topCountries: entries.slice(0, 3).map(e => e.name),
  };
}

/**
 * Calculate affordability: how many days of minimum wage does this price cost?
 * @param priceUSD  Price in USD (convert first if needed)
 * @param countryCode  ISO-3 country code
 */
export function affordabilityDays(priceUSD: number, countryCode: string): number {
  const ref = COUNTRY_DATA[countryCode];
  if (!ref || !ref.monthly_wage_usd) return 0;
  const dailyWage = ref.monthly_wage_usd / 30;
  return priceUSD / dailyWage;
}

/**
 * Compute an Access Equity Score (0–100) for a country dashboard.
 * Higher = better access.
 * Formula: 100 × (1 − drugs_behind_2yr / total_global_drugs)
 */
export function accessEquityScore(drugsBehind2yr: number, totalDrugs: number): number {
  if (!totalDrugs) return 0;
  return Math.round(100 * (1 - Math.min(drugsBehind2yr / totalDrugs, 1)));
}

/** Return colour class for income classification */
export function incomeClassBadge(ic: IncomeClass): string {
  switch (ic) {
    case 'HIC':  return 'badge-green';
    case 'UMIC': return 'badge-teal';
    case 'LMIC': return 'badge-amber';
    case 'LIC':  return 'badge-red';
  }
}
