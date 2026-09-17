import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityConfig } from '@hms/config';
import { PasswordPolicyValidationResult } from '@hms/api-contracts';
import {
  BREACHED_PASSWORD_CHECKER,
  BreachedPasswordChecker,
} from '../interfaces/breached-password-checker.interface';

@Injectable()
export class PasswordPolicyService {
  private readonly securityConfig: SecurityConfig;

  constructor(
    private readonly configService: ConfigService,
    @Inject(BREACHED_PASSWORD_CHECKER)
    private readonly breachedChecker: BreachedPasswordChecker,
  ) {
    const config = this.configService.get<SecurityConfig>('security');
    if (!config) {
      throw new Error('[PasswordPolicyService] Security configuration missing from ConfigService.');
    }
    this.securityConfig = config;
  }

  /**
   * Validates password against length and type policy.
   * Does NOT impose arbitrary complexity rules (no mandatory upper/lower/symbol/number).
   *
   * @param password Candidate password
   */
  validate(password: unknown): PasswordPolicyValidationResult {
    if (
      password === null ||
      password === undefined ||
      typeof password !== 'string' ||
      password.trim().length === 0
    ) {
      return {
        valid: false,
        errors: ['Password must be a valid non-empty string.'],
      };
    }

    const { minLength, maxLength } = this.securityConfig.passwordPolicy;
    // Count Unicode characters safely using Array.from to avoid splitting surrogate pairs
    const charCount = Array.from(password).length;

    if (charCount < minLength) {
      return {
        valid: false,
        errors: [`Password must be at least ${minLength} characters long.`],
      };
    }

    if (charCount > maxLength) {
      return {
        valid: false,
        errors: [`Password must not exceed ${maxLength} characters.`],
      };
    }

    return { valid: true };
  }

  /**
   * Validates password length and type or throws BadRequestException.
   */
  validateOrThrow(password: unknown): void {
    const result = this.validate(password);
    if (!result.valid && result.errors && result.errors.length > 0) {
      throw new BadRequestException(result.errors[0]);
    }
  }

  /**
   * Checks whether the password is known to be breached or weak.
   */
  async isBreached(password: string): Promise<boolean> {
    if (!this.securityConfig.passwordPolicy.breachedCheckEnabled) {
      return false;
    }
    return this.breachedChecker.isBreached(password);
  }

  /**
   * Validates password length, type, and breached/common policy, throwing on failure.
   */
  async assertValidAndNotBreached(password: unknown): Promise<void> {
    this.validateOrThrow(password);
    const breached = await this.isBreached(password as string);
    if (breached) {
      throw new BadRequestException(
        'The chosen password has appeared in a known data breach or is too common. Please choose a different password.',
      );
    }
  }
}
