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
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    ariaLabel: 'Status: Ready for guest occupancy',
  },
  OCCUPIED: {
    code: 'OCCUPIED',
    label: 'Occupied',
    icon: '●',
    color: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    ariaLabel: 'Status: Currently occupied by in-house guest',
  },
  VACANT: {
    code: 'VACANT',
    label: 'Vacant',
    icon: '○',
    color: '#94A3B8',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: 'rgba(148, 163, 184, 0.35)',
    ariaLabel: 'Status: Vacant unassigned',
  },
  DIRTY: {
    code: 'DIRTY',
    label: 'Dirty',
    icon: '✕',
    color: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    ariaLabel: 'Status: Dirty, requires housekeeping service',
  },
  CLEANING: {
    code: 'CLEANING',
    label: 'Cleaning',
    icon: '⟳',
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    ariaLabel: 'Status: Housekeeping cleaning in progress',
  },
  INSPECTION: {
    code: 'INSPECTION',
    label: 'Inspection',
    icon: '🔍',
    color: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderColor: 'rgba(139, 92, 246, 0.35)',
    ariaLabel: 'Status: Awaiting supervisor quality inspection',
  },
  MAINTENANCE: {
    code: 'MAINTENANCE',
    label: 'Maintenance',
    icon: '⚙',
    color: '#F97316',
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderColor: 'rgba(249, 115, 22, 0.35)',
    ariaLabel: 'Status: Engineering maintenance active',
  },
  OUT_OF_ORDER: {
    code: 'OUT_OF_ORDER',
    label: 'Out of Order',
    icon: '⛔',
    color: '#DC2626',
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderColor: 'rgba(220, 38, 38, 0.35)',
    ariaLabel: 'Status: Out of order, not available for sale',
  },
  PENDING: {
    code: 'PENDING',
    label: 'Pending',
    icon: '⏳',
    color: '#EAB308',
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    borderColor: 'rgba(234, 179, 8, 0.35)',
    ariaLabel: 'Status: Pending approval or verification',
  },
  COMPLETED: {
    code: 'COMPLETED',
    label: 'Completed',
    icon: '✓',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    ariaLabel: 'Status: Successfully completed',
  },
  CANCELLED: {
    code: 'CANCELLED',
    label: 'Cancelled',
    icon: '⊘',
    color: '#64748B',
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    borderColor: 'rgba(100, 116, 139, 0.35)',
    ariaLabel: 'Status: Cancelled or voided',
  },
  WARNING: {
    code: 'WARNING',
    label: 'Warning',
    icon: '⚠',
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    ariaLabel: 'Status: Operational warning requires attention',
  },
  CRITICAL: {
    code: 'CRITICAL',
    label: 'Critical',
    icon: '🚨',
    color: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
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
