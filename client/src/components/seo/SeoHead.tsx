import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/hooks/use-language';

const SITE_URL = 'https://koveo-gestion.com';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export interface SeoHeadProps {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: 'website' | 'article';
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

function buildLocaleUrl(path: string, lang: 'fr' | 'en'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const sep = cleanPath.includes('?') ? '&' : '?';
  return `${SITE_URL}${cleanPath}${sep}lang=${lang}`;
}

export function SeoHead({
  title,
  description,
  path,
  image,
  type = 'website',
  jsonLd,
}: SeoHeadProps) {
  const { language } = useLanguage();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = `${SITE_URL}${cleanPath}`;
  const frUrl = buildLocaleUrl(path, 'fr');
  const enUrl = buildLocaleUrl(path, 'en');
  // If the visitor reached this page via ?lang=, the canonical should be
  // the localized URL so hreflang alternates and the canonical agree.
  const hasLangParam =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('lang') !== null;
  const canonical = hasLangParam ? (language === 'fr' ? frUrl : enUrl) : baseUrl;
  const ogImage = image || DEFAULT_OG_IMAGE;

  return (
    <Helmet>
      <html lang={language} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <link rel="alternate" hrefLang="fr-CA" href={frUrl} />
      <link rel="alternate" hrefLang="en-CA" href={enUrl} />
      <link rel="alternate" hrefLang="x-default" href={baseUrl} />

      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="Koveo Gestion" />
      <meta property="og:locale" content={language === 'fr' ? 'fr_CA' : 'en_CA'} />
      <meta
        property="og:locale:alternate"
        content={language === 'fr' ? 'en_CA' : 'fr_CA'}
      />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}

export const SITE_BASE_URL = SITE_URL;
