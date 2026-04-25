import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tag as TagIcon, Plus, Pencil, Trash2, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Header } from '@/components/layout/header';
import type { DocumentTag } from '@/components/document-tags/TagPicker';
import { useLanguage } from '@/hooks/use-language';

const baseTagFormSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  scope: z.enum(['building', 'residence', 'any']),
  importance: z.enum(['obligatoire', 'nice_to_have', 'extra']),
  suggestedProfessionals: z.string().optional(),
});

type TagFormValues = z.infer<typeof baseTagFormSchema>;

export default function ManagerDocumentTags() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTag | null>(null);

  const tagFormSchema = baseTagFormSchema.extend({
    name: z.string().min(1, t('dtNameRequired')).max(150),
  });

  const { data, isLoading } = useQuery<{ tags: DocumentTag[] }>({
    queryKey: ['/api/document-tags'],
  });

  const form = useForm<TagFormValues>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: '',
      description: '',
      scope: 'any',
      importance: 'nice_to_have',
      suggestedProfessionals: '',
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      name: '',
      description: '',
      scope: 'any',
      importance: 'nice_to_have',
      suggestedProfessionals: '',
    });
    setOpen(true);
  };

  const openEdit = (tag: DocumentTag) => {
    setEditing(tag);
    form.reset({
      name: tag.name,
      description: tag.description ?? '',
      scope: tag.scope,
      importance: tag.importance,
      suggestedProfessionals: (tag.suggestedProfessionals || []).join(', '),
    });
    setOpen(true);
  };

  const submit = async (values: TagFormValues) => {
    const payload = {
      name: values.name,
      description: values.description || null,
      scope: values.scope,
      importance: values.importance,
      suggestedProfessionals: (values.suggestedProfessionals || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      if (editing) {
        await apiRequest('PATCH', `/api/document-tags/${editing.id}`, payload);
        toast({ title: t('dtToastUpdatedTitle') });
      } else {
        await apiRequest('POST', '/api/document-tags', payload);
        toast({ title: t('dtToastCreatedTitle') });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/document-tags'] });
      setOpen(false);
    } catch (e: any) {
      toast({ title: t('dtToastErrorTitle'), description: e?.message, variant: 'destructive' });
    }
  };

  const remove = async (tag: DocumentTag) => {
    if (!window.confirm(t('dtDeleteConfirm', { name: tag.name }))) return;
    try {
      await apiRequest('DELETE', `/api/document-tags/${tag.id}`);
      toast({ title: t('dtToastDeletedTitle') });
      queryClient.invalidateQueries({ queryKey: ['/api/document-tags'] });
    } catch (e: any) {
      toast({ title: t('dtToastErrorTitle'), description: e?.message, variant: 'destructive' });
    }
  };

  const tags = data?.tags ?? [];
  const systemTags = tags.filter((tag) => tag.isSystem);
  const customTags = tags.filter((tag) => !tag.isSystem);

  const scopeLabel = (scope: string) => {
    if (scope === 'any') return t('dtScopeAny');
    if (scope === 'building') return t('dtScopeBuilding');
    if (scope === 'residence') return t('dtScopeResidence');
    return scope;
  };

  const importanceLabel = (importance: string) => {
    if (importance === 'obligatoire') return t('dtImportanceObligatoire');
    if (importance === 'nice_to_have') return t('dtImportanceNiceToHave');
    if (importance === 'extra') return t('dtImportanceExtra');
    return importance;
  };

  return (
    <div className="flex-1">
      <Header title={t('dtPageTitle')} subtitle={t('dtPageSubtitle')} />
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TagIcon className="w-5 h-5" />
            <h2 className="text-xl font-semibold">{t('dtSectionHeading')}</h2>
          </div>
          <Button onClick={openCreate} data-testid="button-create-tag">
            <Plus className="w-4 h-4 mr-2" /> {t('dtCreateButton')}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('dtSystemCardTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <TagsTable
              tags={systemTags}
              isLoading={isLoading}
              readOnly
              scopeLabel={scopeLabel}
              importanceLabel={importanceLabel}
              loadingText={t('dtLoading')}
              emptyText={t('dtEmpty')}
              colName={t('dtColName')}
              colScope={t('dtColScope')}
              colImportance={t('dtColImportance')}
              colProfessionals={t('dtColProfessionals')}
              colActions={t('dtColActions')}
              readOnlyText={t('dtReadOnly')}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dtCustomCardTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <TagsTable
              tags={customTags}
              isLoading={isLoading}
              onEdit={openEdit}
              onDelete={remove}
              scopeLabel={scopeLabel}
              importanceLabel={importanceLabel}
              loadingText={t('dtLoading')}
              emptyText={t('dtEmpty')}
              colName={t('dtColName')}
              colScope={t('dtColScope')}
              colImportance={t('dtColImportance')}
              colProfessionals={t('dtColProfessionals')}
              colActions={t('dtColActions')}
              readOnlyText={t('dtReadOnly')}
            />
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? t('dtDialogEditTitle') : t('dtDialogNewTitle')}</DialogTitle>
              <DialogDescription>
                {t('tiquettesPourClasserVosDocumentsCcq')}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dtNameLabel')}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-tag-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dtDescriptionLabel')}</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value ?? ''} rows={4} data-testid="input-tag-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="scope"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('dtScopeLabel')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tag-scope">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="any">{t('dtScopeAny')}</SelectItem>
                            <SelectItem value="building">{t('dtScopeBuilding')}</SelectItem>
                            <SelectItem value="residence">{t('dtScopeResidence')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="importance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('dtImportanceLabel')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tag-importance">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="obligatoire">{t('dtImportanceObligatoire')}</SelectItem>
                            <SelectItem value="nice_to_have">{t('dtImportanceNiceToHave')}</SelectItem>
                            <SelectItem value="extra">{t('dtImportanceExtra')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="suggestedProfessionals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dtSuggestedProsLabel')}</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} placeholder={t('dtSuggestedProsPlaceholder')} data-testid="input-tag-pros" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    {t('dtCancelButton')}
                  </Button>
                  <Button type="submit" data-testid="button-submit-tag">
                    {editing ? t('dtSaveButton') : t('dtCreateSubmitButton')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function TagsTable({
  tags,
  isLoading,
  readOnly,
  onEdit,
  onDelete,
  scopeLabel,
  importanceLabel,
  loadingText,
  emptyText,
  colName,
  colScope,
  colImportance,
  colProfessionals,
  colActions,
  readOnlyText,
}: {
  tags: DocumentTag[];
  isLoading: boolean;
  readOnly?: boolean;
  onEdit?: (t: DocumentTag) => void;
  onDelete?: (t: DocumentTag) => void;
  scopeLabel: (scope: string) => string;
  importanceLabel: (importance: string) => string;
  loadingText: string;
  emptyText: string;
  colName: string;
  colScope: string;
  colImportance: string;
  colProfessionals: string;
  colActions: string;
  readOnlyText: string;
}) {
  if (isLoading) return <p className="text-muted-foreground">{loadingText}</p>;
  if (tags.length === 0) return <p className="text-muted-foreground">{emptyText}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{colName}</TableHead>
          <TableHead>{colScope}</TableHead>
          <TableHead>{colImportance}</TableHead>
          <TableHead>{colProfessionals}</TableHead>
          <TableHead className="text-right">{colActions}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tags.map((tag) => (
          <TableRow key={tag.id} data-testid={`row-tag-${tag.id}`}>
            <TableCell>
              <div className="flex items-center gap-2">
                {tag.isSystem && <Lock className="w-3 h-3 text-muted-foreground" />}
                <span className="font-medium">{tag.name}</span>
              </div>
              {tag.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{tag.description}</p>
              )}
            </TableCell>
            <TableCell><Badge variant="outline">{scopeLabel(tag.scope)}</Badge></TableCell>
            <TableCell><Badge variant={tag.importance === 'obligatoire' ? 'default' : 'secondary'}>{importanceLabel(tag.importance)}</Badge></TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {(tag.suggestedProfessionals || []).join(', ') || '—'}
            </TableCell>
            <TableCell className="text-right">
              {!readOnly && onEdit && onDelete ? (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(tag)} data-testid={`button-edit-tag-${tag.id}`}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(tag)} data-testid={`button-delete-tag-${tag.id}`}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">{readOnlyText}</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
