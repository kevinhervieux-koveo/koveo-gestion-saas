import type { Express } from 'express';
import { Storage } from '@google-cloud/storage';


/**
 * Register company history routes for fetching company information and documents.
 * @param app
 */
export function registerCompanyHistoryRoutes(app: Express): void {
  // Get company history from object storage (histoire.pdf)
  app.get('/api/company/history', async (req, res) => {
    try {
      // Search for histoire.pdf in public object storage
      const histoireFile = await objectStorageService.searchPublicObject('histoire.pdf');

      if (!histoireFile) {
        // Return fallback content if histoire.pdf is not found
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
      }

      // If file is found, get its metadata
      const [metadata] = await histoireFile.getMetadata();

      // For PDF files, we'll return the file information and download URL
      if (metadata.contentType === 'application/pdf') {
        // Generate a signed URL for the PDF
        const [downloadUrl] = await histoireFile.getSignedUrl({
          action: 'read',
          expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        });

        return res.json({
          found: true,
          fileInfo: {
            name: histoireFile.name,
            size: metadata.size,
            contentType: metadata.contentType,
            downloadUrl: downloadUrl,
            lastModified: metadata.updated,
          },
          message:
            'PDF trouvé - utilisez le lien de téléchargement pour accéder au contenu complet.',
        });
      }

      // If it's a text file, read the content directly
      if (
        metadata.contentType?.startsWith('text/') ||
        metadata.contentType === 'application/json' ||
        !metadata.contentType
      ) {
        const stream = histoireFile.createReadStream();
        let content = '';

        for await (const chunk of stream) {
          content += chunk;
        }

        // Try to parse as JSON if it looks like JSON
        let parsedContent;
        try {
          parsedContent = JSON.parse(content);
        } catch {
          // If not JSON, treat as plain text
          parsedContent = {
            title: 'Histoire de Koveo Gestion',
            content: content,
          };
        }

        return res.json({
          found: true,
          content: parsedContent,
          fileInfo: {
            name: histoireFile.name,
            size: metadata.size,
            contentType: metadata.contentType,
            lastModified: metadata.updated,
          },
        });
      }

      // For other file types, return file info only
      return res.json({
        found: true,
        fileInfo: {
          name: histoireFile.name,
          size: metadata.size,
          contentType: metadata.contentType,
          lastModified: metadata.updated,
        },
        message:
          "Fichier trouvé mais le type de contenu n'est pas supporté pour la lecture directe.",
      });
    } catch (_error) {
      console.error('Error fetching company history:', _error);

      // Return fallback content on error
      return res.json({
        found: false,
        _error: true,
        content: {
          title: 'Notre Histoire',
          subtitle: "L'évolution de Koveo Gestion au Québec",
          sections: [
            {
              title: 'Mission',
              content:
                "Koveo Gestion s'engage à fournir des solutions de gestion immobilière innovantes et conformes aux réglementations québécoises, notamment la Loi 25 sur la protection des renseignements personnels.",
              year: '2020-Présent',
            },
          ],
          mission: 'Révolutionner la gestion immobilière au Québec grâce à la technologie.',
          values: ['Innovation', 'Conformité québécoise', 'Service client exceptionnel'],
        },
      });
    }
  });

  // List available company documents in public storage
  app.get('/api/company/documents', async (req, res) => {
    try {
      const publicPaths = objectStorageService.getPublicObjectSearchPaths();
      const documents = [];

      // Search common company document names in public storage
      const commonDocuments = [
        'histoire.pdf',
        'history.pdf',
        'about.pdf',
        'company-info.pdf',
        'koveo-history.pdf',
        'koveo-story.pdf',
        'presentation.pdf',
      ];

      for (const docName of commonDocuments) {
        try {
          const file = await objectStorageService.searchPublicObject(docName);
          if (file) {
            const [metadata] = await file.getMetadata();
            documents.push({
              name: file.name,
              displayName: docName,
              size: metadata.size,
              contentType: metadata.contentType,
              lastModified: metadata.updated,
              available: true,
            });
          }
        } catch (_error) {
          console.warn(`Document ${docName} not found:`, error.message);
        }
      }

      res.json({
        documents,
        total: documents.length,
        searchPaths: publicPaths,
      });
    } catch (_error) {
      console.error('Error listing company documents:', _error);
      res.status(500).json({
        message: "Erreur lors de la recherche des documents d'entreprise",
        _error: error.message,
      });
    }
  });
}
