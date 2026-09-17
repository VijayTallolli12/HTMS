import { Injectable } from '@nestjs/common';
import { BreachedPasswordChecker } from '../../application/interfaces/breached-password-checker.interface';

/**
 * Local / Dev Breached Password Checker
 *
 * Checks candidates against an in-memory dictionary of known common/breached passwords.
 * In development/test environments, this avoids external API calls while fulfilling
 * breached-password protection requirements.
 *
 * In production, a k-anonymity provider (e.g. HaveIBeenPwned SHA-1 prefix API)
 * can implement BreachedPasswordChecker without sending plaintext passwords.
 */
@Injectable()
export class LocalBreachedPasswordChecker implements BreachedPasswordChecker {
  // A representative curated set of known common/breached passwords meeting or exceeding 12 chars
  private readonly commonBreachedPasswords: Set<string> = new Set([
    'password12345',
    'password123456',
    'qwerty123456',
    '123456789012',
    'admin12345678',
    'welcome123456',
    'hospitality123',
    'hotel12345678',
    'hotelpassword1',
    'iloveyou12345',
    'changeme12345',
    'letmein123456',
    'sunshine12345',
    'princess12345',
    'trustnoone123',
    'master1234567',
    'enterprise123',
  ]);

  async isBreached(password: string): Promise<boolean> {
    if (!password || typeof password !== 'string') {
      return false;
    }
    // Case-insensitive check against known common breached passwords
    return this.commonBreachedPasswords.has(password.toLowerCase().trim());
  }
}
