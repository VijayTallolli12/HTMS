import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../../common/redis/redis.service';
import { SecurityContext, CachedSecurityContextPayload, FrozenSet } from '@hms/api-contracts';

export const USER_VERSION_PREFIX = 'authz:ver:u:';
export const ROLE_VERSION_PREFIX = 'authz:ver:r:';
export const CONTEXT_CACHE_PREFIX = 'authz:context:';
export const AUTHZ_CACHE_TTL_SECONDS = 300;

@Injectable()
export class AuthorizationCacheService {
  private readonly logger = new Logger(AuthorizationCacheService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Increment the user's authorization version.
   * Invalidates all cached security contexts for this user.
   */
  async invalidateUser(userId: string): Promise<number> {
    const key = `${USER_VERSION_PREFIX}${userId}`;
    const newVersion = await this.redis.incr(key);
    this.logger.debug(`Invalidated user ${userId} authz version to ${newVersion}`);
    return newVersion;
  }

  /**
   * Increment a role's authorization version.
   * Invalidates any cached security context referencing this role upon next read.
   */
  async invalidateRole(roleId: string): Promise<number> {
    const key = `${ROLE_VERSION_PREFIX}${roleId}`;
    const newVersion = await this.redis.incr(key);
    this.logger.debug(`Invalidated role ${roleId} authz version to ${newVersion}`);
    return newVersion;
  }

  /**
   * Atomically fetch the current user version and all relevant role versions via MGET.
   */
  async getCurrentVersions(
    userId: string,
    roleIds: string[],
  ): Promise<{ userVersion: number; roleVersions: Record<string, number> }> {
    const uniqueRoleIds = Array.from(new Set(roleIds));
    const keys = [
      `${USER_VERSION_PREFIX}${userId}`,
      ...uniqueRoleIds.map((rid) => `${ROLE_VERSION_PREFIX}${rid}`),
    ];

    const values = await this.redis.mget(...keys);

    const userVal = values[0];
    const userVersion = userVal ? parseInt(userVal, 10) : 0;

    const roleVersions: Record<string, number> = {};
    for (let i = 0; i < uniqueRoleIds.length; i++) {
      const roleId = uniqueRoleIds[i];
      const roleVal = values[i + 1];
      roleVersions[roleId] = roleVal ? parseInt(roleVal, 10) : 0;
    }

    return { userVersion, roleVersions };
  }

  /**
   * Get cached SecurityContext.
   * Performs MGET Invalidate-on-Read: validates user version and every role version.
   * Returns null if cache miss or if any version is stale.
   */
  async get(
    userId: string,
    hotelGroupId: string | null,
    correlationId = '',
  ): Promise<SecurityContext | null> {
    const cacheKey = `${CONTEXT_CACHE_PREFIX}${userId}:${hotelGroupId ?? 'global'}`;
    const raw = await this.redis.get(cacheKey);
    if (!raw) {
      return null;
    }

    let payload: CachedSecurityContextPayload;
    try {
      payload = JSON.parse(raw) as CachedSecurityContextPayload;
    } catch {
      this.logger.warn(`Failed to parse cached SecurityContext JSON for key ${cacheKey}`);
      return null;
    }

    const uniqueRoleIds = Array.from(new Set(payload.roles.map((r) => r.id)));
    const keys = [
      `${USER_VERSION_PREFIX}${userId}`,
      ...uniqueRoleIds.map((rid) => `${ROLE_VERSION_PREFIX}${rid}`),
    ];

    const values = await this.redis.mget(...keys);

    const currentUserVal = values[0];
    const currentUserVersion = currentUserVal ? parseInt(currentUserVal, 10) : 0;

    if (currentUserVersion !== (payload.cachedUserVersion ?? 0)) {
      this.logger.debug(
        `Cache invalidated-on-read for user ${userId}: current user version ${currentUserVersion} !== cached ${payload.cachedUserVersion}`,
      );
      return null;
    }

    for (let i = 0; i < uniqueRoleIds.length; i++) {
      const roleId = uniqueRoleIds[i];
      const currentRoleVal = values[i + 1];
      const currentRoleVersion = currentRoleVal ? parseInt(currentRoleVal, 10) : 0;
      const cachedRoleVersion = payload.cachedRoleVersions[roleId] ?? 0;

      if (currentRoleVersion !== cachedRoleVersion) {
        this.logger.debug(
          `Cache invalidated-on-read for user ${userId}: role ${roleId} version ${currentRoleVersion} !== cached ${cachedRoleVersion}`,
        );
        return null;
      }
    }

    return this.deserializeSecurityContext(payload, correlationId);
  }

  /**
   * Store SecurityContext in Redis with dual-version stamps and 300s TTL.
   */
  async set(
    context: SecurityContext,
    userVersion: number,
    roleVersions: Record<string, number>,
  ): Promise<void> {
    const cacheKey = `${CONTEXT_CACHE_PREFIX}${context.userId}:${
      context.activeContext.hotelGroupId ?? 'global'
    }`;

    const payload: CachedSecurityContextPayload = {
      cachedUserVersion: userVersion,
      cachedRoleVersions: roleVersions,
      userId: context.userId,
      sessionId: context.sessionId,
      hotelGroupId: context.activeContext.hotelGroupId,
      propertyId: context.activeContext.propertyId,
      user: {
        id: context.user.id,
        email: context.user.email,
        firstName: context.user.firstName,
        lastName: context.user.lastName,
        status: context.user.status,
      },
      isGlobalAdmin: context.isGlobalAdmin,
      roles: context.roles.map((r) => ({ ...r })),
      permissions: Array.from(context.permissions),
      scopes: context.scopes.map((s) => ({
        ...s,
        permissions: [...s.permissions],
      })),
    };

    await this.redis.set(cacheKey, JSON.stringify(payload), 'EX', AUTHZ_CACHE_TTL_SECONDS);
  }

  /**
   * Deserializes a cached payload into an immutable SecurityContext.
   */
  private deserializeSecurityContext(
    payload: CachedSecurityContextPayload,
    correlationId: string,
  ): SecurityContext {
    return Object.freeze({
      userId: payload.userId,
      sessionId: payload.sessionId,
      correlationId,
      activeContext: Object.freeze({
        hotelGroupId: payload.hotelGroupId,
        propertyId: payload.propertyId,
      }),
      user: Object.freeze({
        id: payload.user.id,
        email: payload.user.email,
        firstName: payload.user.firstName,
        lastName: payload.user.lastName,
        status: payload.user.status,
      }),
      isGlobalAdmin: payload.isGlobalAdmin,
      roles: Object.freeze(payload.roles.map((r) => Object.freeze({ ...r }))),
      permissions: new FrozenSet(payload.permissions),
      scopes: Object.freeze(
        payload.scopes.map((s) =>
          Object.freeze({
            ...s,
            permissions: Object.freeze([...s.permissions]),
          }),
        ),
      ),
    });
  }
}
