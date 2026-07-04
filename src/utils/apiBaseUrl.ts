import { functions } from '../firebaseConfig';

export const getApiBaseUrl = () => {
    const projectId = functions.app.options.projectId || 'ai-slide-architect-9de88';
    const useProdApi = import.meta.env.PROD || import.meta.env.VITE_USE_PROD_API === 'true';

    if (useProdApi) {
        const prodUrl = import.meta.env.VITE_PRODUCTION_API_URL || 'https://api-osqb5umzra-uc.a.run.app';
        return prodUrl;
    }

    const localUrl = import.meta.env.VITE_FUNCTIONS_URL || `http://localhost:5001/${projectId}/us-central1/api`;
    return localUrl;
};

export const getApiBaseUrlDynamic = () => getApiBaseUrl();
