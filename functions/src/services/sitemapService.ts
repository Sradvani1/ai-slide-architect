import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { PublicDeckIndex } from '@shared/types';

const db = admin.firestore();

const SITE_ORIGIN = 'https://www.slidesedu.org';
const DEPLOY_DATE = '2026-07-04';

const escapeXml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

const timestampToIso = (value: unknown): string | undefined => {
    if (value instanceof Timestamp) {
        return value.toDate().toISOString();
    }
    if (typeof value === 'number' && value > 0) {
        return new Date(value).toISOString();
    }
    return undefined;
};

const buildUrlEntry = (loc: string, priority: string, changefreq: string, lastmod?: string): string => {
    const lastmodLine = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : '';
    return `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmodLine}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
};

export const generateSitemapXml = async (): Promise<string> => {
    const snap = await db.collection('publicDecks')
        .orderBy('publishedAt', 'desc')
        .limit(5000)
        .get();

    const staticDeployIso = `${DEPLOY_DATE}T00:00:00.000Z`;
    const entries: string[] = [
        buildUrlEntry(`${SITE_ORIGIN}/`, '1.0', 'weekly', staticDeployIso),
        buildUrlEntry(`${SITE_ORIGIN}/explore`, '0.8', 'weekly', staticDeployIso),
    ];

    for (const doc of snap.docs) {
        const data = doc.data() as PublicDeckIndex;
        const token = data.token || doc.id;
        const lastmod = timestampToIso(data.updatedAt) ?? timestampToIso(data.publishedAt);
        entries.push(
            buildUrlEntry(`${SITE_ORIGIN}/share/${token}`, '0.6', 'monthly', lastmod)
        );
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;
};
