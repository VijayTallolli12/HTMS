import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { AuthorizationCacheService } from './authorization-cache.service';
import { HierarchyValidationService } from './hierarchy-validation.service';
import {
  SecurityContext,
  UserRoleSnapshot,
  UserScopeSnapshot,
  FrozenSet,
  ScopeType,
  DepartmentCode,
} from '@hms/api-contracts';
import {
  ResourceScopeTarget,
  PropertyHierarchyPath,
} from '../../domain/types/resource-scope.types';

interface SecurityContextRow {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_status: string;
  role_id: string | null;
  role_code: string | null;
  role_name: string | null;
  role_is_system: boolean | null;
  role_hotel_group_id: string | null;
  scope_id: string | null;
  scope_type: string | null;
  scope_hotel_group_id: string | null;
  scope_region_id: string | null;
  scope_country_id: string | null;
  scope_property_id: string | null;
  scope_department_code: string | null;
  permission_code: string | null;
}

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authzCache: AuthorizationCacheService,
    private readonly hierarchyValidation: HierarchyValidationService,
  ) {}

  /**
   * Resolve canonical, immutable SecurityContext for a user session.
   * Checks Redis authorization cache first (with MGET Invalidate-on-Read).
   * On cache miss, hydrates via strict single-query SQL from PostgreSQL.
   */
  async resolveSecurityContext(
    userId: string,
    sessionId: string,
    activeContext: { hotelGroupId: string | null; propertyId: string | null },
    correlationId = '',
  ): Promise<SecurityContext> {
    let effectiveHotelGroupId = activeContext.hotelGroupId;
    const effectivePropertyId = activeContext.propertyId;

    // Validate property hierarchy if property context is provided
    if (effectivePropertyId) {
      const propertyPath = await this.hierarchyValidation.getPropertyHierarchy(effectivePropertyId);
      if (!propertyPath) {
        throw new NotFoundException({
          type: 'https://hms.enterprise/errors/organization/property-not-found',
          title: 'Not Found: Property Not Found',
          status: 404,
          detail: `Property ${effectivePropertyId} not found.`,
        });
      }
      if (effectiveHotelGroupId && propertyPath.hotelGroupId !== effectiveHotelGroupId) {
        throw new ForbiddenException({
          type: 'https://hms.enterprise/errors/authorization/cross-tenant-access',
          title: 'Forbidden: Cross-Tenant Property Access',
          status: 403,
          detail: `Property ${effectivePropertyId} does not belong to active hotel group ${effectiveHotelGroupId}`,
        });
      }
      // Infer hotel group if omitted in active context
      if (!effectiveHotelGroupId) {
        effectiveHotelGroupId = propertyPath.hotelGroupId;
      }
    }

    // 1. Try cache lookup
    const cached = await this.authzCache.get(userId, effectiveHotelGroupId, correlationId);
    if (cached) {
      // If property context was supplied or switched, update activeContext
      if (
        effectivePropertyId !== cached.activeContext.propertyId ||
        effectiveHotelGroupId !== cached.activeContext.hotelGroupId
      ) {
        return Object.freeze({
          ...cached,
          correlationId,
          activeContext: Object.freeze({
            hotelGroupId: effectiveHotelGroupId,
            propertyId: effectivePropertyId,
          }),
        });
      }
      return cached;
    }

    // 2. Cache miss: Hydrate from PostgreSQL via strict single query
    const context = await this.hydrateSecurityContextFromDb(
      userId,
      sessionId,
      effectiveHotelGroupId,
      effectivePropertyId,
      correlationId,
    );

    // 3. Atomically get current version stamps and populate Redis cache
    const roleIds = context.roles.map((r) => r.id);
    const { userVersion, roleVersions } = await this.authzCache.getCurrentVersions(userId, roleIds);
    await this.authzCache.set(context, userVersion, roleVersions);

    return context;
  }

  /**
   * Checks whether the user has permission to perform an action on an optional resource scope.
   */
  async can(
    context: SecurityContext,
    permission: string,
    targetScope?: ResourceScopeTarget,
  ): Promise<boolean> {
    if (context.isGlobalAdmin) {
      return true;
    }

    if (!context.permissions.has(permission)) {
      return false;
    }

    // If no target scope specified, having permission at any scope is sufficient
    if (!targetScope) {
      return true;
    }

    const grantingScopes = context.scopes.filter((s) => s.permissions.includes(permission));
    if (grantingScopes.length === 0) {
      return false;
    }

    let targetPropertyPath: PropertyHierarchyPath | null = null;
    if (targetScope.propertyId) {
      targetPropertyPath = await this.hierarchyValidation.getPropertyHierarchy(
        targetScope.propertyId,
      );
    }

    for (const scope of grantingScopes) {
      if (this.scopeDominates(scope, targetScope, targetPropertyPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks whether the user has ALL of the specified permissions.
   */
  async hasAllPermissions(
    context: SecurityContext,
    permissions: string[],
    targetScope?: ResourceScopeTarget,
  ): Promise<boolean> {
    for (const perm of permissions) {
      const allowed = await this.can(context, perm, targetScope);
      if (!allowed) return false;
    }
    return true;
  }

  /**
   * Checks whether the user has AT LEAST ONE of the specified permissions.
   */
  async hasAnyPermission(
    context: SecurityContext,
    permissions: string[],
    targetScope?: ResourceScopeTarget,
  ): Promise<boolean> {
    for (const perm of permissions) {
      const allowed = await this.can(context, perm, targetScope);
      if (allowed) return true;
    }
    return false;
  }

  /**
   * Checks whether the user has a specific role assigned.
   */
  hasRole(context: SecurityContext, roleCode: string): boolean {
    if (context.isGlobalAdmin) return true;
    return context.roles.some((r) => r.code === roleCode);
  }

  /**
   * Checks whether the user has ANY of the specified roles assigned.
   */
  hasAnyRole(context: SecurityContext, roleCodes: string[]): boolean {
    if (context.isGlobalAdmin) return true;
    return context.roles.some((r) => roleCodes.includes(r.code));
  }

  /**
   * Checks whether a given property is within the user's granted organizational scopes.
   */
  async isPropertyWithinScope(context: SecurityContext, propertyId: string): Promise<boolean> {
    if (context.isGlobalAdmin) return true;
    const path = await this.hierarchyValidation.getPropertyHierarchy(propertyId);
    if (!path) return false;
    for (const scope of context.scopes) {
      if (this.scopeDominates(scope, { propertyId }, path)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Scope dominance evaluation: checks if an assigned scope covers a target scope.
   */
  private scopeDominates(
    scope: UserScopeSnapshot,
    target: ResourceScopeTarget,
    targetPropertyPath: PropertyHierarchyPath | null,
  ): boolean {
    // 1. GLOBAL dominates everything
    if (scope.scopeType === 'GLOBAL') {
      return true;
    }

    // If target specifies propertyId, evaluate via resolved property hierarchy path
    if (target.propertyId && targetPropertyPath) {
      switch (scope.scopeType) {
        case 'GROUP':
          return scope.hotelGroupId === targetPropertyPath.hotelGroupId;
        case 'REGION':
          return scope.regionId === targetPropertyPath.regionId;
        case 'COUNTRY':
          return scope.countryId === targetPropertyPath.countryId;
        case 'PROPERTY':
          return scope.propertyId === target.propertyId;
        case 'DEPARTMENT':
          return (
            scope.propertyId === target.propertyId &&
            Boolean(target.departmentCode) &&
            scope.departmentCode === target.departmentCode
          );
        default:
          return false;
      }
    }

    // If target does NOT specify propertyId, evaluate based on target scope levels
    switch (scope.scopeType) {
      case 'GROUP':
        if (target.hotelGroupId) {
          return scope.hotelGroupId === target.hotelGroupId;
        }
        return false;

      case 'REGION':
        if (target.regionId) {
          return scope.regionId === target.regionId;
        }
        return false;

      case 'COUNTRY':
        if (target.countryId) {
          return scope.countryId === target.countryId;
        }
        return false;

      case 'PROPERTY':
        if (target.propertyId) {
          return scope.propertyId === target.propertyId;
        }
        return false;

      case 'DEPARTMENT':
        return (
          scope.propertyId === target.propertyId &&
          Boolean(target.departmentCode) &&
          scope.departmentCode === target.departmentCode
        );

      default:
        return false;
    }
  }

  /**
   * Hydrates SecurityContext from PostgreSQL using a strict single-query SQL join.
   */
  private async hydrateSecurityContextFromDb(
    userId: string,
    sessionId: string,
    hotelGroupId: string | null,
    propertyId: string | null,
    correlationId: string,
  ): Promise<SecurityContext> {
    const query = `
      SELECT 
        u.id as user_id,
        u.email,
        u.first_name,
        u.last_name,
        u.status as user_status,
        r.id as role_id,
        r.code as role_code,
        r.name as role_name,
        r.is_system as role_is_system,
        r.hotel_group_id as role_hotel_group_id,
        urs.id as scope_id,
        urs.scope_type,
        urs.hotel_group_id as scope_hotel_group_id,
        urs.region_id as scope_region_id,
        urs.country_id as scope_country_id,
        urs.property_id as scope_property_id,
        urs.department_code as scope_department_code,
        p.code as permission_code
      FROM platform_schema.users u
      LEFT JOIN (
        platform_schema.user_role_scopes urs
        INNER JOIN platform_schema.roles r ON urs.role_id = r.id AND r.deleted_at IS NULL
        LEFT JOIN platform_schema.role_permissions rp ON r.id = rp.role_id
        LEFT JOIN platform_schema.permissions p ON rp.permission_id = p.id
        LEFT JOIN platform_schema.regions reg ON urs.region_id = reg.id
        LEFT JOIN platform_schema.countries c ON urs.country_id = c.id
        LEFT JOIN platform_schema.regions reg_c ON c.region_id = reg_c.id
        LEFT JOIN platform_schema.properties prop ON urs.property_id = prop.id
        LEFT JOIN platform_schema.countries c_p ON prop.country_id = c_p.id
        LEFT JOIN platform_schema.regions reg_p ON c_p.region_id = reg_p.id
      ) ON u.id = urs.user_id
        AND (r.hotel_group_id IS NULL OR $2::text IS NULL OR r.hotel_group_id = $2)
        AND (
          urs.scope_type = 'GLOBAL'
          OR ($2::text IS NOT NULL AND (
            (urs.scope_type = 'GROUP' AND urs.hotel_group_id = $2)
            OR (urs.scope_type = 'REGION' AND reg.hotel_group_id = $2)
            OR (urs.scope_type = 'COUNTRY' AND reg_c.hotel_group_id = $2)
            OR (urs.scope_type = 'PROPERTY' AND reg_p.hotel_group_id = $2)
            OR (urs.scope_type = 'DEPARTMENT' AND reg_p.hotel_group_id = $2)
          ))
        )
      WHERE u.id = $1 
        AND u.status = 'ACTIVE' 
        AND u.deleted_at IS NULL
    `;

    const rows = await this.prisma.$queryRawUnsafe<SecurityContextRow[]>(
      query,
      userId,
      hotelGroupId,
    );

    if (!rows || rows.length === 0) {
      throw new UnauthorizedException({
        type: 'https://hms.enterprise/errors/authentication/user-not-found',
        title: 'Unauthorized: User Not Found or Inactive',
        status: 401,
        detail: `User ${userId} not found or is not active.`,
      });
    }

    const firstRow = rows[0];
    const userSnapshot = Object.freeze({
      id: firstRow.user_id,
      email: firstRow.email,
      firstName: firstRow.first_name,
      lastName: firstRow.last_name,
      status: firstRow.user_status,
    });

    const rolesMap = new Map<string, UserRoleSnapshot>();
    const scopeMap = new Map<
      string,
      {
        snapshot: Omit<UserScopeSnapshot, 'permissions'>;
        permissions: Set<string>;
      }
    >();
    const allPermissions = new Set<string>();

    for (const row of rows) {
      if (row.role_id && row.role_code) {
        if (!rolesMap.has(row.role_id)) {
          rolesMap.set(
            row.role_id,
            Object.freeze({
              id: row.role_id,
              code: row.role_code,
              name: row.role_name ?? row.role_code,
              isSystem: Boolean(row.role_is_system),
              hotelGroupId: row.role_hotel_group_id,
            }),
          );
        }
      }

      if (row.scope_id && row.role_id && row.role_code && row.scope_type) {
        if (!scopeMap.has(row.scope_id)) {
          scopeMap.set(row.scope_id, {
            snapshot: {
              id: row.scope_id,
              roleId: row.role_id,
              roleCode: row.role_code,
              scopeType: row.scope_type as ScopeType,
              hotelGroupId: row.scope_hotel_group_id,
              regionId: row.scope_region_id,
              countryId: row.scope_country_id,
              propertyId: row.scope_property_id,
              departmentCode: row.scope_department_code as DepartmentCode,
            },
            permissions: new Set<string>(),
          });
        }

        if (row.permission_code) {
          scopeMap.get(row.scope_id)!.permissions.add(row.permission_code);
          allPermissions.add(row.permission_code);
        }
      }
    }

    const scopes: UserScopeSnapshot[] = Array.from(scopeMap.values()).map(
      ({ snapshot, permissions }) =>
        Object.freeze({
          ...snapshot,
          permissions: Object.freeze(Array.from(permissions)),
        }),
    );

    const roles = Array.from(rolesMap.values());

    const isGlobalAdmin =
      roles.some((r) => r.code === 'GLOBAL_ADMIN') ||
      scopes.some(
        (s) =>
          s.scopeType === 'GLOBAL' &&
          (s.roleCode === 'GLOBAL_ADMIN' || s.roleCode === 'SUPER_ADMIN'),
      );

    return Object.freeze({
      userId,
      sessionId,
      correlationId,
      activeContext: Object.freeze({
        hotelGroupId,
        propertyId,
      }),
      user: userSnapshot,
      isGlobalAdmin,
      roles: Object.freeze(roles),
      permissions: new FrozenSet(allPermissions),
      scopes: Object.freeze(scopes),
    });
  }
}
