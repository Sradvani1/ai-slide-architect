import { auth } from '../firebaseConfig';
import type { Slide } from '../types';
import { getApiBaseUrlDynamic } from '../utils/apiBaseUrl';

interface SharePreviewResponse {
    ownerName: string;
    project: {
        title: string;
        topic: string;
        gradeLevel: string;
        subject: string;
    };
    slides: Slide[];
}

const authenticatedRequest = async <T>(endpoint: string, body: Record<string, unknown>): Promise<T> => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User must be authenticated to continue.');
    }
    const token = await user.getIdToken();
    const apiUrl = getApiBaseUrlDynamic();
    const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || response.statusText);
    }

    return response.json();
};

export const claimShareLink = async (token: string) => {
    return authenticatedRequest<{ projectId: string; alreadyClaimed: boolean }>('/share/claim', { token });
};

export const fetchSharePreview = async (token: string): Promise<SharePreviewResponse> => {
    const apiUrl = getApiBaseUrlDynamic();
    const response = await fetch(`${apiUrl}/share/preview?token=${encodeURIComponent(token)}`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || response.statusText);
    }

    return response.json();
};

export const buildShareUrl = (token: string) => `${window.location.origin}/share/${token}`;
