/**
 * @file Component Extraction Analysis Tests.
 * @description Tests to identify extractable components and generate reusable component suggestions.
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// Component pattern analysis types
/**
 *
 */
interface ComponentPattern {
  type: 'button' | 'form' | 'card' | 'modal' | 'table' | 'input';
  pattern: string;
  occurrences: number;
  files: string[];
  extractionPotential: 'high' | 'medium' | 'low';
  complexityScore: number;
}

/**
 *
 */
interface ExtractableComponent {
  name: string;
  description: string;
  props: string[];
  template: string;
  usage: string[];
  benefits: string[];
}

// Utility functions for component analysis
const analyzeComponentComplexity = (pattern: string): number => {
  let complexity = 0;
  
  // Add complexity for various features
  if (pattern.includes('useState')) {complexity += 2;}
  if (pattern.includes('useEffect')) {complexity += 2;}
  if (pattern.includes('onClick')) {complexity += 1;}
  if (pattern.includes('onChange')) {complexity += 1;}
  if (pattern.includes('className')) {complexity += 1;}
  if (pattern.includes('style=')) {complexity += 1;}
  if (pattern.includes('conditional')) {complexity += 2;}
  if (pattern.match(/\?\s*:/) || pattern.includes('&&')) {complexity += 1;} // Conditional rendering
  if (pattern.match(/map\(/)) {complexity += 1;} // List rendering
  
  return complexity;
};

const extractProps = (pattern: string): string[] => {
  const props = new Set<string>();
  
  // Extract prop names from JSX attributes
  const attrMatches = pattern.match(/\s(\w+)=/g);
  if (attrMatches) {
    attrMatches.forEach(match => {
      const propName = match.trim().replace('=', '');
      if (!['className', 'style', 'key', 'ref'].includes(propName)) {
        props.add(propName);
      }
    });
  }
  
  // Extract from destructured props
  const destructuredProps = pattern.match(/{\s*([^}]+)\s*}/);
  if (destructuredProps) {
    const propList = destructuredProps[1].split(',').map(p => p.trim().split(':')[0].trim());
    propList.forEach(prop => {
      if (prop && !['children'].includes(prop)) {
        props.add(prop);
      }
    });
  }
  
  return Array.from(props);
};

