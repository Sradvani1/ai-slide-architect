import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { GalleryReportReason } from '@shared/types';

const db = admin.firestore();

const VALID_REASONS: GalleryReportReason[] = ['inappropriate', 'copyright', 'inaccurate', 'other'];
const MAX_DETAILS_LENGTH = 500;

export const submitGalleryReport = async (
    token: string,
    reason: string,
    details: string | undefined,
    reporterIpHash: string,
    userAgent: string
): Promise<void> => {
    if (!VALID_REASONS.includes(reason as GalleryReportReason)) {
        throw new Error('Invalid reason');
    }

    const trimmedDetails = details?.trim() ?? '';
    if (trimmedDetails.length > MAX_DETAILS_LENGTH) {
        throw new Error('Details too long');
    }

    const indexSnap = await db.collection('publicDecks').doc(token).get();
    if (!indexSnap.exists) {
        throw new Error('Deck not found');
    }

    await db.collection('galleryReports').add({
        token,
        reason,
        details: trimmedDetails || null,
        reportedAt: FieldValue.serverTimestamp(),
        reporterIpHash,
        userAgent: userAgent.slice(0, 200),
    });
};
