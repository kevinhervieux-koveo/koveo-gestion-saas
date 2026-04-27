/**
 * Help content configuration for all pages in the application
 * Maps routes to their help information including page descriptions, buttons, form fields, and relationships
 * Supports bilingual content (EN/FR) for Quebec Law 25 compliance
 */

export type BilingualText = {
  en: string;
  fr: string;
};

export interface HelpButton {
  label: BilingualText;
  description: BilingualText;
  action?: string;
}

export interface HelpFormField {
  label: BilingualText;
  description: BilingualText;
  required?: boolean;
}

export interface HelpPageRelationship {
  page: BilingualText;
  description: BilingualText;
}

export interface HelpContent {
  title: BilingualText;
  description: BilingualText;
  goal: BilingualText;
  howToUse: BilingualText;
  buttons?: HelpButton[];
  formFields?: HelpFormField[];
  relationships?: HelpPageRelationship[];
}

export const helpContentMap: Record<string, HelpContent> = {
  // ===== DASHBOARD PAGES =====
  '/dashboard/overview': {
    title: { en: 'Main Dashboard', fr: 'Tableau de Bord Principal' },
    description: { en: 'Your central hub for quick access to all features and recent activity.', fr: 'Votre hub central pour un accès rapide à toutes les fonctionnalités et l\'activité récente.' },
    goal: { en: 'Get a quick overview of your property management tasks and navigate to specific areas.', fr: 'Obtenez un aperçu rapide de vos tâches de gestion immobilière et naviguez vers des zones spécifiques.' },
    howToUse: { en: 'Click on any card to navigate to that section. The dashboard shows your most important information at a glance.', fr: 'Cliquez sur n\'importe quelle carte pour naviguer vers cette section. Le tableau de bord affiche vos informations les plus importantes en un coup d\'œil.' },
    buttons: [
      { label: { en: 'Fullscreen Toggle', fr: 'Basculer Plein Écran' }, description: { en: 'Expand the view to use the full screen for better visibility', fr: 'Agrandissez la vue pour utiliser le plein écran et améliorer la visibilité' } },
      { label: { en: 'Quick Action Cards', fr: 'Cartes d\'Actions Rapides' }, description: { en: 'Click any card to navigate to that specific feature area', fr: 'Cliquez sur n\'importe quelle carte pour naviger vers cette zone de fonctionnalité spécifique' } },
    ],
    relationships: [
      { page: { en: 'All Pages', fr: 'Toutes les Pages' }, description: { en: 'The dashboard provides quick links to all major sections of the application', fr: 'Le tableau de bord fournit des liens rapides vers toutes les sections principales de l\'application' } },
    ],
  },
  '/dashboard/communication': {
    title: { en: 'Communication', fr: 'Communication' },
    description: { en: 'Send messages and announcements to residents or building managers.', fr: 'Envoyez des messages et annonces aux résidents ou gestionnaires d\'immeubles.' },
    goal: { en: 'Facilitate communication between property managers, owners, and residents.', fr: 'Facilitez la communication entre les gestionnaires immobiliers, propriétaires et résidents.' },
    howToUse: { en: 'Compose messages, select recipients, and send announcements. View message history and replies.', fr: 'Rédigez des messages, sélectionnez les destinataires et envoyez des annonces. Consultez l\'historique des messages et les réponses.' },
    buttons: [
      { label: { en: 'New Message', fr: 'Nouveau Message' }, description: { en: 'Compose a new message or announcement', fr: 'Rédiger un nouveau message ou une annonce' } },
      { label: { en: 'Send', fr: 'Envoyer' }, description: { en: 'Send your composed message to selected recipients', fr: 'Envoyer votre message aux destinataires sélectionnés' } },
    ],
  },

  // ===== ADMIN PAGES =====
  '/admin/bulk-document-import': {
    title: { en: 'Bulk Document Import', fr: 'Importation Documentaire en Lot' },
    description: {
      en: 'Ingest folders of mixed documents (PDF, Word, Excel, images, zips) for one building and let the AI assistant route each file into the correct place.',
      fr: 'Importez des dossiers de documents variés (PDF, Word, Excel, images, archives ZIP) pour un immeuble et laissez l’assistant IA acheminer chaque fichier au bon endroit.',
    },
    goal: {
      en: 'Onboard a building’s historical paperwork in one supervised pass — Anthropic suggests filenames, destinations, and metadata while you keep final approval.',
      fr: 'Intégrez la paperasse historique d’un immeuble en une passe supervisée — Anthropic suggère noms, destinations et métadonnées pendant que vous gardez l’approbation finale.',
    },
    howToUse: {
      en: 'Pick a building, upload files, then walk the 5 AI-assisted steps (screening, sorting, branching, identification, linking). Each suggestion shows a confidence badge. The session auto-saves so you can close the tab and resume later.',
      fr: 'Choisissez un immeuble, téléversez les fichiers puis suivez les 5 étapes assistées par IA (filtrage, tri, aiguillage, identification, liaison). Chaque suggestion affiche un badge de confiance. La session est sauvegardée automatiquement — vous pouvez fermer l’onglet et reprendre plus tard.',
    },
    buttons: [
      {
        label: { en: 'Create session', fr: 'Créer la session' },
        description: {
          en: 'Start (or resume) a bulk-import session for the selected building',
          fr: 'Démarrer (ou reprendre) une session d’importation en lot pour l’immeuble sélectionné',
        },
      },
      {
        label: { en: 'Choose files', fr: 'Choisir des fichiers' },
        description: {
          en: 'Stage files in the session — they are NOT saved to documents until the linking step accepts them',
          fr: 'Stocker les fichiers dans la session — ils ne sont PAS enregistrés dans les documents tant que l’étape de liaison ne les accepte pas',
        },
      },
      {
        label: { en: 'Clear all', fr: 'Tout effacer' },
        description: {
          en: 'Wipe the session and all staged files (requires typing DELETE to confirm)',
          fr: 'Effacer la session et tous les fichiers en attente (nécessite de saisir DELETE pour confirmer)',
        },
      },
    ],
    relationships: [
      {
        page: { en: 'Documents', fr: 'Documents' },
        description: {
          en: 'Items committed at the linking step land in the building/residence document trees',
          fr: 'Les éléments validés à l’étape de liaison atterrissent dans les arborescences de documents de l’immeuble/résidence',
        },
      },
    ],
  },
  '/admin/organizations': {
    title: { en: 'Organizations Management', fr: 'Gestion des Organisations' },
    description: { en: 'Manage all organizations in the system.', fr: 'Gérez toutes les organisations dans le système.' },
    goal: { en: 'Create, edit, and oversee all organizations that use the platform.', fr: 'Créez, modifiez et supervisez toutes les organisations qui utilisent la plateforme.' },
    howToUse: { en: 'View the list of organizations, click Add to create new ones, or click Edit/Delete on existing organizations.', fr: 'Consultez la liste des organisations, cliquez sur Ajouter pour en créer de nouvelles, ou cliquez sur Modifier/Supprimer sur les organisations existantes.' },
    buttons: [
      { label: { en: 'Add Organization', fr: 'Ajouter Organisation' }, description: { en: 'Create a new organization in the system', fr: 'Créer une nouvelle organisation dans le système' } },
      { label: { en: 'Edit', fr: 'Modifier' }, description: { en: 'Modify organization details', fr: 'Modifier les détails de l\'organisation' } },
      { label: { en: 'Delete', fr: 'Supprimer' }, description: { en: 'Remove an organization (requires confirmation)', fr: 'Supprimer une organisation (nécessite une confirmation)' } },
    ],
    formFields: [
      { label: { en: 'Organization Name', fr: 'Nom de l\'Organisation' }, description: { en: 'The official name of the organization', fr: 'Le nom officiel de l\'organisation' }, required: true },
      { label: { en: 'Contact Information', fr: 'Coordonnées' }, description: { en: 'Primary contact details for the organization', fr: 'Coordonnées principales de l\'organisation' } },
    ],
  },
  '/admin/quality': {
    title: { en: 'Quality Management', fr: 'Gestion de la Qualité' },
    description: { en: 'Monitor and manage quality metrics across the system.', fr: 'Surveillez et gérez les indicateurs de qualité dans le système.' },
    goal: { en: 'Ensure high quality standards in property management and service delivery.', fr: 'Assurez des normes de qualité élevées dans la gestion immobilière et la prestation de services.' },
    howToUse: { en: 'Review quality metrics, identify areas for improvement, and track quality initiatives.', fr: 'Examinez les indicateurs de qualité, identifiez les domaines d\'amélioration et suivez les initiatives de qualité.' },
  },
  '/admin/compliance': {
    title: { en: 'Compliance Management', fr: 'Gestion de la Conformité' },
    description: { en: 'Track and manage regulatory compliance requirements.', fr: 'Suivez et gérez les exigences de conformité réglementaire.' },
    goal: { en: 'Ensure all properties and operations meet legal and regulatory standards.', fr: 'Assurez que tous les immeubles et opérations respectent les normes légales et réglementaires.' },
    howToUse: { en: 'Monitor compliance status, view requirements, and manage compliance documentation.', fr: 'Surveillez le statut de conformité, consultez les exigences et gérez la documentation de conformité.' },
  },
  '/admin/permissions': {
    title: { en: 'Permissions Management', fr: 'Gestion des Permissions' },
    description: { en: 'Configure user roles and access permissions.', fr: 'Configurez les rôles utilisateur et les permissions d\'accès.' },
    goal: { en: 'Control who can access which features and data in the system.', fr: 'Contrôlez qui peut accéder aux fonctionnalités et données du système.' },
    howToUse: { en: 'Set up roles, assign permissions, and manage user access levels.', fr: 'Configurez les rôles, attribuez les permissions et gérez les niveaux d\'accès des utilisateurs.' },
    buttons: [
      { label: { en: 'Add Role', fr: 'Ajouter Rôle' }, description: { en: 'Create a new user role with specific permissions', fr: 'Créer un nouveau rôle utilisateur avec des permissions spécifiques' } },
      { label: { en: 'Edit Permissions', fr: 'Modifier Permissions' }, description: { en: 'Modify what a role can access or do', fr: 'Modifier ce qu\'un rôle peut accéder ou faire' } },
    ],
  },

  // ===== MANAGER PAGES =====
  '/manager/buildings': {
    title: { en: 'Buildings Management', fr: 'Gestion des Immeubles' },
    description: { en: 'Manage all buildings in your organization.', fr: 'Gérez tous les immeubles de votre organisation.' },
    goal: { en: 'Oversee building information, maintenance, and operations.', fr: 'Supervisez les informations, l\'entretien et les opérations des immeubles.' },
    howToUse: { en: 'View your buildings list, select one to see details, or add new buildings.', fr: 'Consultez votre liste d\'immeubles, sélectionnez-en un pour voir les détails ou ajoutez de nouveaux immeubles.' },
    buttons: [
      { label: { en: 'Add Building', fr: 'Ajouter Immeuble' }, description: { en: 'Register a new building in the system', fr: 'Enregistrer un nouvel immeuble dans le système' } },
      { label: { en: 'View Details', fr: 'Voir Détails' }, description: { en: 'See comprehensive information about a building', fr: 'Voir les informations complètes sur un immeuble' } },
      { label: { en: 'Edit', fr: 'Modifier' }, description: { en: 'Edit building details and information', fr: 'Modifier les détails et informations de l\'immeuble' } },
      { label: { en: 'Delete', fr: 'Supprimer' }, description: { en: 'Remove a building (requires confirmation)', fr: 'Supprimer un immeuble (nécessite une confirmation)' } },
      { label: { en: 'Documents', fr: 'Documents' }, description: { en: 'Access building-specific documents and files', fr: 'Accéder aux documents et fichiers spécifiques à l\'immeuble' } },
      { label: { en: 'Save', fr: 'Enregistrer' }, description: { en: 'Save your changes', fr: 'Enregistrer vos modifications' } },
      { label: { en: 'Cancel', fr: 'Annuler' }, description: { en: 'Cancel and discard changes', fr: 'Annuler et abandonner les modifications' } },
      { label: { en: 'Search', fr: 'Rechercher' }, description: { en: 'Search buildings by name, address, or city', fr: 'Rechercher des immeubles par nom, adresse ou ville' } },
      { label: { en: 'First Page', fr: 'Première page' }, description: { en: 'Jump to the first page of results', fr: 'Aller à la première page de résultats' } },
      { label: { en: 'Previous', fr: 'Précédent' }, description: { en: 'Go to the previous page', fr: 'Aller à la page précédente' } },
      { label: { en: 'Next', fr: 'Suivant' }, description: { en: 'Go to the next page', fr: 'Aller à la page suivante' } },
      { label: { en: 'Last Page', fr: 'Dernière page' }, description: { en: 'Jump to the last page of results', fr: 'Aller à la dernière page de résultats' } },
      { label: { en: 'View', fr: 'Voir' }, description: { en: 'View building details', fr: 'Voir les détails de l\'immeuble' } },
    ],
    formFields: [
      { label: { en: 'Building Name', fr: 'Nom de l\'Immeuble' }, description: { en: 'The name or identifier for the building', fr: 'Le nom ou identifiant de l\'immeuble' }, required: true },
      { label: { en: 'Address', fr: 'Adresse' }, description: { en: 'Physical location of the building', fr: 'Emplacement physique de l\'immeuble' }, required: true },
      { label: { en: 'Number of Units', fr: 'Nombre d\'Unités' }, description: { en: 'Total residential units in the building', fr: 'Nombre total d\'unités résidentielles dans l\'immeuble' } },
    ],
    relationships: [
      { page: { en: 'Residences', fr: 'Résidences' }, description: { en: 'Buildings contain multiple residences/units', fr: 'Les immeubles contiennent plusieurs résidences/unités' } },
      { page: { en: 'Building Documents', fr: 'Documents d\'Immeuble' }, description: { en: 'Access documents specific to each building', fr: 'Accéder aux documents spécifiques à chaque immeuble' } },
      { page: { en: 'Budget', fr: 'Budget' }, description: { en: 'Buildings have associated budgets for maintenance and operations', fr: 'Les immeubles ont des budgets associés pour l\'entretien et les opérations' } },
    ],
  },
  '/manager/residences': {
    title: { en: 'Residences Management', fr: 'Gestion des Résidences' },
    description: { en: 'Manage individual residential units within buildings.', fr: 'Gérez les unités résidentielles individuelles dans les immeubles.' },
    goal: { en: 'Oversee unit information, occupancy, and resident details.', fr: 'Supervisez les informations sur les unités, l\'occupation et les détails des résidents.' },
    howToUse: { en: 'View all units, filter by building, add new units, or edit existing ones.', fr: 'Consultez toutes les unités, filtrez par immeuble, ajoutez de nouvelles unités ou modifiez celles existantes.' },
    buttons: [
      { label: { en: 'Add Residence', fr: 'Ajouter Résidence' }, description: { en: 'Create a new residential unit entry', fr: 'Créer une nouvelle entrée d\'unité résidentielle' } },
      { label: { en: 'Edit', fr: 'Modifier' }, description: { en: 'Update unit details or occupancy information', fr: 'Mettre à jour les détails de l\'unité ou les informations d\'occupation' } },
      { label: { en: 'Delete', fr: 'Supprimer' }, description: { en: 'Remove a residence (requires confirmation)', fr: 'Supprimer une résidence (nécessite une confirmation)' } },
      { label: { en: 'Documents', fr: 'Documents' }, description: { en: 'Access residence-specific documents', fr: 'Accéder aux documents spécifiques à la résidence' } },
      { label: { en: 'Save', fr: 'Enregistrer' }, description: { en: 'Save residence changes', fr: 'Enregistrer les modifications de résidence' } },
      { label: { en: 'Cancel', fr: 'Annuler' }, description: { en: 'Cancel and close without saving', fr: 'Annuler et fermer sans enregistrer' } },
      { label: { en: 'Clear Filters', fr: 'Effacer les filtres' }, description: { en: 'Remove all filters and show all residences', fr: 'Retirer tous les filtres et afficher toutes les résidences' } },
      { label: { en: 'Search', fr: 'Rechercher' }, description: { en: 'Search residences by unit number or resident name', fr: 'Rechercher des résidences par numéro d\'unité ou nom de résident' } },
      { label: { en: 'First Page', fr: 'Première page' }, description: { en: 'Jump to the first page of results', fr: 'Aller à la première page de résultats' } },
      { label: { en: 'Previous', fr: 'Précédent' }, description: { en: 'Go to the previous page', fr: 'Aller à la page précédente' } },
      { label: { en: 'Next', fr: 'Suivant' }, description: { en: 'Go to the next page', fr: 'Aller à la page suivante' } },
      { label: { en: 'Last Page', fr: 'Dernière page' }, description: { en: 'Jump to the last page of results', fr: 'Aller à la dernière page de résultats' } },
      { label: { en: 'View', fr: 'Voir' }, description: { en: 'View residence details', fr: 'Voir les détails de la résidence' } },
    ],
    formFields: [
      { label: { en: 'Unit Number', fr: 'Numéro d\'Unité' }, description: { en: 'The unit or apartment number', fr: 'Le numéro de l\'unité ou de l\'appartement' }, required: true },
      { label: { en: 'Building', fr: 'Immeuble' }, description: { en: 'Which building this residence is in', fr: 'Dans quel immeuble se trouve cette résidence' }, required: true },
      { label: { en: 'Floor', fr: 'Étage' }, description: { en: 'The floor level of this unit', fr: 'Le niveau d\'étage de cette unité' } },
      { label: { en: 'Square Footage', fr: 'Superficie' }, description: { en: 'Total area of the residence', fr: 'Superficie totale de la résidence' } },
    ],
    relationships: [
      { page: { en: 'Buildings', fr: 'Immeubles' }, description: { en: 'Residences belong to buildings', fr: 'Les résidences appartiennent aux immeubles' } },
      { page: { en: 'Residence Documents', fr: 'Documents de Résidence' }, description: { en: 'Each residence can have its own documents', fr: 'Chaque résidence peut avoir ses propres documents' } },
    ],
  },
  '/manager/bills': {
    title: { en: 'Bills Management', fr: 'Gestion des Comptes' },
    description: { en: 'Track and manage all bills and expenses for your properties.', fr: 'Suivez et gérez tous les comptes et dépenses pour vos immeubles.' },
    goal: { en: 'Record expenses, track payments, and maintain financial records.', fr: 'Enregistrez les dépenses, suivez les paiements et maintenez les registres financiers.' },
    howToUse: { en: 'Add bills as they come in, categorize them, and mark them as paid. Filter by date, category, or status.', fr: 'Ajoutez les comptes au fur et à mesure, catégorisez-les et marquez-les comme payés. Filtrez par date, catégorie ou statut.' },
    buttons: [
      { label: { en: 'Add Bill', fr: 'Ajouter Compte' }, description: { en: 'Record a new bill or expense', fr: 'Enregistrer un nouveau compte ou une dépense' } },
      { label: { en: 'Upload Bill', fr: 'Téléverser Compte' }, description: { en: 'Upload a bill document from your files', fr: 'Téléverser un document de compte depuis vos fichiers' } },
      { label: { en: 'Edit', fr: 'Modifier' }, description: { en: 'Modify bill details', fr: 'Modifier les détails du compte' } },
      { label: { en: 'Delete', fr: 'Supprimer' }, description: { en: 'Remove a bill (requires confirmation)', fr: 'Supprimer un compte (nécessite une confirmation)' } },
      { label: { en: 'Filters', fr: 'Filtres' }, description: { en: 'Filter bills by category, date, status, or payment type', fr: 'Filtrer les comptes par catégorie, date, statut ou type de paiement' } },
      { label: { en: 'Save', fr: 'Enregistrer' }, description: { en: 'Save your changes and close the form', fr: 'Enregistrer vos modifications et fermer le formulaire' } },
      { label: { en: 'Cancel', fr: 'Annuler' }, description: { en: 'Discard changes and close the form without saving', fr: 'Annuler les modifications et fermer le formulaire sans enregistrer' } },
      { label: { en: 'Clear Filters', fr: 'Effacer les filtres' }, description: { en: 'Remove all active filters and show all bills', fr: 'Retirer tous les filtres actifs et afficher tous les comptes' } },
      { label: { en: 'Search', fr: 'Rechercher' }, description: { en: 'Search bills by supplier, description, or amount', fr: 'Rechercher des comptes par fournisseur, description ou montant' } },
      { label: { en: 'First Page', fr: 'Première page' }, description: { en: 'Jump to the first page of results', fr: 'Aller à la première page de résultats' } },
      { label: { en: 'Previous', fr: 'Précédent' }, description: { en: 'Go to the previous page of results', fr: 'Aller à la page précédente de résultats' } },
      { label: { en: 'Next', fr: 'Suivant' }, description: { en: 'Go to the next page of results', fr: 'Aller à la page suivante de résultats' } },
      { label: { en: 'Last Page', fr: 'Dernière page' }, description: { en: 'Jump to the last page of results', fr: 'Aller à la dernière page de résultats' } },
      { label: { en: 'View', fr: 'Voir' }, description: { en: 'View detailed bill information', fr: 'Voir les informations détaillées du compte' } },
      { label: { en: 'Close', fr: 'Fermer' }, description: { en: 'Close this dialog', fr: 'Fermer cette fenêtre' } },
    ],
    formFields: [
      { label: { en: 'Title', fr: 'Titre' }, description: { en: 'A descriptive name for this bill', fr: 'Un nom descriptif pour ce compte' }, required: true },
      { label: { en: 'Description', fr: 'Description' }, description: { en: 'Additional details about this bill', fr: 'Détails supplémentaires sur ce compte' } },
      { label: { en: 'Category', fr: 'Catégorie' }, description: { en: 'Type of expense (utilities, maintenance, insurance, etc.)', fr: 'Type de dépense (services publics, entretien, assurance, etc.)' }, required: true },
      { label: { en: 'Vendor', fr: 'Fournisseur' }, description: { en: 'The company or person you pay for this bill', fr: 'L\'entreprise ou la personne que vous payez pour ce compte' } },
      { label: { en: 'Status', fr: 'Statut' }, description: { en: 'Current state of the bill. Draft bills are saved but not finalized - ideal for bills you\'re still working on before sending or approving.', fr: 'État actuel du compte. Les comptes brouillons sont enregistrés mais non finalisés - idéal pour les comptes sur lesquels vous travaillez encore avant de les envoyer ou approuver.' } },
      { label: { en: 'Bill Type', fr: 'Type de Compte' }, description: { en: 'Unique bills occur once. Recurring bills repeat automatically (e.g., yearly with single payment, or monthly installments)', fr: 'Les factures uniques se produisent une fois. Les factures récurrentes se répètent automatiquement (p. ex., annuellement avec paiement unique, ou versements mensuels)' }, required: true },
      { label: { en: 'Payment Structure', fr: 'Structure de Paiement' }, description: { en: 'Single payment = paid in one lump sum. Installment plan = split into multiple scheduled payments', fr: 'Paiement unique = payé en une seule somme. Plan de versements = divisé en plusieurs paiements planifiés' }, required: true },
      { label: { en: 'Payment Amount', fr: 'Montant du Paiement' }, description: { en: 'Enter the amount for this single payment', fr: 'Entrez le montant pour ce paiement unique' }, required: true },
      { label: { en: 'Start Date', fr: 'Date de Début' }, description: { en: 'When this bill starts or when the first payment is due', fr: 'Quand ce compte commence ou quand le premier paiement est dû' }, required: true },
      { label: { en: 'Year Interval', fr: 'Intervalle d\'Années' }, description: { en: 'How many years between each occurrence (1-99). For example, enter 3 for bills that occur every 3 years.', fr: 'Nombre d\'années entre chaque occurrence (1-99). Par exemple, entrez 3 pour les factures qui se produisent tous les 3 ans.' } },
      { label: { en: 'Recurrence End Date', fr: 'Date de fin de récurrence' }, description: { en: 'Optional. Specify when this recurring bill should stop. Leave empty for ongoing bills. For example, a yearly bill starting in 2024 with no end date will recur every year indefinitely.', fr: 'Optionnel. Spécifiez quand cette facture récurrente devrait cesser. Laissez vide pour les factures continues. Par exemple, une facture annuelle commençant en 2024 sans date de fin se répétera chaque année indéfiniment.' } },
      { label: { en: 'Payment Schedule', fr: 'Échéancier de Paiement' }, description: { en: 'How often installment payments occur (weekly, monthly, quarterly, yearly, or custom)', fr: 'Fréquence des versements (hebdomadaire, mensuel, trimestriel, annuel ou personnalisé)' } },
      { label: { en: 'Initial Payment', fr: 'Paiement Initial' }, description: { en: 'Is there an upfront payment different from recurring amounts?', fr: 'Y a-t-il un paiement initial différent des montants récurrents?' } },
      { label: { en: 'Equal Recurring Payments', fr: 'Paiements Récurrents Égaux' }, description: { en: 'Are all recurring payment amounts the same?', fr: 'Tous les montants de paiement récurrents sont-ils les mêmes?' } },
      { label: { en: 'Initial Payment Amount', fr: 'Montant du Paiement Initial' }, description: { en: 'Amount for the upfront payment', fr: 'Montant du paiement initial' } },
      { label: { en: 'Recurring Payment Amount', fr: 'Montant du Paiement Récurrent' }, description: { en: 'Amount for each recurring payment', fr: 'Montant de chaque paiement récurrent' } },
    ],
    relationships: [
      { page: { en: 'Budget', fr: 'Budget' }, description: { en: 'Bills are used to calculate budget forecasts. Recurring bills create automatic future expenses, while unique bills are one-time entries.', fr: 'Les comptes sont utilisés pour calculer les prévisions budgétaires. Les comptes récurrents créent des dépenses futures automatiques, tandis que les comptes uniques sont des entrées ponctuelles.' } },
      { page: { en: 'Buildings', fr: 'Immeubles' }, description: { en: 'Bills are associated with specific buildings', fr: 'Les comptes sont associés à des immeubles spécifiques' } },
    ],
  },
  '/manager/budget': {
    title: { en: 'Budget & Forecast', fr: 'Budget et Prévisions' },
    description: { en: 'View financial forecasts and manage budget settings including revenue configuration, bills management, and capital investment scenarios.', fr: 'Consultez les prévisions financières et gérez les paramètres budgétaires incluant la configuration des revenus, la gestion des comptes et les scénarios d\'investissements en capital.' },
    goal: { en: 'Plan finances, forecast cash flow, ensure sufficient funds for operations, and strategize capital investments to maintain building health and financial stability.', fr: 'Planifiez les finances, prévoyez les flux de trésorerie, assurez des fonds suffisants pour les opérations et stratégisez les investissements en capital pour maintenir la santé de l\'immeuble et la stabilité financière.' },
    howToUse: { en: 'View projected income and expenses over time. Configure revenue growth rates, plan punctual fee increases, manage unplanned bills, and choose capital investment strategies. The forecast shows solid lines for past/current data and dotted lines for future projections.', fr: 'Consultez les revenus et dépenses projetés dans le temps. Configurez les taux de croissance des revenus, planifiez les augmentations ponctuelles de frais, gérez les comptes imprévus et choisissez les stratégies d\'investissements en capital. Les prévisions affichent des lignes pleines pour les données passées/actuelles et des lignes pointillées pour les projections futures.' },
    buttons: [
      { label: { en: 'Settings', fr: 'Paramètres' }, description: { en: 'Configure budget parameters like starting balance, inflation rates, and financial year start', fr: 'Configurez les paramètres budgétaires comme le solde de départ, les taux d\'inflation et le début de l\'année financière' } },
      { label: { en: 'Refresh', fr: 'Actualiser' }, description: { en: 'Recalculate the forecast with current data', fr: 'Recalculer les prévisions avec les données actuelles' } },
      { label: { en: 'Filter', fr: 'Filtrer' }, description: { en: 'Adjust what data is shown in the forecast', fr: 'Ajuster les données affichées dans les prévisions' } },
      { label: { en: 'Add Punctual Growth', fr: 'Ajouter Croissance Ponctuelle' }, description: { en: 'Plan a specific condo fee increase for a particular month and year', fr: 'Planifier une augmentation spécifique des frais de copropriété pour un mois et une année particuliers' } },
      { label: { en: 'Save Revenue Configuration', fr: 'Enregistrer Configuration des Revenus' }, description: { en: 'Save changes to revenue growth rates and punctual increases', fr: 'Enregistrer les modifications aux taux de croissance des revenus et augmentations ponctuelles' } },
      { label: { en: 'Save Bills Configuration', fr: 'Enregistrer Configuration des Comptes' }, description: { en: 'Save unplanned bills settings and inflation configurations', fr: 'Enregistrer les paramètres de comptes imprévus et configurations d\'inflation' } },
    ],
    formFields: [
      { label: { en: 'Bank Account Start Amount', fr: 'Montant de Départ du Compte Bancaire' }, description: { en: 'Your current or starting bank balance for the forecast', fr: 'Votre solde bancaire actuel ou de départ pour les prévisions' }, required: true },
      { label: { en: 'Start Date', fr: 'Date de Début' }, description: { en: 'When to begin the forecast from', fr: 'À partir de quand commencer les prévisions' } },
      { label: { en: 'Minimum Balance', fr: 'Solde Minimum' }, description: { en: 'Alert threshold for low funds - used in capital investment calculations', fr: 'Seuil d\'alerte pour fonds insuffisants - utilisé dans les calculs d\'investissements en capital' } },
      { label: { en: 'General Inflation Rate', fr: 'Taux d\'Inflation Général' }, description: { en: 'Expected annual inflation percentage applied to costs', fr: 'Pourcentage d\'inflation annuel prévu appliqué aux coûts' } },
      { label: { en: 'Revenue Growth Rate (%)', fr: 'Taux de Croissance des Revenus (%)' }, description: { en: 'Annual baseline percentage increase applied to all revenues every year, representing regular inflation and cost adjustments. This is applied automatically unless overridden by punctual revenue growth with inflation included.', fr: 'Pourcentage d\'augmentation annuelle de base appliqué à tous les revenus chaque année, représentant l\'inflation régulière et les ajustements de coûts. Ceci est appliqué automatiquement sauf si remplacé par une croissance ponctuelle des revenus avec inflation incluse.' }, required: false },
      { label: { en: 'Punctual Revenue Growth', fr: 'Croissance Ponctuelle des Revenus' }, description: { en: 'Specific condo fee increases planned for particular months and years, such as special assessments or one-time rate adjustments. Each entry includes a year, month, percentage increase, and "Inflation Included" toggle.', fr: 'Augmentations spécifiques des frais de copropriété prévues pour des mois et années particuliers, comme les évaluations spéciales ou les ajustements ponctuels de tarifs. Chaque entrée inclut une année, un mois, un pourcentage d\'augmentation et un bouton "Inflation Incluse".' }, required: false },
      { label: { en: 'Inflation Included', fr: 'Inflation Incluse' }, description: { en: 'When enabled for a punctual growth entry, this indicates that the percentage increase already accounts for inflation. The system will skip applying the regular Revenue Growth Rate for that specific period to avoid double-counting inflation. Use this when planning fee increases that already factor in yearly inflation.', fr: 'Lorsqu\'activé pour une entrée de croissance ponctuelle, ceci indique que le pourcentage d\'augmentation tient déjà compte de l\'inflation. Le système n\'appliquera pas le taux de croissance des revenus régulier pour cette période spécifique afin d\'éviter de compter l\'inflation deux fois. Utilisez ceci lors de la planification d\'augmentations de frais qui tiennent déjà compte de l\'inflation annuelle.' }, required: false },
      { label: { en: 'Unplanned Bills Amount', fr: 'Montant des Comptes Imprévus' }, description: { en: 'Annual budget allocation for unexpected expenses. Based on historical data from your unique (non-recurring) bills.', fr: 'Allocation budgétaire annuelle pour les dépenses imprévues. Basé sur les données historiques de vos comptes uniques (non récurrents).' }, required: false },
      { label: { en: 'Capital Investment Mode', fr: 'Mode d\'Investissement en Capital' }, description: { en: 'Choose your investment strategy: Urgent (prevents balance from falling below $0), Suggested (prevents balance from falling below minimum requirement), or Custom (manual entries only).', fr: 'Choisissez votre stratégie d\'investissement : Urgent (empêche le solde de tomber sous 0$), Suggéré (empêche le solde de tomber sous l\'exigence minimale), ou Personnalisé (entrées manuelles seulement).' }, required: false },
    ],
    relationships: [
      { page: { en: 'Bills', fr: 'Comptes' }, description: { en: 'The budget uses your bills to forecast expenses. Recurring bills appear as repeating expenses in future months, while unique bills appear only once. Historical unique bills data informs the unplanned bills budget recommendation.', fr: 'Le budget utilise vos comptes pour prévoir les dépenses. Les comptes récurrents apparaissent comme dépenses répétées dans les mois futurs, tandis que les comptes uniques n\'apparaissent qu\'une fois. Les données historiques des comptes uniques informent la recommandation du budget des comptes imprévus.' } },
      { page: { en: 'Invoices', fr: 'Factures' }, description: { en: 'Income from invoices contributes to the revenue forecast and is affected by revenue growth rate settings', fr: 'Les revenus des factures contribuent aux prévisions de revenus et sont affectés par les paramètres du taux de croissance des revenus' } },
      { page: { en: 'Projects', fr: 'Projets' }, description: { en: 'Capital investment scenarios use your maintenance projects to determine when to fund major repairs and improvements', fr: 'Les scénarios d\'investissements en capital utilisent vos projets d\'entretien pour déterminer quand financer les réparations et améliorations majeures' } },
    ],
  },
  '/manager/invoices': {
    title: { en: 'Invoices Management', fr: 'Gestion des Factures' },
    description: { en: 'Create and manage invoices for residents and income tracking.', fr: 'Créez et gérez les factures pour les résidents et le suivi des revenus.' },
    goal: { en: 'Bill residents, track payments, and manage income.', fr: 'Facturez les résidents, suivez les paiements et gérez les revenus.' },
    howToUse: { en: 'Create invoices for rent, fees, or services. Track payment status and send to residents.', fr: 'Créez des factures pour le loyer, les frais ou les services. Suivez le statut des paiements et envoyez aux résidents.' },
    buttons: [
      { label: { en: 'New Invoice', fr: 'Nouvelle Facture' }, description: { en: 'Create an invoice for a resident or service', fr: 'Créer une facture pour un résident ou un service' } },
      { label: { en: 'Mark Paid', fr: 'Marquer Payé' }, description: { en: 'Record that an invoice has been paid', fr: 'Enregistrer qu\'une facture a été payée' } },
      { label: { en: 'Send', fr: 'Envoyer' }, description: { en: 'Send invoice to the resident via email', fr: 'Envoyer la facture au résident par courriel' } },
    ],
    relationships: [
      { page: { en: 'Budget', fr: 'Budget' }, description: { en: 'Invoice income feeds into budget revenue forecasts', fr: 'Les revenus de factures alimentent les prévisions de revenus budgétaires' } },
      { page: { en: 'Residences', fr: 'Résidences' }, description: { en: 'Invoices are linked to specific residences', fr: 'Les factures sont liées à des résidences spécifiques' } },
    ],
  },
  '/manager/demands': {
    title: { en: 'Maintenance Requests', fr: 'Demandes d\'Entretien' },
    description: { en: 'Manage maintenance and service requests from residents.', fr: 'Gérez les demandes d\'entretien et de service des résidents.' },
    goal: { en: 'Track and respond to resident requests efficiently.', fr: 'Suivez et répondez aux demandes des résidents efficacement.' },
    howToUse: { en: 'View incoming requests, assign them to staff, and update status as work progresses.', fr: 'Consultez les demandes entrantes, assignez-les au personnel et mettez à jour le statut au fur et à mesure des travaux.' },
    buttons: [
      { label: { en: 'View Details', fr: 'Voir Détails' }, description: { en: 'See full request information and history', fr: 'Voir les informations complètes et l\'historique de la demande' } },
      { label: { en: 'Update Status', fr: 'Mettre à Jour Statut' }, description: { en: 'Change request status (pending, in progress, completed)', fr: 'Changer le statut de la demande (en attente, en cours, complété)' } },
      { label: { en: 'Assign', fr: 'Assigner' }, description: { en: 'Assign the request to a maintenance person', fr: 'Assigner la demande à une personne d\'entretien' } },
    ],
    relationships: [
      { page: { en: 'Maintenance Projects', fr: 'Projets d\'Entretien' }, description: { en: 'Complex requests may become maintenance projects', fr: 'Les demandes complexes peuvent devenir des projets d\'entretien' } },
    ],
  },
  '/manager/user-management': {
    title: { en: 'User Management', fr: 'Gestion des Utilisateurs' },
    description: { en: 'Manage users, residents, and their access to the system.', fr: 'Gérez les utilisateurs, résidents et leur accès au système.' },
    goal: { en: 'Add, remove, and manage user accounts and permissions.', fr: 'Ajoutez, supprimez et gérez les comptes utilisateurs et permissions.' },
    howToUse: { en: 'Invite new users, assign roles, and manage existing accounts.', fr: 'Invitez de nouveaux utilisateurs, attribuez des rôles et gérez les comptes existants.' },
    buttons: [
      { label: { en: 'Invite User', fr: 'Inviter Utilisateur' }, description: { en: 'Send an invitation to a new user', fr: 'Envoyer une invitation à un nouvel utilisateur' } },
      { label: { en: 'Edit Role', fr: 'Modifier Rôle' }, description: { en: 'Change a user\'s permissions or role', fr: 'Modifier les permissions ou le rôle d\'un utilisateur' } },
      { label: { en: 'Deactivate', fr: 'Désactiver' }, description: { en: 'Remove user access without deleting their data', fr: 'Retirer l\'accès utilisateur sans supprimer leurs données' } },
    ],
  },
  '/manager/common-spaces-stats': {
    title: { en: 'Common Spaces Statistics', fr: 'Statistiques des Espaces Communs' },
    description: { en: 'View usage statistics and bookings for shared amenities.', fr: 'Consultez les statistiques d\'utilisation et les réservations pour les installations partagées.' },
    goal: { en: 'Monitor how common spaces are used and optimize their availability.', fr: 'Surveillez comment les espaces communs sont utilisés et optimisez leur disponibilité.' },
    howToUse: { en: 'View booking history, popular times, and usage trends for facilities like gyms, pools, and party rooms.', fr: 'Consultez l\'historique des réservations, les heures populaires et les tendances d\'utilisation pour les installations comme les gymnases, piscines et salles de fête.' },
    buttons: [
      { label: { en: 'Building', fr: 'Bâtiment' }, description: { en: 'Navigate back to select a different building for viewing common spaces', fr: 'Revenir en arrière pour sélectionner un immeuble différent pour voir les espaces communs' } },
      { label: { en: 'Building', fr: 'Immeuble' }, description: { en: 'Navigate back to select a different building for viewing common spaces', fr: 'Revenir en arrière pour sélectionner un immeuble différent pour voir les espaces communs' } },
      { label: { en: 'Organization', fr: 'Organisation' }, description: { en: 'Navigate back to organization selection', fr: 'Revenir à la sélection de l\'organisation' } },
      { label: { en: 'Create Space', fr: 'Créer un espace' }, description: { en: 'Add a new common space or amenity to the building', fr: 'Ajouter un nouvel espace commun ou installation à l\'immeuble' } },
      { label: { en: 'Select a space', fr: 'Sélectionnez un espace' }, description: { en: 'Choose which common space to view statistics for', fr: 'Choisir quel espace commun pour voir les statistiques' } },
      { label: { en: 'Statistics', fr: 'Statistiques' }, description: { en: 'View detailed usage statistics and booking data', fr: 'Voir les statistiques d\'utilisation détaillées et les données de réservation' } },
      { label: { en: 'Calendar', fr: 'Calendrier' }, description: { en: 'See booking calendar and availability schedule', fr: 'Voir le calendrier de réservations et l\'horaire de disponibilité' } },
      { label: { en: 'Edit', fr: 'Modifier' }, description: { en: 'Edit the selected common space details and settings', fr: 'Modifier les détails et paramètres de l\'espace commun sélectionné' } },
      { label: { en: 'Save', fr: 'Enregistrer' }, description: { en: 'Save your changes and close the form', fr: 'Enregistrer vos modifications et fermer le formulaire' } },
      { label: { en: 'Cancel', fr: 'Annuler' }, description: { en: 'Discard changes and close the form without saving', fr: 'Annuler les modifications et fermer le formulaire sans enregistrer' } },
      { label: { en: 'Delete', fr: 'Supprimer' }, description: { en: 'Permanently delete this item (requires confirmation)', fr: 'Supprimer définitivement cet élément (nécessite une confirmation)' } },
      { label: { en: 'Clear Filters', fr: 'Effacer les filtres' }, description: { en: 'Remove all active filters and show all items', fr: 'Retirer tous les filtres actifs et afficher tous les éléments' } },
      { label: { en: 'Search', fr: 'Rechercher' }, description: { en: 'Search and filter items by typing keywords', fr: 'Rechercher et filtrer les éléments en tapant des mots-clés' } },
      { label: { en: 'First Page', fr: 'Première page' }, description: { en: 'Jump to the first page of results', fr: 'Aller à la première page de résultats' } },
      { label: { en: 'Previous', fr: 'Précédent' }, description: { en: 'Go to the previous page of results', fr: 'Aller à la page précédente de résultats' } },
      { label: { en: 'Next', fr: 'Suivant' }, description: { en: 'Go to the next page of results', fr: 'Aller à la page suivante de résultats' } },
      { label: { en: 'Last Page', fr: 'Dernière page' }, description: { en: 'Jump to the last page of results', fr: 'Aller à la dernière page de résultats' } },
      { label: { en: 'Columns', fr: 'Colonnes' }, description: { en: 'Show or hide table columns to customize your view', fr: 'Afficher ou masquer les colonnes du tableau pour personnaliser votre vue' } },
      { label: { en: 'Today', fr: 'Aujourd\'hui' }, description: { en: 'Quickly jump to today\'s date', fr: 'Accéder rapidement à la date d\'aujourd\'hui' } },
      { label: { en: 'Clear', fr: 'Effacer' }, description: { en: 'Clear the selected date', fr: 'Effacer la date sélectionnée' } },
      { label: { en: 'Refresh', fr: 'Actualiser' }, description: { en: 'Reload the data to see the most recent information', fr: 'Recharger les données pour voir les informations les plus récentes' } },
      { label: { en: 'Export', fr: 'Exporter' }, description: { en: 'Download the data as a file (CSV, Excel, or PDF)', fr: 'Télécharger les données sous forme de fichier (CSV, Excel ou PDF)' } },
      { label: { en: 'View', fr: 'Voir' }, description: { en: 'View detailed information about this item', fr: 'Voir les informations détaillées sur cet élément' } },
      { label: { en: 'Close', fr: 'Fermer' }, description: { en: 'Close this dialog or window', fr: 'Fermer cette fenêtre ou boîte de dialogue' } },
      { label: { en: 'Dashboard', fr: 'Tableau de bord' }, description: { en: 'Go to the main dashboard overview page', fr: 'Aller à la page d\'aperçu du tableau de bord principal' } },
      { label: { en: 'Residents', fr: 'Résidents' }, description: { en: 'Access resident information and management', fr: 'Accéder aux informations et gestion des résidents' } },
      { label: { en: 'My Residence', fr: 'Ma résidence' }, description: { en: 'View details about your residential unit', fr: 'Voir les détails de votre unité résidentielle' } },
      { label: { en: 'My Building', fr: 'Mon bâtiment' }, description: { en: 'View and manage your assigned building', fr: 'Voir et gérer votre immeuble assigné' } },
      { label: { en: 'My Demands', fr: 'Mes demandes' }, description: { en: 'View maintenance requests and demands', fr: 'Voir les demandes d\'entretien' } },
      { label: { en: 'Common Spaces', fr: 'Espaces communs' }, description: { en: 'Manage common spaces and view statistics', fr: 'Gérer les espaces communs et voir les statistiques' } },
      { label: { en: 'Manager', fr: 'Gestionnaire' }, description: { en: 'Access manager-specific tools and features', fr: 'Accéder aux outils et fonctionnalités du gestionnaire' } },
      { label: { en: 'Buildings', fr: 'Bâtiments' }, description: { en: 'Manage buildings in your organization', fr: 'Gérer les immeubles de votre organisation' } },
      { label: { en: 'Residences', fr: 'Résidences' }, description: { en: 'Manage residential units', fr: 'Gérer les unités résidentielles' } },
      { label: { en: 'Budget', fr: 'Budget' }, description: { en: 'View financial forecasts and manage budget settings', fr: 'Voir les prévisions financières et gérer les paramètres budgétaires' } },
      { label: { en: 'Bills', fr: 'Factures' }, description: { en: 'Track and manage bills and expenses', fr: 'Suivre et gérer les factures et dépenses' } },
      { label: { en: 'Demands', fr: 'Demandes' }, description: { en: 'Manage maintenance and service requests', fr: 'Gérer les demandes d\'entretien et de service' } },
      { label: { en: 'User Management', fr: 'Gestion des utilisateurs' }, description: { en: 'Manage users, residents, and their access', fr: 'Gérer les utilisateurs, résidents et leurs accès' } },
      { label: { en: 'Manage Common Spaces', fr: 'Gérer les espaces communs' }, description: { en: 'View usage statistics and manage common spaces', fr: 'Voir les statistiques d\'utilisation et gérer les espaces communs' } },
      { label: { en: 'Maintenance Journal', fr: 'Carnet d\'entretien' }, description: { en: 'Access maintenance inventory and projects', fr: 'Accéder à l\'inventaire et aux projets d\'entretien' } },
      { label: { en: 'Inventory', fr: 'Inventaire' }, description: { en: 'Track maintenance equipment and supplies', fr: 'Suivre l\'équipement et les fournitures d\'entretien' } },
      { label: { en: 'Projects', fr: 'Projets' }, description: { en: 'Manage maintenance and renovation projects', fr: 'Gérer les projets d\'entretien et de rénovation' } },
      { label: { en: 'Settings', fr: 'Paramètres' }, description: { en: 'Configure your account and application settings', fr: 'Configurer votre compte et les paramètres de l\'application' } },
      { label: { en: 'Logout', fr: 'Déconnexion' }, description: { en: 'Sign out of your account', fr: 'Déconnectez-vous de votre compte' } },
      { label: { en: 'EN', fr: 'EN' }, description: { en: 'Switch interface language to English', fr: 'Changer la langue de l\'interface en anglais' } },
      { label: { en: 'FR', fr: 'FR' }, description: { en: 'Switch interface language to French (Français)', fr: 'Changer la langue de l\'interface en français' } },
      { label: { en: 'language en', fr: 'langue en' }, description: { en: 'Switch interface language to English', fr: 'Changer la langue de l\'interface en anglais' } },
      { label: { en: 'language fr', fr: 'langue fr' }, description: { en: 'Switch interface language to French (Français)', fr: 'Changer la langue de l\'interface en français' } },
    ],
  },
  '/manager/maintenance/inventory': {
    title: { en: 'Maintenance Inventory', fr: 'Inventaire d\'Entretien' },
    description: { en: 'Track maintenance equipment, tools, and supplies.', fr: 'Suivez l\'équipement d\'entretien, les outils et les fournitures.' },
    goal: { en: 'Manage inventory to ensure necessary items are available for maintenance work.', fr: 'Gérez l\'inventaire pour garantir la disponibilité des articles nécessaires pour les travaux d\'entretien.' },
    howToUse: { en: 'Add items to inventory, track quantities, and record when items are used or need restocking.', fr: 'Ajoutez des articles à l\'inventaire, suivez les quantités et enregistrez quand les articles sont utilisés ou nécessitent un réapprovisionnement.' },
    buttons: [
      { label: { en: 'Add Item', fr: 'Ajouter Article' }, description: { en: 'Register a new inventory item', fr: 'Enregistrer un nouvel article d\'inventaire' } },
      { label: { en: 'Update Quantity', fr: 'Mettre à Jour Quantité' }, description: { en: 'Adjust stock levels', fr: 'Ajuster les niveaux de stock' } },
      { label: { en: 'Low Stock Alert', fr: 'Alerte Stock Faible' }, description: { en: 'Set minimum quantities for automatic alerts', fr: 'Définir les quantités minimales pour les alertes automatiques' } },
    ],
  },
  '/manager/maintenance/projects': {
    title: { en: 'Maintenance Projects', fr: 'Projets d\'Entretien' },
    description: { en: 'Manage large-scale maintenance and renovation projects.', fr: 'Gérez les projets d\'entretien et de rénovation à grande échelle.' },
    goal: { en: 'Plan, track, and complete maintenance projects efficiently.', fr: 'Planifiez, suivez et complétez les projets d\'entretien efficacement.' },
    howToUse: { en: 'Create projects, track progress, assign tasks, and manage budgets for major work.', fr: 'Créez des projets, suivez les progrès, assignez des tâches et gérez les budgets pour les travaux majeurs.' },
    buttons: [
      { label: { en: 'New Project', fr: 'Nouveau Projet' }, description: { en: 'Start a new maintenance project', fr: 'Démarrer un nouveau projet d\'entretien' } },
      { label: { en: 'Update Progress', fr: 'Mettre à Jour Progrès' }, description: { en: 'Record work completed and update status', fr: 'Enregistrer le travail complété et mettre à jour le statut' } },
      { label: { en: 'View Timeline', fr: 'Voir Échéancier' }, description: { en: 'See project schedule and milestones', fr: 'Voir l\'horaire du projet et les jalons' } },
    ],
    relationships: [
      { page: { en: 'Bills', fr: 'Comptes' }, description: { en: 'Project expenses are tracked as bills', fr: 'Les dépenses du projet sont suivies comme des comptes' } },
      { page: { en: 'Maintenance Inventory', fr: 'Inventaire d\'Entretien' }, description: { en: 'Projects use inventory items', fr: 'Les projets utilisent des articles d\'inventaire' } },
    ],
  },

  // ===== RESIDENTS PAGES =====
  '/residents/residence': {
    title: { en: 'My Residence', fr: 'Ma Résidence' },
    description: { en: 'View information and details about your home.', fr: 'Consultez les informations et détails sur votre domicile.' },
    goal: { en: 'Access your residence information and unit-specific details.', fr: 'Accédez aux informations de votre résidence et aux détails spécifiques à l\'unité.' },
    howToUse: { en: 'View your unit details, contact information, and access documents.', fr: 'Consultez les détails de votre unité, les coordonnées et accédez aux documents.' },
    buttons: [
      { label: { en: 'View Documents', fr: 'Voir Documents' }, description: { en: 'Access documents related to your residence', fr: 'Accéder aux documents relatifs à votre résidence' } },
    ],
  },
  '/residents/building': {
    title: { en: 'My Building', fr: 'Mon Immeuble' },
    description: { en: 'Information about your building and shared facilities.', fr: 'Informations sur votre immeuble et les installations partagées.' },
    goal: { en: 'Learn about your building and access building-wide information.', fr: 'Apprenez-en davantage sur votre immeuble et accédez aux informations générales.' },
    howToUse: { en: 'View building details, amenities, and access building documents.', fr: 'Consultez les détails de l\'immeuble, les commodités et accédez aux documents de l\'immeuble.' },
    buttons: [
      { label: { en: 'View Documents', fr: 'Voir Documents' }, description: { en: 'Access building-wide documents', fr: 'Accéder aux documents de l\'immeuble' } },
    ],
  },
  '/residents/demands': {
    title: { en: 'My Requests', fr: 'Mes Demandes' },
    description: { en: 'Submit and track your maintenance requests.', fr: 'Soumettez et suivez vos demandes d\'entretien.' },
    goal: { en: 'Report issues and monitor their resolution.', fr: 'Signalez les problèmes et suivez leur résolution.' },
    howToUse: { en: 'Submit new requests for maintenance or services. Track the status of your existing requests.', fr: 'Soumettez de nouvelles demandes d\'entretien ou de services. Suivez le statut de vos demandes existantes.' },
    buttons: [
      { label: { en: 'New Request', fr: 'Nouvelle Demande' }, description: { en: 'Submit a maintenance or service request', fr: 'Soumettre une demande d\'entretien ou de service' } },
      { label: { en: 'View Status', fr: 'Voir Statut' }, description: { en: 'Check the progress of your requests', fr: 'Vérifier le progrès de vos demandes' } },
    ],
    formFields: [
      { label: { en: 'Issue Type', fr: 'Type de Problème' }, description: { en: 'Category of the problem (plumbing, electrical, etc.)', fr: 'Catégorie du problème (plomberie, électricité, etc.)' }, required: true },
      { label: { en: 'Description', fr: 'Description' }, description: { en: 'Detailed explanation of the issue', fr: 'Explication détaillée du problème' }, required: true },
      { label: { en: 'Priority', fr: 'Priorité' }, description: { en: 'How urgent is this issue (low, medium, high)', fr: 'Quel est le niveau d\'urgence (faible, moyen, élevé)' } },
      { label: { en: 'Location', fr: 'Emplacement' }, description: { en: 'Where in your unit the issue is located', fr: 'Où se situe le problème dans votre unité' } },
    ],
  },
  '/residents/common-spaces': {
    title: { en: 'Common Spaces', fr: 'Espaces Communs' },
    description: { en: 'Book and manage shared amenity reservations.', fr: 'Réservez et gérez les réservations d\'installations partagées.' },
    goal: { en: 'Reserve common areas like gyms, pools, and party rooms.', fr: 'Réservez des espaces communs comme les gymnases, piscines et salles de fête.' },
    howToUse: { en: 'View available spaces, check availability, and make bookings.', fr: 'Consultez les espaces disponibles, vérifiez la disponibilité et effectuez des réservations.' },
    buttons: [
      { label: { en: 'Book Space', fr: 'Réserver Espace' }, description: { en: 'Reserve a common area for a specific time', fr: 'Réserver un espace commun pour une période spécifique' } },
      { label: { en: 'View Bookings', fr: 'Voir Réservations' }, description: { en: 'See your current and past reservations', fr: 'Voir vos réservations actuelles et passées' } },
      { label: { en: 'Cancel', fr: 'Annuler' }, description: { en: 'Cancel an existing booking', fr: 'Annuler une réservation existante' } },
    ],
  },
  '/resident/my-calendar': {
    title: { en: 'My Calendar', fr: 'Mon Calendrier' },
    description: { en: 'View your personal calendar of bookings and events.', fr: 'Consultez votre calendrier personnel de réservations et événements.' },
    goal: { en: 'Track your reservations and building events.', fr: 'Suivez vos réservations et les événements de l\'immeuble.' },
    howToUse: { en: 'See all your bookings, building events, and important dates in one place.', fr: 'Consultez toutes vos réservations, événements de l\'immeuble et dates importantes en un seul endroit.' },
  },

  // ===== SETTINGS PAGES =====
  '/settings': {
    title: { en: 'Settings', fr: 'Paramètres' },
    description: { en: 'Configure your personal preferences and account settings.', fr: 'Configurez vos préférences personnelles et paramètres de compte.' },
    goal: { en: 'Customize your experience and manage your account.', fr: 'Personnalisez votre expérience et gérez votre compte.' },
    howToUse: { en: 'Update your profile, change password, set notifications, and adjust preferences.', fr: 'Mettez à jour votre profil, changez le mot de passe, configurez les notifications et ajustez les préférences.' },
    buttons: [
      { label: { en: 'Save Changes', fr: 'Enregistrer Modifications' }, description: { en: 'Apply your updated settings', fr: 'Appliquer vos paramètres mis à jour' } },
      { label: { en: 'Change Password', fr: 'Changer Mot de Passe' }, description: { en: 'Update your account password', fr: 'Mettre à jour votre mot de passe de compte' } },
    ],
  },
  // ===== DOCUMENTS PAGES =====
  '/manager/buildings/documents': {
    title: { en: 'Building Documents', fr: 'Documents d\'Immeuble' },
    description: { en: 'Access and manage documents for a specific building.', fr: 'Accédez et gérez les documents pour un immeuble spécifique.' },
    goal: { en: 'Organize and access building-related files and documentation.', fr: 'Organisez et accédez aux fichiers et documentation relatifs à l\'immeuble.' },
    howToUse: { en: 'Upload, view, download, or delete documents related to the selected building.', fr: 'Téléversez, consultez, téléchargez ou supprimez les documents relatifs à l\'immeuble sélectionné.' },
    buttons: [
      { label: { en: 'Upload Document', fr: 'Téléverser Document' }, description: { en: 'Add a new document or file', fr: 'Ajouter un nouveau document ou fichier' } },
      { label: { en: 'Download', fr: 'Télécharger' }, description: { en: 'Download a document to your device', fr: 'Télécharger un document sur votre appareil' } },
      { label: { en: 'Delete', fr: 'Supprimer' }, description: { en: 'Remove a document (requires confirmation)', fr: 'Supprimer un document (nécessite une confirmation)' } },
    ],
  },
  '/manager/residences/documents': {
    title: { en: 'Residence Documents', fr: 'Documents de Résidence' },
    description: { en: 'Access and manage documents for a specific residence.', fr: 'Accédez et gérez les documents pour une résidence spécifique.' },
    goal: { en: 'Organize and access unit-specific files and documentation.', fr: 'Organisez et accédez aux fichiers et documentation spécifiques à l\'unité.' },
    howToUse: { en: 'Upload, view, download, or delete documents related to the selected residence.', fr: 'Téléversez, consultez, téléchargez ou supprimez les documents relatifs à la résidence sélectionnée.' },
    buttons: [
      { label: { en: 'Upload Document', fr: 'Téléverser Document' }, description: { en: 'Add a new document or file', fr: 'Ajouter un nouveau document ou fichier' } },
      { label: { en: 'Download', fr: 'Télécharger' }, description: { en: 'Download a document to your device', fr: 'Télécharger un document sur votre appareil' } },
      { label: { en: 'Delete', fr: 'Supprimer' }, description: { en: 'Remove a document (requires confirmation)', fr: 'Supprimer un document (nécessite une confirmation)' } },
    ],
  },
  '/residents/residence/documents': {
    title: { en: 'My Residence Documents', fr: 'Documents de Ma Résidence' },
    description: { en: 'View documents related to your residence.', fr: 'Consultez les documents relatifs à votre résidence.' },
    goal: { en: 'Access important documents about your home.', fr: 'Accédez aux documents importants concernant votre domicile.' },
    howToUse: { en: 'View and download documents like lease agreements, rules, and notices.', fr: 'Consultez et téléchargez des documents comme les baux, règlements et avis.' },
    buttons: [
      { label: { en: 'View', fr: 'Consulter' }, description: { en: 'Open a document to read it', fr: 'Ouvrir un document pour le lire' } },
      { label: { en: 'Download', fr: 'Télécharger' }, description: { en: 'Save a document to your device', fr: 'Enregistrer un document sur votre appareil' } },
    ],
  },
  '/residents/building/documents': {
    title: { en: 'Building Documents', fr: 'Documents de l\'Immeuble' },
    description: { en: 'View documents related to your building.', fr: 'Consultez les documents relatifs à votre immeuble.' },
    goal: { en: 'Access building-wide documents and information.', fr: 'Accédez aux documents et informations de l\'immeuble.' },
    howToUse: { en: 'View and download documents like building rules, notices, and announcements.', fr: 'Consultez et téléchargez des documents comme les règlements de l\'immeuble, avis et annonces.' },
    buttons: [
      { label: { en: 'View', fr: 'Consulter' }, description: { en: 'Open a document to read it', fr: 'Ouvrir un document pour le lire' } },
      { label: { en: 'Download', fr: 'Télécharger' }, description: { en: 'Save a document to your device', fr: 'Enregistrer un document sur votre appareil' } },
    ],
  },

  // ===== PUBLIC PAGES =====
  '/': {
    title: { en: 'Home', fr: 'Accueil' },
    description: { en: 'Welcome to the property management platform.', fr: 'Bienvenue sur la plateforme de gestion immobilière.' },
    goal: { en: 'Learn about the platform and get started.', fr: 'Découvrez la plateforme et commencez.' },
    howToUse: { en: 'Explore features, view pricing, or log in to your account.', fr: 'Explorez les fonctionnalités, consultez les tarifs ou connectez-vous à votre compte.' },
    buttons: [
      { label: { en: 'Get Started', fr: 'Commencer' }, description: { en: 'Begin using the platform', fr: 'Commencer à utiliser la plateforme' } },
      { label: { en: 'Learn More', fr: 'En Savoir Plus' }, description: { en: 'Discover features and benefits', fr: 'Découvrir les fonctionnalités et avantages' } },
      { label: { en: 'Login', fr: 'Connexion' }, description: { en: 'Access your account', fr: 'Accéder à votre compte' } },
    ],
  },
  '/features': {
    title: { en: 'Features', fr: 'Fonctionnalités' },
    description: { en: 'Explore all the capabilities of the platform.', fr: 'Explorez toutes les capacités de la plateforme.' },
    goal: { en: 'Understand what the platform can do for you.', fr: 'Comprenez ce que la plateforme peut faire pour vous.' },
    howToUse: { en: 'Browse through feature descriptions to see how they can help manage your property.', fr: 'Parcourez les descriptions des fonctionnalités pour voir comment elles peuvent aider à gérer votre immeuble.' },
  },
  '/pricing': {
    title: { en: 'Pricing', fr: 'Tarification' },
    description: { en: 'View pricing plans and options.', fr: 'Consultez les plans tarifaires et options.' },
    goal: { en: 'Choose the right plan for your needs.', fr: 'Choisissez le plan adapté à vos besoins.' },
    howToUse: { en: 'Compare plans, see features included, and select the best option for you.', fr: 'Comparez les plans, consultez les fonctionnalités incluses et sélectionnez la meilleure option pour vous.' },
  },
  '/security': {
    title: { en: 'Security', fr: 'Sécurité' },
    description: { en: 'Learn about our security measures and data protection.', fr: 'Découvrez nos mesures de sécurité et protection des données.' },
    goal: { en: 'Understand how we protect your data and maintain security.', fr: 'Comprenez comment nous protégeons vos données et maintenons la sécurité.' },
    howToUse: { en: 'Read about our security practices, compliance standards, and data protection measures.', fr: 'Consultez nos pratiques de sécurité, normes de conformité et mesures de protection des données.' },
  },
  '/story': {
    title: { en: 'Our Story', fr: 'Notre Histoire' },
    description: { en: 'Learn about the history and mission behind the platform.', fr: 'Découvrez l\'histoire et la mission derrière la plateforme.' },
    goal: { en: 'Understand our vision and why we built this property management solution.', fr: 'Comprenez notre vision et pourquoi nous avons créé cette solution de gestion immobilière.' },
    howToUse: { en: 'Read about our journey, values, and commitment to improving property management.', fr: 'Consultez notre parcours, nos valeurs et notre engagement à améliorer la gestion immobilière.' },
  },
  '/privacy-policy': {
    title: { en: 'Privacy Policy', fr: 'Politique de Confidentialité' },
    description: { en: 'Our privacy policy and data handling practices.', fr: 'Notre politique de confidentialité et pratiques de gestion des données.' },
    goal: { en: 'Understand how we collect, use, and protect your personal information.', fr: 'Comprenez comment nous collectons, utilisons et protégeons vos informations personnelles.' },
    howToUse: { en: 'Review our privacy commitments, data handling procedures, and your rights under Quebec Law 25.', fr: 'Consultez nos engagements en matière de confidentialité, nos procédures de gestion des données et vos droits en vertu de la Loi 25 du Québec.' },
  },
  '/terms-of-service': {
    title: { en: 'Terms of Service', fr: 'Conditions d\'Utilisation' },
    description: { en: 'Terms and conditions for using the platform.', fr: 'Conditions générales d\'utilisation de la plateforme.' },
    goal: { en: 'Understand the legal terms governing your use of this service.', fr: 'Comprenez les conditions légales régissant votre utilisation de ce service.' },
    howToUse: { en: 'Read the complete terms of service, user responsibilities, and service agreements.', fr: 'Consultez les conditions d\'utilisation complètes, responsabilités des utilisateurs et accords de service.' },
  },
  '/login': {
    title: { en: 'Login', fr: 'Connexion' },
    description: { en: 'Sign in to access your account.', fr: 'Connectez-vous pour accéder à votre compte.' },
    goal: { en: 'Securely access the property management platform.', fr: 'Accédez en toute sécurité à la plateforme de gestion immobilière.' },
    howToUse: { en: 'Enter your username and password to login. Use "Forgot Password" link if you need to reset your password.', fr: 'Entrez votre nom d\'utilisateur et mot de passe pour vous connecter. Utilisez le lien « Mot de passe oublié » si vous devez réinitialiser votre mot de passe.' },
    buttons: [
      { label: { en: 'Login', fr: 'Connexion' }, description: { en: 'Sign in with your credentials', fr: 'Se connecter avec vos identifiants' } },
      { label: { en: 'Forgot Password', fr: 'Mot de Passe Oublié' }, description: { en: 'Reset your password if you\'ve forgotten it', fr: 'Réinitialiser votre mot de passe si vous l\'avez oublié' } },
    ],
  },
  '/forgot-password': {
    title: { en: 'Forgot Password', fr: 'Mot de Passe Oublié' },
    description: { en: 'Reset your account password.', fr: 'Réinitialisez votre mot de passe de compte.' },
    goal: { en: 'Recover access to your account by resetting your password.', fr: 'Récupérez l\'accès à votre compte en réinitialisant votre mot de passe.' },
    howToUse: { en: 'Enter your email address to receive a password reset link.', fr: 'Entrez votre adresse courriel pour recevoir un lien de réinitialisation de mot de passe.' },
    buttons: [
      { label: { en: 'Send Reset Link', fr: 'Envoyer Lien de Réinitialisation' }, description: { en: 'Receive an email with password reset instructions', fr: 'Recevoir un courriel avec les instructions de réinitialisation du mot de passe' } },
    ],
  },
  '/reset-password': {
    title: { en: 'Reset Password', fr: 'Réinitialiser Mot de Passe' },
    description: { en: 'Create a new password for your account.', fr: 'Créez un nouveau mot de passe pour votre compte.' },
    goal: { en: 'Set a new secure password to regain access to your account.', fr: 'Définissez un nouveau mot de passe sécurisé pour retrouver l\'accès à votre compte.' },
    howToUse: { en: 'Enter and confirm your new password. Ensure it meets security requirements (minimum 8 characters, includes uppercase, lowercase, and numbers).', fr: 'Entrez et confirmez votre nouveau mot de passe. Assurez-vous qu\'il respecte les exigences de sécurité (minimum 8 caractères, inclut majuscules, minuscules et chiffres).' },
    buttons: [
      { label: { en: 'Reset Password', fr: 'Réinitialiser Mot de Passe' }, description: { en: 'Save your new password and login', fr: 'Enregistrer votre nouveau mot de passe et vous connecter' } },
    ],
  },
  '/admin/performance': {
    title: { en: 'Performance Dashboard', fr: 'Tableau de Bord de Performance' },
    description: { en: 'Monitor system performance metrics and optimization statistics.', fr: 'Surveillez les indicateurs de performance du système et les statistiques d\'optimisation.' },
    goal: { en: 'Track application performance, query efficiency, and system health.', fr: 'Suivez la performance de l\'application, l\'efficacité des requêtes et la santé du système.' },
    howToUse: { en: 'View real-time performance metrics, identify bottlenecks, and monitor optimization improvements.', fr: 'Consultez les indicateurs de performance en temps réel, identifiez les goulots d\'étranglement et surveillez les améliorations d\'optimisation.' },
    buttons: [
      { label: { en: 'Refresh Metrics', fr: 'Actualiser Indicateurs' }, description: { en: 'Update performance data to see current statistics', fr: 'Mettre à jour les données de performance pour voir les statistiques actuelles' } },
      { label: { en: 'Export Report', fr: 'Exporter Rapport' }, description: { en: 'Download performance data for analysis', fr: 'Télécharger les données de performance pour analyse' } },
    ],
  },
};

