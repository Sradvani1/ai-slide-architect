import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Slide, ProjectData } from '@shared/types';
import { getOwnerDisplayName } from '../utils/ownerDisplayName';

const db = admin.firestore();

const deriveThumbnailUrl = (slides: Slide[]): string | undefined => {
    const sorted = [...slides].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const slide of sorted) {
        const searchImage = (slide.generatedImages || []).find(img => img.source === 'search');
        if (searchImage) {
            return searchImage.thumbnailUrl || searchImage.url;
        }
    }
    return undefined;
};

export const upsertPublicDeck = async (
    token: string,
    ownerId: string,
    projectId: string,
    projectData: ProjectData
) => {
    const projectRef = db.collection('users').doc(ownerId).collection('projects').doc(projectId);
    const slidesSnap = await projectRef.collection('slides').orderBy('sortOrder', 'asc').get();
    const slides = slidesSnap.docs.map(doc => doc.data() as Slide);

    const ownerSnap = await db.collection('users').doc(ownerId).get();
    const ownerData = ownerSnap.exists
        ? (ownerSnap.data() as { displayName?: string; email?: string })
        : undefined;
    const ownerDisplayName = getOwnerDisplayName(ownerData);

    const thumbnailUrl = deriveThumbnailUrl(slides);
    const indexRef = db.collection('publicDecks').doc(token);
    const existing = await indexRef.get();

    const baseFields = {
        token,
        ownerId,
        projectId,
        title: projectData.title,
        topic: projectData.topic,
        gradeLevel: projectData.gradeLevel,
        subject: projectData.subject,
        slideCount: slides.length,
        ownerDisplayName,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (existing.exists) {
        const update: Record<string, unknown> = { ...baseFields };
        if (thumbnailUrl) {
            update.thumbnailUrl = thumbnailUrl;
        } else {
            update.thumbnailUrl = FieldValue.delete();
        }
        await indexRef.update(update);
    } else {
        await indexRef.set({
            ...baseFields,
            ...(thumbnailUrl ? { thumbnailUrl } : {}),
            publishedAt: FieldValue.serverTimestamp(),
            viewCount: 0,
            remixCount: 0,
        });
    }
};

export const deletePublicDeck = async (token: string) => {
    const indexRef = db.collection('publicDecks').doc(token);
    const snap = await indexRef.get();
    if (snap.exists) {
        await indexRef.delete();
    }
};

export const incrementViewCount = (token: string): void => {
    db.collection('publicDecks').doc(token)
        .update({ viewCount: FieldValue.increment(1) })
        .catch(err => console.warn('Failed to increment viewCount for', token, err));
};
