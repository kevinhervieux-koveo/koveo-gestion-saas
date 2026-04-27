import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { Tag as TagIcon, Plus, Pencil, Trash2, Lock, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Header } from '@/components/layout/header';
import type { DocumentTag } from '@/components/document-tags/TagPicker';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

// ─── Tag form schema ──────────────────────────────────────────────────────────

const baseTagFormSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  scope: z.enum(['building', 'residence', 'any']),
  importance: z.enum(['obligatoire', 'nice_to_have', 'extra']),
  suggestedProfessionals: z.string().optional(),
  isSystem: z.boolean().optional().default(false),
});

type TagFormValues = z.infer<typeof baseTagFormSchema>;

// ─── Link family types & schema ───────────────────────────────────────────────

interface LinkFamily {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  organizationId: string | null;
}

const familyFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  description: z.string().max(2000).optional().nullable(),
  isSystem: z.boolean().optional().default(false),
});

type FamilyFormValues = z.infer<typeof familyFormSchema>;

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminDocumentTags() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // ── Tags ──────────────────────────────────────────────────────────────────
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<DocumentTag | null>(null);

  const tagFormSchema = baseTagFormSchema.extend({
    name: z.string().min(1, t('dtNameRequired')).max(150),
  });

  const { data: tagData, isLoading: tagsLoading } = useQuery<{ tags: DocumentTag[] }>({
    queryKey: ['/api/document-tags'],
  });

  const tagForm = useForm<TagFormValues>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: '',
      description: '',
      scope: 'any',
      importance: 'nice_to_have',
      suggestedProfessionals: '',
      isSystem: false,
    },
  });

  const openCreateTag = () => {
    setEditingTag(null);
    tagForm.reset({
      name: '',
      description: '',
      scope: 'any',
      importance: 'nice_to_have',
      suggestedProfessionals: '',
      isSystem: false,
    });
    setTagDialogOpen(true);
  };

  const openEditTag = (tag: DocumentTag) => {
    setEditingTag(tag);
    tagForm.reset({
      name: tag.name,
      description: tag.description ?? '',
      scope: tag.scope,
      importance: tag.importance,
      suggestedProfessionals: (tag.suggestedProfessionals || []).join(', '),
      isSystem: false,
    });
    setTagDialogOpen(true);
  };

  const submitTag = async (values: TagFormValues) => {
    const payload: Record<string, unknown> = {
      name: values.name,
      description: values.description || null,
      scope: values.scope,
      importance: values.importance,
      suggestedProfessionals: (values.suggestedProfessionals || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (!editingTag && isAdmin) {
      payload.isSystem = values.isSystem ?? false;
    }
    try {
      if (editingTag) {
        await apiRequest('PATCH', `/api/document-tags/${editingTag.id}`, payload);
        toast({ title: t('dtToastUpdatedTitle') });
      } else {
        await apiRequest('POST', '/api/document-tags', payload);
        toast({ title: t('dtToastCreatedTitle') });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/document-tags'] });
      setTagDialogOpen(false);
    } catch (e: any) {
      toast({ title: t('dtToastErrorTitle'), description: e?.message, variant: 'destructive' });
    }
  };

  const removeTag = async (tag: DocumentTag) => {
    if (!window.confirm(t('dtDeleteConfirm', { name: tag.name }))) return;
    try {
      await apiRequest('DELETE', `/api/document-tags/${tag.id}`);
      toast({ title: t('dtToastDeletedTitle') });
      queryClient.invalidateQueries({ queryKey: ['/api/document-tags'] });
    } catch (e: any) {
      toast({ title: t('dtToastErrorTitle'), description: e?.message, variant: 'destructive' });
    }
  };

  const tags = tagData?.tags ?? [];
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

  // ── Link families ─────────────────────────────────────────────────────────
  const [familyDialogOpen, setFamilyDialogOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<LinkFamily | null>(null);

  const { data: familyData, isLoading: familiesLoading } = useQuery<{ families: LinkFamily[] }>({
    queryKey: ['/api/document-link-families'],
  });

  const familyForm = useForm<FamilyFormValues>({
    resolver: zodResolver(familyFormSchema),
    defaultValues: { name: '', description: '', isSystem: false },
  });

  const createFamilyMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest('POST', '/api/document-link-families', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-link-families'] });
      toast({ title: t('lfToastCreatedTitle') || 'Family created' });
      setFamilyDialogOpen(false);
    },
    onError: (e: any) => {
      toast({ title: t('lfToastErrorTitle') || 'Error', description: e?.message, variant: 'destructive' });
    },
  });

  const updateFamilyMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiRequest('PATCH', `/api/document-link-families/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-link-families'] });
      toast({ title: t('lfToastUpdatedTitle') || 'Family updated' });
      setFamilyDialogOpen(false);
    },
    onError: (e: any) => {
      toast({ title: t('lfToastErrorTitle') || 'Error', description: e?.message, variant: 'destructive' });
    },
  });

  const deleteFamilyMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/document-link-families/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-link-families'] });
      toast({ title: t('lfToastDeletedTitle') || 'Family deleted' });
    },
    onError: (e: any) => {
      toast({ title: t('lfToastErrorTitle') || 'Error', description: e?.message, variant: 'destructive' });
    },
  });

  const openCreateFamily = () => {
    setEditingFamily(null);
    familyForm.reset({ name: '', description: '', isSystem: false });
    setFamilyDialogOpen(true);
  };

  const openEditFamily = (family: LinkFamily) => {
    setEditingFamily(family);
    familyForm.reset({ name: family.name, description: family.description ?? '', isSystem: false });
    setFamilyDialogOpen(true);
  };

  const submitFamily = (values: FamilyFormValues) => {
    const payload: Record<string, unknown> = {
      name: values.name,
      description: values.description || null,
    };
    if (!editingFamily && isAdmin) {
      payload.isSystem = values.isSystem ?? false;
    }
    if (editingFamily) {
      updateFamilyMutation.mutate({ id: editingFamily.id, payload });
    } else {
      createFamilyMutation.mutate(payload);
    }
  };

  const removeFamily = (family: LinkFamily) => {
    const name = family.name;
    if (!window.confirm(t('lfDeleteConfirm', { name }) || `Delete family "${name}"?`)) return;
    deleteFamilyMutation.mutate(family.id);
  };

  const families = familyData?.families ?? [];
  const systemFamilies = families.filter((f) => f.isSystem);
  const customFamilies = families.filter((f) => !f.isSystem);

  return (
    <div className="flex-1">
      <Header title={t('dtPageTitle')} subtitle={t('dtPageSubtitle')} />
      <div className="container mx-auto px-4 py-6 space-y-10">

        {/* ── Document Tags ───────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TagIcon className="w-5 h-5" />
              <h2 className="text-xl font-semibold">{t('dtSectionHeading')}</h2>
            </div>
            <Button onClick={openCreateTag} data-testid="button-create-tag">
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
                isLoading={tagsLoading}
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
                isLoading={tagsLoading}
                onEdit={openEditTag}
                onDelete={removeTag}
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
        </section>

        {/* ── Link Families ───────────────────────────────────────────────── */}
        <section className="space-y-4" data-testid="section-link-families">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              <h2 className="text-xl font-semibold">
                {t('lfSectionHeading') || 'Link Families'}
              </h2>
            </div>
            <Button onClick={openCreateFamily} data-testid="button-create-family">
              <Plus className="w-4 h-4 mr-2" />
              {t('lfCreateButton') || 'New family'}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {t('lfSectionDescription') ||
              'Link families group documents into independent reading sequences. A document can belong to multiple families (e.g. Financial, AGA). In the viewer, ← / → navigates within the active family and ↑ / ↓ switches between families.'}
          </p>

          <Card>
            <CardHeader>
              <CardTitle>{t('lfSystemCardTitle') || 'Koveo families'}</CardTitle>
            </CardHeader>
            <CardContent>
              <FamiliesTable
                families={systemFamilies}
                isLoading={familiesLoading}
                readOnly={!isAdmin}
                onEdit={isAdmin ? openEditFamily : undefined}
                onDelete={isAdmin ? removeFamily : undefined}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('lfCustomCardTitle') || 'Custom families'}</CardTitle>
            </CardHeader>
            <CardContent>
              <FamiliesTable
                families={customFamilies}
                isLoading={familiesLoading}
                onEdit={openEditFamily}
                onDelete={removeFamily}
              />
            </CardContent>
          </Card>
        </section>

        {/* ── Tag create / edit dialog ────────────────────────────────────── */}
        <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingTag ? t('dtDialogEditTitle') : t('dtDialogNewTitle')}
              </DialogTitle>
              <DialogDescription>
                {t('tiquettesPourClasserVosDocumentsCcq')}
              </DialogDescription>
            </DialogHeader>
            <Form {...tagForm}>
              <form onSubmit={tagForm.handleSubmit(submitTag)} className="space-y-4">
                <FormField
                  control={tagForm.control}
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
                  control={tagForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dtDescriptionLabel')}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ''}
                          rows={4}
                          data-testid="input-tag-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={tagForm.control}
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
                    control={tagForm.control}
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
                            <SelectItem value="obligatoire">
                              {t('dtImportanceObligatoire')}
                            </SelectItem>
                            <SelectItem value="nice_to_have">
                              {t('dtImportanceNiceToHave')}
                            </SelectItem>
                            <SelectItem value="extra">{t('dtImportanceExtra')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={tagForm.control}
                  name="suggestedProfessionals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dtSuggestedProsLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder={t('dtSuggestedProsPlaceholder')}
                          data-testid="input-tag-pros"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {isAdmin && !editingTag && (
                  <FormField
                    control={tagForm.control}
                    name="isSystem"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-1 rounded-md border p-4">
                        <div className="flex items-center justify-between">
                          <FormLabel className="cursor-pointer" htmlFor="toggle-is-system">
                            {t('dtKoveoTagLabel')}
                          </FormLabel>
                          <FormControl>
                            <Switch
                              id="toggle-is-system"
                              checked={field.value ?? false}
                              onCheckedChange={field.onChange}
                              data-testid="toggle-is-system"
                            />
                          </FormControl>
                        </div>
                        <p className="text-xs text-muted-foreground">{t('dtKoveoTagHelper')}</p>
                      </FormItem>
                    )}
                  />
                )}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTagDialogOpen(false)}
                  >
                    {t('dtCancelButton')}
                  </Button>
                  <Button type="submit" data-testid="button-submit-tag">
                    {editingTag ? t('dtSaveButton') : t('dtCreateSubmitButton')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* ── Family create / edit dialog ─────────────────────────────────── */}
        <Dialog open={familyDialogOpen} onOpenChange={setFamilyDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingFamily
                  ? t('lfDialogEditTitle') || 'Edit link family'
                  : t('lfDialogNewTitle') || 'New link family'}
              </DialogTitle>
              <DialogDescription>
                {t('lfDialogDescription') ||
                  'A link family defines an independent sequence of documents that can be navigated with ← / →.'}
              </DialogDescription>
            </DialogHeader>
            <Form {...familyForm}>
              <form onSubmit={familyForm.handleSubmit(submitFamily)} className="space-y-4">
                <FormField
                  control={familyForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('lfNameLabel') || 'Name'}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-family-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={familyForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('lfDescriptionLabel') || 'Description'}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ''}
                          rows={3}
                          placeholder={t('lfDescriptionPlaceholder') || 'Optional description…'}
                          data-testid="input-family-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isAdmin && !editingFamily && (
                  <FormField
                    control={familyForm.control}
                    name="isSystem"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-1 rounded-md border p-4">
                        <div className="flex items-center justify-between">
                          <FormLabel className="cursor-pointer" htmlFor="toggle-family-is-system">
                            {t('lfKoveoFamilyLabel') || 'Koveo system family'}
                          </FormLabel>
                          <FormControl>
                            <Switch
                              id="toggle-family-is-system"
                              checked={field.value ?? false}
                              onCheckedChange={field.onChange}
                              data-testid="toggle-family-is-system"
                            />
                          </FormControl>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t('lfKoveoFamilyHelper') ||
                            'System families are seeded by Koveo and visible to all organizations.'}
                        </p>
                      </FormItem>
                    )}
                  />
                )}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFamilyDialogOpen(false)}
                  >
                    {t('dtCancelButton')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={createFamilyMutation.isPending || updateFamilyMutation.isPending}
                    data-testid="button-submit-family"
                  >
                    {editingFamily
                      ? t('dtSaveButton') || 'Save'
                      : t('lfCreateSubmitButton') || 'Create'}
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

// ─── Tags table ───────────────────────────────────────────────────────────────

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
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {tag.description}
                </p>
              )}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{scopeLabel(tag.scope)}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={tag.importance === 'obligatoire' ? 'default' : 'secondary'}>
                {importanceLabel(tag.importance)}
              </Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {(tag.suggestedProfessionals || []).join(', ') || '—'}
            </TableCell>
            <TableCell className="text-right">
              {!readOnly && onEdit && onDelete ? (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(tag)}
                    data-testid={`button-edit-tag-${tag.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(tag)}
                    data-testid={`button-delete-tag-${tag.id}`}
                  >
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

// ─── Families table ───────────────────────────────────────────────────────────

function FamiliesTable({
  families,
  isLoading,
  readOnly,
  onEdit,
  onDelete,
}: {
  families: LinkFamily[];
  isLoading: boolean;
  readOnly?: boolean;
  onEdit?: (f: LinkFamily) => void;
  onDelete?: (f: LinkFamily) => void;
}) {
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (families.length === 0) return <p className="text-muted-foreground">No families yet.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {families.map((f) => (
          <TableRow key={f.id} data-testid={`row-family-${f.id}`}>
            <TableCell>
              <div className="flex items-center gap-2">
                {f.isSystem && <Lock className="w-3 h-3 text-muted-foreground" />}
                <span className="font-medium">{f.name}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {f.description || '—'}
            </TableCell>
            <TableCell className="text-right">
              {!readOnly && onEdit && onDelete ? (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(f)}
                    data-testid={`button-edit-family-${f.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(f)}
                    data-testid={`button-delete-family-${f.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Read-only</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
