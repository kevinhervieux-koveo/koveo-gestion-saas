import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { FeatureFormData } from './use-feature-form-data';

/**
 * Props for form section components.
 */
interface FormSectionProps {
  formData: FeatureFormData;
  onUpdateFormData: (_field: string, _value: string | boolean) => void;
}

/**
 * Basic Information section component.
 * @param root0 - Form section component props.
 * @param root0.formData - Current form data.
 * @param root0.onUpdateFormData - Function to update form data.
 * @returns JSX element for the basic information section.
 */
/**
 * BasicInformationSection function.
 * @param root0
 * @param root0.formData
 * @param root0.onUpdateFormData
 * @returns Function result.
 */
export function BasicInformationSection({ formData, onUpdateFormData }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Basic Information</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="featureName">Feature Name *</Label>
          <Input
            id="featureName"
            placeholder="What is this feature called?"
            value={formData.featureName}
            onChange={(e) => onUpdateFormData('featureName', e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="featureCategory">Category *</Label>
          <Select 
            value={formData.featureCategory} 
            onValueChange={(value: string) => onUpdateFormData('featureCategory', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select feature category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Core Platform">Core Platform</SelectItem>
              <SelectItem value="Property Management">Property Management</SelectItem>
              <SelectItem value="Financial Management">Financial Management</SelectItem>
              <SelectItem value="Communication & Notifications">Communication & Notifications</SelectItem>
              <SelectItem value="Document Management">Document Management</SelectItem>
              <SelectItem value="User Management">User Management</SelectItem>
              <SelectItem value="Maintenance & Operations">Maintenance & Operations</SelectItem>
              <SelectItem value="AI & Automation">AI & Automation</SelectItem>
              <SelectItem value="Compliance & Security">Compliance & Security</SelectItem>
              <SelectItem value="Analytics & Reporting">Analytics & Reporting</SelectItem>
              <SelectItem value="Integration & API">Integration & API</SelectItem>
              <SelectItem value="Infrastructure & Performance">Infrastructure & Performance</SelectItem>
              <SelectItem value="Website">Website</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="featureDescription">Description *</Label>
        <Textarea
          id="featureDescription"
          placeholder="Describe what this feature does and why it's needed"
          value={formData.featureDescription}
          onChange={(e) => onUpdateFormData('featureDescription', e.target.value)}
          rows={3}
          required
        />
      </div>

      <div className="flex items-center gap-3">
        <Label htmlFor="isStrategicPath" className="text-sm font-medium">
          Strategic Path Feature
        </Label>
        <Switch
          id="isStrategicPath"
          checked={formData.isStrategicPath}
          onCheckedChange={(checked: boolean) => onUpdateFormData('isStrategicPath', checked)}
        />
        <span className="text-xs text-gray-500">
          Mark as a strategic development priority
        </span>
      </div>
    </div>
  );
}

/**
 * Business Requirements section component.
 * @param root0 - Form section component props.
 * @param root0.formData - Current form data.
 * @param root0.onUpdateFormData - Function to update form data.
 * @returns JSX element for the business requirements section.
 */
/**
 * BusinessRequirementsSection function.
 * @param root0
 * @param root0.formData
 * @param root0.onUpdateFormData
 * @returns Function result.
 */
export function BusinessRequirementsSection({ formData, onUpdateFormData }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Business Requirements</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="businessObjective">Business Objective *</Label>
          <Textarea
            id="businessObjective"
            placeholder="What business problem does this solve? What value does it provide?"
            value={formData.businessObjective}
            onChange={(e) => onUpdateFormData('businessObjective', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="targetUsers">Target Users *</Label>
          <Textarea
            id="targetUsers"
            placeholder="Who will use this feature? (Admins, Managers, Tenants, Residents)"
            value={formData.targetUsers}
            onChange={(e) => onUpdateFormData('targetUsers', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="successMetrics">Success Metrics</Label>
          <Textarea
            id="successMetrics"
            placeholder="How will we measure the success of this feature?"
            value={formData.successMetrics}
            onChange={(e) => onUpdateFormData('successMetrics', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="timeline">Timeline</Label>
          <Input
            id="timeline"
            placeholder="When does this need to be completed?"
            value={formData.timeline}
            onChange={(e) => onUpdateFormData('timeline', e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="priority">Priority Level</Label>
        <Select 
          value={formData.priority} 
          onValueChange={(value: string) => onUpdateFormData('priority', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select priority level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/**
 * Technical Requirements section component.
 * @param root0 - Form section component props.
 * @param root0.formData - Current form data.
 * @param root0.onUpdateFormData - Function to update form data.
 * @returns JSX element for the technical requirements section.
 */
/**
 * TechnicalRequirementsSection function.
 * @param root0
 * @param root0.formData
 * @param root0.onUpdateFormData
 * @returns Function result.
 */
export function TechnicalRequirementsSection({ formData, onUpdateFormData }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Technical Requirements</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="complexity">Complexity Assessment</Label>
          <Select 
            value={formData.complexity} 
            onValueChange={(value: string) => onUpdateFormData('complexity', value)}
          >
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
            onChange={(e) => onUpdateFormData('dependencies', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="dataRequirements">Data Requirements</Label>
          <Textarea
            id="dataRequirements"
            placeholder="What data needs to be stored, modified, or accessed?"
            value={formData.dataRequirements}
            onChange={(e) => onUpdateFormData('dataRequirements', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="integrationNeeds">Integration Needs</Label>
          <Textarea
            id="integrationNeeds"
            placeholder="External APIs, services, or third-party integrations needed"
            value={formData.integrationNeeds}
            onChange={(e) => onUpdateFormData('integrationNeeds', e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="securityConsiderations">Security Considerations</Label>
        <Textarea
          id="securityConsiderations"
          placeholder="Authentication, authorization, data privacy concerns"
          value={formData.securityConsiderations}
          onChange={(e) => onUpdateFormData('securityConsiderations', e.target.value)}
        />
      </div>
    </div>
  );
}

/**
 * User Experience section component.
 * @param root0 - Form section component props.
 * @param root0.formData - Current form data.
 * @param root0.onUpdateFormData - Function to update form data.
 * @returns JSX element for the user experience section.
 */
/**
 * UserExperienceSection function.
 * @param root0
 * @param root0.formData
 * @param root0.onUpdateFormData
 * @returns Function result.
 */
export function UserExperienceSection({ formData, onUpdateFormData }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">User Experience</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="userFlow">User Flow *</Label>
          <Textarea
            id="userFlow"
            placeholder="Describe the step-by-step user interaction with this feature"
            value={formData.userFlow}
            onChange={(e) => onUpdateFormData('userFlow', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="uiRequirements">UI Requirements</Label>
          <Textarea
            id="uiRequirements"
            placeholder="Specific UI components, layouts, or visual requirements"
            value={formData.uiRequirements}
            onChange={(e) => onUpdateFormData('uiRequirements', e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="accessibilityNeeds">Accessibility Needs</Label>
        <Input
          id="accessibilityNeeds"
          placeholder="Screen reader support, keyboard navigation, color contrast"
          value={formData.accessibilityNeeds}
          onChange={(e) => onUpdateFormData('accessibilityNeeds', e.target.value)}
        />
      </div>
    </div>
  );
}

/**
 * Quality & Performance section component.
 * @param root0 - Form section component props.
 * @param root0.formData - Current form data.
 * @param root0.onUpdateFormData - Function to update form data.
 * @returns JSX element for the quality performance section.
 */
/**
 * QualityPerformanceSection function.
 * @param root0
 * @param root0.formData
 * @param root0.onUpdateFormData
 * @returns Function result.
 */
export function QualityPerformanceSection({ formData, onUpdateFormData }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Quality & Performance</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="performanceRequirements">Performance Requirements</Label>
          <Textarea
            id="performanceRequirements"
            placeholder="Load times, data processing speed, scalability needs"
            value={formData.performanceRequirements}
            onChange={(e) => onUpdateFormData('performanceRequirements', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="testingStrategy">Testing Strategy</Label>
          <Textarea
            id="testingStrategy"
            placeholder="Unit tests, integration tests, user acceptance criteria"
            value={formData.testingStrategy}
            onChange={(e) => onUpdateFormData('testingStrategy', e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="additionalNotes">Additional Notes</Label>
        <Textarea
          id="additionalNotes"
          placeholder="Any other important information, constraints, or context"
          value={formData.additionalNotes}
          onChange={(e) => onUpdateFormData('additionalNotes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}