import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Copy, ChevronDown, ChevronRight, ListTodo } from 'lucide-react';
import { getStatusIcon, getStatusBadge, getPriorityBadge } from './feature-status-badges';
import { getDuplicateBadge, getDuplicateNote } from './feature-duplicate-analysis';
import { ActionableItemsList } from './actionable-items-list';
import type { Feature, ActionableItem } from '@shared/schema';
import type { DuplicateInfo } from './feature-duplicate-analysis';

/**
 * Props for FeatureCard component.
 */
interface FeatureCardProps {
  feature: Feature;
  isExpanded: boolean;
  actionableItems: ActionableItem[];
  duplicateAnalysis: Map<string, DuplicateInfo>;
  onToggleExpand: () => void;
  onFeatureClick: () => void;
  onToggleActionableItem: (item: ActionableItem) => void;
  onFetchActionableItems: (featureId: string) => void;
  onCopyPrompt: (prompt: string) => void;
  onUpdateStatus: (featureId: string, status: string) => void;
  onToggleStrategic: (featureId: string, isStrategic: boolean) => void;
}

/**
 * Component for displaying a single feature card with its details.
 * @param root0
 * @param root0.feature
 * @param root0.isExpanded
 * @param root0.actionableItems
 * @param root0.duplicateAnalysis
 * @param root0.onToggleExpand
 * @param root0.onFeatureClick
 * @param root0.onToggleActionableItem
 * @param root0.onFetchActionableItems
 * @param root0.onCopyPrompt
 * @param root0.onUpdateStatus
 * @param root0.onToggleStrategic
 */
/**
 * FeatureCard function.
 * @param root0
 * @param root0.feature
 * @param root0.isExpanded
 * @param root0.actionableItems
 * @param root0.duplicateAnalysis
 * @param root0.onToggleExpand
 * @param root0.onFeatureClick
 * @param root0.onToggleActionableItem
 * @param root0.onFetchActionableItems
 * @param root0.onCopyPrompt
 * @param root0.onUpdateStatus
 * @param root0.onToggleStrategic
 * @returns Function result.
 */
export function FeatureCard({
  feature,
  isExpanded,
  actionableItems,
  duplicateAnalysis,
  onToggleExpand,
  onFeatureClick,
  onToggleActionableItem,
  onFetchActionableItems,
  onCopyPrompt,
  onUpdateStatus,
  onToggleStrategic,
}: FeatureCardProps) {
  const duplicateNote = getDuplicateNote(feature.id, duplicateAnalysis);

  const generateImplementationPrompt = () => {
    const context = `Feature: ${feature.name}
Description: ${feature.description || 'No description provided'}
Category: ${feature.category}
Priority: ${feature.priority || 'medium'}
Status: ${feature.status}

Business Objective: ${feature.businessObjective || 'Not specified'}
Target Users: ${feature.targetUsers || 'Not specified'}
Success Metrics: ${feature.successMetrics || 'Not specified'}
Technical Complexity: ${feature.technicalComplexity || 'Not specified'}
Dependencies: ${feature.dependencies || 'None specified'}
User Flow: ${feature.userFlow || 'Not specified'}

Actionable Items Count: ${actionableItems.length}`;

    return `Please implement this feature for Koveo Gestion (Quebec property management platform):

${context}

Implementation Requirements:
- Follow the existing TypeScript patterns in the codebase
- Use React 18 with shadcn/ui components and Tailwind CSS for frontend
- Use Express.js with Drizzle ORM for backend
- Ensure Quebec Law 25 compliance and French/English bilingual support
- Follow role-based access control patterns (admin, manager, tenant, resident)
- Use proper form validation with Zod schemas
- Implement proper error handling and user feedback

Please provide a complete implementation with both frontend and backend code.`;
  };

  return (
    <div className='border rounded-lg p-4 hover:shadow-md transition-shadow bg-white'>
      <div className='flex items-start justify-between'>
        <div className='flex-1'>
          <div className='flex items-center gap-2 mb-2'>
            <button
              onClick={onToggleExpand}
              className='p-1 hover:bg-gray-100 rounded transition-colors'
            >
              {isExpanded ? (
                <ChevronDown className='w-4 h-4' />
              ) : (
                <ChevronRight className='w-4 h-4' />
              )}
            </button>
            {getStatusIcon(feature.status)}
            <h3
              className='font-medium text-lg cursor-pointer hover:text-blue-600 transition-colors'
              onClick={onFeatureClick}
            >
              {feature.name}
            </h3>
            {getStatusBadge(feature.status)}
            {getPriorityBadge(feature.priority)}
            {getDuplicateBadge(feature.id, duplicateAnalysis)}
          </div>

          {duplicateNote && (
            <div className='mb-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800'>
              {duplicateNote}
            </div>
          )}

          <p className='text-gray-600 mb-3 leading-relaxed'>
            {feature.description || 'No description available.'}
          </p>

          {isExpanded && (
            <div className='space-y-4 mt-4'>
              {/* Feature Details */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
                {feature.businessObjective && (
                  <div>
                    <strong>Business Objective:</strong>
                    <p className='text-gray-600 mt-1'>{feature.businessObjective}</p>
                  </div>
                )}
                {feature.targetUsers && (
                  <div>
                    <strong>Target Users:</strong>
                    <p className='text-gray-600 mt-1'>{feature.targetUsers}</p>
                  </div>
                )}
                {feature.successMetrics && (
                  <div>
                    <strong>Success Metrics:</strong>
                    <p className='text-gray-600 mt-1'>{feature.successMetrics}</p>
                  </div>
                )}
                {feature.technicalComplexity && (
                  <div>
                    <strong>Technical Complexity:</strong>
                    <p className='text-gray-600 mt-1'>{feature.technicalComplexity}</p>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className='flex flex-wrap items-center gap-4 pt-4 border-t'>
                <div className='flex items-center gap-2'>
                  <Label htmlFor={`status-${feature.id}`}>Status:</Label>
                  <Select
                    value={feature.status}
                    onValueChange={(value) => onUpdateStatus(feature.id, value)}
                  >
                    <SelectTrigger id={`status-${feature.id}`} className='w-32'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='submitted'>Submitted</SelectItem>
                      <SelectItem value='planned'>Planned</SelectItem>
                      <SelectItem value='in-progress'>In Progress</SelectItem>
                      <SelectItem value='completed'>Completed</SelectItem>
                      <SelectItem value='cancelled'>Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className='flex items-center gap-2'>
                  <Switch
                    id={`strategic-${feature.id}`}
                    checked={feature.isStrategicPath || false}
                    onCheckedChange={(checked) => onToggleStrategic(feature.id, checked)}
                  />
                  <Label htmlFor={`strategic-${feature.id}`}>Strategic Path</Label>
                </div>

                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => onCopyPrompt(generateImplementationPrompt())}
                  className='flex items-center gap-1'
                >
                  <Copy className='w-3 h-3' />
                  Copy Prompt
                </Button>
              </div>

              {/* Actionable Items */}
              <div className='pt-4 border-t'>
                <div className='flex items-center gap-2 mb-2'>
                  <ListTodo className='w-4 h-4' />
                  <h4 className='font-medium'>Actionable Items ({actionableItems.length})</h4>
                </div>
                <ActionableItemsList
                  featureId={feature.id}
                  items={actionableItems}
                  onToggleStatus={onToggleActionableItem}
                  onFetchItems={onFetchActionableItems}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}