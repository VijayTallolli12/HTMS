import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService } from '../../application/services/authorization.service';
import {
  IS_PUBLIC_KEY,
  IS_AUTHENTICATED_ONLY_KEY,
  PERMISSIONS_KEY,
  ANY_PERMISSIONS_KEY,
  ROLES_KEY,
  SCOPE_LEVELS_KEY,
  REQUIRE_PROPERTY_CONTEXT_KEY,
} from '../decorators/authz.decorators';
import { ScopeType, SecurityContext } from '@hms/api-contracts';
import { ResourceScopeTarget } from '../../domain/types/resource-scope.types';

const SCOPE_TYPE_RANK: Record<ScopeType, number> = {
  GLOBAL: 6,
  GROUP: 5,
  REGION: 4,
  COUNTRY: 3,
  PROPERTY: 2,
  DEPARTMENT: 1,
};

@Injectable()
export class ScopedRbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const targetClass = context.getClass();

    // 1. Check @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      handler,
      targetClass,
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const securityContext: SecurityContext | undefined = request.securityContext;

    if (!securityContext) {
      throw new ForbiddenException({
        type: 'https://hms.enterprise/errors/authorization/missing-security-context',
        title: 'Forbidden: Missing Security Context',
        status: 403,
        detail: 'SecurityContext is required for authorization evaluation.',
      });
    }

    // 2. Global Admin Bypass
    if (securityContext.isGlobalAdmin) {
      return true;
    }

    // 3. Check @Authenticated()
    const isAuthenticatedOnly = this.reflector.getAllAndOverride<boolean>(
      IS_AUTHENTICATED_ONLY_KEY,
      [handler, targetClass],
    );
    if (isAuthenticatedOnly) {
      return true;
    }

    // 4. Retrieve metadata
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      handler,
      targetClass,
    ]);
    const requiredAnyPermissions = this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
      handler,
      targetClass,
    ]);
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      handler,
      targetClass,
    ]);
    const requiredScopeLevels = this.reflector.getAllAndOverride<ScopeType[]>(SCOPE_LEVELS_KEY, [
      handler,
      targetClass,
    ]);
    const requirePropertyContext = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_PROPERTY_CONTEXT_KEY,
      [handler, targetClass],
    );

    // 5. DENY BY DEFAULT
    // If none of @Public, @Authenticated, @RequirePermissions, @RequireAnyPermission, @RequireRoles is present:
    if (!requiredPermissions && !requiredAnyPermissions && !requiredRoles) {
      throw new ForbiddenException({
        type: 'https://hms.enterprise/errors/authorization/deny-by-default',
        title: 'Forbidden: Deny By Default',
        status: 403,
        detail:
          'Access denied: Protected endpoint lacks explicit permission, role, or authenticated annotation.',
      });
    }

    // 6. Check @RequirePropertyContext()
    if (requirePropertyContext && !securityContext.activeContext.propertyId) {
      throw new ForbiddenException({
        type: 'https://hms.enterprise/errors/authorization/property-context-required',
        title: 'Forbidden: Property Context Required',
        status: 403,
        detail: 'This operation requires an explicit property context via x-property-id header.',
      });
    }

    // 7. Resolve target scope from request
    const targetScope: ResourceScopeTarget = {
      hotelGroupId: securityContext.activeContext.hotelGroupId ?? undefined,
      propertyId:
        request.params?.propertyId || securityContext.activeContext.propertyId || undefined,
      departmentCode: request.params?.departmentCode || undefined,
    };

    // 8. Check @RequireRoles(...)
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = this.authorizationService.hasAnyRole(securityContext, requiredRoles);
      if (!hasRole) {
        throw new ForbiddenException({
          type: 'https://hms.enterprise/errors/authorization/insufficient-roles',
          title: 'Forbidden: Insufficient Roles',
          status: 403,
          detail: `User lacks required role(s): ${requiredRoles.join(', ')}`,
        });
      }
    }

    // 9. Check @RequirePermissions(...)
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAll = await this.authorizationService.hasAllPermissions(
        securityContext,
        requiredPermissions,
        targetScope,
      );
      if (!hasAll) {
        throw new ForbiddenException({
          type: 'https://hms.enterprise/errors/authorization/insufficient-permissions',
          title: 'Forbidden: Insufficient Permissions',
          status: 403,
          detail: `User lacks required permission(s): ${requiredPermissions.join(', ')} for the specified scope.`,
        });
      }
    }

    // 10. Check @RequireAnyPermission(...)
    if (requiredAnyPermissions && requiredAnyPermissions.length > 0) {
      const hasAny = await this.authorizationService.hasAnyPermission(
        securityContext,
        requiredAnyPermissions,
        targetScope,
      );
      if (!hasAny) {
        throw new ForbiddenException({
          type: 'https://hms.enterprise/errors/authorization/insufficient-permissions',
          title: 'Forbidden: Insufficient Permissions',
          status: 403,
          detail: `User lacks at least one required permission: ${requiredAnyPermissions.join(', ')} for the specified scope.`,
        });
      }
    }

    // 11. Check @RequireScopeLevel(...)
    if (requiredScopeLevels && requiredScopeLevels.length > 0) {
      const minRequiredRank = Math.min(
        ...requiredScopeLevels.map((lvl) => SCOPE_TYPE_RANK[lvl] ?? 0),
      );
      const userMaxRank = Math.max(
        ...securityContext.scopes.map((s) => SCOPE_TYPE_RANK[s.scopeType] ?? 0),
        0,
      );

      if (userMaxRank < minRequiredRank) {
        throw new ForbiddenException({
          type: 'https://hms.enterprise/errors/authorization/insufficient-scope-level',
          title: 'Forbidden: Insufficient Scope Level',
          status: 403,
          detail: `User's scope level is insufficient. Minimum required level: ${requiredScopeLevels.join(', ')}`,
        });
      }
    }

    return true;
  }
}
