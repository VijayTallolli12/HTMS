import { CANONICAL_PERMISSIONS, CANONICAL_ROLE_PERMISSIONS } from '../../apps/api-core/src/modules/setup/application/data/iam-baseline.data';

describe('Channel Manager demo RBAC baseline', () => {
  const channelPermissions = ['channel:read', 'channel:create', 'channel:update', 'channel:delete', 'channel:sync', 'channel:reconcile'];

  it('declares each Channel Manager permission exactly once', () => {
    const channelCodes = CANONICAL_PERMISSIONS.map((permission) => permission.code).filter((code) => code.startsWith('channel:'));
    expect(channelCodes.sort()).toEqual([...channelPermissions].sort());
  });

  it('grants demo management to authorized admin and property roles only', () => {
    const grants = new Map(CANONICAL_ROLE_PERMISSIONS.map(({ roleCode, permCodes }) => [roleCode, permCodes]));
    expect(grants.get('PLATFORM_OWNER')).toContain('channel:read');
    expect(grants.get('PLATFORM_OWNER')).not.toContain('channel:sync');
    expect(grants.get('CORP_ADMIN')).toEqual(expect.arrayContaining(channelPermissions));
    expect(grants.get('PROPERTY_GM')).toEqual(expect.arrayContaining(channelPermissions));
    expect(grants.get('FDA')).not.toContain('channel:read');
    expect(grants.get('NIGHT_AUDITOR')).not.toContain('channel:sync');
  });
});
