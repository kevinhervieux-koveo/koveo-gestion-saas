import { useEffect, useState } from 'react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tag as TagIcon, Plus, Pencil, Trash2, Lock, Link2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Header } from '@/components/layout/header';
import type { DocumentTag } from '@/components/document-tags/TagPicker';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { getSystemFamilyDisplay, makeFamilyNameComparator } from '@/lib/system-family-display';
import { dedupeLinkFamilies } from '@/lib/dedupe-link-families';

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
  /** Used as a tiebreaker by dedupeLinkFamilies — matches the backend canonical resolver. */
  createdAt?: string | Date | null;
}

const familyFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  description: z.string().max(2000).optional().nullable(),
  isSystem: z.boolean().optional().default(false),
  organizationId: z.string().nullable().optional(),
});

type FamilyFormValues = z.infer<typeof familyFormSchema>;

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminDocumentTags() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  // ── View toggle ───────────────────────────────────────────────────────────
  const VIEW_STORAGE_KEY = 'admin:document-tags:view';
  const [view, setView] = useState<'tags' | 'families'>(() => {
    if (typeof window === 'undefined') return 'tags';
    try {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
      return saved === 'families' ? 'families' : 'tags';
    } catch {
      return 'tags';
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // Ignore storage failures (e.g. private mode, quota).
    }
  }, [view]);

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
    if (!editingTag) {
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

  type PendingDelete =
    | { kind: 'tag'; id: string; name: string }
    | { kind: 'family'; id: string; name: string };

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const removeTag = (tag: DocumentTag) => {
    setPendingDelete({ kind: 'tag', id: tag.id, name: tag.name });
  };

  const performDeleteTag = async (id: string) => {
    try {
      await apiRequest('DELETE', `/api/document-tags/${id}`);
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
  const [familySearch, setFamilySearch] = useState('');

  const { data: familyData, isLoading: familiesLoading } = useQuery<{ families: LinkFamily[] }>({
    queryKey: ['/api/document-link-families'],
  });

  const { data: organizations = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/organizations'],
    enabled: isSuperAdmin,
  });

  const { data: myMemberOrgs = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/users/me/organizations'],
    enabled: isSuperAdmin,
  });

  const familyForm = useForm<FamilyFormValues>({
    resolver: zodResolver(familyFormSchema),
    defaultValues: { name: '', description: '', isSystem: false, organizationId: null },
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
      if (e?.status === 409) {
        familyForm.setError('name', { message: e?.message ?? 'A family with this name already exists.' });
      } else {
        toast({ title: t('lfToastErrorTitle') || 'Error', description: e?.message, variant: 'destructive' });
      }
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
      if (e?.status === 409) {
        familyForm.setError('name', { message: e?.message ?? 'A family with this name already exists.' });
      } else {
        toast({ title: t('lfToastErrorTitle') || 'Error', description: e?.message, variant: 'destructive' });
      }
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
    const defaultOrg = isSuperAdmin && myMemberOrgs.length > 0 ? myMemberOrgs[0].id : null;
    familyForm.reset({ name: '', description: '', isSystem: false, organizationId: defaultOrg });
    setFamilyDialogOpen(true);
  };

  const openEditFamily = (family: LinkFamily) => {
    setEditingFamily(family);
    familyForm.reset({ name: family.name, description: family.description ?? '', isSystem: false, organizationId: null });
    setFamilyDialogOpen(true);
  };

  const submitFamily = (values: FamilyFormValues) => {
    if (isSuperAdmin && !editingFamily && !values.isSystem && !values.organizationId) {
      familyForm.setError('organizationId', { message: 'Please select an organization' });
      return;
    }
    const payload: Record<string, unknown> = {
      name: values.name,
      description: values.description || null,
    };
    if (!editingFamily) {
      payload.isSystem = values.isSystem ?? false;
      if (isSuperAdmin && !values.isSystem && values.organizationId) {
        payload.organizationId = values.organizationId;
      }
    }
    if (editingFamily) {
      updateFamilyMutation.mutate({ id: editingFamily.id, payload });
    } else {
      createFamilyMutation.mutate(payload);
    }
  };

  const removeFamily = (family: LinkFamily) => {
    setPendingDelete({ kind: 'family', id: family.id, name: family.name });
  };

  const performDeleteFamily = (id: string) => {
    deleteFamilyMutation.mutate(id);
  };

  const confirmPendingDelete = async () => {
    if (!pendingDelete) return;
    const item = pendingDelete;
    setPendingDelete(null);
    if (item.kind === 'tag') {
      await performDeleteTag(item.id);
    } else {
      performDeleteFamily(item.id);
    }
  };

  // Task #1643: Strip non-canonical duplicates client-side as a safety net
  // even if the backend dedup pass misses any (e.g. partial startup backfill).
  const families = dedupeLinkFamilies(familyData?.families ?? []);

  const familyMatchesSearch = (f: LinkFamily): boolean => {
    const q = familySearch.trim().toLowerCase();
    if (!q) return true;
    const display = getSystemFamilyDisplay(f, t);
    return (
      f.name.toLowerCase().includes(q) ||
      display.name.toLowerCase().includes(q)
    );
  };

  const familyCmp = makeFamilyNameComparator(language, t);
  const systemFamilies = families.filter((f) => f.isSystem && familyMatchesSearch(f)).sort(familyCmp);
  const customFamilies = families.filter((f) => !f.isSystem && familyMatchesSearch(f)).sort(familyCmp);

  return (
    <div className="flex-1">
      <Header title={t('dtPageTitle')} subtitle={t('dtPageSubtitle')} />
      <div className="container mx-auto px-4 py-6 space-y-6">

        {/* ── View toggle ─────────────────────────────────────────────────── */}
        <Tabs
          value={view}
          onValueChange={(value) => setView(value as 'tags' | 'families')}
          data-testid="toggle-tags-families-view"
        >
          <TabsList>
            <TabsTrigger value="tags" data-testid="toggle-view-tags">
              {t('dtViewToggleTags') || 'Tags'}
            </TabsTrigger>
            <TabsTrigger value="families" data-testid="toggle-view-families">
              {t('dtViewToggleFamilies') || 'Link Families'}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ── Document Tags ───────────────────────────────────────────────── */}
        {view === 'tags' && (
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
                readOnly={!isSuperAdmin}
                onEdit={isSuperAdmin ? openEditTag : undefined}
                onDelete={isSuperAdmin ? removeTag : undefined}
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
        )}

        {/* ── Link Families ───────────────────────────────────────────────── */}
        {view === 'families' && (
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

          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t('lfSearchPlaceholder') || 'Search families…'}
              value={familySearch}
              onChange={(e) => setFamilySearch(e.target.value)}
              data-testid="input-family-search"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('lfSystemCardTitle') || 'Koveo families'}</CardTitle>
            </CardHeader>
            <CardContent>
              <FamiliesTable
                families={systemFamilies}
                isLoading={familiesLoading}
                readOnly={!isSuperAdmin}
                onEdit={isSuperAdmin ? openEditFamily : undefined}
                onDelete={isSuperAdmin ? removeFamily : undefined}
                loadingText={t('lfLoading')}
                emptyText={t('lfEmpty')}
                colName={t('lfColName')}
                colDescription={t('lfColDescription')}
                colActions={t('lfColActions')}
                readOnlyText={t('dtReadOnly')}
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
                loadingText={t('lfLoading')}
                emptyText={t('lfEmpty')}
                colName={t('lfColName')}
                colDescription={t('lfColDescription')}
                colActions={t('lfColActions')}
                readOnlyText={t('dtReadOnly')}
              />
            </CardContent>
          </Card>
        </section>
        )}

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
                {!editingTag && isSuperAdmin && (
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
                {!editingFamily && isSuperAdmin && (
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
                {!editingFamily && isSuperAdmin && !familyForm.watch('isSystem') && (
                  <FormField
                    control={familyForm.control}
                    name="organizationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('lfOrganizationLabel') || 'Organization'}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ''}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-family-organization">
                              <SelectValue placeholder={t('lfOrganizationPlaceholder') || 'Select an organization…'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {organizations.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
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

        {/* ── Delete confirmation dialog ──────────────────────────────────── */}
        <AlertDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
        >
          <AlertDialogContent data-testid="dialog-confirm-delete">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('delete')}</AlertDialogTitle>
              <AlertDialogDescription data-testid="text-confirm-delete-message">
                {pendingDelete
                  ? pendingDelete.kind === 'family'
                    ? t('lfDeleteConfirm', { name: pendingDelete.name }) ||
                      `Delete family "${pendingDelete.name}"?`
                    : t('dtDeleteConfirm', { name: pendingDelete.name })
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">
                {t('dtCancelButton')}
              </AlertDialogCancel>
              <AlertDialogAction
                className={cn(
                  buttonVariants({ variant: 'destructive' }),
                )}
                onClick={(e) => {
                  e.preventDefault();
                  void confirmPendingDelete();
                }}
                data-testid="button-confirm-delete"
              >
                {t('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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

export function FamiliesTable({
  families,
  isLoading,
  readOnly,
  onEdit,
  onDelete,
  loadingText,
  emptyText,
  colName,
  colDescription,
  colActions,
  readOnlyText,
}: {
  families: LinkFamily[];
  isLoading: boolean;
  readOnly?: boolean;
  onEdit?: (f: LinkFamily) => void;
  onDelete?: (f: LinkFamily) => void;
  loadingText: string;
  emptyText: string;
  colName: string;
  colDescription: string;
  colActions: string;
  readOnlyText?: string;
}) {
  const { t } = useLanguage();
  if (isLoading) return <p className="text-muted-foreground">{loadingText}</p>;
  if (families.length === 0) return <p className="text-muted-foreground">{emptyText}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{colName}</TableHead>
          <TableHead>{colDescription}</TableHead>
          <TableHead className="text-right">{colActions}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {families.map((f) => {
          const display = getSystemFamilyDisplay(f, t);
          return (
            <TableRow key={f.id} data-testid={`row-family-${f.id}`}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {f.isSystem && <Lock className="w-3 h-3 text-muted-foreground" />}
                  <span className="font-medium">{display.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {display.description || '—'}
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
                  <span className="text-xs text-muted-foreground">{readOnlyText ?? t('dtReadOnly')}</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
