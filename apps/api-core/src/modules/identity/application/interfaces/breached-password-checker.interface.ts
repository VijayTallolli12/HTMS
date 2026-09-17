/**
 * Breached Password Checker Interface & Token
 * Baseline: W1-T03 T03
 */

export const BREACHED_PASSWORD_CHECKER = Symbol('BREACHED_PASSWORD_CHECKER');

export interface BreachedPasswordChecker {
  /**
   * Checks whether the provided password is known to be breached or weak.
   * Implementation MUST NOT transmit plaintext password over insecure channels
   * or log the plaintext password.
   *
   * @param password Plaintext candidate password
   * @returns Promise<boolean> True if breached/common, false otherwise
   */
  isBreached(password: string): Promise<boolean>;
}
