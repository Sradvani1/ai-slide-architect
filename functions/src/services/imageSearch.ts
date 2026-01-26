import * as crypto from 'crypto';
import type { GeneratedImage } from '@shared/types';

interface BraveImageResult {
    url?: string;
    title?: string;
    source?: string;
    thumbnail?: {
        src?: string;
    };
    properties?: {
        url?: string;
    };
}

interface BraveImageSearchResponse {
    results?: BraveImageResult[];
}

const buildSearchQuery = (terms: string[]): string => {
    const cleaned = terms.map(term => term.trim()).filter(Boolean);
    if (cleaned.length === 0) {
        throw new Error('No search terms provided');
    }
    const quoted = cleaned.slice(0, 3).map(term => `"${term}"`);
    return quoted.join(' OR ');
};

export async function searchBraveImages(
    terms: string[],
    apiKey: string,
    maxResults: number = 50
): Promise<GeneratedImage[]> {
    const query = buildSearchQuery(terms);
    const url = new URL('https://api.search.brave.com/res/v1/images/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(Math.min(Math.max(maxResults, 1), 200)));
    url.searchParams.set('safesearch', 'strict');

    const response = await fetch(url.toString(), {
        headers: {
            'X-Subscription-Token': apiKey
        }
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Brave Search error: ${response.status} ${response.statusText} ${text}`.trim());
    }

    const data = await response.json() as BraveImageSearchResponse;
    const now = Date.now();

    const minWidth = 600;
    const minHeight = 400;

    return (data.results || []).flatMap(entry => {
        const imageUrl = entry.properties?.url;
        if (!imageUrl) return [];
        const width = entry.properties?.width;
        const height = entry.properties?.height;
        if (typeof width === 'number' && typeof height === 'number') {
            if (width < minWidth || height < minHeight) {
                return [];
            }
        }
        const id = crypto.randomUUID() as string;
        const mapped: GeneratedImage = {
            id,
            url: imageUrl,
            createdAt: now,
            source: 'search',
            thumbnailUrl: entry.thumbnail?.src || imageUrl,
            sourcePageUrl: entry.url || entry.source,
            provider: 'brave'
        };
        return [mapped];
    });
}
