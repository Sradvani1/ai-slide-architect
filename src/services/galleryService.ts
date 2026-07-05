import type { GalleryResponse, GallerySort, GalleryReportReason } from '../types';
import { getApiBaseUrlDynamic } from '../utils/apiBaseUrl';

export interface SubmitGalleryReportParams {
    token: string;
    reason: GalleryReportReason;
    details?: string;
}

export interface FetchGalleryParams {
    gradeLevel?: string;
    subject?: string;
    sort?: GallerySort;
    limit?: number;
    cursor?: string;
}

export const fetchGallery = async (params: FetchGalleryParams = {}): Promise<GalleryResponse> => {
    const searchParams = new URLSearchParams();
    if (params.gradeLevel) searchParams.set('gradeLevel', params.gradeLevel);
    if (params.subject) searchParams.set('subject', params.subject);
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.limit != null) searchParams.set('limit', String(params.limit));
    if (params.cursor) searchParams.set('cursor', params.cursor);

    const query = searchParams.toString();
    const apiUrl = getApiBaseUrlDynamic();
    const response = await fetch(`${apiUrl}/gallery${query ? `?${query}` : ''}`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = typeof errorData.error === 'string'
            ? errorData.error
            : response.status === 429
                ? 'Too many requests'
                : response.statusText;
        throw new Error(message);
    }

    return response.json();
};

export const submitGalleryReport = async (params: SubmitGalleryReportParams): Promise<void> => {
    const apiUrl = getApiBaseUrlDynamic();
    const response = await fetch(`${apiUrl}/gallery/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = typeof errorData.error === 'string'
            ? errorData.error
            : response.status === 429
                ? 'Too many requests'
                : response.statusText;
        throw new Error(message);
    }
};
