const RETAINMENT_MIN = 35_000;
const RETAINMENT_MAX = 100_000;
const RETAINMENT_RATE = 0.01;
const PLATFORM_RATE = 0.1;

export function calcRetainmentFee(annualRent: number): number {
  return Math.min(Math.max(Math.round(annualRent * RETAINMENT_RATE), RETAINMENT_MIN), RETAINMENT_MAX);
}

export function calcPlatformFee(retainmentFee: number): number {
  return Math.round(retainmentFee * PLATFORM_RATE);
}

export function calcOutgoingPayout(retainmentFee: number): number {
  return retainmentFee - calcPlatformFee(retainmentFee);
}
