import type { Language } from '@/lib/i18n';

interface SeoEntry {
  title: string;
  description: string;
}

type SeoMap = Record<string, Record<Language, SeoEntry>>;

export const seoContent: SeoMap = {
  home: {
    en: {
      title: 'Koveo Gestion — Property Management Software for Quebec Condos & Rentals',
      description:
        'Bilingual property management platform built for Quebec. Manage buildings, residents, finances, maintenance and Law 25 compliance from one secure dashboard.',
    },
    fr: {
      title: 'Koveo Gestion — Logiciel de gestion immobilière pour copropriétés et locatifs au Québec',
      description:
        "Plateforme bilingue de gestion immobilière conçue pour le Québec. Gérez immeubles, résidents, finances, entretien et conformité à la Loi 25 dans un tableau de bord sécurisé.",
    },
  },
  features: {
    en: {
      title: 'Features — Building, Resident, Financial & Compliance Tools | Koveo Gestion',
      description:
        'Discover Koveo Gestion features: building & residence management, resident portal, financial reports, document storage, maintenance projects and Quebec Law 25 compliance.',
    },
    fr: {
      title: 'Fonctionnalités — Gestion immeuble, résidents, finances et conformité | Koveo Gestion',
      description:
        "Découvrez les fonctionnalités de Koveo Gestion : gestion d'immeubles et résidences, portail résident, rapports financiers, gestion documentaire, projets d'entretien et conformité à la Loi 25.",
    },
  },
  pricing: {
    en: {
      title: 'Pricing — Simple Per-Door Plans for Quebec Property Managers | Koveo Gestion',
      description:
        'Transparent per-door pricing in CAD. Includes unlimited residents, document storage, maintenance tracking, financial reports and Law 25 protection. No setup fees.',
    },
    fr: {
      title: 'Tarification — Forfaits simples par porte pour gestionnaires au Québec | Koveo Gestion',
      description:
        "Tarification transparente par porte en CAD. Inclut résidents illimités, stockage documentaire, suivi de l'entretien, rapports financiers et protection Loi 25. Aucuns frais d'installation.",
    },
  },
  security: {
    en: {
      title: 'Security & Quebec Law 25 Compliance | Koveo Gestion',
      description:
        'Enterprise-grade encryption, role-based access, Canadian data hosting and full Quebec Law 25 compliance. See how Koveo Gestion protects your residents and your data.',
    },
    fr: {
      title: 'Sécurité et conformité à la Loi 25 du Québec | Koveo Gestion',
      description:
        "Chiffrement de niveau entreprise, accès basé sur les rôles, hébergement des données au Canada et conformité complète à la Loi 25. Découvrez comment Koveo Gestion protège vos résidents et vos données.",
    },
  },
  story: {
    en: {
      title: 'Our Story — Built in Quebec for Quebec Property Managers | Koveo Gestion',
      description:
        'Koveo Gestion is built in Quebec for Quebec property managers. Learn about our mission, values and the team behind the platform.',
    },
    fr: {
      title: 'Notre histoire — Conçu au Québec pour les gestionnaires québécois | Koveo Gestion',
      description:
        'Koveo Gestion est conçu au Québec pour les gestionnaires québécois. Découvrez notre mission, nos valeurs et l\'équipe derrière la plateforme.',
    },
  },
  privacyPolicy: {
    en: {
      title: 'Privacy Policy — Quebec Law 25 Compliant | Koveo Gestion',
      description:
        'Read the Koveo Gestion privacy policy. We comply with Quebec Law 25 and protect personal information collected from property managers and residents.',
    },
    fr: {
      title: 'Politique de confidentialité — Conforme à la Loi 25 | Koveo Gestion',
      description:
        "Consultez la politique de confidentialité de Koveo Gestion. Nous respectons la Loi 25 du Québec et protégeons les renseignements personnels des gestionnaires et résidents.",
    },
  },
  termsOfService: {
    en: {
      title: 'Terms of Service | Koveo Gestion',
      description:
        'Read the Koveo Gestion terms of service governing the use of our property management platform for Quebec condos and rentals.',
    },
    fr: {
      title: "Conditions d'utilisation | Koveo Gestion",
      description:
        "Consultez les conditions d'utilisation de Koveo Gestion régissant l'utilisation de notre plateforme de gestion immobilière pour copropriétés et locatifs au Québec.",
    },
  },
};
