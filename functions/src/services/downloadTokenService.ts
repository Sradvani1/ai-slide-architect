import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

const db = admin.firestore();
const collection = db.collection('downloadTokens');

interface DownloadTokenRecord {
    url: string;
    ownerId: string;
    projectId: string;
    createdAt: FirebaseFirestore.FieldValue;
    expiresAt: number;
}

export const createDownloadTokens = async (
    items: Array<{ url: string; ownerId: string; projectId: string }>,
    ttlMs: number
): Promise<Map<string, string>> => {
    const uniqueUrls = Array.from(new Set(items.map(item => item.url)));
    if (uniqueUrls.length === 0) {
        return new Map();
    }

    const now = Date.now();
    const expiresAt = now + ttlMs;
    const batch = db.batch();
    const urlToToken = new Map<string, string>();

    uniqueUrls.forEach((url) => {
        const token = crypto.randomUUID();
        const record: DownloadTokenRecord = {
            url,
            ownerId: items[0].ownerId,
            projectId: items[0].projectId,
            createdAt: FieldValue.serverTimestamp(),
            expiresAt
        };
        batch.set(collection.doc(token), record);
        urlToToken.set(url, token);
    });

    await batch.commit();
    return urlToToken;
};

export const resolveDownloadToken = async (
    token: string,
    ownerId: string,
    projectId: string
): Promise<string | null> => {
    const snap = await collection.doc(token).get();
    if (!snap.exists) return null;
    const data = snap.data() as { url?: string; ownerId?: string; projectId?: string; expiresAt?: number };
    if (!data?.url || data.ownerId !== ownerId || data.projectId !== projectId) {
        return null;
    }
    if (typeof data.expiresAt === 'number' && Date.now() > data.expiresAt) {
        return null;
    }
    return data.url;
};
