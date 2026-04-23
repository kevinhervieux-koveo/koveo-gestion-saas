import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Sparkles, Tag as TagIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

export type DocumentTag = {
  id: string;
  name: string;
  description: string | null;
  scope: 'building' | 'residence' | 'any';
  importance: 'obligatoire' | 'nice_to_have' | 'extra';
  suggestedProfessionals: string[];
  isSystem: boolean;
  organizationId: string | null;
};

interface TagPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
  scope?: 'building' | 'residence';
  placeholder?: string;
  disabled?: boolean;
  suggestedTagIds?: string[];
}

export function TagPicker({
  value,
  onChange,
  scope,
  placeholder = 'Select tags',
  disabled,
  suggestedTagIds = [],
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery<{ tags: DocumentTag[] }>({
    queryKey: ['/api/document-tags'],
  });

  const allTags = data?.tags ?? [];

  const filteredTags = useMemo(() => {
    const base = scope ? allTags.filter((t) => t.scope === scope || t.scope === 'any') : allTags;
    if (suggestedTagIds.length === 0) return base;
    const suggestedSet = new Set(suggestedTagIds);
    return [...base].sort((a, b) => {
      const sa = suggestedSet.has(a.id) ? 0 : 1;
      const sb = suggestedSet.has(b.id) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return 0;
    });
  }, [allTags, scope, suggestedTagIds]);

  const suggestedSet = useMemo(() => new Set(suggestedTagIds), [suggestedTagIds]);

  const selectedTags = allTags.filter((t) => value.includes(t.id));

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  const unappliedSuggestions = suggestedTagIds.filter((id) => !value.includes(id));
  const applySuggestions = () => {
    if (unappliedSuggestions.length === 0) return;
    const merged = Array.from(new Set([...value, ...unappliedSuggestions]));
    onChange(merged);
  };

  return (
    <div className="space-y-2">
      {suggestedTagIds.length > 0 && unappliedSuggestions.length > 0 && (
        <button
          type="button"
          onClick={applySuggestions}
          disabled={disabled}
          data-testid="button-apply-suggested-tags"
          className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:underline disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" />
          Appliquer les {unappliedSuggestions.length} suggestion{unappliedSuggestions.length > 1 ? 's' : ''}
        </button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
            data-testid="button-tag-picker"
            type="button"
          >
            <span className="flex items-center gap-2 truncate">
              <TagIcon className="h-4 w-4" />
              {selectedTags.length > 0
                ? `${selectedTags.length} ${selectedTags.length === 1 ? 'étiquette' : 'étiquettes'}`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Rechercher une étiquette…" />
            <CommandList>
              <CommandEmpty>{isLoading ? 'Chargement…' : 'Aucune étiquette.'}</CommandEmpty>
              <CommandGroup>
                {filteredTags.map((tag) => {
                  const checked = value.includes(tag.id);
                  const suggested = suggestedSet.has(tag.id);
                  return (
                    <CommandItem
                      key={tag.id}
                      onSelect={() => toggle(tag.id)}
                      data-testid={`option-tag-${tag.id}`}
                      className={cn(suggested && 'bg-amber-50 dark:bg-amber-950/20')}
                    >
                      <Check className={cn('mr-2 h-4 w-4', checked ? 'opacity-100' : 'opacity-0')} />
                      <div className="flex flex-col flex-1">
                        <span className="text-sm flex items-center gap-1">
                          {tag.name}
                          {suggested && (
                            <Sparkles
                              className="h-3 w-3 text-amber-500"
                              data-testid={`icon-suggested-${tag.id}`}
                            />
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {tag.scope} · {tag.importance}
                          {tag.isSystem ? ' · Koveo' : ''}
                          {suggested ? ' · Suggéré' : ''}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((t) => (
            <Badge key={t.id} variant="secondary" className="gap-1" data-testid={`chip-tag-${t.id}`}>
              {t.name}
              <button
                type="button"
                onClick={() => toggle(t.id)}
                className="ml-1 hover:text-destructive"
                aria-label={`Remove ${t.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface TagChipsProps {
  tags: Pick<DocumentTag, 'id' | 'name' | 'importance'>[];
  className?: string;
}

export function TagChips({ tags, className }: TagChipsProps) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {tags.map((t) => (
        <Badge
          key={t.id}
          variant={t.importance === 'obligatoire' ? 'default' : 'secondary'}
          className="text-xs"
          data-testid={`badge-tag-${t.id}`}
        >
          {t.name}
        </Badge>
      ))}
    </div>
  );
}
