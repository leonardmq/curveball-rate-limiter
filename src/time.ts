/**
 * Returns the number of seconds in the given milliseconds.
 *
 * @param milliseconds The number of milliseconds.
 * @returns The number of seconds.
 */
export function millisecondsToSeconds(milliseconds: number): number {
  return Math.floor(milliseconds / 1000);
}
