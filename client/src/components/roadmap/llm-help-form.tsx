/**
 * Generates and copies the LLM help form for feature discussions.
 */
/**
 * GenerateLLMHelpForm function.
 * @returns Function result.
 */
export function generateLLMHelpForm(): string {
  return `# Koveo Gestion Feature Development Discussion Form

## 📖 APPLICATION CONTEXT
**Koveo Gestion** is a comprehensive property management platform for Quebec residential communities.

### Tech Stack:
- **Frontend**: React 18 with TypeScript, Vite, shadcn/ui components, Tailwind CSS
- **Backend**: Express.js with TypeScript, RESTful API
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Express sessions with PostgreSQL session store
- **Validation**: Zod schemas for runtime type validation
- **State Management**: TanStack Query for server state, React Hook Form for forms

### Key Patterns:
- Monorepo structure with shared types between frontend and backend
- Type-safe database operations with Drizzle ORM
- Comprehensive validation with Zod schemas
- Internationalization supporting French and English
- Role-based access control (admin, manager, owner, tenant)

### Database Schema includes:
- Users, Organizations, Buildings, Residences
- Bills, Maintenance Requests, Budgets
- Documents, Notifications
- Features and Actionable Items for roadmap management

### Security Considerations:
- Quebec Law 25 compliance required
- Secure authentication with bcrypt password hashing
- Session management with secure cookies
- Input validation and sanitization

---

## 🎯 Feature Overview
**What feature do you want to build?**
[Describe the feature in one sentence]

**What problem does this solve?**
[Explain the user problem or business need]

## 👥 User Context
**Who will use this feature?**
[Target users: Property managers, Tenants, Owners, etc.]

**How will they use it?**
[Describe the user's workflow and interaction]

## 📋 Requirements
**What should this feature do? (List 3-5 key capabilities)**
1. 
2. 
3. 
4. 
5. 

**What should this feature NOT do? (Any constraints or boundaries)**
- 
- 
- 

## 🔧 Technical Considerations
**Does this feature need to:**
- [ ] Store new data in the database?
- [ ] Create new API endpoints?
- [ ] Add new UI components?
- [ ] Integrate with external services?
- [ ] Handle file uploads?
- [ ] Send notifications?
- [ ] Support Quebec Law 25 compliance?
- [ ] Work in both French and English?

**Database Changes Needed:**
[Describe any new tables or columns needed]

**API Endpoints Needed:**
[List any new routes like GET /api/new-feature]

## 🎨 User Experience
**How should this look and feel?**
[Describe the UI/UX requirements]

**What pages or components are involved?**
[List the specific parts of the app this affects]

## 🔍 Acceptance Criteria
**How will we know this feature works correctly?**
1. 
2. 
3. 

**Edge cases to consider:**
- 
- 
- 

## 📊 Success Metrics
**How will we measure if this feature is successful?**
[Describe measurable outcomes]

## 🚀 Implementation Notes
**Any specific technical requirements or constraints:**
[Add any additional context or requirements]

---

## 💡 Tips for AI Implementation
- Start with the database schema changes first
- Create API endpoints before frontend components
- Use existing patterns from the codebase
- Test with real data scenarios
- Ensure proper error handling
- Consider mobile responsiveness
- Add proper loading states
- Include user feedback/toast notifications
- Follow accessibility guidelines
- Test role-based access control`;
}
