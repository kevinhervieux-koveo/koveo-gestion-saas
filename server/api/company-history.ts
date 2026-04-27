import type { Express } from 'express';

/**
 * Register company history routes for fetching company information and documents.
 * @param app
 */
export function registerCompanyHistoryRoutes(app: Express): void {
  // Get company history - object storage removed, always return fallback content
  app.get('/api/company/history', async (req, res) => {
    try {
      return res.json({
        found: false,
        content: {
          title: 'Notre Histoire',
          subtitle: "L'évolution de Koveo Gestion au Québec",
          sections: [
            {
              title: 'Fondation et Vision',
              content:
                'Koveo Gestion a été fondée avec la vision de révolutionner la gestion immobilière au Québec en offrant des solutions technologiques avancées et conformes aux réglementations provinciales.',
              year: '2020',
            },
            {
              title: 'Développement et Croissance',
              content:
                "Nous avons développé notre plateforme en gardant à l'esprit les besoins spécifiques des gestionnaires immobiliers québécois et la conformité avec la Loi 25 sur la protection des renseignements personnels.",
              year: '2021-2022',
            },
            {
              title: 'Innovation Continue',
              content:
                "Notre engagement envers l'innovation nous pousse constamment à améliorer nos services et à intégrer les dernières technologies pour offrir la meilleure expérience possible à nos clients.",
              year: '2023-Présent',
            },
          ],
          mission:
            'Simplifier la gestion immobilière au Québec grâce à des outils numériques intuitifs, sécurisés et conformes aux normes québécoises.',
          values: [
            'Excellence en service client',
            'Innovation technologique',
            'Conformité réglementaire québécoise',
            'Transparence et intégrité',
            "Soutien aux professionnels de l'immobilier",
          ],
        },
      });
    } catch (error) {
      return res.status(500).json({ _error: 'Failed to fetch company history' });
    }
  });

  // List available company documents - object storage removed
  app.get('/api/company/documents', async (req, res) => {
    try {
      // Object storage integration removed - return empty list
      const documents: unknown[] = [];

      res.json({
        documents,
        total: documents.length,
        message: 'Document storage has been disabled',
      });
    } catch (_error) {
      console.error("Erreur lors de la recherche des documents d'entreprise:", _error);
      res.status(500).json({
        message: "Erreur lors de la recherche des documents d'entreprise",
        _error: 'internal_error',
      });
    }
  });
}
