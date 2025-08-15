import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy, FileText, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Feature } from '@shared/schema';

/**
 * Props for the FeaturePlanningDialog component.
 */
interface FeaturePlanningDialogProps {
  feature: Feature | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog component for planning feature development.
 * Collects detailed requirements and generates development prompts.
 * @param root0
 * @param root0.feature
 * @param root0.open
 * @param root0.onOpenChange
 */
export function FeaturePlanningDialog({ feature, open, onOpenChange }: FeaturePlanningDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    // General questions
    businessObjective: '',
    targetUsers: '',
    successMetrics: '',
    priority: '',
    timeline: '',
    
    // Technical questions
    complexity: '',
    dependencies: '',
    dataRequirements: '',
    integrationNeeds: '',
    securityConsiderations: '',
    
    // User experience questions
    userFlow: '',
    uiRequirements: '',
    accessibilityNeeds: '',
    
    // Additional requirements
    performanceRequirements: '',
    testingStrategy: '',
    additionalNotes: '',
  });

  const [step, setStep] = useState<'form' | 'prompt'>('form');
  const [generatedPrompt, setGeneratedPrompt] = useState('');

  /**
   * Updates form data when input values change.
   * @param field
   * @param value
   */
  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Generates a comprehensive development prompt based on the collected requirements.
   */
  const generatePrompt = () => {
    if (!feature) {return;}

    const prompt = `# Feature Development Request: ${feature.name}

## 🎯 Overview
**Category:** ${feature.category}
**Current Status:** ${feature.status}
**Priority:** ${formData.priority || feature.priority || 'Medium'}
**Description:** ${feature.description}

## 📋 Business Requirements

### Business Objective
${formData.businessObjective || 'Not specified'}

### Target Users
${formData.targetUsers || 'All system users'}

### Success Metrics
${formData.successMetrics || 'Feature completion and user adoption'}

### Timeline
${formData.timeline || 'Standard development timeline'}

## 🔧 Technical Requirements

### Complexity Assessment
${formData.complexity || 'Medium complexity'}

### Dependencies
${formData.dependencies || 'None specified'}

### Data Requirements
${formData.dataRequirements || 'Standard data handling'}

### Integration Needs
${formData.integrationNeeds || 'Standard system integration'}

### Security Considerations
${formData.securityConsiderations || 'Follow standard security practices'}

## 👤 User Experience Requirements

### User Flow
${formData.userFlow || 'Standard user interaction pattern'}

### UI Requirements
${formData.uiRequirements || 'Follow existing design system (shadcn/ui)'}

### Accessibility Needs
${formData.accessibilityNeeds || 'WCAG 2.1 AA compliance required'}

## ⚡ Performance & Quality Requirements

### Performance Requirements
${formData.performanceRequirements || 'Standard performance expectations'}

### Testing Strategy
${formData.testingStrategy || 'Unit tests, integration tests, and manual testing'}

## 📝 Implementation Guidelines

**CRITICAL: This feature must be implemented with the highest standards of quality, maintainability, and best practices.**

### Code Quality Standards
- Follow TypeScript strict mode and maintain 100% type safety
- Implement comprehensive error handling and user feedback
- Use consistent naming conventions and clear, self-documenting code
- Add thorough JSDoc comments for all exported functions and interfaces
- Maintain test coverage above 90% for all new code

### Architecture & Design Patterns
- Follow the existing project architecture (React + Express + PostgreSQL + Drizzle ORM)
- Use established patterns: React Query for data fetching, Zod for validation
- Implement proper separation of concerns (UI components, business logic, data layer)
- Follow SOLID principles and avoid code duplication
- Use composition over inheritance where applicable

### User Interface Standards
- Use the established shadcn/ui component system exclusively
- Ensure responsive design works on all screen sizes (mobile, tablet, desktop)
- Follow the existing design tokens and color scheme
- Implement proper loading states, error states, and empty states
- Add appropriate micro-interactions and transitions

### Database & Backend Standards
- Create proper database migrations using Drizzle Kit
- Implement input validation on both client and server sides using Zod schemas
- Follow RESTful API conventions and proper HTTP status codes
- Add comprehensive error handling and logging
- Ensure proper data relationships and foreign key constraints

### Security & Performance
- Implement proper authentication and authorization checks
- Sanitize all user inputs to prevent XSS and injection attacks
- Use prepared statements and parameterized queries
- Optimize database queries and add proper indexing
- Implement caching strategies where appropriate

### Testing Requirements
- Write unit tests for all business logic and utility functions
- Add integration tests for API endpoints and database operations
- Include component tests for React components with user interactions
- Test error scenarios and edge cases thoroughly
- Add end-to-end tests for critical user flows

### Documentation & Maintenance
- Update the project's replit.md file with any architectural changes
- Add inline comments explaining complex business logic
- Create clear commit messages following conventional commit format
- Ensure backward compatibility unless explicitly requested otherwise

## 🚀 Additional Notes
${formData.additionalNotes || 'No additional notes'}

## ✅ Definition of Done
- [ ] Feature implemented following all quality standards above
- [ ] All tests pass with >90% coverage for new code
- [ ] Code review completed and approved
- [ ] Documentation updated (JSDoc, inline comments, replit.md if needed)
- [ ] Manual testing completed across different devices and browsers
- [ ] Performance benchmarks meet requirements
- [ ] Security review completed
- [ ] Feature deployed and working in production environment

**Remember: Quality and maintainability are more important than speed. Take the time to implement this feature properly, following all established patterns and best practices in the Koveo Gestion codebase.**`;

    setGeneratedPrompt(prompt);
    setStep('prompt');
  };

  /**
   * Copies the generated prompt to clipboard.
   */
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      toast({
        title: 'Prompt Copied',
        description: 'The development prompt has been copied to your clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy prompt to clipboard.',
        variant: 'destructive',
      });
    }
  };

  /**
   * Resets the dialog to initial state.
   */
  const resetDialog = () => {
    setStep('form');
    setFormData({
      businessObjective: '',
      targetUsers: '',
      successMetrics: '',
      priority: '',
      timeline: '',
      complexity: '',
      dependencies: '',
      dataRequirements: '',
      integrationNeeds: '',
      securityConsiderations: '',
      userFlow: '',
      uiRequirements: '',
      accessibilityNeeds: '',
      performanceRequirements: '',
      testingStrategy: '',
      additionalNotes: '',
    });
    setGeneratedPrompt('');
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetDialog();
    }
    onOpenChange(open);
  };

  if (!feature) {return null;}

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {step === 'form' ? 'Plan Feature Development' : 'Generated Development Prompt'}
          </DialogTitle>
        </DialogHeader>

        {step === 'form' ? (
          <div className="space-y-6">
            {/* Feature Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">{feature.name}</h3>
              <p className="text-sm text-gray-600 mb-2">{feature.description}</p>
              <div className="flex gap-2">
                <Badge variant="outline">{feature.category}</Badge>
                <Badge variant={feature.status === 'completed' ? 'default' : 'secondary'}>
                  {feature.status}
                </Badge>
                {feature.priority && (
                  <Badge variant={feature.priority === 'high' ? 'destructive' : 'secondary'}>
                    {feature.priority}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Business Requirements */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Business Requirements</h3>
                
                <div>
                  <Label htmlFor="businessObjective">Business Objective *</Label>
                  <Textarea
                    id="businessObjective"
                    placeholder="What problem does this feature solve? What business value does it provide?"
                    value={formData.businessObjective}
                    onChange={(e) => updateFormData('businessObjective', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="targetUsers">Target Users *</Label>
                  <Input
                    id="targetUsers"
                    placeholder="e.g., Property managers, Tenants, Board members"
                    value={formData.targetUsers}
                    onChange={(e) => updateFormData('targetUsers', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="successMetrics">Success Metrics</Label>
                  <Textarea
                    id="successMetrics"
                    placeholder="How will we measure success? What are the KPIs?"
                    value={formData.successMetrics}
                    onChange={(e) => updateFormData('successMetrics', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="priority">Development Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => updateFormData('priority', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="timeline">Expected Timeline</Label>
                  <Input
                    id="timeline"
                    placeholder="e.g., 2 weeks, 1 month, Next sprint"
                    value={formData.timeline}
                    onChange={(e) => updateFormData('timeline', e.target.value)}
                  />
                </div>
              </div>

              {/* Technical Requirements */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Technical Requirements</h3>
                
                <div>
                  <Label htmlFor="complexity">Complexity Assessment</Label>
                  <Select value={formData.complexity} onValueChange={(value) => updateFormData('complexity', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Assess technical complexity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Simple (1-3 days)</SelectItem>
                      <SelectItem value="medium">Medium (1-2 weeks)</SelectItem>
                      <SelectItem value="complex">Complex (2-4 weeks)</SelectItem>
                      <SelectItem value="very-complex">Very Complex (1+ months)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="dependencies">Dependencies</Label>
                  <Textarea
                    id="dependencies"
                    placeholder="What other features, APIs, or systems does this depend on?"
                    value={formData.dependencies}
                    onChange={(e) => updateFormData('dependencies', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="dataRequirements">Data Requirements</Label>
                  <Textarea
                    id="dataRequirements"
                    placeholder="What data needs to be stored, modified, or accessed?"
                    value={formData.dataRequirements}
                    onChange={(e) => updateFormData('dataRequirements', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="integrationNeeds">Integration Needs</Label>
                  <Textarea
                    id="integrationNeeds"
                    placeholder="External APIs, services, or third-party integrations needed"
                    value={formData.integrationNeeds}
                    onChange={(e) => updateFormData('integrationNeeds', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="securityConsiderations">Security Considerations</Label>
                  <Textarea
                    id="securityConsiderations"
                    placeholder="Authentication, authorization, data privacy concerns"
                    value={formData.securityConsiderations}
                    onChange={(e) => updateFormData('securityConsiderations', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* User Experience Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">User Experience</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="userFlow">User Flow *</Label>
                  <Textarea
                    id="userFlow"
                    placeholder="Describe the step-by-step user interaction with this feature"
                    value={formData.userFlow}
                    onChange={(e) => updateFormData('userFlow', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="uiRequirements">UI Requirements</Label>
                  <Textarea
                    id="uiRequirements"
                    placeholder="Specific UI components, layouts, or visual requirements"
                    value={formData.uiRequirements}
                    onChange={(e) => updateFormData('uiRequirements', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="accessibilityNeeds">Accessibility Needs</Label>
                <Input
                  id="accessibilityNeeds"
                  placeholder="Screen reader support, keyboard navigation, color contrast"
                  value={formData.accessibilityNeeds}
                  onChange={(e) => updateFormData('accessibilityNeeds', e.target.value)}
                />
              </div>
            </div>

            {/* Quality & Performance Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Quality & Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="performanceRequirements">Performance Requirements</Label>
                  <Textarea
                    id="performanceRequirements"
                    placeholder="Load times, data processing speed, scalability needs"
                    value={formData.performanceRequirements}
                    onChange={(e) => updateFormData('performanceRequirements', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="testingStrategy">Testing Strategy</Label>
                  <Textarea
                    id="testingStrategy"
                    placeholder="Unit tests, integration tests, user acceptance criteria"
                    value={formData.testingStrategy}
                    onChange={(e) => updateFormData('testingStrategy', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Additional Notes */}
            <div>
              <Label htmlFor="additionalNotes">Additional Notes</Label>
              <Textarea
                id="additionalNotes"
                placeholder="Any other requirements, constraints, or considerations"
                value={formData.additionalNotes}
                onChange={(e) => updateFormData('additionalNotes', e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">
                  Generated development prompt for <strong>{feature.name}</strong>
                </p>
                <Button onClick={copyPrompt} size="sm" variant="outline">
                  <Copy className="h-4 w-4 mr-1" />
                  Copy Prompt
                </Button>
              </div>
            </div>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{generatedPrompt}</pre>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {step === 'prompt' && (
              <Button variant="outline" onClick={() => setStep('form')}>
                Back to Form
              </Button>
            )}
            <Button 
              onClick={generatePrompt} 
              disabled={!formData.businessObjective || !formData.targetUsers || !formData.userFlow}
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              {step === 'form' ? 'Generate Prompt' : 'Regenerate'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}