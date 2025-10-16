/**
 * Help content configuration for all pages in the application
 * Maps routes to their help information including page descriptions, buttons, form fields, and relationships
 */

export interface HelpButton {
  label: string;
  description: string;
  action?: string;
}

export interface HelpFormField {
  label: string;
  description: string;
  required?: boolean;
}

export interface HelpPageRelationship {
  page: string;
  description: string;
}

export interface HelpContent {
  title: string;
  description: string;
  goal: string;
  howToUse: string;
  buttons?: HelpButton[];
  formFields?: HelpFormField[];
  relationships?: HelpPageRelationship[];
}

export const helpContentMap: Record<string, HelpContent> = {
  // ===== DASHBOARD PAGES =====
  '/dashboard/quick-actions': {
    title: 'Main Dashboard',
    description: 'Your central hub for quick access to all features and recent activity.',
    goal: 'Get a quick overview of your property management tasks and navigate to specific areas.',
    howToUse: 'Click on any card to navigate to that section. The dashboard shows your most important information at a glance.',
    buttons: [
      { label: 'Fullscreen Toggle', description: 'Expand the view to use the full screen for better visibility' },
      { label: 'Quick Action Cards', description: 'Click any card to navigate to that specific feature area' },
    ],
    relationships: [
      { page: 'All Pages', description: 'The dashboard provides quick links to all major sections of the application' },
    ],
  },
  '/dashboard/calendar': {
    title: 'Calendar',
    description: 'View and manage all scheduled events, maintenance appointments, and important dates.',
    goal: 'Keep track of all events, bookings, and scheduled activities across your properties.',
    howToUse: 'View events by day, week, or month. Click on an event to see details or create new events using the Add button.',
    buttons: [
      { label: 'Add Event', description: 'Create a new calendar event or appointment' },
      { label: 'View Toggle', description: 'Switch between day, week, and month views' },
      { label: 'Today', description: 'Jump to today\'s date quickly' },
    ],
  },
  '/dashboard/communication': {
    title: 'Communication',
    description: 'Send messages and announcements to residents or building managers.',
    goal: 'Facilitate communication between property managers, owners, and residents.',
    howToUse: 'Compose messages, select recipients, and send announcements. View message history and replies.',
    buttons: [
      { label: 'New Message', description: 'Compose a new message or announcement' },
      { label: 'Send', description: 'Send your composed message to selected recipients' },
    ],
  },

  // ===== ADMIN PAGES =====
  '/admin/organizations': {
    title: 'Organizations Management',
    description: 'Manage all organizations in the system.',
    goal: 'Create, edit, and oversee all organizations that use the platform.',
    howToUse: 'View the list of organizations, click Add to create new ones, or click Edit/Delete on existing organizations.',
    buttons: [
      { label: 'Add Organization', description: 'Create a new organization in the system' },
      { label: 'Edit', description: 'Modify organization details' },
      { label: 'Delete', description: 'Remove an organization (requires confirmation)' },
    ],
    formFields: [
      { label: 'Organization Name', description: 'The official name of the organization', required: true },
      { label: 'Contact Information', description: 'Primary contact details for the organization' },
    ],
  },
  '/admin/documentation': {
    title: 'Documentation',
    description: 'Access and manage system documentation and guides.',
    goal: 'Provide comprehensive documentation for administrators and users.',
    howToUse: 'Browse documentation by category, search for specific topics, and manage documentation files.',
  },
  '/admin/pillars': {
    title: 'Pillars Management',
    description: 'Define the core pillars and principles of the property management system.',
    goal: 'Establish and maintain the fundamental principles that guide property management operations.',
    howToUse: 'View, add, or edit the pillars that define your management approach.',
  },
  '/admin/roadmap': {
    title: 'Product Roadmap',
    description: 'View and manage the product development roadmap.',
    goal: 'Track upcoming features, improvements, and the development timeline.',
    howToUse: 'See planned features, their status, and expected release dates.',
  },
  '/admin/quality': {
    title: 'Quality Management',
    description: 'Monitor and manage quality metrics across the system.',
    goal: 'Ensure high quality standards in property management and service delivery.',
    howToUse: 'Review quality metrics, identify areas for improvement, and track quality initiatives.',
  },
  '/admin/compliance': {
    title: 'Compliance Management',
    description: 'Track and manage regulatory compliance requirements.',
    goal: 'Ensure all properties and operations meet legal and regulatory standards.',
    howToUse: 'Monitor compliance status, view requirements, and manage compliance documentation.',
  },
  '/admin/suggestions': {
    title: 'Suggestions Management',
    description: 'Review and manage suggestions from users across the system.',
    goal: 'Collect and evaluate improvement suggestions to enhance the platform.',
    howToUse: 'Review submitted suggestions, categorize them, and decide on implementation.',
  },
  '/admin/permissions': {
    title: 'Permissions Management',
    description: 'Configure user roles and access permissions.',
    goal: 'Control who can access which features and data in the system.',
    howToUse: 'Set up roles, assign permissions, and manage user access levels.',
    buttons: [
      { label: 'Add Role', description: 'Create a new user role with specific permissions' },
      { label: 'Edit Permissions', description: 'Modify what a role can access or do' },
    ],
  },

  // ===== MANAGER PAGES =====
  '/manager/buildings': {
    title: 'Buildings Management',
    description: 'Manage all buildings in your organization.',
    goal: 'Oversee building information, maintenance, and operations.',
    howToUse: 'View your buildings list, select one to see details, or add new buildings.',
    buttons: [
      { label: 'Add Building', description: 'Register a new building in the system' },
      { label: 'View Details', description: 'See comprehensive information about a building' },
      { label: 'Documents', description: 'Access building-specific documents and files' },
    ],
    formFields: [
      { label: 'Building Name', description: 'The name or identifier for the building', required: true },
      { label: 'Address', description: 'Physical location of the building', required: true },
      { label: 'Number of Units', description: 'Total residential units in the building' },
    ],
    relationships: [
      { page: 'Residences', description: 'Buildings contain multiple residences/units' },
      { page: 'Building Documents', description: 'Access documents specific to each building' },
      { page: 'Budget', description: 'Buildings have associated budgets for maintenance and operations' },
    ],
  },
  '/manager/residences': {
    title: 'Residences Management',
    description: 'Manage individual residential units within buildings.',
    goal: 'Oversee unit information, occupancy, and resident details.',
    howToUse: 'View all units, filter by building, add new units, or edit existing ones.',
    buttons: [
      { label: 'Add Residence', description: 'Create a new residential unit entry' },
      { label: 'Edit', description: 'Update unit details or occupancy information' },
      { label: 'Documents', description: 'Access residence-specific documents' },
    ],
    formFields: [
      { label: 'Unit Number', description: 'The unit or apartment number', required: true },
      { label: 'Building', description: 'Which building this residence is in', required: true },
      { label: 'Floor', description: 'The floor level of this unit' },
      { label: 'Square Footage', description: 'Total area of the residence' },
    ],
    relationships: [
      { page: 'Buildings', description: 'Residences belong to buildings' },
      { page: 'Residence Documents', description: 'Each residence can have its own documents' },
    ],
  },
  '/manager/bills': {
    title: 'Bills Management',
    description: 'Track and manage all bills and expenses for your properties.',
    goal: 'Record expenses, track payments, and maintain financial records.',
    howToUse: 'Add bills as they come in, categorize them, and mark them as paid. Filter by date, category, or status.',
    buttons: [
      { label: 'Add Bill', description: 'Record a new bill or expense' },
      { label: 'Upload Bill', description: 'Upload a bill document from your files' },
      { label: 'Edit', description: 'Modify bill details' },
      { label: 'Delete', description: 'Remove a bill (requires confirmation)' },
      { label: 'Filters', description: 'Filter bills by category, date, status, or payment type' },
    ],
    formFields: [
      { label: 'Supplier/Vendor', description: 'Who the bill is from', required: true },
      { label: 'Amount', description: 'Total bill amount in dollars', required: true },
      { label: 'Category', description: 'Type of expense (utilities, maintenance, etc.)', required: true },
      { label: 'Due Date', description: 'When payment is due' },
      { label: 'Payment Type', description: 'Recurring (repeats automatically) or Unique (one-time expense)', required: true },
      { label: 'Status', description: 'Pending, Paid, or Overdue' },
      { label: 'Recurrence', description: 'For recurring bills: how often it repeats (monthly, quarterly, yearly)' },
    ],
    relationships: [
      { page: 'Budget', description: 'Bills are used to calculate budget forecasts. Recurring bills create automatic future expenses, while unique bills are one-time entries.' },
      { page: 'Buildings', description: 'Bills are associated with specific buildings' },
    ],
  },
  '/manager/budget': {
    title: 'Budget & Forecast',
    description: 'View financial forecasts and manage budget settings.',
    goal: 'Plan finances, forecast cash flow, and ensure sufficient funds for operations.',
    howToUse: 'View projected income and expenses over time. Adjust settings like inflation rates and starting balance to get accurate forecasts.',
    buttons: [
      { label: 'Settings', description: 'Configure budget parameters like starting balance, inflation rates, and financial year start' },
      { label: 'Refresh', description: 'Recalculate the forecast with current data' },
      { label: 'Filter', description: 'Adjust what data is shown in the forecast' },
    ],
    formFields: [
      { label: 'Bank Account Start Amount', description: 'Your current or starting bank balance', required: true },
      { label: 'Start Date', description: 'When to begin the forecast from' },
      { label: 'Minimum Balance', description: 'Alert threshold for low funds' },
      { label: 'General Inflation Rate', description: 'Expected annual inflation percentage for cost increases' },
    ],
    relationships: [
      { page: 'Bills', description: 'The budget uses your bills to forecast expenses. Recurring bills appear as repeating expenses in future months, while unique bills appear only once. This helps predict your cash flow over time.' },
      { page: 'Invoices', description: 'Income from invoices contributes to the revenue forecast' },
    ],
  },
  '/manager/invoices': {
    title: 'Invoices Management',
    description: 'Create and manage invoices for residents and income tracking.',
    goal: 'Bill residents, track payments, and manage income.',
    howToUse: 'Create invoices for rent, fees, or services. Track payment status and send to residents.',
    buttons: [
      { label: 'New Invoice', description: 'Create an invoice for a resident or service' },
      { label: 'Mark Paid', description: 'Record that an invoice has been paid' },
      { label: 'Send', description: 'Send invoice to the resident via email' },
    ],
    relationships: [
      { page: 'Budget', description: 'Invoice income feeds into budget revenue forecasts' },
      { page: 'Residences', description: 'Invoices are linked to specific residences' },
    ],
  },
  '/manager/demands': {
    title: 'Maintenance Requests',
    description: 'Manage maintenance and service requests from residents.',
    goal: 'Track and respond to resident requests efficiently.',
    howToUse: 'View incoming requests, assign them to staff, and update status as work progresses.',
    buttons: [
      { label: 'View Details', description: 'See full request information and history' },
      { label: 'Update Status', description: 'Change request status (pending, in progress, completed)' },
      { label: 'Assign', description: 'Assign the request to a maintenance person' },
    ],
    relationships: [
      { page: 'Maintenance Projects', description: 'Complex requests may become maintenance projects' },
    ],
  },
  '/manager/user-management': {
    title: 'User Management',
    description: 'Manage users, residents, and their access to the system.',
    goal: 'Add, remove, and manage user accounts and permissions.',
    howToUse: 'Invite new users, assign roles, and manage existing accounts.',
    buttons: [
      { label: 'Invite User', description: 'Send an invitation to a new user' },
      { label: 'Edit Role', description: 'Change a user\'s permissions or role' },
      { label: 'Deactivate', description: 'Remove user access without deleting their data' },
    ],
  },
  '/manager/common-spaces-stats': {
    title: 'Common Spaces Statistics',
    description: 'View usage statistics and bookings for shared amenities.',
    goal: 'Monitor how common spaces are used and optimize their availability.',
    howToUse: 'View booking history, popular times, and usage trends for facilities like gyms, pools, and party rooms.',
    buttons: [
      { label: 'Building', description: 'Return to building selection to choose a different building' },
      { label: 'Create Space', description: 'Add a new common space or amenity to the building' },
      { label: 'Select a space', description: 'Choose which common space to view statistics for' },
      { label: 'Statistics', description: 'View detailed usage statistics and booking data' },
      { label: 'Calendar', description: 'See booking calendar and availability schedule' },
      { label: 'edit space', description: 'Modify the selected common space details and settings' },
      { label: 'EN', description: 'Switch interface language to English' },
      { label: 'FR', description: 'Switch interface language to French (Français)' },
      { label: 'language en', description: 'Switch interface language to English' },
      { label: 'language fr', description: 'Switch interface language to French (Français)' },
    ],
  },
  '/manager/maintenance/inventory': {
    title: 'Maintenance Inventory',
    description: 'Track maintenance equipment, tools, and supplies.',
    goal: 'Manage inventory to ensure necessary items are available for maintenance work.',
    howToUse: 'Add items to inventory, track quantities, and record when items are used or need restocking.',
    buttons: [
      { label: 'Add Item', description: 'Register a new inventory item' },
      { label: 'Update Quantity', description: 'Adjust stock levels' },
      { label: 'Low Stock Alert', description: 'Set minimum quantities for automatic alerts' },
    ],
  },
  '/manager/maintenance/projects': {
    title: 'Maintenance Projects',
    description: 'Manage large-scale maintenance and renovation projects.',
    goal: 'Plan, track, and complete maintenance projects efficiently.',
    howToUse: 'Create projects, track progress, assign tasks, and manage budgets for major work.',
    buttons: [
      { label: 'New Project', description: 'Start a new maintenance project' },
      { label: 'Update Progress', description: 'Record work completed and update status' },
      { label: 'View Timeline', description: 'See project schedule and milestones' },
    ],
    relationships: [
      { page: 'Bills', description: 'Project expenses are tracked as bills' },
      { page: 'Maintenance Inventory', description: 'Projects use inventory items' },
    ],
  },

  // ===== RESIDENTS PAGES =====
  '/residents/residence': {
    title: 'My Residence',
    description: 'View information and details about your home.',
    goal: 'Access your residence information and unit-specific details.',
    howToUse: 'View your unit details, contact information, and access documents.',
    buttons: [
      { label: 'View Documents', description: 'Access documents related to your residence' },
    ],
  },
  '/residents/building': {
    title: 'My Building',
    description: 'Information about your building and shared facilities.',
    goal: 'Learn about your building and access building-wide information.',
    howToUse: 'View building details, amenities, and access building documents.',
    buttons: [
      { label: 'View Documents', description: 'Access building-wide documents' },
    ],
  },
  '/residents/demands': {
    title: 'My Requests',
    description: 'Submit and track your maintenance requests.',
    goal: 'Report issues and monitor their resolution.',
    howToUse: 'Submit new requests for maintenance or services. Track the status of your existing requests.',
    buttons: [
      { label: 'New Request', description: 'Submit a maintenance or service request' },
      { label: 'View Status', description: 'Check the progress of your requests' },
    ],
    formFields: [
      { label: 'Issue Type', description: 'Category of the problem (plumbing, electrical, etc.)', required: true },
      { label: 'Description', description: 'Detailed explanation of the issue', required: true },
      { label: 'Priority', description: 'How urgent is this issue (low, medium, high)' },
      { label: 'Location', description: 'Where in your unit the issue is located' },
    ],
  },
  '/resident/common-spaces': {
    title: 'Common Spaces',
    description: 'Book and manage shared amenity reservations.',
    goal: 'Reserve common areas like gyms, pools, and party rooms.',
    howToUse: 'View available spaces, check availability, and make bookings.',
    buttons: [
      { label: 'Book Space', description: 'Reserve a common area for a specific time' },
      { label: 'View Bookings', description: 'See your current and past reservations' },
      { label: 'Cancel', description: 'Cancel an existing booking' },
    ],
  },
  '/resident/my-calendar': {
    title: 'My Calendar',
    description: 'View your personal calendar of bookings and events.',
    goal: 'Track your reservations and building events.',
    howToUse: 'See all your bookings, building events, and important dates in one place.',
  },

  // ===== SETTINGS PAGES =====
  '/settings/settings': {
    title: 'Settings',
    description: 'Configure your personal preferences and account settings.',
    goal: 'Customize your experience and manage your account.',
    howToUse: 'Update your profile, change password, set notifications, and adjust preferences.',
    buttons: [
      { label: 'Save Changes', description: 'Apply your updated settings' },
      { label: 'Change Password', description: 'Update your account password' },
    ],
  },
  '/settings/bug-reports': {
    title: 'Report a Bug',
    description: 'Report technical issues or problems with the system.',
    goal: 'Help improve the platform by reporting issues.',
    howToUse: 'Describe the problem you encountered, include steps to reproduce it, and submit.',
    buttons: [
      { label: 'Submit Report', description: 'Send your bug report to the development team' },
    ],
    formFields: [
      { label: 'Issue Summary', description: 'Brief description of the problem', required: true },
      { label: 'Steps to Reproduce', description: 'How to recreate the issue' },
      { label: 'Expected Behavior', description: 'What should have happened' },
      { label: 'Actual Behavior', description: 'What actually happened' },
    ],
  },
  '/settings/idea-box': {
    title: 'Idea Box',
    description: 'Share your suggestions for new features or improvements.',
    goal: 'Contribute ideas to make the platform better.',
    howToUse: 'Submit your ideas, vote on others\' suggestions, and see what\'s being considered.',
    buttons: [
      { label: 'Submit Idea', description: 'Share your suggestion for improvement' },
      { label: 'Vote', description: 'Support ideas you like' },
    ],
  },

  // ===== DOCUMENTS PAGES =====
  '/manager/buildings/documents': {
    title: 'Building Documents',
    description: 'Access and manage documents for a specific building.',
    goal: 'Organize and access building-related files and documentation.',
    howToUse: 'Upload, view, download, or delete documents related to the selected building.',
    buttons: [
      { label: 'Upload Document', description: 'Add a new document or file' },
      { label: 'Download', description: 'Download a document to your device' },
      { label: 'Delete', description: 'Remove a document (requires confirmation)' },
    ],
  },
  '/manager/residences/documents': {
    title: 'Residence Documents',
    description: 'Access and manage documents for a specific residence.',
    goal: 'Organize and access unit-specific files and documentation.',
    howToUse: 'Upload, view, download, or delete documents related to the selected residence.',
    buttons: [
      { label: 'Upload Document', description: 'Add a new document or file' },
      { label: 'Download', description: 'Download a document to your device' },
      { label: 'Delete', description: 'Remove a document (requires confirmation)' },
    ],
  },
  '/residents/residence/documents': {
    title: 'My Residence Documents',
    description: 'View documents related to your residence.',
    goal: 'Access important documents about your home.',
    howToUse: 'View and download documents like lease agreements, rules, and notices.',
    buttons: [
      { label: 'View', description: 'Open a document to read it' },
      { label: 'Download', description: 'Save a document to your device' },
    ],
  },
  '/residents/building/documents': {
    title: 'Building Documents',
    description: 'View documents related to your building.',
    goal: 'Access building-wide documents and information.',
    howToUse: 'View and download documents like building rules, notices, and announcements.',
    buttons: [
      { label: 'View', description: 'Open a document to read it' },
      { label: 'Download', description: 'Save a document to your device' },
    ],
  },

  // ===== PUBLIC PAGES =====
  '/': {
    title: 'Home',
    description: 'Welcome to the property management platform.',
    goal: 'Learn about the platform and get started.',
    howToUse: 'Explore features, view pricing, or log in to your account.',
    buttons: [
      { label: 'Get Started', description: 'Begin using the platform' },
      { label: 'Learn More', description: 'Discover features and benefits' },
      { label: 'Login', description: 'Access your account' },
    ],
  },
  '/features': {
    title: 'Features',
    description: 'Explore all the capabilities of the platform.',
    goal: 'Understand what the platform can do for you.',
    howToUse: 'Browse through feature descriptions to see how they can help manage your property.',
  },
  '/pricing': {
    title: 'Pricing',
    description: 'View pricing plans and options.',
    goal: 'Choose the right plan for your needs.',
    howToUse: 'Compare plans, see features included, and select the best option for you.',
  },
  '/security': {
    title: 'Security',
    description: 'Learn about our security measures and data protection.',
    goal: 'Understand how we keep your data safe.',
    howToUse: 'Read about our security practices, compliance, and data protection policies.',
  },
  '/story': {
    title: 'Our Story',
    description: 'Learn about the platform\'s mission and history.',
    goal: 'Understand our vision and values.',
    howToUse: 'Read about why we built this platform and what drives us.',
  },
};

/**
 * Get help content for a specific route
 */
export function getHelpContent(route: string): HelpContent | null {
  // Exact match
  if (helpContentMap[route]) {
    return helpContentMap[route];
  }

  // Try to match dynamic routes (e.g., /manager/buildings/:id/documents)
  for (const [key, value] of Object.entries(helpContentMap)) {
    if (key.includes(':') || route.includes(key)) {
      const keyPattern = key.replace(/:[^/]+/g, '[^/]+');
      const regex = new RegExp(`^${keyPattern}$`);
      if (regex.test(route)) {
        return value;
      }
    }
  }

  // Try partial match for dynamic routes
  if (route.includes('/documents')) {
    if (route.includes('/manager/buildings')) return helpContentMap['/manager/buildings/documents'];
    if (route.includes('/manager/residences')) return helpContentMap['/manager/residences/documents'];
    if (route.includes('/residents/residence')) return helpContentMap['/residents/residence/documents'];
    if (route.includes('/residents/building')) return helpContentMap['/residents/building/documents'];
  }

  return null;
}
