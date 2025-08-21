import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FeatureCard } from './feature-card';
import type { Feature, ActionableItem } from '@shared/schema';
import type { DuplicateInfo } from './feature-duplicate-analysis';

/**
 * Section interface for roadmap organization.
 */
export interface Section {
  title: string;
  icon: any;
  description: string;
  features: Feature[];
}

/**
 * Props for RoadmapSection component.
 */
interface RoadmapSectionProps {
  section: Section;
  isExpanded: boolean;
  expandedFeatures: string[];
  actionableItems: Record<string, ActionableItem[]>;
  duplicateAnalysis: Map<string, DuplicateInfo>;
  searchTerm: string;
  onToggleSection: () => void;
  onToggleFeature: (featureId: string) => void;
  onFeatureClick: (feature: Feature) => void;
  onToggleActionableItem: (item: ActionableItem) => void;
  onFetchActionableItems: (featureId: string) => void;
  onCopyPrompt: (prompt: string) => void;
  onUpdateStatus: (featureId: string, status: string) => void;
  onToggleStrategic: (featureId: string, isStrategic: boolean) => void;
}

/**
 * Component for displaying a roadmap section with its features.
 * @param root0
 * @param root0.section
 * @param root0.isExpanded
 * @param root0.expandedFeatures
 * @param root0.actionableItems
 * @param root0.duplicateAnalysis
 * @param root0.searchTerm
 * @param root0.onToggleSection
 * @param root0.onToggleFeature
 * @param root0.onFeatureClick
 * @param root0.onToggleActionableItem
 * @param root0.onFetchActionableItems
 * @param root0.onCopyPrompt
 * @param root0.onUpdateStatus
 * @param root0.onToggleStrategic
 */
/**
 * RoadmapSection function.
 * @param root0
 * @param root0.section
 * @param root0.isExpanded
 * @param root0.expandedFeatures
 * @param root0.actionableItems
 * @param root0.duplicateAnalysis
 * @param root0.searchTerm
 * @param root0.onToggleSection
 * @param root0.onToggleFeature
 * @param root0.onFeatureClick
 * @param root0.onToggleActionableItem
 * @param root0.onFetchActionableItems
 * @param root0.onCopyPrompt
 * @param root0.onUpdateStatus
 * @param root0.onToggleStrategic
 * @returns Function result.
 */
export function RoadmapSection({
  section,
  isExpanded,
  expandedFeatures,
  actionableItems,
  duplicateAnalysis,
  searchTerm,
  onToggleSection,
  onToggleFeature,
  onFeatureClick,
  onToggleActionableItem,
  onFetchActionableItems,
  onCopyPrompt,
  onUpdateStatus,
  onToggleStrategic,
}: RoadmapSectionProps) {
  // Filter features based on search term
  const filteredFeatures = section.features.filter(feature =>
    feature.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    feature.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Don't render section if no features match search
  if (searchTerm && filteredFeatures.length === 0) {
    return null;
  }

  const IconComponent = section.icon;

  return (
    <Card className='mb-4'>
      <CardHeader
        className='cursor-pointer hover:bg-gray-50 transition-colors'
        onClick={onToggleSection}
      >
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <IconComponent className='w-5 h-5' />
            <div>
              <CardTitle className='text-lg'>
                {section.title} ({filteredFeatures.length})
              </CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </div>
          </div>
          {isExpanded ? (
            <ChevronDown className='w-5 h-5' />
          ) : (
            <ChevronRight className='w-5 h-5' />
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className='pt-0'>
          {filteredFeatures.length === 0 ? (
            <p className='text-gray-500 italic'>No features in this category yet.</p>
          ) : (
            <div className='space-y-3'>
              {filteredFeatures.map((feature) => (
                <FeatureCard
                  key={feature.id}
                  feature={feature}
                  isExpanded={expandedFeatures.includes(feature.id)}
                  actionableItems={actionableItems[feature.id] || []}
                  duplicateAnalysis={duplicateAnalysis}
                  onToggleExpand={() => onToggleFeature(feature.id)}
                  onFeatureClick={() => onFeatureClick(feature)}
                  onToggleActionableItem={onToggleActionableItem}
                  onFetchActionableItems={onFetchActionableItems}
                  onCopyPrompt={onCopyPrompt}
                  onUpdateStatus={onUpdateStatus}
                  onToggleStrategic={onToggleStrategic}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}