import * as crypto from 'crypto';
import type { GeneratedImage } from '@shared/types';

interface GoogleCustomSearchItem {
    link?: string;
    title?: string;
    image?: {
        thumbnailLink?: string;
        contextLink?: string;
    };
}

interface GoogleCustomSearchResponse {
    items?: GoogleCustomSearchItem[];
}

const buildSearchQuery = (terms: string[]): string => {
    const cleaned = terms.map(term => term.trim()).filter(Boolean);
    if (cleaned.length === 0) {
        throw new Error('No search terms provided');
    }
    const quoted = cleaned.slice(0, 3).map(term => `"${term}"`);
    return quoted.join(' OR ');
};

export async function searchGoogleImages(
    terms: string[],
    apiKey: string,
    cx: string,
    maxResults: number = 10
): Promise<GeneratedImage[]> {
    const query = buildSearchQuery(terms);
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('q', query);
    url.searchParams.set('cx', cx);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('num', String(Math.min(Math.max(maxResults, 1), 10)));
    url.searchParams.set('safe', 'active');

    const response = await fetch(url.toString());
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Google CSE error: ${response.status} ${response.statusText} ${text}`.trim());
    }

    const data = await response.json() as GoogleCustomSearchResponse;
    const now = Date.now();

    return (data.items || [])
        .map(item => {
            if (!item.link) return null;
            return {
                id: crypto.randomUUID(),
                url: item.link,
                createdAt: now,
                source: 'search' as const,
                thumbnailUrl: item.image?.thumbnailLink,
                sourcePageUrl: item.image?.contextLink,
                provider: 'google_cse' as const
            };
        })
        .filter((item): item is GeneratedImage => Boolean(item));
}
