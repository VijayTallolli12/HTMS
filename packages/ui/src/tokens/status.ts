export interface StatusDefinition {
  readonly code: string;
  readonly label: string;
  readonly icon: string;
  readonly color: string;
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly ariaLabel: string;
}

/**
 * 13 Canonical Operational Status Tokens for Enterprise HMS.
 * Rule: Status must NEVER be communicated by color alone.
 * Always present: Icon + Label + Color.
 */
export const STATUS_TOKENS: Record<string, StatusDefinition> = {
  READY: {
    code: 'READY',
    label: 'Ready',
    icon: '✓',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    ariaLabel: 'Status: Ready for guest occupancy',
  },
  OCCUPIED: {
    code: 'OCCUPIED',
    label: 'Occupied',
    icon: '●',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    ariaLabel: 'Status: Currently occupied by in-house guest',
  },
  VACANT: {
    code: 'VACANT',
    label: 'Vacant',
    icon: '○',
    color: '#475569',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    ariaLabel: 'Status: Vacant unassigned',
  },
  DIRTY: {
    code: 'DIRTY',
    label: 'Dirty',
    icon: '✕',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    ariaLabel: 'Status: Dirty, requires housekeeping service',
  },
  CLEANING: {
    code: 'CLEANING',
    label: 'Cleaning',
    icon: '⟳',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    ariaLabel: 'Status: Housekeeping cleaning in progress',
  },
  INSPECTION: {
    code: 'INSPECTION',
    label: 'Inspection',
    icon: '🔍',
    color: '#7C3AED',
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
    ariaLabel: 'Status: Awaiting supervisor quality inspection',
  },
  MAINTENANCE: {
    code: 'MAINTENANCE',
    label: 'Maintenance',
    icon: '⚙',
    color: '#EA580C',
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    ariaLabel: 'Status: Engineering maintenance active',
  },
  OUT_OF_ORDER: {
    code: 'OUT_OF_ORDER',
    label: 'Out of Order',
    icon: '⛔',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    ariaLabel: 'Status: Out of order, not available for sale',
  },
  PENDING: {
    code: 'PENDING',
    label: 'Pending',
    icon: '⏳',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    ariaLabel: 'Status: Pending approval or verification',
  },
  COMPLETED: {
    code: 'COMPLETED',
    label: 'Completed',
    icon: '✓',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    ariaLabel: 'Status: Successfully completed',
  },
  CANCELLED: {
    code: 'CANCELLED',
    label: 'Cancelled',
    icon: '⊘',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    ariaLabel: 'Status: Cancelled or voided',
  },
  WARNING: {
    code: 'WARNING',
    label: 'Warning',
    icon: '⚠',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    ariaLabel: 'Status: Operational warning requires attention',
  },
  CRITICAL: {
    code: 'CRITICAL',
    label: 'Critical',
    icon: '🚨',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    ariaLabel: 'Status: Critical emergency exception',
  },
} as const;

export type CanonicalStatusCode =
  | 'READY'
  | 'OCCUPIED'
  | 'VACANT'
  | 'DIRTY'
  | 'CLEANING'
  | 'INSPECTION'
  | 'MAINTENANCE'
  | 'OUT_OF_ORDER'
  | 'PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'WARNING'
  | 'CRITICAL';
