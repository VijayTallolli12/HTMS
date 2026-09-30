import { CANONICAL_PERMISSIONS, CANONICAL_ROLE_PERMISSIONS } from '../../apps/api-core/src/modules/setup/application/data/iam-baseline.data';

describe('Payment gateway property RBAC baseline', () => {
  const required = [
    'payment_gateway:view', 'payment_gateway:configure', 'payment_gateway:test',
    'payment_gateway:enable', 'payment_gateway:disable',
  ];

  it('declares separate payment administration and financial permissions', () => {
    const codes = new Set(CANONICAL_PERMISSIONS.map((item) => item.code));
    for (const permission of [
      ...required, 'payment:intent:create', 'payment:authorize', 'payment:capture', 'payment:refund', 'payment:reconcile',
    ]) expect(codes.has(permission)).toBe(true);
    expect(codes.has('payment_gateway:refund')).toBe(false);
  });

  it('limits gateway configuration and operational access to Corp Admin and Property GM', () => {
    const grants = new Map(CANONICAL_ROLE_PERMISSIONS.map(({ roleCode, permCodes }) => [roleCode, permCodes]));
    expect(grants.get('CORP_ADMIN')).toEqual(expect.arrayContaining(required));
    expect(grants.get('PROPERTY_GM')).toEqual(expect.arrayContaining(required));
    expect(grants.get('CORP_ADMIN')).not.toContain('payment_gateway:refund');
    expect(grants.get('PROPERTY_GM')).not.toContain('payment_gateway:refund');
    expect(grants.get('CORP_ADMIN')).toEqual(expect.arrayContaining(['payment:intent:create', 'payment:authorize', 'payment:capture', 'payment:refund', 'payment:reconcile']));
    expect(grants.get('PROPERTY_GM')).toEqual(expect.arrayContaining(['payment:intent:create', 'payment:authorize', 'payment:capture', 'payment:refund', 'payment:reconcile']));
    for (const role of ['FDA', 'HK_SUPERVISOR', 'MAINT_TECH', 'NIGHT_AUDITOR']) {
      expect(grants.get(role) || []).not.toContain('payment_gateway:configure');
      expect(grants.get(role) || []).not.toContain('payment:refund');
    }
  });
});
