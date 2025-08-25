import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Edit2, CheckCircle, XCircle, Building2, Home, User, Clock } from 'lucide-react';

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
  };
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
 * @param root0
 * @param root0.demand
 * @param root0.buildings
 * @param root0.residences
 * @param root0.actions
 * @param root0.userRole
 */
export function DemandCard({
  demand,
  buildings = [],
  residences = [],
  actions = {},
  userRole = 'resident',
}: DemandCardProps) {
  const building = buildings.find((b) => b.id === demand.buildingId);
  const residence = residences.find((r) => r.id === demand.residenceId);

  const handleCardClick = () => {
    if (actions.onClick) {
      actions.onClick(demand);
    }
  };

  const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <Card
      className={`transition-shadow ${actions.onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
      onClick={actions.onClick ? handleCardClick : undefined}
      data-testid={`demand-card-${demand.id}`}
    >
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Badge variant='outline' data-testid={`demand-type-${demand.id}`}>
              {TYPE_LABELS[demand.type]}
            </Badge>
            <Badge
              className={STATUS_COLORS[demand.status]}
              data-testid={`demand-status-${demand.id}`}
            >
              {STATUS_LABELS[demand.status]}
            </Badge>
          </div>

          {/* Action buttons - only show for manager role or when explicitly provided */}
          {(userRole === 'manager' || actions.onView || actions.onEdit) && (
            <div className='flex items-center gap-1'>
              {actions.onView && (
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={(e) => handleButtonClick(e, () => actions.onView!(demand))}
                  data-testid={`button-view-${demand.id}`}
                >
                  <Eye className='h-4 w-4' />
                </Button>
              )}

              {/* Quick actions for submitted demands */}
              {actions.showQuickActions && demand.status === 'submitted' && (
                <>
                  {actions.onApprove && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(e) => handleButtonClick(e, () => actions.onApprove!(demand))}
                      className='text-green-600 hover:text-green-700'
                      data-testid={`button-approve-${demand.id}`}
                    >
                      <CheckCircle className='h-4 w-4' />
                    </Button>
                  )}
                  {actions.onReject && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(e) => handleButtonClick(e, () => actions.onReject!(demand))}
                      className='text-red-600 hover:text-red-700'
                      data-testid={`button-reject-${demand.id}`}
                    >
                      <XCircle className='h-4 w-4' />
                    </Button>
                  )}
                </>
              )}

              {actions.onEdit && (
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={(e) => handleButtonClick(e, () => actions.onEdit!(demand))}
                  data-testid={`button-edit-${demand.id}`}
                >
                  <Edit2 className='h-4 w-4' />
                </Button>
              )}
            </div>
          )}
        </div>

        <CardTitle
          className='text-base line-clamp-2'
          data-testid={`demand-description-${demand.id}`}
        >
          {demand.description.substring(0, 100)}
          {demand.description.length > 100 && '...'}
        </CardTitle>
      </CardHeader>

      <CardContent className='pt-0'>
        <div className='text-sm text-muted-foreground space-y-1'>
          {/* Show submitter info for managers */}
          {userRole === 'manager' && demand.submitter && (
            <div className='flex items-center gap-1'>
              <User className='h-3 w-3' />
              <span data-testid={`demand-submitter-${demand.id}`}>
                {`${demand.submitter.firstName} ${demand.submitter.lastName}`}
              </span>
            </div>
          )}

          <div className='flex items-center gap-1'>
            <Building2 className='h-3 w-3' />
            <span data-testid={`demand-building-${demand.id}`}>
              {building?.name || 'Unknown Building'}
            </span>
          </div>

          {residence && (
            <div className='flex items-center gap-1'>
              <Home className='h-3 w-3' />
              <span data-testid={`demand-residence-${demand.id}`}>{residence.name}</span>
            </div>
          )}

          <div className='flex items-center gap-1'>
            <Clock className='h-3 w-3' />
            <span data-testid={`demand-date-${demand.id}`}>
              {new Date(demand.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DemandCard;
