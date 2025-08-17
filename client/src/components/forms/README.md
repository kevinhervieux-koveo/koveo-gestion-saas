# Forms Directory

## Overview

This directory contains all form components for the Koveo Gestion application. Forms are centralized here for consistency, reusability, and maintainability across the entire application.

## Available Forms

### FeatureForm (`feature-form.tsx`)
**Purpose**: Create and manage feature requests for the product roadmap

**Key Features**:
- Comprehensive feature planning with business objectives
- AI-powered development prompt generation
- Integration with roadmap system
- Draft saving and auto-recovery
- Multi-tab interface for detailed planning

**Usage**:
```typescript
import { FeatureForm } from '@/components/forms/FeatureForm';

<FeatureForm
  feature={existingFeature} // Optional for editing
  open={isDialogOpen}
  onOpenChange={setIsDialogOpen}
/>
```

**Props**:
- `feature?: Feature` - Existing feature data for editing
- `open: boolean` - Dialog visibility state
- `onOpenChange: (open: boolean) => void` - Dialog state handler

### OrganizationForm (`organization-form.tsx`)
**Purpose**: Create and edit organization records with Quebec compliance

**Key Features**:
- Quebec-specific validation (postal codes, provinces)
- Multi-organization type support (syndicate, coop, management company)
- Comprehensive contact information management
- Registration number tracking

**Usage**:
```typescript
import { OrganizationForm } from '@/components/forms/OrganizationForm';

<OrganizationForm
  open={isDialogOpen}
  onOpenChange={setIsDialogOpen}
/>
```

### UserForm (`user-form.tsx`)
**Purpose**: User creation and profile management

**Key Features**:
- Role-based access control integration
- Quebec compliance for personal data
- Email validation and formatting
- Password complexity requirements

### InvitationForm (`invitation-form.tsx`)
**Purpose**: Send user invitations with role assignments

**Key Features**:
- Role selection with proper permissions
- Organization assignment
- Email validation and formatting
- Expiration date management

## Form Architecture

### Common Patterns

All forms in this directory follow these consistent patterns:

#### 1. Schema Validation
```typescript
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const formSchema = z.object({
  field1: z.string().min(1, 'Field is required'),
  field2: z.string().email('Invalid email'),
  // ... other fields
});

type FormData = z.infer<typeof formSchema>;
```

#### 2. Form Hook Setup
```typescript
import { useForm } from 'react-hook-form';

const form = useForm<FormData>({
  resolver: zodResolver(formSchema),
  defaultValues: {
    field1: '',
    field2: '',
    // ... defaults
  },
});
```

#### 3. Mutation Handling
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

const mutation = useMutation({
  mutationFn: async (data: FormData) => {
    const response = await apiRequest('POST', '/api/endpoint', data);
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/related-data'] });
    toast({ title: 'Success', description: 'Operation completed' });
    onOpenChange(false);
  },
  onError: (error) => {
    toast({ 
      title: 'Error', 
      description: error.message,
      variant: 'destructive' 
    });
  },
});
```

#### 4. Quebec Compliance
- Canadian postal code validation: `/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/`
- Province defaults to 'QC' (Quebec)
- Bilingual field labels and error messages
- WCAG 2.1 AA accessibility compliance

#### 5. Error Handling
- Form validation errors displayed inline
- Server errors shown via toast notifications
- Loading states during submission
- Disabled controls during async operations

## Form Components Structure

### Standard Form Layout
```typescript
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>{formTitle}</DialogTitle>
    </DialogHeader>
    
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Form fields */}
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  </DialogContent>
</Dialog>
```

### Field Components
```typescript
<FormField
  control={form.control}
  name="fieldName"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Field Label</FormLabel>
      <FormControl>
        <Input {...field} placeholder="Enter value..." />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

## Development Guidelines

### Adding New Forms

1. **Create the form component** in this directory
2. **Follow naming convention**: `EntityForm.tsx` (PascalCase)
3. **Add to index exports** for clean imports
4. **Document props and usage** with JSDoc
5. **Include validation schema** with Zod
6. **Implement error handling** and loading states
7. **Add unit tests** in `tests/unit/forms/`

### Quebec Compliance Checklist

- [ ] Support both French and English labels
- [ ] Use Canadian date formats (YYYY-MM-DD)
- [ ] Validate Canadian postal codes
- [ ] Default province to Quebec (QC)
- [ ] Include proper ARIA labels
- [ ] Test with screen readers
- [ ] Follow Law 25 privacy guidelines

### Performance Optimization

- Use `React.memo` for expensive form fields
- Implement proper debouncing for search inputs
- Lazy load complex validation logic
- Cache API responses where appropriate
- Optimize bundle size with dynamic imports

## Testing Strategy

### Unit Tests
- Form validation with various inputs
- Error handling scenarios
- Success path testing
- Accessibility compliance

### Integration Tests
- API integration with form submission
- State management and cache updates
- User interaction flows
- Error recovery scenarios

### Example Test Structure
```typescript
describe('FeatureForm', () => {
  it('should validate required fields', () => {
    // Test validation logic
  });
  
  it('should submit valid data', async () => {
    // Test successful submission
  });
  
  it('should handle server errors', async () => {
    // Test error scenarios
  });
});
```

## Maintenance

### Regular Tasks
- Update validation schemas when API changes
- Review and update error messages
- Ensure accessibility compliance
- Update documentation and examples
- Monitor form completion rates and optimize UX

### Version Updates
- Keep React Hook Form updated
- Update Zod schemas for new validation features
- Review and update UI components
- Test compatibility with new browser versions