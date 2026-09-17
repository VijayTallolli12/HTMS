/**
 * SecurityContext and Authorization Contracts
 * Baseline: W1-T03 T05
 */

import { ScopeType, DepartmentCode } from './security.contract';

/**
 * Immutable snapshot of a user's assigned role.
 */
export interface UserRoleSnapshot {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isSystem: boolean;
  readonly hotelGroupId: string | null;
}

/**
 * Immutable snapshot of an organizational scope assignment for a role.
 */
export interface UserScopeSnapshot {
  readonly id: string;
  readonly roleId: string;
  readonly roleCode: string;
  readonly scopeType: ScopeType;
  readonly hotelGroupId: string | null;
  readonly regionId: string | null;
  readonly countryId: string | null;
  readonly propertyId: string | null;
  readonly departmentCode: DepartmentCode | string | null;
  readonly permissions: ReadonlyArray<string>;
}

/**
 * Canonical SecurityContext representing the server-side validated authorization
 * state of an authenticated user within an active tenant context.
 */
export interface SecurityContext {
  readonly userId: string;
  readonly sessionId: string;
  readonly correlationId: string;
  readonly activeContext: {
    readonly hotelGroupId: string | null;
    readonly propertyId: string | null;
  };
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly status: string;
  };
  readonly isGlobalAdmin: boolean;
  readonly roles: ReadonlyArray<UserRoleSnapshot>;
  readonly permissions: ReadonlySet<string>;
  readonly scopes: ReadonlyArray<UserScopeSnapshot>;
}

/**
 * Serialized representation stored in Redis authorization cache.
 */
export interface CachedSecurityContextPayload {
  readonly cachedUserVersion: number;
  readonly cachedRoleVersions: Record<string, number>;
  readonly userId: string;
  readonly sessionId: string;
  readonly hotelGroupId: string | null;
  readonly propertyId: string | null;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly status: string;
  };
  readonly isGlobalAdmin: boolean;
  readonly roles: ReadonlyArray<UserRoleSnapshot>;
  readonly permissions: ReadonlyArray<string>;
  readonly scopes: ReadonlyArray<UserScopeSnapshot>;
}

/**
 * Immutable runtime Set wrapper preventing runtime mutation of permission sets.
 */
export class FrozenSet<T> extends Set<T> {
  private _frozen = false;

  constructor(iterable?: Iterable<T> | null) {
    super(iterable);
    this._frozen = true;
    Object.freeze(this);
  }

  override add(value: T): this {
    if (this._frozen) {
      throw new TypeError('Cannot add to an immutable FrozenSet.');
    }
    return super.add(value);
  }

  override delete(value: T): boolean {
    if (this._frozen) {
      throw new TypeError('Cannot delete from an immutable FrozenSet.');
    }
    return super.delete(value);
  }

  override clear(): void {
    if (this._frozen) {
      throw new TypeError('Cannot clear an immutable FrozenSet.');
    }
    super.clear();
  }
}
