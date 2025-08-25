import type { Feature } from '@shared/schema';
import type { FeatureFormData } from './use-feature-form-data';

/**
 * Generates a comprehensive development prompt based on feature data and form input.
 * @param feature - Feature data for context, null for new features.
 * @param formData - Form data containing feature requirements.
 * @returns Generated development prompt string.
 */
/**
 * GenerateDevelopmentPrompt function.
 * @param feature
 * @param formData
 * @returns Function result.
 */
export function generateDevelopmentPrompt(
  feature: Feature | null,
  formData: FeatureFormData
): string {
  const featureName = feature?.name || formData.featureName || 'New Feature';
  const featureCategory = feature?.category || formData.featureCategory || 'Not specified';
  const featureStatus = feature?.status || 'submitted';
  const featurePriority = formData.priority || feature?.priority || 'Medium';
  const featureDescription =
    feature?.description || formData.featureDescription || 'Feature description not provided';

  let prompt = `# Feature Development Request: ${featureName}

## 🎯 Overview
**Category:** ${featureCategory}
**Current Status:** ${featureStatus}
**Priority:** ${featurePriority}
**Description:** ${featureDescription}

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
${formData.securityConsiderations || 'Follow standard security practices'}`;

  // Add RBAC section if required
  if (formData.rbacRequired) {
    prompt += `

### Role-Based Access Control (RBAC)
**RBAC Required:** Yes

**Role Permissions:**`;

    Object.entries(formData.rbacRoles).forEach(([role, permissions]) => {
      prompt += `
- **${role.charAt(0).toUpperCase() + role.slice(1)}:**
  - Read Access: ${permissions.read ? 'Yes' : 'No'}
  - Write Access: ${permissions.write ? 'Yes' : 'No'}`;

      if (permissions.organizationalLimitation) {
        prompt += `
  - Organizational Limitation: ${permissions.organizationalLimitation}`;
      }
    });
  } else {
    prompt += `

### Role-Based Access Control (RBAC)
**RBAC Required:** No (Feature uses standard application permissions)`;
  }

  // Add User Experience section
  prompt += `

## 🎨 User Experience

### User Flow
${formData.userFlow || 'Standard user interaction flow'}

### UI Requirements
${formData.uiRequirements || 'Follow existing design system'}

### Accessibility Needs
${formData.accessibilityNeeds || 'Standard accessibility compliance (WCAG 2.1 AA)'}

## ⚡ Quality & Performance

### Performance Requirements
${formData.performanceRequirements || 'Standard performance expectations'}

### Testing Strategy
${formData.testingStrategy || 'Unit tests, integration tests, and manual testing'}

## 📝 Additional Context

${formData.additionalNotes || 'No additional notes provided'}

---

## 🚀 Implementation Guidelines

### Koveo Gestion Architecture Context:
- **Frontend:** React 18 with TypeScript, Vite, shadcn/ui components, Tailwind CSS
- **Backend:** Express.js with TypeScript, RESTful API design
- **Database:** PostgreSQL with Drizzle ORM for type-safe operations
- **Authentication:** Express sessions with PostgreSQL session store
- **Validation:** Zod schemas for runtime type validation
- **State Management:** TanStack Query for server state, React Hook Form for forms
- **File Structure:** Monorepo with shared types between frontend and backend

### Quebec Law 25 Compliance Requirements:
- All features must support French and English languages
- Data collection and processing must be transparent
- User consent mechanisms for data usage
- Secure data storage and transmission
- Right to data portability and deletion

### Security & Performance Standards:
- Input validation on both client and server
- SQL injection prevention via Drizzle ORM
- XSS protection through proper data escaping
- Rate limiting on API endpoints
- Optimistic UI updates where appropriate
- Error boundaries and graceful error handling

### Code Quality Standards:
- TypeScript strict mode enabled
- ESLint and Prettier configured
- Comprehensive test coverage (unit, integration, E2E)
- Performance monitoring and optimization
- Accessibility compliance (WCAG 2.1 AA)

## ✅ Acceptance Criteria

1. **Functionality:** Feature works as described in all specified user scenarios
2. **Performance:** Meets or exceeds performance requirements
3. **Security:** Passes security review and follows secure coding practices
4. **Accessibility:** Compliant with WCAG 2.1 AA standards
5. **Testing:** Comprehensive test suite with >80% coverage
6. **Documentation:** Updated API documentation and user guides
7. **Quebec Compliance:** Fully supports French/English and Law 25 requirements
8. **Code Review:** Approved by senior developers and security team

## 🔄 Implementation Steps

1. **Database Schema:** Design and implement any required database changes
2. **Backend API:** Create secure, validated API endpoints
3. **Frontend Components:** Build responsive, accessible UI components
4. **Integration:** Connect frontend to backend with proper error handling
5. **Testing:** Write and execute comprehensive test suite
6. **Security Review:** Conduct security audit and vulnerability assessment
7. **Performance Testing:** Validate performance under expected load
8. **Documentation:** Update technical and user documentation
9. **Deployment:** Deploy to staging for final testing before production

---

*This prompt was generated by the Koveo Gestion Feature Planning System. Please ensure all implementation follows the established architectural patterns and security guidelines.*`;

  return prompt;
}
