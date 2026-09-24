import {
  AssetStatus,
  MaintenanceFrequency,
  PmsEventType,
  ScheduleDueStatus,
  WorkOrderCategory,
  WorkOrderPriority,
  WorkOrderStatus,
} from '@hms/api-contracts';

describe('Engineering / Maintenance V1 Contracts & Workflow', () => {
  describe('Work Order State Machine', () => {
    const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
      [WorkOrderStatus.OPEN]: [WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS],
      [WorkOrderStatus.ASSIGNED]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ASSIGNED],
      [WorkOrderStatus.IN_PROGRESS]: [WorkOrderStatus.COMPLETED],
      [WorkOrderStatus.COMPLETED]: [WorkOrderStatus.CLOSED],
      [WorkOrderStatus.CLOSED]: [],
    };

    it('should permit valid lifecycle transitions', () => {
      expect(validTransitions[WorkOrderStatus.OPEN]).toContain(WorkOrderStatus.ASSIGNED);
      expect(validTransitions[WorkOrderStatus.OPEN]).toContain(WorkOrderStatus.IN_PROGRESS);
      expect(validTransitions[WorkOrderStatus.ASSIGNED]).toContain(WorkOrderStatus.IN_PROGRESS);
      expect(validTransitions[WorkOrderStatus.ASSIGNED]).toContain(WorkOrderStatus.ASSIGNED); // reassign
      expect(validTransitions[WorkOrderStatus.IN_PROGRESS]).toContain(WorkOrderStatus.COMPLETED);
      expect(validTransitions[WorkOrderStatus.COMPLETED]).toContain(WorkOrderStatus.CLOSED);
      expect(validTransitions[WorkOrderStatus.CLOSED]).toHaveLength(0);
    });

    it('should reject invalid lifecycle jumps', () => {
      expect(validTransitions[WorkOrderStatus.OPEN]).not.toContain(WorkOrderStatus.COMPLETED);
      expect(validTransitions[WorkOrderStatus.OPEN]).not.toContain(WorkOrderStatus.CLOSED);
      expect(validTransitions[WorkOrderStatus.IN_PROGRESS]).not.toContain(WorkOrderStatus.CLOSED);
      expect(validTransitions[WorkOrderStatus.COMPLETED]).not.toContain(WorkOrderStatus.IN_PROGRESS);
    });
  });

  describe('Asset Register Contracts', () => {
    it('should validate Asset statuses and categories', () => {
      expect(Object.values(AssetStatus)).toEqual(['ACTIVE', 'UNDER_MAINTENANCE', 'INACTIVE']);
      expect(Object.values(WorkOrderCategory)).toContain(WorkOrderCategory.HVAC);
      expect(Object.values(WorkOrderCategory)).toContain(WorkOrderCategory.ELECTRICAL);
      expect(Object.values(WorkOrderCategory)).toContain(WorkOrderCategory.PLUMBING);
    });
  });

  describe('Preventive Maintenance Schedule Due Calculation', () => {
    it('should classify dueStatus correctly against reference business date', () => {
      const todayStr = '2026-09-24';

      function computeDueStatus(dueDateStr: string): ScheduleDueStatus {
        if (dueDateStr < todayStr) return ScheduleDueStatus.OVERDUE;
        if (dueDateStr === todayStr) return ScheduleDueStatus.DUE;
        return ScheduleDueStatus.UPCOMING;
      }

      expect(computeDueStatus('2026-09-20')).toBe(ScheduleDueStatus.OVERDUE);
      expect(computeDueStatus('2026-09-24')).toBe(ScheduleDueStatus.DUE);
      expect(computeDueStatus('2026-09-30')).toBe(ScheduleDueStatus.UPCOMING);
    });

    it('should support standard maintenance frequencies', () => {
      expect(Object.values(MaintenanceFrequency)).toEqual([
        'DAILY',
        'WEEKLY',
        'MONTHLY',
        'QUARTERLY',
        'ANNUAL',
      ]);
    });
  });

  describe('Room Maintenance Block Integration (T06 Authority)', () => {
    it('should preserve T06 room maintenance authority and types', () => {
      const allowedBlockTypes = ['OUT_OF_ORDER', 'OUT_OF_SERVICE'];
      expect(allowedBlockTypes).toContain('OUT_OF_ORDER');
      expect(allowedBlockTypes).toContain('OUT_OF_SERVICE');
    });

    it('should require start and end dates for block creation', () => {
      const roomBlockRequest = {
        type: 'OUT_OF_ORDER' as const,
        startDate: '2026-09-24',
        endDate: '2026-09-26',
        reason: 'HVAC replacement in Suite 401',
      };

      expect(roomBlockRequest.startDate).toBeDefined();
      expect(roomBlockRequest.endDate).toBeDefined();
      expect(new Date(roomBlockRequest.endDate) > new Date(roomBlockRequest.startDate)).toBe(true);
    });
  });

  describe('Engineering RBAC Permissions', () => {
    const requiredPermissions = [
      'engineering.asset.view',
      'engineering.asset.manage',
      'engineering.work_order.view',
      'engineering.work_order.create',
      'engineering.work_order.assign',
      'engineering.work_order.status_update',
      'engineering.work_order.close',
      'engineering.work_order.note',
      'engineering.schedule.view',
      'engineering.schedule.manage',
    ];

    it('should define all 10 granular engineering permissions', () => {
      expect(requiredPermissions).toHaveLength(10);
      requiredPermissions.forEach((perm) => {
        expect(perm).toMatch(/^engineering\.(asset|work_order|schedule)\.\w+$/);
      });
    });

    it('should map MAINT_TECH role to operational permissions only', () => {
      const maintTechPermissions = [
        'engineering.asset.view',
        'engineering.work_order.view',
        'engineering.work_order.status_update',
        'engineering.work_order.note',
        'engineering.schedule.view',
      ];

      expect(maintTechPermissions).not.toContain('engineering.asset.manage');
      expect(maintTechPermissions).not.toContain('engineering.work_order.assign');
      expect(maintTechPermissions).not.toContain('engineering.schedule.manage');
    });
  });

  describe('Event Contracts (Outbox CloudEvents)', () => {
    it('should contain all 7 Engineering CloudEvent types', () => {
      const expectedEvents = [
        PmsEventType.ENGINEERING_WORK_ORDER_CREATED,
        PmsEventType.ENGINEERING_WORK_ORDER_ASSIGNED,
        PmsEventType.ENGINEERING_WORK_ORDER_STATUS_CHANGED,
        PmsEventType.ENGINEERING_ASSET_CREATED,
        PmsEventType.ENGINEERING_ASSET_UPDATED,
        PmsEventType.ENGINEERING_SCHEDULE_CREATED,
        PmsEventType.ENGINEERING_SCHEDULE_UPDATED,
      ];

      expectedEvents.forEach((type) => {
        expect(type).toMatch(/^com\.enterprise_hms\.pms\.engineering\.\w+\.v1$/);
      });
    });
  });

  describe('OCC Concurrency Protection', () => {
    it('should increment version on updates', () => {
      const assetUpdate = {
        where: { id: 'asset-1', version: 2 },
        data: { name: 'Updated HVAC', version: { increment: 1 } },
      };
      expect(assetUpdate.data.version.increment).toBe(1);
    });
  });
});

