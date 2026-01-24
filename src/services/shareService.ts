import { auth, functions } from '../firebaseConfig';
import type { Slide } from '../types';

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

const getApiBaseUrl = () => {
    const projectId = functions.app.options.projectId || 'ai-slide-architect-9de88';
    const useProdApi = import.meta.env.PROD || import.meta.env.VITE_USE_PROD_API === 'true';

    if (useProdApi) {
        const prodUrl = import.meta.env.VITE_PRODUCTION_API_URL || 'https://api-osqb5umzra-uc.a.run.app';
        return prodUrl;
    }

    const localUrl = import.meta.env.VITE_FUNCTIONS_URL || `http://localhost:5001/${projectId}/us-central1/api`;
    return localUrl;
};

const getApiBaseUrlDynamic = () => getApiBaseUrl();

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

export const createShareLink = async (projectId: string) => {
    const result = await authenticatedRequest<{ token: string }>('/share/create', { projectId });
    const shareUrl = `${window.location.origin}/share/${result.token}`;
    return { token: result.token, shareUrl };
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
