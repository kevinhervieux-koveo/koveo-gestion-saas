import { StandardCard } from '@/components/common/StandardCard';
import { Eye, Edit2, CheckCircle, XCircle, Building2, Home, User, Clock, FileText } from 'lucide-react';
import { sanitizeDescription } from '@/utils/sanitize';

// Common demand interface
/**
 *
 */
export interface Demand {
  id: string;
  type: 'maintenance' | 'complaint' | 'information' | 'other';
  description: string;
  status:
    | 'draft'
    | 'submitted'
    | 'under_review'
    | 'approved'
    | 'rejected'
    | 'in_progress'
    | 'completed'
    | 'cancelled';
  submitterId: string;
  buildingId: string;
  residenceId?: string;
  assignationBuildingId?: string;
  assignationResidenceId?: string;
  createdAt: string;
  updatedAt: string;
  reviewNotes?: string;
  submitter?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  residence?: {
    id: string;
    unitNumber: string;
    buildingId: string;
  };
  building?: {
    id: string;
    name: string;
    address: string;
  };
}

// Common interfaces
/**
 *
 */
export interface Building {
  id: string;
  name: string;
  address?: string;
}

/**
 *
 */
export interface Residence {
  id: string;
  name: string;
  buildingId: string;
  unitNumber?: string;
}

// Status color mapping
export const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-800',
} as const;

// Type labels
export const TYPE_LABELS = {
  maintenance: 'Maintenance',
  complaint: 'Complaint',
  information: 'Information',
  other: 'Other',
} as const;

// Status labels
export const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
} as const;

// Card actions configuration
/**
 *
 */
interface DemandCardActions {
  onView?: (demand: Demand) => void;
  onEdit?: (demand: Demand) => void;
  onApprove?: (demand: Demand) => void;
  onReject?: (demand: Demand) => void;
  onClick?: (demand: Demand) => void;
  showQuickActions?: boolean; // Show approve/reject for submitted demands
}

/**
 *
 */
interface DemandCardProps {
  demand: Demand;
  buildings?: Building[];
  residences?: Residence[];
  actions?: DemandCardActions;
  userRole?: 'manager' | 'resident';
}

/**
 * Unified DemandCard component for displaying demand information
 * Supports different user roles and customizable actions.
 * Now uses StandardCard as its base for consistency across the application
 * @param root0
 * @param root0.demand
 * @param root0.buildings
 * @param root0.residences
 * @param root0.actions
 * @param root0.userRole
 * @param root0.compact
 */
export function DemandCard({
  demand,
  buildings = [],
  residences = [],
  actions = {},
  userRole = 'resident',
  compact = false,
}: DemandCardProps & { compact?: boolean }) {
  const building = buildings.find((b) => b.id === demand.buildingId);
  const residence = residences.find((r) => r.id === demand.residenceId);

  // Get demand type icon
  const getDemandIcon = () => {
    switch (demand.type) {
      case 'maintenance':
        return <FileText className="w-5 h-5 text-orange-500" />;
      case 'complaint':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'information':
        return <FileText className="w-5 h-5 text-blue-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  // Get status badge variant
  const getStatusVariant = (status: typeof demand.status) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'default' as const;
      case 'rejected':
      case 'cancelled':
        return 'destructive' as const;
      case 'under_review':
      case 'in_progress':
        return 'outline' as const;
      default:
        return 'secondary' as const;
    }
  };

  // Build badges array for StandardCard - hide in compact mode
  const badges = !compact ? [
    {
      text: TYPE_LABELS[demand.type],
      variant: 'outline' as const
    },
    {
      text: STATUS_LABELS[demand.status],
      variant: getStatusVariant(demand.status),
      className: STATUS_COLORS[demand.status]
    }
  ] : [];

  // Build actions array for StandardCard
  const actionButtons = (userRole === 'manager' || actions.onView || actions.onEdit) ? [
    actions.onView && {
      icon: <Eye className="w-4 h-4" />,
      label: 'View demand',
      onClick: () => actions.onView!(demand),
      variant: 'ghost' as const,
      testId: `button-view-${demand.id}`
    },
    actions.showQuickActions && demand.status === 'submitted' && actions.onApprove && {
      icon: <CheckCircle className="w-4 h-4" />,
      label: 'Approve demand',
      onClick: () => actions.onApprove!(demand),
      variant: 'ghost' as const,
      className: 'text-green-600 hover:text-green-700',
      testId: `button-approve-${demand.id}`
    },
    actions.showQuickActions && demand.status === 'submitted' && actions.onReject && {
      icon: <XCircle className="w-4 h-4" />,
      label: 'Reject demand',
      onClick: () => actions.onReject!(demand),
      variant: 'ghost' as const,
      className: 'text-red-600 hover:text-red-700',
      testId: `button-reject-${demand.id}`
    },
    actions.onEdit && {
      icon: <Edit2 className="w-4 h-4" />,
      label: 'Edit demand',
      onClick: () => actions.onEdit!(demand),
      variant: 'ghost' as const,
      testId: `button-edit-${demand.id}`
    }
  ].filter(Boolean) : [];

  // Build metadata array for StandardCard
  // In compact mode: only show building and date
  // In normal mode: show submitter (if manager), building, residence, date
  const metadata = compact ? [
    {
      icon: <Building2 className="w-3 h-3" />,
      value: building?.name || 'Unknown Building'
    },
    {
      icon: <Clock className="w-3 h-3" />,
      value: new Date(demand.createdAt).toLocaleDateString()
    }
  ] : [
    userRole === 'manager' && {
      icon: <User className="w-3 h-3" />,
      value: demand.submitter 
        ? `${demand.submitter.firstName} ${demand.submitter.lastName}`
        : 'Utilisateur supprimé'
    },
    {
      icon: <Building2 className="w-3 h-3" />,
      value: building?.name || 'Unknown Building'
    },
    residence && {
      icon: <Home className="w-3 h-3" />,
      value: residence.name
    },
    {
      icon: <Clock className="w-3 h-3" />,
      value: new Date(demand.createdAt).toLocaleDateString()
    }
  ].filter(Boolean);

  // Format description (truncate for title)
  const formatTitle = () => {
    const sanitized = sanitizeDescription(demand.description);
    if (sanitized.length > 100) {
      return sanitized.substring(0, 100) + '...';
    }
    return sanitized;
  };

  return (
    <StandardCard
      title={formatTitle()}
      icon={getDemandIcon()}
      badges={badges}
      actions={actionButtons}
      metadata={metadata}
      onClick={actions.onClick ? () => actions.onClick!(demand) : undefined}
      spacing={compact ? 'compact' : 'normal'}
      testId={`demand-card-${demand.id}`}
    />
  );
}

export default DemandCard;
