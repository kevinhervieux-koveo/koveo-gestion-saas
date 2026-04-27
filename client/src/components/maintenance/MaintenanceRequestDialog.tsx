import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wrench, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
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
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { handleApiError } from '@/lib/demo-error-handler';
import { MAINTENANCE_CATEGORY_VALUES } from '@shared/schemas/operations';
import type { Translations } from '@/lib/i18n';

const maintenanceRequestFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or fewer'),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(5000, 'Description must be 5000 characters or fewer'),
  category: z.enum(MAINTENANCE_CATEGORY_VALUES),
  priority: z.enum(['low', 'medium', 'high', 'urgent', 'emergency']).default('medium'),
});

type MaintenanceRequestFormData = z.infer<typeof maintenanceRequestFormSchema>;

const CATEGORY_KEYS: Record<string, keyof Translations> = {
  plumbing: 'plumbing',
  electrical: 'electrical',
  hvac: 'hvac',
  general: 'general',
  elevator: 'elevator',
  landscaping: 'landscaping',
  cleaning: 'cleaning',
  security: 'security',
  other: 'other',
};

interface MaintenanceRequestDialogProps {
  residenceId: string;
  unitNumber: string;
  trigger?: React.ReactNode;
}

export function MaintenanceRequestDialog({
  residenceId,
  unitNumber,
  trigger,
}: MaintenanceRequestDialogProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<MaintenanceRequestFormData>({
    resolver: zodResolver(maintenanceRequestFormSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'general',
      priority: 'medium',
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    form.reset();
    clearPhoto();
  };

  const submitMutation = useMutation({
    mutationFn: async (data: MaintenanceRequestFormData) => {
      return apiRequest('POST', '/api/maintenance-requests', {
        residenceId,
        ...data,
        images: photoPreview ? [photoPreview] : undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: t('maintenanceRequestSubmitted'),
        description: `${t('managerWillBeNotified')}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance-requests'] });
      resetForm();
      setOpen(false);
    },
    onError: (err) => handleApiError(err),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant='outline'
            size='sm'
            className='w-full justify-start'
            data-testid={`button-submit-maintenance-${residenceId}`}
          >
            <Wrench className='w-4 h-4 mr-2' />
            {t('submitMaintenanceRequest')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('submitMaintenanceRequest')}</DialogTitle>
          <DialogDescription>
            {t('managerWillBeNotified')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => submitMutation.mutate(data))}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('title')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder='e.g. Leaking kitchen faucet'
                      data-testid='input-maintenance-title'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='category'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('category')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid='select-maintenance-category'>
                        <SelectValue placeholder={t('selectCategory')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MAINTENANCE_CATEGORY_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(CATEGORY_KEYS[value])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='priority'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('priority')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid='select-maintenance-priority'>
                        <SelectValue placeholder={t('selectPriority')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='low'>{t('low')}</SelectItem>
                      <SelectItem value='medium'>{t('medium')}</SelectItem>
                      <SelectItem value='high'>{t('high')}</SelectItem>
                      <SelectItem value='urgent'>{t('urgent')}</SelectItem>
                      <SelectItem value='emergency'>{t('emergency')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={4}
                      placeholder='Describe the issue in detail'
                      data-testid='textarea-maintenance-description'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='space-y-2'>
              <FormLabel>{t('maintenancePhotoOptional')}</FormLabel>
              {photoPreview ? (
                <div className='relative inline-block'>
                  <img
                    src={photoPreview}
                    alt='Preview'
                    className='h-24 w-24 object-cover rounded-md border'
                  />
                  <button
                    type='button'
                    onClick={clearPhoto}
                    className='absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5'
                    aria-label='Remove photo'
                  >
                    <X className='w-3 h-3' />
                  </button>
                </div>
              ) : (
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => fileInputRef.current?.click()}
                  data-testid='button-attach-photo'
                >
                  <ImagePlus className='w-4 h-4 mr-2' />
                  {t('maintenancePhotoOptional')}
                </Button>
              )}
              <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                className='hidden'
                onChange={handlePhotoChange}
                data-testid='input-maintenance-photo'
              />
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setOpen(false)}
                disabled={submitMutation.isPending}
              >
                {t('cancel')}
              </Button>
              <Button
                type='submit'
                disabled={submitMutation.isPending}
                data-testid='button-confirm-submit-maintenance'
              >
                {submitMutation.isPending ? t('submitting') : t('submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