const generateComponentTemplate = (type: ComponentPattern['type'], props: string[]): ExtractableComponent => {
  const templates = {
    button: {
      name: 'StandardButton',
      description: 'Reusable button component with consistent styling and behavior',
      template: `interface StandardButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

const StandardButton: React.FC<StandardButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  children,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500'
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };
  
  return (
    <button
      className={\`\${baseClasses} \${variantClasses[variant]} \${sizeClasses[size]} \${disabled ? 'opacity-50 cursor-not-allowed' : ''} \${className}\`}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <span className="mr-2">⏳</span>}
      {children}
    </button>
  );
};`,
      usage: [
        '<StandardButton variant="primary" onClick={handleSubmit}>Submit</StandardButton>',
        '<StandardButton variant="danger" onClick={handleDelete}>Delete</StandardButton>',
        '<StandardButton variant="ghost" size="sm">Cancel</StandardButton>'
      ],
      benefits: [
        'Consistent button styling across the application',
        'Built-in loading and disabled states',
        'Reduced code duplication',
        'Easy to maintain and update styling'
      ]
    },
    
    form: {
      name: 'StandardForm',
      description: 'Reusable form wrapper with validation and error handling',
      template: `interface StandardFormProps {
  onSubmit: (data: any) => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  validationSchema?: any;
  initialValues?: Record<string, any>;
}

const StandardForm: React.FC<StandardFormProps> = ({
  onSubmit,
  children,
  className = '',
  validationSchema,
  initialValues = {}
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    
    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const data = Object.fromEntries(formData.entries());
      
      if (validationSchema) {
        const result = validationSchema.safeParse(data);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((error: any) => {
            fieldErrors[error.path[0]] = error.message;
          });
          setErrors(fieldErrors);
          return;
        }
      }
      
      await onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form 
      className={\`space-y-4 \${className}\`} 
      onSubmit={handleSubmit}
      noValidate
    >
      <FormErrorProvider errors={errors}>
        {children}
      </FormErrorProvider>
      {isSubmitting && (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      )}
    </form>
  );
};`,
      usage: [
        '<StandardForm onSubmit={handleUserSubmit} validationSchema={userSchema}>',
        '  <FormField name="email" type="email" label="Email" />',
        '  <FormField name="password" type="password" label="Password" />',
        '</StandardForm>'
      ],
      benefits: [
        'Centralized form validation logic',
        'Consistent error handling',
        'Built-in loading states',
        'Reduced boilerplate code'
      ]
    },
    
    card: {
      name: 'StandardCard',
      description: 'Flexible card component with header, content, and actions',
      template: `interface StandardCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  shadow?: boolean;
  border?: boolean;
}

const StandardCard: React.FC<StandardCardProps> = ({
  title,
  subtitle,
  children,
  actions,
  className = '',
  padding = 'md',
  shadow = true,
  border = true
}) => {
  const paddingClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };
  
  const baseClasses = \`
    bg-white rounded-lg
    \${shadow ? 'shadow-sm' : ''}
    \${border ? 'border border-gray-200' : ''}
    \${paddingClasses[padding]}
    \${className}
  \`.trim();
  
  return (
    <div className={baseClasses}>
      {(title || subtitle) && (
        <div className="mb-4 pb-2 border-b border-gray-100">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          )}
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          )}
        </div>
      )}
      
      <div className="flex-1">
        {children}
      </div>
      
      {actions && (
        <div className="mt-4 pt-2 border-t border-gray-100 flex gap-2 justify-end">
          {actions}
        </div>
      )}
    </div>
  );
};`,
      usage: [
        '<StandardCard title="User Profile" actions={<Button>Edit</Button>}>',
        '  <UserDetails user={user} />',
        '</StandardCard>',
        '<StandardCard shadow={false} border={false}>Simple content</StandardCard>'
      ],
      benefits: [
        'Consistent card styling across the app',
        'Flexible content and action areas',
        'Configurable spacing and styling',
        'Accessible structure'
      ]
    },
    
    input: {
      name: 'StandardInput',
      description: 'Form input with built-in validation and error display',
      template: `interface StandardInputProps {
  name: string;
  label?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  description?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  validation?: (value: string) => string | undefined;
}

const StandardInput: React.FC<StandardInputProps> = ({
  name,
  label,
  type = 'text',
  placeholder,
  required = false,
  disabled = false,
  className = '',
  description,
  value,
  defaultValue,
  onChange,
  onBlur,
  validation
}) => {
  const [error, setError] = useState<string>('');
  const [touched, setTouched] = useState(false);
  const inputId = \`input-\${name}\`;
  
  const handleBlur = () => {
    setTouched(true);
    if (validation && value) {
      const validationError = validation(value);
      setError(validationError || '');
    }
    onBlur?.();
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange?.(newValue);
    
    if (touched && validation) {
      const validationError = validation(newValue);
      setError(validationError || '');
    }
  };
  
  return (
    <div className={\`flex flex-col \${className}\`}>
      {label && (
        <label 
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <input
        id={inputId}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={\`
          px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:border-transparent
          \${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
          \${disabled ? 'bg-gray-50 text-gray-500' : 'bg-white'}
        \`}
      />
      
      {description && !error && (
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      )}
      
      {error && touched && (
        <p className="text-xs text-red-600 mt-1" role="alert">{error}</p>
      )}
    </div>
  );
};`,
      usage: [
        '<StandardInput name="email" label="Email Address" type="email" required />',
        '<StandardInput name="phone" label="Phone" type="tel" validation={validatePhone} />',
        '<StandardInput name="description" label="Description" description="Optional field" />'
      ],
      benefits: [
        'Consistent input styling and behavior',
        'Built-in validation and error display',
        'Accessibility features included',
        'Reduced form component complexity'
      ]
    },
    
    modal: {
      name: 'StandardModal',
      description: 'Accessible modal dialog with backdrop and keyboard handling',
      template: `interface StandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
}

const StandardModal: React.FC<StandardModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  actions,
  size = 'md',
  closeOnBackdrop = true,
  showCloseButton = true
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={closeOnBackdrop ? onClose : undefined}
        />
        
        {/* Modal */}
        <div className={\`relative bg-white rounded-lg shadow-xl w-full \${sizeClasses[size]} max-h-[90vh] flex flex-col\`}>
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              {title && (
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              )}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          
          {/* Content */}
          <div className="flex-1 p-4 overflow-y-auto">
            {children}
          </div>
          
          {/* Actions */}
          {actions && (
            <div className="flex gap-2 justify-end p-4 border-t border-gray-200">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};`,
      usage: [
        '<StandardModal isOpen={showModal} onClose={closeModal} title="Confirm Action">',
        '  <p>Are you sure you want to delete this item?</p>',
        '</StandardModal>',
        '<StandardModal isOpen={editMode} onClose={handleClose} size="lg" actions={<SaveButton />}>'
      ],
      benefits: [
        'Accessible modal implementation',
        'Consistent modal behavior across app',
        'Built-in keyboard and backdrop handling',
        'Flexible sizing and content options'
      ]
    },
    
    table: {
      name: 'StandardTable',
      description: 'Data table with sorting, pagination, and selection',
      template: `interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  width?: string;
}

interface StandardTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  sortable?: boolean;
  pagination?: {
    pageSize: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    totalItems: number;
  };
}

function StandardTable<T extends { id: string | number }>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No data available',
  selectable = false,
  onSelectionChange,
  sortable = false,
  pagination
}: StandardTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
  
  const handleSort = (column: keyof T) => {
    if (!sortable) return;
    
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  
  const sortedData = sortable && sortColumn 
    ? [...data].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        const modifier = sortDirection === 'asc' ? 1 : -1;
        return aVal < bVal ? -1 * modifier : aVal > bVal ? 1 * modifier : 0;
      })
    : data;
  
  const handleRowSelection = (id: string | number, selected: boolean) => {
    const newSelection = new Set(selectedRows);
    if (selected) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedRows(newSelection);
    onSelectionChange?.(data.filter(row => newSelection.has(row.id)));
  };
  
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            {selectable && (
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                <input type="checkbox" className="rounded" />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={\`px-3 py-3.5 text-left text-sm font-semibold text-gray-900 \${sortable && column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}\`}
                onClick={() => column.sortable && handleSort(column.key)}
                style={{ width: column.width }}
              >
                <div className="flex items-center gap-1">
                  {column.label}
                  {sortable && column.sortable && sortColumn === column.key && (
                    <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="px-3 py-8 text-center text-sm text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {selectable && (
                  <td className="px-3 py-4">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedRows.has(row.id)}
                      onChange={(e) => handleRowSelection(row.id, e.target.checked)}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={String(column.key)} className="px-3 py-4 text-sm text-gray-900">
                    {column.render
                      ? column.render(row[column.key], row)
                      : String(row[column.key])
                    }
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      
      {pagination && (
        <div className="bg-white px-4 py-3 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-700">
              Showing {((pagination.currentPage - 1) * pagination.pageSize) + 1} to{' '}
              {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)} of{' '}
              {pagination.totalItems} results
            </div>
            <div className="flex gap-2">
              <button
                disabled={pagination.currentPage === 1}
                onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={pagination.currentPage * pagination.pageSize >= pagination.totalItems}
                onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`,
      usage: [
        'const columns = [',
        '  { key: "name", label: "Name", sortable: true },',
        '  { key: "email", label: "Email", sortable: true },',
        '  { key: "role", label: "Role", render: (role) => <Badge>{role}</Badge> }',
        '];',
        '<StandardTable data={users} columns={columns} loading={isLoading} />'
      ],
      benefits: [
        'Feature-rich data table out of the box',
        'Built-in sorting and pagination',
        'Flexible column rendering',
        'Consistent table styling'
      ]
    }
  };
  
  const template = templates[type];
  return {
    ...template,
    props: props.length > 0 ? props : template.props || []
  } as ExtractableComponent;
};

