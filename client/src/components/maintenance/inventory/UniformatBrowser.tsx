import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, Search, Building, Clock, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';

interface UniformatCode {
  code: string;
  level: number;
  parentCode?: string;
  nameFr: string;
  nameEn: string;
  descriptionFr?: string;
  descriptionEn?: string;
  typicalLifespan?: number;
  category: string;
  synonymsEn?: string[];
  synonymsFr?: string[];
}

interface UniformatBrowserProps {
  onCodeSelect: (code: UniformatCode) => void;
  selectedCode?: string;
  showDescription?: boolean;
  showLifespan?: boolean;
  compact?: boolean;
  className?: string;
  language?: 'fr' | 'en';
}

interface TreeNode extends UniformatCode {
  children: TreeNode[];
  isExpanded: boolean;
  isVisible: boolean;
}

/**
 * UniformatBrowser component for browsing the UNIFORMAT II catalog
 * Provides hierarchical tree view with search and filtering capabilities
 */
export function UniformatBrowser({
  onCodeSelect,
  selectedCode,
  showDescription = true,
  showLifespan = true,
  compact = false,
  className,
  language = 'en',
}: UniformatBrowserProps) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showFavorites, setShowFavorites] = useState(false);

  // Fetch UNIFORMAT codes
  const {
    data: uniformatResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/maintenance/uniformat'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/maintenance/uniformat');
      return await response.json();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  const uniformatCodes: UniformatCode[] = uniformatResponse?.data || [];

  // Common/favorite codes for quick access
  const favoritesCodes = useMemo(() => [
    'A1010', 'A2010', 'B1010', 'B2010', 'B3010', 'C1010', 'C3010',
    'D2010', 'D3010', 'D5010', 'B2020', 'C1020', 'D2020', 'D3020'
  ], []);

  // Get unique categories and levels
  const categories = useMemo(() => {
    const cats = new Set(uniformatCodes.map(code => code.category));
    return Array.from(cats).sort();
  }, [uniformatCodes]);

  const levels = useMemo(() => {
    const lvls = new Set(uniformatCodes.map(code => code.level));
    return Array.from(lvls).sort((a, b) => a - b);
  }, [uniformatCodes]);

  // Build tree structure
  const treeData = useMemo(() => {
    if (!uniformatCodes.length) return [];

    // Helper to check if a code matches search criteria
    const matchesSearch = (code: UniformatCode, search: string): boolean => {
      return code.code.toLowerCase().includes(search) ||
        code.nameEn.toLowerCase().includes(search) ||
        code.nameFr.toLowerCase().includes(search) ||
        (code.descriptionEn && code.descriptionEn.toLowerCase().includes(search)) ||
        (code.descriptionFr && code.descriptionFr.toLowerCase().includes(search)) ||
        (code.synonymsEn && code.synonymsEn.some(syn => syn.toLowerCase().includes(search))) ||
        (code.synonymsFr && code.synonymsFr.some(syn => syn.toLowerCase().includes(search)));
    };

    // Helper to get all parent codes for a given code
    const getParentCodes = (code: UniformatCode): string[] => {
      const parents: string[] = [];
      let currentParent = code.parentCode;
      while (currentParent) {
        parents.push(currentParent);
        const parentCode = uniformatCodes.find(c => c.code === currentParent);
        currentParent = parentCode?.parentCode;
      }
      return parents;
    };

    // Filter codes based on search and filters
    let matchingCodes = uniformatCodes;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const directMatches = uniformatCodes.filter(code => matchesSearch(code, search));
      
      // Collect all parent codes needed to display the hierarchy
      const parentCodesNeeded = new Set<string>();
      directMatches.forEach(code => {
        getParentCodes(code).forEach(pc => parentCodesNeeded.add(pc));
      });
      
      // Include both direct matches and their parents
      const matchingCodeSet = new Set(directMatches.map(c => c.code));
      matchingCodes = uniformatCodes.filter(code => 
        matchingCodeSet.has(code.code) || parentCodesNeeded.has(code.code)
      );
    }

    if (levelFilter !== 'all') {
      matchingCodes = matchingCodes.filter(code => code.level === parseInt(levelFilter));
    }

    if (categoryFilter !== 'all') {
      matchingCodes = matchingCodes.filter(code => code.category === categoryFilter);
    }

    if (showFavorites) {
      matchingCodes = matchingCodes.filter(code => favoritesCodes.includes(code.code));
    }

    // Create tree structure
    const nodeMap = new Map<string, TreeNode>();
    
    // Initialize all nodes
    matchingCodes.forEach(code => {
      nodeMap.set(code.code, {
        ...code,
        children: [],
        isExpanded: expandedNodes.has(code.code),
        isVisible: true,
      });
    });

    // Build parent-child relationships
    const rootNodes: TreeNode[] = [];
    
    matchingCodes.forEach(code => {
      const node = nodeMap.get(code.code);
      if (!node) return;

      if (code.parentCode && nodeMap.has(code.parentCode)) {
        const parent = nodeMap.get(code.parentCode);
        parent?.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    // Sort nodes by code
    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.code.localeCompare(b.code));
      nodes.forEach(node => sortNodes(node.children));
    };

    sortNodes(rootNodes);
    return rootNodes;
  }, [uniformatCodes, searchTerm, levelFilter, categoryFilter, showFavorites, favoritesCodes, expandedNodes]);

  // Toggle node expansion
  const toggleNode = useCallback((code: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  }, []);

  // Auto-expand to show selected code
  useEffect(() => {
    if (selectedCode && uniformatCodes.length > 0) {
      const selectedCodeData = uniformatCodes.find(code => code.code === selectedCode);
      if (selectedCodeData) {
        const pathToRoot: string[] = [];
        let currentCode = selectedCodeData.parentCode;
        
        while (currentCode) {
          pathToRoot.push(currentCode);
          const parentCode = uniformatCodes.find(code => code.code === currentCode);
          currentCode = parentCode?.parentCode;
        }

        setExpandedNodes(prev => new Set([...prev, ...pathToRoot]));
      }
    }
  }, [selectedCode, uniformatCodes]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setLevelFilter('all');
    setCategoryFilter('all');
    setShowFavorites(false);
  }, []);

  // Render tree node
  const renderNode = useCallback((node: TreeNode, depth: number = 0) => {
    const hasChildren = node.children.length > 0;
    const isSelected = selectedCode === node.code;
    const isExpanded = expandedNodes.has(node.code);
    const displayName = language === 'fr' ? node.nameFr : node.nameEn;
    const description = language === 'fr' ? node.descriptionFr : node.descriptionEn;

    return (
      <div key={node.code} className="w-full" data-testid={`uniformat-node-${node.code}`}>
        <div
          className={cn(
            'flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
            'hover:bg-muted/50',
            isSelected && 'bg-primary/10 border border-primary/20',
            depth > 0 && 'ml-4'
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => onCodeSelect(node)}
        >
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(node.code);
                }}
                data-testid={`expand-${node.code}`}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            )}

            <Badge 
              variant={isSelected ? 'default' : 'outline'} 
              className={cn(
                'text-xs font-mono flex-shrink-0',
                isSelected && 'bg-primary text-primary-foreground'
              )}
            >
              {node.code}
            </Badge>

            <div className="min-w-0 flex-1">
              <div className={cn(
                'text-sm font-medium truncate',
                isSelected && 'text-primary'
              )}>
                {displayName}
              </div>
              
              {showDescription && description && !compact && (
                <div className="text-xs text-muted-foreground truncate">
                  {description}
                </div>
              )}
              
              {showLifespan && node.typicalLifespan && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {node.typicalLifespan} {t('ubYearsSuffix')}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {t('ubLevelLabel')} {node.level}
            </Badge>
            
            {favoritesCodes.includes(node.code) && (
              <Badge variant="outline" className="text-xs text-orange-600">
                {t('ubCommonBadge')}
              </Badge>
            )}
          </div>
        </div>

        {/* Render children when expanded */}
        {hasChildren && isExpanded && (
          <div className="ml-2">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }, [selectedCode, expandedNodes, language, showDescription, showLifespan, compact, onCodeSelect, toggleNode, favoritesCodes]);

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('ubFailedToLoad')}</h3>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : t('ubLoadErrorDesc')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)} data-testid="uniformat-browser">
      <CardHeader className={cn('space-y-4', compact && 'pb-4')}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn('text-lg', compact && 'text-base')}>
            {t('ubCatalogTitle')}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button
              variant={showFavorites ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFavorites(!showFavorites)}
              data-testid="favorites-toggle"
            >
              {t('ubCommonButton')}
            </Button>
            
            {(searchTerm || levelFilter !== 'all' || categoryFilter !== 'all' || showFavorites) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                data-testid="clear-filters"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={t('ubSearchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="uniformat-search"
            />
          </div>

          {!compact && (
            <div className="grid grid-cols-2 gap-2">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger data-testid="level-filter">
                  <SelectValue placeholder={t('ubAllLevelsPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('ubAllLevelsItem')}</SelectItem>
                  {levels.map(level => (
                    <SelectItem key={level} value={level.toString()}>
                      {t('ubLevelLabel')} {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="category-filter">
                  <SelectValue placeholder={t('ubAllCategoriesPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('ubAllCategoriesItem')}</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Active filters indicator */}
          {(searchTerm || levelFilter !== 'all' || categoryFilter !== 'all' || showFavorites) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-3 w-3" />
              <span>
                {t('ubFilteredResultsPrefix')} {treeData.reduce((count, node) => {
                  const countNode = (n: TreeNode): number => {
                    return 1 + n.children.reduce((sum, child) => sum + countNode(child), 0);
                  };
                  return count + countNode(node);
                }, 0)} {t('ubFilteredResultsSuffix')}
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className={cn('w-full', compact ? 'h-64' : 'h-96')}>
          <div className="p-4 space-y-1">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-2 p-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            ) : treeData.length > 0 ? (
              <div className="space-y-1" data-testid="uniformat-tree">
                {treeData.map(node => renderNode(node))}
              </div>
            ) : (
              <div className="text-center py-8" data-testid="no-results">
                <Building className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchTerm || levelFilter !== 'all' || categoryFilter !== 'all' || showFavorites
                    ? t('ubNoMatchingCodes')
                    : t('ubNoCodesAvailable')
                  }
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export type { UniformatBrowserProps, UniformatCode };