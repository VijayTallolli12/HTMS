import { generateUuidV7, isValidUuidV7, createCloudEvent } from '@hms/shared';
import { OrganizationEventType } from '@hms/api-contracts';

describe('Organization Hierarchy & Domain Events Unit Tests', () => {
  describe('UUIDv7 ID Generation Compliance', () => {
    it('should generate valid UUIDv7 strings for organization entities', () => {
      const id = generateUuidV7();
      expect(isValidUuidV7(id)).toBe(true);
      // Check version 7 bit
      const parts = id.split('-');
      expect(parts[2].startsWith('7')).toBe(true);
    });

    it('should generate chronologically ordered IDs across timestamp progression', async () => {
      const id1 = generateUuidV7();
      await new Promise((r) => setTimeout(r, 10));
      const id2 = generateUuidV7();
      expect(id1).not.toBe(id2);
      expect(id2 > id1).toBe(true);
    });
  });

  describe('CloudEvents v1.0 Factory for Organization Events', () => {
    it('should construct a specification-compliant CloudEvent for GroupCreated', () => {
      const groupId = generateUuidV7();
      const event = createCloudEvent({
        type: OrganizationEventType.GROUP_CREATED,
        source: `https://platform.enterprise-hms.com/organizations/groups/${groupId}`,
        subject: groupId,
        data: {
          groupId,
          code: 'HG-GLR',
          name: 'Global Luxury Resorts',
          status: 'ACTIVE',
        },
        correlationId: 'corr_test_123',
      });

      expect(event.specversion).toBe('1.0');
      expect(isValidUuidV7(event.id)).toBe(true);
      expect(event.type).toBe('com.enterprise_hms.organization.group_created.v1');
      expect(event.source).toBe(
        `https://platform.enterprise-hms.com/organizations/groups/${groupId}`,
      );
      expect(event.subject).toBe(groupId);
      expect(event.datacontenttype).toBe('application/json');
      expect(event.correlationid).toBe('corr_test_123');
      expect(event.data.code).toBe('HG-GLR');
    });

    it('should construct a specification-compliant CloudEvent for PropertyCreated', () => {
      const propertyId = generateUuidV7();
      const countryId = generateUuidV7();
      const event = createCloudEvent({
        type: OrganizationEventType.PROPERTY_CREATED,
        source: `https://platform.enterprise-hms.com/organizations/properties/${propertyId}`,
        subject: propertyId,
        propertyId,
        data: {
          propertyId,
          countryId,
          code: 'PROP-TYO-001',
          name: 'Tokyo Grandeur Palace',
          status: 'ACTIVE',
          timeZone: 'Asia/Tokyo',
          currency: 'JPY',
        },
      });

      expect(event.type).toBe('com.enterprise_hms.organization.property_created.v1');
      expect(event.propertyid).toBe(propertyId);
      expect(event.data.timeZone).toBe('Asia/Tokyo');
      expect(event.data.currency).toBe('JPY');
    });
  });

  describe('Time Zone Validation Rule', () => {
    function isValidIanaTimeZone(timeZone: string): boolean {
      try {
        Intl.DateTimeFormat(undefined, { timeZone });
        return true;
      } catch {
        return false;
      }
    }

    it('should accept recognized IANA time zones', () => {
      expect(isValidIanaTimeZone('Asia/Tokyo')).toBe(true);
      expect(isValidIanaTimeZone('America/New_York')).toBe(true);
      expect(isValidIanaTimeZone('Europe/London')).toBe(true);
      expect(isValidIanaTimeZone('UTC')).toBe(true);
    });

    it('should reject invalid or misspelled time zones', () => {
      expect(isValidIanaTimeZone('Asia/FakeCity')).toBe(false);
      expect(isValidIanaTimeZone('Mars/Olympus_Mons')).toBe(false);
      expect(isValidIanaTimeZone('')).toBe(false);
    });
  });
});
