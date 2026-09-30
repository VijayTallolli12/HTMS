import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { AuthorizationCacheService } from './authorization-cache.service';
import { HierarchyValidationService } from './hierarchy-validation.service';
import { CredentialService } from './credential.service';
import { PasswordPolicyService } from './password-policy.service';
import { SecurityAuditSink } from '../../../setup/infrastructure/security-audit.sink';
import {
  SecurityContext,
  ManagedUserSummaryDto,
  ManagedUserDetailDto,
  AccessiblePropertyDto,
  CreateUserResponse,
} from '@hms/api-contracts';
import { generateUuidV7 } from '@hms/shared';
import {
  CreateUserDto,
  UpdateUserDto,
  AssignPropertiesDto,
  UpdateUserStatusDto,
  ListUsersQueryDto,
} from '../../presentation/dto/user-management.dto';

const GM_PERMITTED_ROLES = new Set([
  'FOM',
  'FDA',
  'HK_SUPERVISOR',
  'ROOM_ATTENDANT',
  'MAINT_TECH',
  'FNB_MANAGER',
  'SPA_MANAGER',
]);

const MAX_PROVISIONING_PASSWORD_ATTEMPTS = 5;

interface ActorAuthority {
  isGlobalAdmin: boolean;
  isGroupAdmin: boolean;
  isPropertyGm: boolean;
  hotelGroupId: string | null;
  propertyIds: string[];
}

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorizationCache: AuthorizationCacheService,
    private readonly hierarchyValidation: HierarchyValidationService,
    private readonly credentialService: CredentialService,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly auditSink: SecurityAuditSink,
  ) {}

  /**
   * Returns properties the actor is authorized to administer / assign.
   */
  async getAccessiblePropertiesForManagement(
    actor: SecurityContext,
  ): Promise<AccessiblePropertyDto[]> {
    const auth = this.getActorAuthority(actor);

    if (!auth.isGroupAdmin && !auth.isPropertyGm) {
      return [];
    }

    if (auth.isGroupAdmin) {
      const whereClause: any = { status: 'ACTIVE', deletedAt: null };
      if (auth.hotelGroupId) {
        whereClause.country = { region: { hotelGroupId: auth.hotelGroupId } };
      }
      const properties = await this.prisma.property.findMany({
        where: whereClause,
        include: { country: { include: { region: true } } },
        orderBy: { name: 'asc' },
      });
      return properties.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        city: p.city ?? null,
        hotelGroupId: p.country.region.hotelGroupId,
      }));
    }

    if (auth.propertyIds.length === 0) {
      return [];
    }

    const properties = await this.prisma.property.findMany({
      where: {
        id: { in: auth.propertyIds },
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: { country: { include: { region: true } } },
      orderBy: { name: 'asc' },
    });

    return properties.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      city: p.city ?? null,
      hotelGroupId: p.country.region.hotelGroupId,
    }));
  }

  /**
   * List users accessible to the actor with pagination and filters.
   */
  async listUsers(
    actor: SecurityContext,
    query: ListUsersQueryDto,
  ): Promise<{ items: ManagedUserSummaryDto[]; total: number; page: number; limit: number }> {
    const auth = this.getActorAuthority(actor);

    if (!auth.isGroupAdmin && !auth.isPropertyGm) {
      return { items: [], total: 0, page: query.page || 1, limit: query.limit || 25 };
    }

    const accessiblePropertyIds = auth.isGroupAdmin
      ? null
      : auth.propertyIds;

    if (!auth.isGroupAdmin && (!accessiblePropertyIds || accessiblePropertyIds.length === 0)) {
      return { items: [], total: 0, page: query.page || 1, limit: query.limit || 25 };
    }

    // Build Prisma where filter
    const where: any = {
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim().length > 0) {
      const term = query.search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
      ];
    }

    // If property-scoped GM or filtered by property
    const targetPropertyId = query.propertyId;
    if (targetPropertyId) {
      if (!auth.isGroupAdmin && !accessiblePropertyIds!.includes(targetPropertyId)) {
        throw new ForbiddenException('You are not authorized to view users for this property.');
      }
      where.roleScopes = {
        some: { propertyId: targetPropertyId },
      };
    } else if (!auth.isGroupAdmin) {
      // Must have role scope in at least one authorized property
      where.roleScopes = {
        some: { propertyId: { in: accessiblePropertyIds! } },
      };
    }

    if (query.role) {
      where.roleScopes = {
        ...(where.roleScopes || {}),
        some: {
          ...(where.roleScopes?.some || {}),
          role: { code: query.role },
        },
      };
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 25));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          roleScopes: {
            include: {
              role: true,
              property: true,
            },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = users.map((u) => this.mapToSummaryDto(u));
    return { items, total, page, limit };
  }

  /**
   * Get single user by ID.
   */
  async getUserById(actor: SecurityContext, id: string): Promise<ManagedUserDetailDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roleScopes: {
          include: {
            role: true,
            property: true,
          },
        },
      },
    });

    if (!user || user.deletedAt !== null) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    this.assertCanManageUser(actor, user);
    return this.mapToDetailDto(user);
  }

  /**
   * Create and provision a new user.
   */
  async createUser(actor: SecurityContext, dto: CreateUserDto): Promise<CreateUserResponse> {
    const auth = this.getActorAuthority(actor);

    // 1. Role assignment authorization check
    this.assertCanAssignRole(auth, dto.roleCode);

    // 2. Property assignment authorization check
    await this.assertCanAssignProperties(auth, dto.propertyIds);

    // 3. Email uniqueness fast path. The DB UNIQUE constraint stays the source
    //    of truth; a concurrent insert is caught via P2002 below (409).
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException(`User with email '${normalizedEmail}' already exists.`);
    }

    // 4. Resolve role
    const role = await this.prisma.role.findFirst({
      where: { code: dto.roleCode, deletedAt: null },
    });
    if (!role) {
      throw new BadRequestException(`Role '${dto.roleCode}' does not exist.`);
    }

    // 5. Resolve HotelGroup for primary membership
    const sampleProperty = await this.prisma.property.findUnique({
      where: { id: dto.propertyIds[0] },
      include: { country: { include: { region: true } } },
    });
    if (!sampleProperty) {
      throw new BadRequestException(`Property '${dto.propertyIds[0]}' not found.`);
    }
    const hotelGroupId = sampleProperty.country.region.hotelGroupId;

    // 6. Resolve the initial password. A supplied password is validated against
    //    the policy; otherwise a policy-compliant password is generated and
    //    returned exactly once. Hashes are never exposed.
    let plaintextPassword: string;
    let generatedPassword = false;
    if (dto.initialPassword) {
      await this.passwordPolicyService.assertValidAndNotBreached(dto.initialPassword);
      plaintextPassword = dto.initialPassword;
    } else {
      plaintextPassword = await this.generateProvisioningPassword();
      generatedPassword = true;
    }

    const userId = generateUuidV7();

    // 7. Transactional provisioning
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: userId,
            email: normalizedEmail,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            phone: dto.phone?.trim() ?? null,
            status: dto.status || 'ACTIVE',
            defaultPropertyId: dto.propertyIds[0],
          },
        });

        // Reuse the established credential architecture (argon2id + policy +
        // breached check + passwordChangedAt). No PasswordHistory on initial
        // creation, matching the W2 setup provisioning convention.
        await this.credentialService.createCredential(userId, plaintextPassword, tx);

        await tx.organizationMembership.create({
          data: {
            id: generateUuidV7(),
            userId,
            hotelGroupId,
            isPrimary: true,
            status: 'ACTIVE',
          },
        });

        for (const propertyId of dto.propertyIds) {
          await tx.userRoleScope.create({
            data: {
              id: generateUuidV7(),
              userId,
              roleId: role.id,
              scopeType: 'PROPERTY',
              propertyId,
              hotelGroupId,
            },
          });
        }
      });
    } catch (error) {
      if ((error as any)?.code === 'P2002') {
        throw new ConflictException(`User with email '${normalizedEmail}' already exists.`);
      }
      throw error;
    }

    // 8. Invalidate authorization cache for target user
    await this.authorizationCache.invalidateUser(userId);

    // 9. Audit event
    await this.auditSink.record({
      action: 'USER_CREATED',
      outcome: 'SUCCESS',
      actorId: actor.userId,
      actorType: 'USER',
      resourceType: 'USER',
      resourceId: userId,
      correlationId: actor.correlationId,
      details: {
        email: normalizedEmail,
        roleCode: dto.roleCode,
        assignedProperties: dto.propertyIds,
        status: dto.status || 'ACTIVE',
        credentialSource: generatedPassword ? 'GENERATED' : 'SUPPLIED',
      },
    });

    const detail = await this.getUserById(actor, userId);
    return generatedPassword ? { ...detail, provisionedPassword: plaintextPassword } : detail;
  }

  /**
   * Generates a random initial password that satisfies the password policy.
   * Returned in plaintext exactly once so it can be handed to the new user.
   */
  private async generateProvisioningPassword(): Promise<string> {
    for (let attempt = 0; attempt < MAX_PROVISIONING_PASSWORD_ATTEMPTS; attempt += 1) {
      const candidate = `Hms@${generateUuidV7().replace(/-/g, '').slice(-12)}!`;
      try {
        await this.passwordPolicyService.assertValidAndNotBreached(candidate);
        return candidate;
      } catch {
        // Random suffix makes a policy/breach hit extremely unlikely; retry.
      }
    }
    throw new BadRequestException('Unable to generate a policy-compliant initial password.');
  }

  /**
   * Update user details, role, and/or property assignments.
   */
  async updateUser(
    actor: SecurityContext,
    id: string,
    dto: UpdateUserDto,
  ): Promise<ManagedUserDetailDto> {
    const auth = this.getActorAuthority(actor);

    // Fix 3: block self-deactivation through PATCH /:id as well as /:id/status.
    if (actor.userId === id && dto.status === 'INACTIVE') {
      throw new BadRequestException('Administrators cannot deactivate their own account.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roleScopes: {
          include: { role: true },
        },
      },
    });

    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    this.assertCanManageUser(actor, existing);

    const previousStatus = existing.status;
    const beforeState = {
      firstName: existing.firstName,
      lastName: existing.lastName,
      phone: existing.phone,
      status: existing.status,
      roles: existing.roleScopes.map((rs) => rs.role.code),
      properties: existing.roleScopes.map((rs) => rs.propertyId).filter(Boolean),
    };

    // Role check if changing role
    let newRole: any = null;
    if (dto.roleCode) {
      this.assertCanAssignRole(auth, dto.roleCode);
      newRole = await this.prisma.role.findFirst({
        where: { code: dto.roleCode, deletedAt: null },
      });
      if (!newRole) {
        throw new BadRequestException(`Role '${dto.roleCode}' does not exist.`);
      }
    }

    // Property check if changing properties
    if (dto.propertyIds) {
      await this.assertCanAssignProperties(auth, dto.propertyIds);
    }

    // Snapshot existing PROPERTY scopes so roleId + hotelGroupId can be
    // preserved for properties that remain assigned. NON-property scopes
    // (GLOBAL/GROUP/REGION/COUNTRY/DEPARTMENT) are never touched here.
    const existingPropertyScopes = new Map<string, { roleId: string; hotelGroupId: string | null }>();
    for (const rs of existing.roleScopes) {
      if (rs.scopeType === 'PROPERTY' && rs.propertyId) {
        existingPropertyScopes.set(rs.propertyId, {
          roleId: rs.roleId,
          hotelGroupId: (rs as any).hotelGroupId ?? null,
        });
      }
    }

    const fallbackRoleId =
      newRole?.id ?? existing.roleScopes.find((rs) => rs.roleId)?.roleId ?? null;

    const targetPropertyIds = dto.propertyIds
      ? Array.from(new Set(dto.propertyIds))
      : Array.from(existingPropertyScopes.keys());

    if ((dto.roleCode || dto.propertyIds) && targetPropertyIds.length === 0) {
      throw new BadRequestException('A user must retain at least one property assignment.');
    }

    // Resolve the desired PROPERTY scope set, preserving roleId + hotelGroupId.
    const resolvedScopes: Array<{ propertyId: string; roleId: string; hotelGroupId: string | null }> = [];
    for (const pid of targetPropertyIds) {
      const preserved = existingPropertyScopes.get(pid);
      const roleId = newRole?.id ?? preserved?.roleId ?? fallbackRoleId;
      if (!roleId) {
        throw new BadRequestException('Cannot resolve a role for the property assignment.');
      }
      let hotelGroupId = preserved?.hotelGroupId ?? null;
      if (!hotelGroupId) {
        const path = await this.hierarchyValidation.getPropertyHierarchy(pid);
        hotelGroupId = path?.hotelGroupId ?? null;
      }
      resolvedScopes.push({ propertyId: pid, roleId, hotelGroupId });
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Update basic user fields
      const userUpdate: any = {};
      if (dto.firstName) userUpdate.firstName = dto.firstName.trim();
      if (dto.lastName) userUpdate.lastName = dto.lastName.trim();
      if (dto.phone !== undefined) userUpdate.phone = dto.phone ? dto.phone.trim() : null;
      if (dto.status) userUpdate.status = dto.status;
      if (dto.propertyIds && dto.propertyIds.length > 0) {
        userUpdate.defaultPropertyId = dto.propertyIds[0];
      }

      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({
          where: { id },
          data: userUpdate,
        });
      }

      // 2. Replace ONLY PROPERTY scopes when role or properties changed.
      //    GLOBAL/GROUP/REGION/COUNTRY/DEPARTMENT scopes are preserved.
      if (dto.roleCode || dto.propertyIds) {
        if (auth.isGroupAdmin) {
          await tx.userRoleScope.deleteMany({
            where: { userId: id, scopeType: 'PROPERTY' },
          });

          for (const scope of resolvedScopes) {
            await tx.userRoleScope.create({
              data: {
                id: generateUuidV7(),
                userId: id,
                roleId: scope.roleId,
                scopeType: 'PROPERTY',
                propertyId: scope.propertyId,
                hotelGroupId: scope.hotelGroupId,
              },
            });
          }
        } else {
          // Property GM: replace only PROPERTY scopes within their own authority.
          await tx.userRoleScope.deleteMany({
            where: {
              userId: id,
              scopeType: 'PROPERTY',
              propertyId: { in: auth.propertyIds },
            },
          });

          for (const scope of resolvedScopes) {
            if (auth.propertyIds.includes(scope.propertyId)) {
              await tx.userRoleScope.create({
                data: {
                  id: generateUuidV7(),
                  userId: id,
                  roleId: scope.roleId,
                  scopeType: 'PROPERTY',
                  propertyId: scope.propertyId,
                  hotelGroupId: scope.hotelGroupId,
                },
              });
            }
          }
        }
      }
    });

    // Cache invalidation
    await this.authorizationCache.invalidateUser(id);

    // Fix 3: status mutations emit USER_STATUS_CHANGED, not USER_UPDATED.
    const statusChanged = dto.status !== undefined && dto.status !== previousStatus;
    if (statusChanged) {
      await this.auditSink.record({
        action: 'USER_STATUS_CHANGED',
        outcome: 'SUCCESS',
        actorId: actor.userId,
        actorType: 'USER',
        resourceType: 'USER',
        resourceId: id,
        correlationId: actor.correlationId,
        details: {
          previousStatus,
          newStatus: dto.status,
        },
      });
    }

    const profileOrScopeChanged =
      dto.firstName !== undefined ||
      dto.lastName !== undefined ||
      dto.phone !== undefined ||
      dto.roleCode !== undefined ||
      dto.propertyIds !== undefined;

    if (profileOrScopeChanged) {
      await this.auditSink.record({
        action: 'USER_UPDATED',
        outcome: 'SUCCESS',
        actorId: actor.userId,
        actorType: 'USER',
        resourceType: 'USER',
        resourceId: id,
        correlationId: actor.correlationId,
        details: {
          before: beforeState,
          after: {
            firstName: dto.firstName ?? beforeState.firstName,
            lastName: dto.lastName ?? beforeState.lastName,
            status: dto.status ?? beforeState.status,
            roleCode: dto.roleCode ?? existing.roleScopes[0]?.role.code,
            propertyIds: dto.propertyIds ?? beforeState.properties,
          },
        },
      });
    }

    return this.getUserById(actor, id);
  }

  /**
   * Assign one or more properties to an existing user.
   */
  async assignProperties(
    actor: SecurityContext,
    id: string,
    dto: AssignPropertiesDto,
  ): Promise<ManagedUserDetailDto> {
    const auth = this.getActorAuthority(actor);
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roleScopes: { include: { role: true } },
      },
    });

    if (!user || user.deletedAt !== null) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    this.assertCanManageUser(actor, user);
    await this.assertCanAssignProperties(auth, dto.propertyIds);

    let roleId = user.roleScopes[0]?.roleId;
    if (dto.roleCode) {
      this.assertCanAssignRole(auth, dto.roleCode);
      const role = await this.prisma.role.findFirst({
        where: { code: dto.roleCode, deletedAt: null },
      });
      if (!role) throw new BadRequestException(`Role '${dto.roleCode}' does not exist.`);
      roleId = role.id;
    }

    if (!roleId) {
      throw new BadRequestException('Target user has no existing role. Specify roleCode.');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const propertyId of dto.propertyIds) {
        const exists = await tx.userRoleScope.findFirst({
          where: { userId: id, propertyId },
        });
        if (!exists) {
          await tx.userRoleScope.create({
            data: {
              id: generateUuidV7(),
              userId: id,
              roleId,
              scopeType: 'PROPERTY',
              propertyId,
            },
          });
        }
      }

      if (!user.defaultPropertyId && dto.propertyIds.length > 0) {
        await tx.user.update({
          where: { id },
          data: { defaultPropertyId: dto.propertyIds[0] },
        });
      }
    });

    await this.authorizationCache.invalidateUser(id);

    await this.auditSink.record({
      action: 'USER_PROPERTY_ASSIGNED',
      outcome: 'SUCCESS',
      actorId: actor.userId,
      actorType: 'USER',
      resourceType: 'USER',
      resourceId: id,
      correlationId: actor.correlationId,
      details: {
        assignedProperties: dto.propertyIds,
        roleId,
      },
    });

    return this.getUserById(actor, id);
  }

  /**
   * Remove a property assignment from a user.
   */
  async removePropertyAssignment(
    actor: SecurityContext,
    id: string,
    propertyId: string,
  ): Promise<ManagedUserDetailDto> {
    const auth = this.getActorAuthority(actor);
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roleScopes: true,
      },
    });

    if (!user || user.deletedAt !== null) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    this.assertCanManageUser(actor, user);

    if (!auth.isGroupAdmin && !auth.propertyIds.includes(propertyId)) {
      throw new ForbiddenException('You cannot remove property assignments outside your authorized scope.');
    }

    // A user must retain at least one property assignment.
    const currentPropertyScopes = (user.roleScopes || []).filter((rs: any) => rs.propertyId);
    const removesLastProperty =
      currentPropertyScopes.length <= 1 &&
      currentPropertyScopes.some((rs: any) => rs.propertyId === propertyId);
    if (removesLastProperty) {
      throw new BadRequestException('Cannot remove the last property assignment from a user.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRoleScope.deleteMany({
        where: {
          userId: id,
          propertyId,
        },
      });

      // If removed property was defaultPropertyId, fallback to another assigned property or null
      if (user.defaultPropertyId === propertyId) {
        const remainingScope = await tx.userRoleScope.findFirst({
          where: { userId: id, propertyId: { not: null } },
        });
        await tx.user.update({
          where: { id },
          data: { defaultPropertyId: remainingScope?.propertyId ?? null },
        });
      }
    });

    await this.authorizationCache.invalidateUser(id);

    await this.auditSink.record({
      action: 'USER_PROPERTY_REMOVED',
      outcome: 'SUCCESS',
      actorId: actor.userId,
      actorType: 'USER',
      resourceType: 'USER',
      resourceId: id,
      correlationId: actor.correlationId,
      details: {
        removedPropertyId: propertyId,
      },
    });

    return this.getUserById(actor, id);
  }

  /**
   * Activate or deactivate a user account.
   */
  async updateUserStatus(
    actor: SecurityContext,
    id: string,
    dto: UpdateUserStatusDto,
  ): Promise<ManagedUserDetailDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roleScopes: { include: { role: true } } },
    });

    if (!user || user.deletedAt !== null) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    this.assertCanManageUser(actor, user);

    // Prevent actor deactivating themselves
    if (actor.userId === id && dto.status === 'INACTIVE') {
      throw new BadRequestException('Administrators cannot deactivate their own account.');
    }

    const previousStatus = user.status;

    await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.authorizationCache.invalidateUser(id);

    await this.auditSink.record({
      action: 'USER_STATUS_CHANGED',
      outcome: 'SUCCESS',
      actorId: actor.userId,
      actorType: 'USER',
      resourceType: 'USER',
      resourceId: id,
      correlationId: actor.correlationId,
      details: {
        previousStatus,
        newStatus: dto.status,
      },
    });

    return this.getUserById(actor, id);
  }

  // ============================================================================
  // AUTHORIZATION INVARIANT ENFORCERS
  // ============================================================================

  private getActorAuthority(actor: SecurityContext): ActorAuthority {
    if (actor.isGlobalAdmin) {
      return {
        isGlobalAdmin: true,
        isGroupAdmin: true,
        isPropertyGm: false,
        hotelGroupId: null,
        propertyIds: [],
      };
    }

    // Fix 4: group-admin authority is granted ONLY by the CORP_ADMIN role.
    // A GROUP/GLOBAL scope record on an operational role must never elevate a
    // user to group admin (fail closed against scope-derived privilege).
    const isCorpAdmin = actor.roles.some((r) => r.code === 'CORP_ADMIN');
    if (isCorpAdmin) {
      const groupScope = actor.scopes.find((s) => s.hotelGroupId);
      return {
        isGlobalAdmin: false,
        isGroupAdmin: true,
        isPropertyGm: false,
        hotelGroupId:
          groupScope?.hotelGroupId || actor.activeContext.hotelGroupId || null,
        propertyIds: [],
      };
    }

    const isPropertyGm = actor.roles.some((r) => r.code === 'PROPERTY_GM');

    const propertyIds = Array.from(
      new Set(
        actor.scopes
          .filter((s) => s.scopeType === 'PROPERTY' && s.propertyId)
          .map((s) => s.propertyId as string),
      ),
    );

    return {
      isGlobalAdmin: false,
      isGroupAdmin: false,
      isPropertyGm,
      hotelGroupId: actor.activeContext.hotelGroupId || null,
      propertyIds,
    };
  }

  private assertCanManageUser(actor: SecurityContext, targetUser: any): void {
    const auth = this.getActorAuthority(actor);

    // Only corporate admin or property GM can manage users
    if (!auth.isGroupAdmin && !auth.isPropertyGm) {
      throw new ForbiddenException('You are not authorized to manage staff users.');
    }

    const isSelf = actor.userId === targetUser.id;
    const targetRoles: string[] =
      targetUser.roleScopes?.map((rs: any) => rs.role?.code).filter(Boolean) || [];

    // Fix 1: PLATFORM_OWNER is protected from every lower administrator. Only a
    // global admin (platform owner) may manage a PLATFORM_OWNER account.
    if (targetRoles.includes('PLATFORM_OWNER') && !auth.isGlobalAdmin) {
      throw new ForbiddenException('Only a platform owner may manage a platform owner account.');
    }

    // Fix 1: a CORP_ADMIN account may be managed only by a global admin or by
    // itself. No other CORP_ADMIN or property GM may modify it.
    if (targetRoles.includes('CORP_ADMIN') && !isSelf && !auth.isGlobalAdmin) {
      throw new ForbiddenException(
        'Corporate administrator accounts cannot be managed by another administrator.',
      );
    }

    // Fix 1: a property GM may never modify another PROPERTY_GM.
    if (!auth.isGroupAdmin && !isSelf && targetRoles.includes('PROPERTY_GM')) {
      throw new ForbiddenException('Property managers cannot manage another general manager.');
    }

    // CORP_ADMIN / global admin can manage all remaining users in scope.
    if (auth.isGroupAdmin) {
      return;
    }

    // Property GM: target user must share at least one property with the GM.
    const targetPropertyIds: string[] =
      targetUser.roleScopes
        ?.map((rs: any) => rs.propertyId)
        .filter((p: any): p is string => Boolean(p)) || [];

    const hasCommonProperty = targetPropertyIds.some((pid: string) =>
      auth.propertyIds.includes(pid),
    );

    if (!hasCommonProperty) {
      throw new ForbiddenException('You are not authorized to manage users outside your assigned properties.');
    }
  }

  private assertCanAssignRole(auth: { isGroupAdmin: boolean; isPropertyGm: boolean }, roleCode: string): void {
    if (roleCode === 'PLATFORM_OWNER') {
      throw new ForbiddenException('Assigning PLATFORM_OWNER role is forbidden.');
    }

    if (!auth.isGroupAdmin && !auth.isPropertyGm) {
      throw new ForbiddenException('You are not authorized to manage users or assign roles.');
    }

    if (!auth.isGroupAdmin) {
      if (roleCode === 'CORP_ADMIN') {
        throw new ForbiddenException('Property managers cannot assign CORP_ADMIN role.');
      }
      if (roleCode === 'PROPERTY_GM') {
        throw new ForbiddenException('Property managers cannot create or assign another General Manager.');
      }
      if (!GM_PERMITTED_ROLES.has(roleCode)) {
        throw new ForbiddenException(`Property managers cannot assign role '${roleCode}'. Permitted operational roles: ${Array.from(GM_PERMITTED_ROLES).join(', ')}`);
      }
    }
  }

  private async assertCanAssignProperties(
    auth: ActorAuthority,
    propertyIds: string[],
  ): Promise<void> {
    if (!propertyIds || propertyIds.length === 0) {
      throw new BadRequestException('At least one property ID must be assigned.');
    }

    if (auth.isGroupAdmin) {
      // Fix 4: fail closed. A non-global group admin MUST have a resolvable
      // hotel group; without it property ownership cannot be verified, so deny.
      if (!auth.hotelGroupId) {
        if (!auth.isGlobalAdmin) {
          throw new ForbiddenException(
            'Unable to resolve your hotel group; property assignment is not permitted.',
          );
        }
        return;
      }
      // Validate that all properties belong to the hotel group
      for (const pid of propertyIds) {
        const path = await this.hierarchyValidation.getPropertyHierarchy(pid);
        if (!path || path.hotelGroupId !== auth.hotelGroupId) {
          throw new ForbiddenException(`Property '${pid}' does not belong to your hotel group.`);
        }
      }
      return;
    }

    // Property GM: can ONLY assign properties they themselves have scope for
    for (const pid of propertyIds) {
      if (!auth.propertyIds.includes(pid)) {
        throw new ForbiddenException(`You do not have administrative authority over property '${pid}'.`);
      }
    }
  }

  private mapToSummaryDto(user: any): ManagedUserSummaryDto {
    const primaryScope = user.roleScopes?.[0];
    const role = primaryScope?.role
      ? {
          id: primaryScope.role.id,
          code: primaryScope.role.code,
          name: primaryScope.role.name,
        }
      : null;

    const assignedMap = new Map<string, { id: string; code: string; name: string }>();
    for (const s of user.roleScopes || []) {
      if (s.property) {
        assignedMap.set(s.property.id, {
          id: s.property.id,
          code: s.property.code,
          name: s.property.name,
        });
      }
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? null,
      status: user.status,
      role,
      assignedProperties: Array.from(assignedMap.values()),
      defaultPropertyId: user.defaultPropertyId ?? null,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private mapToDetailDto(user: any): ManagedUserDetailDto {
    const summary = this.mapToSummaryDto(user);
    const scopes = (user.roleScopes || []).map((s: any) => ({
      id: s.id,
      roleId: s.roleId,
      roleCode: s.role?.code ?? '',
      roleName: s.role?.name ?? '',
      scopeType: s.scopeType,
      propertyId: s.propertyId ?? null,
      propertyName: s.property?.name ?? null,
      hotelGroupId: s.hotelGroupId ?? null,
    }));

    return {
      ...summary,
      scopes,
    };
  }
}
