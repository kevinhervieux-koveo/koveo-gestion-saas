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

const tagFormSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(150),
  description: z.string().max(2000).optional().nullable(),
  scope: z.enum(['building', 'residence', 'any']),
  importance: z.enum(['obligatoire', 'nice_to_have', 'extra']),
  suggestedProfessionals: z.string().optional(),
});

type TagFormValues = z.infer<typeof tagFormSchema>;

export default function ManagerDocumentTags() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTag | null>(null);

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
        toast({ title: 'Étiquette mise à jour' });
      } else {
        await apiRequest('POST', '/api/document-tags', payload);
        toast({ title: 'Étiquette créée' });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/document-tags'] });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    }
  };

  const remove = async (tag: DocumentTag) => {
    if (!window.confirm(`Supprimer l'étiquette « ${tag.name} » ?`)) return;
    try {
      await apiRequest('DELETE', `/api/document-tags/${tag.id}`);
      toast({ title: 'Étiquette supprimée' });
      queryClient.invalidateQueries({ queryKey: ['/api/document-tags'] });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    }
  };

  const tags = data?.tags ?? [];
  const systemTags = tags.filter((t) => t.isSystem);
  const customTags = tags.filter((t) => !t.isSystem);

  return (
    <div className="flex-1">
      <Header title="Étiquettes de documents" subtitle="Gestion des étiquettes Koveo et personnalisées" />
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TagIcon className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Étiquettes</h2>
          </div>
          <Button onClick={openCreate} data-testid="button-create-tag">
            <Plus className="w-4 h-4 mr-2" /> Nouvelle étiquette
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Étiquettes Koveo (système)</CardTitle>
          </CardHeader>
          <CardContent>
            <TagsTable tags={systemTags} isLoading={isLoading} readOnly />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Étiquettes personnalisées</CardTitle>
          </CardHeader>
          <CardContent>
            <TagsTable
              tags={customTags}
              isLoading={isLoading}
              onEdit={openEdit}
              onDelete={remove}
            />
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier' : 'Nouvelle'} étiquette</DialogTitle>
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
                      <FormLabel>Nom *</FormLabel>
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
                      <FormLabel>Description</FormLabel>
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
                        <FormLabel>Portée</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tag-scope">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="any">Toute</SelectItem>
                            <SelectItem value="building">Bâtiment</SelectItem>
                            <SelectItem value="residence">Résidence</SelectItem>
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
                        <FormLabel>Importance</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tag-importance">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="obligatoire">Obligatoire</SelectItem>
                            <SelectItem value="nice_to_have">Recommandée</SelectItem>
                            <SelectItem value="extra">Extra</SelectItem>
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
                      <FormLabel>Professionnels suggérés (séparés par des virgules)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} placeholder="Notaire, Avocat" data-testid="input-tag-pros" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" data-testid="button-submit-tag">
                    {editing ? 'Enregistrer' : 'Créer'}
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
}: {
  tags: DocumentTag[];
  isLoading: boolean;
  readOnly?: boolean;
  onEdit?: (t: DocumentTag) => void;
  onDelete?: (t: DocumentTag) => void;
}) {
  if (isLoading) return <p className="text-muted-foreground">Chargement…</p>;
  if (tags.length === 0) return <p className="text-muted-foreground">Aucune étiquette.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Portée</TableHead>
          <TableHead>Importance</TableHead>
          <TableHead>Professionnels</TableHead>
          <TableHead className="text-right">Actions</TableHead>
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
            <TableCell><Badge variant="outline">{tag.scope}</Badge></TableCell>
            <TableCell><Badge variant={tag.importance === 'obligatoire' ? 'default' : 'secondary'}>{tag.importance}</Badge></TableCell>
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
                <span className="text-xs text-muted-foreground">Lecture seule</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