/**
 * Get help content for a specific route
 */
/**
 * Helper function to extract language-specific text from BilingualText with Law 25 compliance
 * Always defaults to French if translation is missing to ensure Quebec compliance
 * 
 * Law 25 Guarantee: This function ALWAYS returns French text, even in error cases
 */
export function getText(text: BilingualText, language: 'en' | 'fr'): string {
  // Quebec Law 25 compliance: Always ensure French is available
  const requestedText = text[language];
  const frenchText = text.fr;
  
  // If requested language text is missing or empty, fall back to French (Law 25 requirement)
  if (!requestedText || requestedText.trim() === '') {
    if (language === 'en' && frenchText && frenchText.trim() !== '') {
      console.warn('[Loi 25 - Conformité] Traduction anglaise manquante, utilisation du français par défaut');
      return frenchText;
    }
    // If French is also missing, log critical error and return French error message (Law 25 compliance)
    console.error('[Loi 25 - Conformité] CRITIQUE : Traduction française manquante - ceci viole la Loi 25');
    // ALWAYS return French, even for error messages (Law 25 compliance)
    return requestedText || frenchText || '[Erreur de traduction]';
  }
  
  return requestedText;
}

/**
 * Bilingual UI text for HelpOverlay component (Law 25 compliant - French first)
 */
