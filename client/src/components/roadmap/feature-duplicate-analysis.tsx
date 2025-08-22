import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Copy } from 'lucide-react';
import type { Feature } from '@shared/schema';

/**
 * Duplicate analysis result for a feature.
 */
export interface DuplicateInfo {
  isDuplicate: boolean;
  duplicateCount: number;
  duplicateFeatures: Feature[];
  similarityType: 'exact' | 'similar' | 'none';
}

/**
 * Props for duplicate analysis component.
 */
interface FeatureDuplicateAnalysisProps {
  features: Feature[];
}

/**
 * Hook for analyzing feature duplicates and similarities.
 * @param features
 */
/**
 * UseFeatureDuplicateAnalysis function.
 * @param features
 * @returns Function result.
 */
export function useFeatureDuplicateAnalysis(features: Feature[]) {
  const duplicateAnalysis = useMemo(() => {
    if (!features.length) {
      return new Map<string, DuplicateInfo>();
    }
    
    const analysis = new Map<string, DuplicateInfo>();
    
    features.forEach((feature: Feature, _index: number) => {
      const duplicates: Feature[] = [];
      let exactMatch = false;
      
      // Compare with all other features
      features.forEach((otherFeature: Feature, otherIndex: number) => {
        if (index === otherIndex) {
          return;
        }
        
        const nameMatch = feature.name.toLowerCase().trim() === otherFeature.name.toLowerCase().trim();
        const descMatch = feature.description?.toLowerCase().trim() === otherFeature.description?.toLowerCase().trim();
        
        // Check for exact duplicates (same name OR same description)
        if (nameMatch || (descMatch && feature.description && otherFeature.description)) {
          duplicates.push(otherFeature);
          exactMatch = true;
        }
        // Check for similar features (containing similar keywords)
        else {
          const featureWords = feature.name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
          const otherWords = otherFeature.name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
          
          const commonWords = featureWords.filter((word: string) => otherWords.includes(word));
          
          // If more than 50% of significant words match, consider it similar
          if (featureWords.length > 0 && commonWords.length / featureWords.length > 0.5) {
            duplicates.push(otherFeature);
          }
        }
      });
      
      analysis.set(feature.id, {
        isDuplicate: duplicates.length > 0,
        duplicateCount: duplicates.length,
        duplicateFeatures: duplicates,
        similarityType: exactMatch ? 'exact' : duplicates.length > 0 ? 'similar' : 'none'
      });
    });
    
    return analysis;
  }, [features]);

  const duplicateStats = useMemo(() => {
    const exactDuplicates = Array.from(duplicateAnalysis.values()).filter(d => d.similarityType === 'exact');
    const similarFeatures = Array.from(duplicateAnalysis.values()).filter(d => d.similarityType === 'similar');
    
    return {
      totalExact: exactDuplicates.length,
      totalSimilar: similarFeatures.length,
      totalWithDuplicates: Array.from(duplicateAnalysis.values()).filter(d => d.isDuplicate).length
    };
  }, [duplicateAnalysis]);

  return { duplicateAnalysis, duplicateStats };
}

/**
 * Gets duplicate badge for a feature.
 * @param featureId
 * @param duplicateAnalysis
 */
/**
 * GetDuplicateBadge function.
 * @param featureId
 * @param duplicateAnalysis
 * @returns Function result.
 */
export function getDuplicateBadge(featureId: string, duplicateAnalysis: Map<string, DuplicateInfo> | undefined) {
  if (!duplicateAnalysis) {
    return null;
  }
  const dupInfo = duplicateAnalysis.get(featureId);
  if (!dupInfo || !dupInfo.isDuplicate) {
    return null;
  }
  
  if (dupInfo.similarityType === 'exact') {
    return (
      <Badge className='bg-red-100 text-red-800 hover:bg-red-100 ml-2 flex items-center gap-1'>
        <AlertTriangle className='h-3 w-3' />
        Exact Duplicate ({dupInfo.duplicateCount})
      </Badge>
    );
  } else {
    return (
      <Badge className='bg-orange-100 text-orange-800 hover:bg-orange-100 ml-2 flex items-center gap-1'>
        <Copy className='h-3 w-3' />
        Similar ({dupInfo.duplicateCount})
      </Badge>
    );
  }
}

/**
 * Gets duplicate note text for a feature.
 * @param featureId
 * @param duplicateAnalysis
 */
/**
 * GetDuplicateNote function.
 * @param featureId
 * @param duplicateAnalysis
 * @returns Function result.
 */
export function getDuplicateNote(featureId: string, duplicateAnalysis: Map<string, DuplicateInfo> | undefined) {
  if (!duplicateAnalysis) {
    return null;
  }
  const dupInfo = duplicateAnalysis.get(featureId);
  if (!dupInfo || !dupInfo.isDuplicate) {
    return null;
  }
  
  const duplicateNames = dupInfo.duplicateFeatures.map(f => f.name).join(', ');
  
  if (dupInfo.similarityType === 'exact') {
    return `⚠️ This feature has ${dupInfo.duplicateCount} exact ${dupInfo.duplicateCount === 1 ? 'duplicate' : 'duplicates'}: ${duplicateNames}`;
  } else {
    return `📋 This feature is similar to ${dupInfo.duplicateCount} other ${dupInfo.duplicateCount === 1 ? 'feature' : 'features'}: ${duplicateNames}`;
  }
}