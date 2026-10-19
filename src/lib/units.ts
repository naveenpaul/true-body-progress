// Unit conversion utilities
// All data is stored in metric (kg, cm). Convert on display only.

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs / 2.20462 * 10) / 10;
}

export function cmToInches(cm: number): number {
  return Math.round(cm / 2.54 * 10) / 10;
}

export function inchesToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}

export function formatWeight(kg: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    return `${kgToLbs(kg)} lbs`;
  }
  return `${kg} kg`;
}

export function formatLength(cm: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    return `${cmToInches(cm)} in`;
  }
  return `${cm} cm`;
}

export function parseWeightInput(value: number, units: 'metric' | 'imperial'): number {
  if (units === 'imperial') {
    return lbsToKg(value);
  }
  return value;
}

export function parseLengthInput(value: number, units: 'metric' | 'imperial'): number {
  if (units === 'imperial') {
    return inchesToCm(value);
  }
  return value;
}

// Distance is stored in metres; shown as km (metric) or miles (imperial).
const METRES_PER_MILE = 1609.344;

export function metresToDisplay(m: number, units: 'metric' | 'imperial'): number {
  const v = units === 'imperial' ? m / METRES_PER_MILE : m / 1000;
  return Math.round(v * 100) / 100;
}

export function displayToMetres(value: number, units: 'metric' | 'imperial'): number {
  return Math.round(units === 'imperial' ? value * METRES_PER_MILE : value * 1000);
}

export function distanceUnit(units: 'metric' | 'imperial'): string {
  return units === 'imperial' ? 'mi' : 'km';
}
