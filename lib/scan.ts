export interface LastScan {
  code: string;
  time: number;
}

/**
 * Continuous decoding fires the same barcode many times per second. Accept a
 * scan only if it differs from the last accepted one or enough time has
 * passed, so we don't hammer the API with duplicate lookups.
 */
export function shouldAcceptScan(
  last: LastScan | null,
  code: string,
  now: number,
  windowMs = 2500,
): boolean {
  if (last !== null && last.code === code && now - last.time < windowMs) {
    return false;
  }
  return true;
}