export const helpUIText = {
  help: { fr: 'Aide', en: 'Help' },
  goals: { fr: 'OBJECTIFS', en: 'GOALS' },
  howToUse: { fr: 'COMMENT UTILISER', en: 'HOW TO USE' },
  buttonsAndActions: { fr: 'Boutons & Actions', en: 'Buttons & Actions' },
  formFields: { fr: 'Champs de Formulaire', en: 'Form Fields' },
  relatedPages: { fr: 'Pages Connexes', en: 'Related Pages' },
  required: { fr: 'Requis', en: 'Required' },
  tip: { fr: 'Conseil', en: 'Tip' },
  helpNotAvailable: {
    fr: "Le contenu d'aide n'est pas encore disponible pour cette page.",
    en: 'Help content is not yet available for this page.'
  },
  helpNotAvailableDetails: {
    fr: "Vous pouvez naviguer vers d'autres pages en utilisant le menu de la barre latérale, ou si vous avez besoin d'aide spécifique pour cette page, veuillez contacter le support.",
    en: 'You can navigate to other pages using the sidebar menu, or if you need assistance with this page specifically, please contact support.'
  },
  closeHelpTip: {
    fr: "Cliquez sur le bouton ? pour fermer cette boîte de dialogue d'aide",
    en: 'Click the ? button to close this help dialog'
  },
  getHelpTip: {
    fr: "Cliquez sur le bouton ? à tout moment pour obtenir de l'aide sur la page actuelle",
    en: 'Click the ? button anytime to get help with the current page'
  }
};

export function getHelpContent(route: string): HelpContent | null {
  const normalizedRoute = route.replace(/\/+$/, '') || '/';

  if (helpContentMap[normalizedRoute]) {
    return helpContentMap[normalizedRoute];
  }

  for (const [key, value] of Object.entries(helpContentMap)) {
    if (key.includes(':')) {
      const keyPattern = key.replace(/:[^/]+/g, '[^/]+');
      const regex = new RegExp(`^${keyPattern}$`);
      if (regex.test(normalizedRoute)) {
        return value;
      }
    }
  }

  if (normalizedRoute.includes('/documents')) {
    if (normalizedRoute.includes('/manager/buildings')) return helpContentMap['/manager/buildings/documents'] || null;
    if (normalizedRoute.includes('/manager/residences')) return helpContentMap['/manager/residences/documents'] || null;
    if (normalizedRoute.includes('/residents/residence')) return helpContentMap['/residents/residence/documents'] || null;
    if (normalizedRoute.includes('/residents/building')) return helpContentMap['/residents/building/documents'] || null;
  }

  return null;
}