describe('Component Extraction Analysis Tests', () => {
  const clientDir = './client/src';
  let sourceFiles: string[];

  beforeAll(() => {
    sourceFiles = [];
    
    const scanDirectory = (dir: string) => {
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          
          if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
            scanDirectory(fullPath);
          } else if (item.isFile() && (item.name.endsWith('.tsx') || item.name.endsWith('.ts'))) {
            sourceFiles.push(fullPath);
          }
        }
      } catch (error) {
        // Directory might not exist
      }
    };
    
    scanDirectory(clientDir);
  });

  describe('Button Component Analysis', () => {
    it('should identify extractable button patterns', () => {
      const buttonPatterns: ComponentPattern[] = [];
      
      sourceFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8').catch(() => '');
        
        // Find button patterns
        const buttonMatches = content.match(/<button[^>]*>.*?<\/button>/gs) || [];
        const buttonComponentMatches = content.match(/<Button[^>]*>.*?<\/Button>/gs) || [];
        
        [...buttonMatches, ...buttonComponentMatches].forEach(pattern => {
          const complexity = analyzeComponentComplexity(pattern);
          const props = extractProps(pattern);
          
          const existingPattern = buttonPatterns.find(p => p.pattern === pattern);
          if (existingPattern) {
            existingPattern.occurrences++;
            existingPattern.files.push(file);
          } else {
            buttonPatterns.push({
              type: 'button',
              pattern,
              occurrences: 1,
              files: [file],
              extractionPotential: complexity > 3 ? 'high' : complexity > 1 ? 'medium' : 'low',
              complexityScore: complexity
            });
          }
        });
      });
      
      const extractableButtons = buttonPatterns.filter(p => p.occurrences >= 2 || p.extractionPotential === 'high');
      
      console.log('\n=== BUTTON COMPONENT ANALYSIS ===\n');
      console.log(`Total button patterns found: ${buttonPatterns.length}`);
      console.log(`Extractable button patterns: ${extractableButtons.length}`);
      
      extractableButtons.forEach((pattern, index) => {
        console.log(`\n${index + 1}. Button Pattern (Complexity: ${pattern.complexityScore}, Potential: ${pattern.extractionPotential})`);
        console.log(`   Occurrences: ${pattern.occurrences}`);
        console.log(`   Files: ${pattern.files.length} files`);
        console.log(`   Pattern preview: ${pattern.pattern.substring(0, 100)}...`);
      });
      
      if (extractableButtons.length > 0) {
        const buttonComponent = generateComponentTemplate('button', []);
        console.log('\n=== SUGGESTED BUTTON COMPONENT ===\n');
        console.log(buttonComponent.template);
      }
      
      expect(buttonPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Form Component Analysis', () => {
    it('should identify extractable form patterns', () => {
      const formPatterns: ComponentPattern[] = [];
      
      sourceFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8').catch(() => '');
        
        // Find form patterns
        const formMatches = content.match(/<form[^>]*>.*?<\/form>/gs) || [];
        
        formMatches.forEach(pattern => {
          const complexity = analyzeComponentComplexity(pattern);
          const props = extractProps(pattern);
          
          const existingPattern = formPatterns.find(p => p.pattern === pattern);
          if (existingPattern) {
            existingPattern.occurrences++;
            existingPattern.files.push(file);
          } else {
            formPatterns.push({
              type: 'form',
              pattern,
              occurrences: 1,
              files: [file],
              extractionPotential: complexity > 5 ? 'high' : complexity > 2 ? 'medium' : 'low',
              complexityScore: complexity
            });
          }
        });
      });
      
      const extractableForms = formPatterns.filter(p => p.occurrences >= 2 || p.extractionPotential === 'high');
      
      console.log('\n=== FORM COMPONENT ANALYSIS ===\n');
      console.log(`Total form patterns found: ${formPatterns.length}`);
      console.log(`Extractable form patterns: ${extractableForms.length}`);
      
      extractableForms.forEach((pattern, index) => {
        console.log(`\n${index + 1}. Form Pattern (Complexity: ${pattern.complexityScore}, Potential: ${pattern.extractionPotential})`);
        console.log(`   Occurrences: ${pattern.occurrences}`);
        console.log(`   Files: ${pattern.files.length} files`);
        console.log(`   Pattern preview: ${pattern.pattern.substring(0, 100)}...`);
      });
      
      if (extractableForms.length > 0) {
        const formComponent = generateComponentTemplate('form', []);
        console.log('\n=== SUGGESTED FORM COMPONENT ===\n');
        console.log(formComponent.template);
      }
      
      expect(formPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Card Component Analysis', () => {
    it('should identify extractable card patterns', () => {
      const cardPatterns: ComponentPattern[] = [];
      
      sourceFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8').catch(() => '');
        
        // Find card-like patterns
        const cardMatches = content.match(/<div[^>]*(?:card|bg-white.*rounded)[^>]*>.*?<\/div>/gs) || [];
        
        cardMatches.forEach(pattern => {
          const complexity = analyzeComponentComplexity(pattern);
          const props = extractProps(pattern);
          
          // Skip very simple divs
          if (pattern.length < 100) {return;}
          
          const existingPattern = cardPatterns.find(p => p.pattern === pattern);
          if (existingPattern) {
            existingPattern.occurrences++;
            existingPattern.files.push(file);
          } else {
            cardPatterns.push({
              type: 'card',
              pattern,
              occurrences: 1,
              files: [file],
              extractionPotential: complexity > 3 ? 'high' : complexity > 1 ? 'medium' : 'low',
              complexityScore: complexity
            });
          }
        });
      });
      
      const extractableCards = cardPatterns.filter(p => p.occurrences >= 2 || p.extractionPotential === 'high');
      
      console.log('\n=== CARD COMPONENT ANALYSIS ===\n');
      console.log(`Total card patterns found: ${cardPatterns.length}`);
      console.log(`Extractable card patterns: ${extractableCards.length}`);
      
      extractableCards.forEach((pattern, index) => {
        console.log(`\n${index + 1}. Card Pattern (Complexity: ${pattern.complexityScore}, Potential: ${pattern.extractionPotential})`);
        console.log(`   Occurrences: ${pattern.occurrences}`);
        console.log(`   Files: ${pattern.files.length} files`);
        console.log(`   Pattern preview: ${pattern.pattern.substring(0, 100)}...`);
      });
      
      if (extractableCards.length > 0) {
        const cardComponent = generateComponentTemplate('card', []);
        console.log('\n=== SUGGESTED CARD COMPONENT ===\n');
        console.log(cardComponent.template);
      }
      
      expect(cardPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Input Component Analysis', () => {
    it('should identify extractable input patterns', () => {
      const inputPatterns: ComponentPattern[] = [];
      
      sourceFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8').catch(() => '');
        
        // Find input patterns with labels and error handling
        const inputMatches = content.match(/(?:<label[^>]*>.*?<\/label>\s*)?<input[^>]*>[^<]*(?:<.*?error.*?>.*?<\/.*?>)?/gs) || [];
        
        inputMatches.forEach(pattern => {
          const complexity = analyzeComponentComplexity(pattern);
          const props = extractProps(pattern);
          
          const existingPattern = inputPatterns.find(p => p.pattern === pattern);
          if (existingPattern) {
            existingPattern.occurrences++;
            existingPattern.files.push(file);
          } else {
            inputPatterns.push({
              type: 'input',
              pattern,
              occurrences: 1,
              files: [file],
              extractionPotential: complexity > 2 ? 'high' : complexity > 0 ? 'medium' : 'low',
              complexityScore: complexity
            });
          }
        });
      });
      
      const extractableInputs = inputPatterns.filter(p => p.occurrences >= 3 || p.extractionPotential === 'high');
      
      console.log('\n=== INPUT COMPONENT ANALYSIS ===\n');
      console.log(`Total input patterns found: ${inputPatterns.length}`);
      console.log(`Extractable input patterns: ${extractableInputs.length}`);
      
      extractableInputs.forEach((pattern, index) => {
        console.log(`\n${index + 1}. Input Pattern (Complexity: ${pattern.complexityScore}, Potential: ${pattern.extractionPotential})`);
        console.log(`   Occurrences: ${pattern.occurrences}`);
        console.log(`   Files: ${pattern.files.length} files`);
        console.log(`   Pattern preview: ${pattern.pattern.substring(0, 100)}...`);
      });
      
      if (extractableInputs.length > 0) {
        const inputComponent = generateComponentTemplate('input', []);
        console.log('\n=== SUGGESTED INPUT COMPONENT ===\n');
        console.log(inputComponent.template);
      }
      
      expect(inputPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Modal Component Analysis', () => {
    it('should identify extractable modal patterns', () => {
      const modalPatterns: ComponentPattern[] = [];
      
      sourceFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8').catch(() => '');
        
        // Find modal-like patterns
        const modalMatches = content.match(/(?:modal|dialog|overlay|fixed.*inset-0).*?<\/div>/gs) || [];
        
        modalMatches.forEach(pattern => {
          const complexity = analyzeComponentComplexity(pattern);
          const props = extractProps(pattern);
          
          // Skip very simple patterns
          if (pattern.length < 200) {return;}
          
          const existingPattern = modalPatterns.find(p => p.pattern === pattern);
          if (existingPattern) {
            existingPattern.occurrences++;
            existingPattern.files.push(file);
          } else {
            modalPatterns.push({
              type: 'modal',
              pattern,
              occurrences: 1,
              files: [file],
              extractionPotential: complexity > 4 ? 'high' : complexity > 2 ? 'medium' : 'low',
              complexityScore: complexity
            });
          }
        });
      });
      
      const extractableModals = modalPatterns.filter(p => p.occurrences >= 2 || p.extractionPotential === 'high');
      
      console.log('\n=== MODAL COMPONENT ANALYSIS ===\n');
      console.log(`Total modal patterns found: ${modalPatterns.length}`);
      console.log(`Extractable modal patterns: ${extractableModals.length}`);
      
      extractableModals.forEach((pattern, index) => {
        console.log(`\n${index + 1}. Modal Pattern (Complexity: ${pattern.complexityScore}, Potential: ${pattern.extractionPotential})`);
        console.log(`   Occurrences: ${pattern.occurrences}`);
        console.log(`   Files: ${pattern.files.length} files`);
      });
      
      if (extractableModals.length > 0) {
        const modalComponent = generateComponentTemplate('modal', []);
        console.log('\n=== SUGGESTED MODAL COMPONENT ===\n');
        console.log(modalComponent.template);
      }
      
      expect(modalPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Comprehensive Component Library Generation', () => {
    it('should generate complete component library recommendations', () => {
      console.log('\n=== COMPREHENSIVE COMPONENT LIBRARY RECOMMENDATIONS ===\n');
      
      const componentTypes: ComponentPattern['type'][] = ['button', 'form', 'card', 'input', 'modal', 'table'];
      
      componentTypes.forEach(type => {
        const component = generateComponentTemplate(type, []);
        
        console.log(`\n## ${component.name}\n`);
        console.log(`**Description**: ${component.description}\n`);
        
        console.log('**Benefits**:');
        component.benefits.forEach(benefit => {
          console.log(`- ${benefit}`);
        });
        
        console.log('\n**Usage Examples**:');
        component.usage.forEach(example => {
          console.log(`\`\`\`tsx\n${example}\n\`\`\``);
        });
        
        console.log('\n---\n');
      });
      
      console.log('\n## Implementation Strategy\n');
      console.log('1. **Phase 1**: Implement StandardButton and StandardInput (highest impact, lowest effort)');
      console.log('2. **Phase 2**: Add StandardCard and StandardForm (medium effort, high value)');  
      console.log('3. **Phase 3**: Complete with StandardModal and StandardTable (higher complexity)');
      
      console.log('\n## File Structure Recommendation\n');
      console.log('```');
      console.log('client/src/components/');
      console.log('├── ui/');
      console.log('│   ├── Button/');
      console.log('│   │   ├── StandardButton.tsx');
      console.log('│   │   ├── StandardButton.test.tsx');
      console.log('│   │   └── index.ts');
      console.log('│   ├── Input/');
      console.log('│   │   ├── StandardInput.tsx');
      console.log('│   │   ├── StandardInput.test.tsx');
      console.log('│   │   └── index.ts');
      console.log('│   ├── Card/');
      console.log('│   ├── Form/');
      console.log('│   ├── Modal/');
      console.log('│   ├── Table/');
      console.log('│   └── index.ts');
      console.log('└── shared/');
      console.log('    ├── types.ts');
      console.log('    └── constants.ts');
      console.log('```');
      
      expect(componentTypes.length).toBe(6);
    });
  });
});