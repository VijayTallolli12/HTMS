import {
  AuthorizationCacheService,
  USER_VERSION_PREFIX,
  ROLE_VERSION_PREFIX,
  CONTEXT_CACHE_PREFIX,
  AUTHZ_CACHE_TTL_SECONDS,
} from '../../apps/api-core/src/modules/identity/application/services/authorization-cache.service';
import { RedisService } from '../../apps/api-core/src/common/redis/redis.service';
import { SecurityContext, FrozenSet } from '@hms/api-contracts';

describe('AuthorizationCacheService (Unit)', () => {
  let service: AuthorizationCacheService;
  let mockRedis: jest.Mocked<Partial<RedisService>>;

  const mockSecurityContext: SecurityContext = Object.freeze({
    userId: 'user-123',
    sessionId: 'session-456',
    correlationId: 'req-789',
    activeContext: Object.freeze({
      hotelGroupId: 'group-1',
      propertyId: 'prop-1',
    }),
    user: Object.freeze({
      id: 'user-123',
      email: 'staff@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      status: 'ACTIVE',
    }),
    isGlobalAdmin: false,
    roles: Object.freeze([
      Object.freeze({
        id: 'role-front-desk',
        code: 'FRONT_DESK_AGENT',
        name: 'Front Desk Agent',
        isSystem: true,
        hotelGroupId: null,
      }),
    ]),
    permissions: new FrozenSet(['reservation:read', 'guest:checkin']),
    scopes: Object.freeze([
      Object.freeze({
        id: 'scope-1',
        roleId: 'role-front-desk',
        roleCode: 'FRONT_DESK_AGENT',
        scopeType: 'PROPERTY',
        hotelGroupId: 'group-1',
        regionId: 'reg-1',
        countryId: 'country-1',
        propertyId: 'prop-1',
        departmentCode: 'FRONT_OFFICE',
        permissions: Object.freeze(['reservation:read', 'guest:checkin']),
      }),
    ]),
  });

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      incr: jest.fn(),
      mget: jest.fn(),
    };

    service = new AuthorizationCacheService(mockRedis as RedisService);
  });

  describe('invalidation', () => {
    it('should increment user version in Redis', async () => {
      (mockRedis.incr as jest.Mock).mockResolvedValue(2);

      const newVer = await service.invalidateUser('user-123');

      expect(newVer).toBe(2);
      expect(mockRedis.incr).toHaveBeenCalledWith(`${USER_VERSION_PREFIX}user-123`);
    });

    it('should increment role version in Redis', async () => {
      (mockRedis.incr as jest.Mock).mockResolvedValue(5);

      const newVer = await service.invalidateRole('role-manager');

      expect(newVer).toBe(5);
      expect(mockRedis.incr).toHaveBeenCalledWith(`${ROLE_VERSION_PREFIX}role-manager`);
    });
  });

  describe('getCurrentVersions', () => {
    it('should query user version and all unique role versions using MGET', async () => {
      (mockRedis.mget as jest.Mock).mockResolvedValue(['2', '3', '1']);

      const versions = await service.getCurrentVersions('user-123', [
        'role-1',
        'role-2',
        'role-1', // duplicate
      ]);

      expect(versions).toEqual({
        userVersion: 2,
        roleVersions: {
          'role-1': 3,
          'role-2': 1,
        },
      });
      expect(mockRedis.mget).toHaveBeenCalledWith(
        `${USER_VERSION_PREFIX}user-123`,
        `${ROLE_VERSION_PREFIX}role-1`,
        `${ROLE_VERSION_PREFIX}role-2`,
      );
    });

    it('should default missing versions to 0', async () => {
      (mockRedis.mget as jest.Mock).mockResolvedValue([null, null]);

      const versions = await service.getCurrentVersions('user-new', ['role-new']);

      expect(versions).toEqual({
        userVersion: 0,
        roleVersions: {
          'role-new': 0,
        },
      });
    });
  });

  describe('get (Invalidate-on-Read)', () => {
    const cachedPayload = JSON.stringify({
      cachedUserVersion: 1,
      cachedRoleVersions: {
        'role-front-desk': 1,
      },
      userId: 'user-123',
      sessionId: 'session-456',
      hotelGroupId: 'group-1',
      propertyId: 'prop-1',
      user: {
        id: 'user-123',
        email: 'staff@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        status: 'ACTIVE',
      },
      isGlobalAdmin: false,
      roles: [
        {
          id: 'role-front-desk',
          code: 'FRONT_DESK_AGENT',
          name: 'Front Desk Agent',
          isSystem: true,
          hotelGroupId: null,
        },
      ],
      permissions: ['reservation:read', 'guest:checkin'],
      scopes: [
        {
          id: 'scope-1',
          roleId: 'role-front-desk',
          roleCode: 'FRONT_DESK_AGENT',
          scopeType: 'PROPERTY',
          hotelGroupId: 'group-1',
          regionId: 'reg-1',
          countryId: 'country-1',
          propertyId: 'prop-1',
          departmentCode: 'FRONT_OFFICE',
          permissions: ['reservation:read', 'guest:checkin'],
        },
      ],
    });

    it('should return null on cache miss', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(null);

      const result = await service.get('user-123', 'group-1');

      expect(result).toBeNull();
    });

    it('should return reconstructed immutable SecurityContext when versions match', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(cachedPayload);
      (mockRedis.mget as jest.Mock).mockResolvedValue(['1', '1']);

      const result = await service.get('user-123', 'group-1', 'req-corr-1');

      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user-123');
      expect(result!.correlationId).toBe('req-corr-1');
      expect(result!.permissions.has('reservation:read')).toBe(true);
      expect(result!.permissions).toBeInstanceOf(FrozenSet);

      // Verify immutability
      expect(() => (result!.permissions as any).add('unauthorized')).toThrow(TypeError);
      expect(() => ((result as any).userId = 'hacked')).toThrow();
    });

    it('should invalidate on read when user version is incremented (stale user cache)', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(cachedPayload);
      // Current user version in Redis is 2, but cache was built at version 1
      (mockRedis.mget as jest.Mock).mockResolvedValue(['2', '1']);

      const result = await service.get('user-123', 'group-1');

      expect(result).toBeNull();
    });

    it('should invalidate on read when role version is incremented (stale role permissions)', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(cachedPayload);
      // User version is 1, but role version in Redis was incremented to 2
      (mockRedis.mget as jest.Mock).mockResolvedValue(['1', '2']);

      const result = await service.get('user-123', 'group-1');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should serialize SecurityContext and store with 300s TTL', async () => {
      (mockRedis.set as jest.Mock).mockResolvedValue('OK');

      await service.set(mockSecurityContext, 1, { 'role-front-desk': 1 });

      expect(mockRedis.set).toHaveBeenCalledWith(
        `${CONTEXT_CACHE_PREFIX}user-123:group-1`,
        expect.any(String),
        'EX',
        AUTHZ_CACHE_TTL_SECONDS,
      );

      const serialized = JSON.parse((mockRedis.set as jest.Mock).mock.calls[0][1]);
      expect(serialized.cachedUserVersion).toBe(1);
      expect(serialized.cachedRoleVersions).toEqual({ 'role-front-desk': 1 });
      expect(serialized.permissions).toContain('reservation:read');
    });
  });
});
