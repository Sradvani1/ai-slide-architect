interface SharePreviewMeta {
    ownerName: string;
    project: {
        title: string;
        topic: string;
        gradeLevel: string;
        subject: string;
    };
}

const DEFAULT_OG_IMAGE = 'https://www.slidesedu.org/og-image.png';

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const safeJsonLdString = (jsonLd: Record<string, unknown>): string =>
    JSON.stringify(jsonLd).replace(/</g, '\\u003c');

export const buildSharePageJsonLd = (
    preview: SharePreviewMeta,
    canonical: string,
    ogImage: string,
    description: string
): Record<string, unknown> => ({
    '@context': 'https://schema.org',
    '@type': ['LearningResource', 'CreativeWork'],
    '@id': canonical,
    name: preview.project.title,
    description,
    url: canonical,
    image: ogImage,
    educationalLevel: preview.project.gradeLevel,
    about: preview.project.topic,
    inLanguage: 'en',
    isAccessibleForFree: true,
    provider: { '@type': 'Organization', name: 'SlidesEdu', url: 'https://www.slidesedu.org' },
});

export const buildCrawlerHtml = (
    preview: SharePreviewMeta,
    canonical: string,
    ogImage: string
): string => {
    const title = `${preview.project.title} — Grade ${preview.project.gradeLevel} ${preview.project.subject} | SlidesEdu`;
    const description = `Free ${preview.project.subject} slide deck on ${preview.project.topic}. Remix and customize for your classroom.`;
    const jsonLd = buildSharePageJsonLd(preview, canonical, ogImage, description);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <script type="application/ld+json">${safeJsonLdString(jsonLd)}</script>
</head>
<body>
  <h1>${escapeHtml(preview.project.title)}</h1>
  <p>${escapeHtml(description)}</p>
</body>
</html>`;
};

export const buildCrawlerNotFoundHtml = (): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Deck not available | SlidesEdu</title>
  <meta name="robots" content="noindex">
</head>
<body>
  <h1>This deck isn&apos;t available</h1>
  <p>It may be private or still generating.</p>
</body>
</html>`;

export const resolveOgImage = (thumbnailUrl?: string): string =>
    thumbnailUrl ?? DEFAULT_OG_IMAGE;
