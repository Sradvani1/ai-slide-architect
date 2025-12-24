import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Debug: Log environment configuration
if (!import.meta.env.PROD) {
    console.log('[Firebase Config] VITE_USE_PROD_API:', import.meta.env.VITE_USE_PROD_API);
    console.log('[Firebase Config] Project ID:', firebaseConfig.projectId);
}

const app = initializeApp(firebaseConfig);

// Only initialize analytics in production to avoid measurement ID warnings
export const analytics = import.meta.env.PROD ? getAnalytics(app) : null;

export const auth = getAuth(app);

// Use auto-detect for long polling to avoid CORS issues when connecting from localhost to production
export const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true
});

export const storage = getStorage(app);
export const functions = getFunctions(app);
