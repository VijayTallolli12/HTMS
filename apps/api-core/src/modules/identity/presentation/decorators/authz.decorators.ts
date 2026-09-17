import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ScopeType, SecurityContext } from '@hms/api-contracts';

export const IS_PUBLIC_KEY = 'isPublic';
export const IS_AUTHENTICATED_ONLY_KEY = 'isAuthenticatedOnly';
export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSIONS_KEY = 'anyPermissions';
export const ROLES_KEY = 'roles';
export const SCOPE_LEVELS_KEY = 'scopeLevels';
export const REQUIRE_PROPERTY_CONTEXT_KEY = 'requirePropertyContext';

/**
 * Marks an endpoint as public. Bypasses authentication and authorization guards.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Requires authentication only.
 * No business permissions required (used for self-identity endpoints like /me).
 */
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED_ONLY_KEY, true);

/**
 * Requires the authenticated user to hold ALL specified permissions.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Requires the authenticated user to hold AT LEAST ONE of the specified permissions.
 */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);

/**
 * Requires the authenticated user to hold AT LEAST ONE of the specified roles.
 */
export const RequireRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Requires the user's granted scope to match or exceed the required scope hierarchy level.
 */
export const RequireScopeLevel = (...scopeLevels: ScopeType[]) =>
  SetMetadata(SCOPE_LEVELS_KEY, scopeLevels);

/**
 * Requires an explicit property context (via x-property-id header or route parameter).
 */
export const RequirePropertyContext = () => SetMetadata(REQUIRE_PROPERTY_CONTEXT_KEY, true);

/**
 * Parameter decorator to inject the immutable SecurityContext into a controller handler.
 */
export const CurrentSecurityContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SecurityContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.securityContext;
  },
);
