import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Slide, ProjectData, PublicDeckIndex, GalleryDeckItem, GalleryResponse, GallerySort } from '@shared/types';
import { GRADE_LEVELS, SUBJECTS } from '@shared/constants';
import { getOwnerDisplayName } from '../utils/ownerDisplayName';

const db = admin.firestore();

interface GalleryCursor {
    sort: GallerySort;
    publishedAt?: number;
    viewCount?: number;
    token: string;
}

export interface ListPublicDecksParams {
    gradeLevel?: string;
    subject?: string;
    sort: GallerySort;
    limit: number;
    cursor?: string;
}

const timestampToMs = (value: unknown): number => {
    if (value instanceof Timestamp) {
        return value.toMillis();
    }
    if (typeof value === 'number') {
        return value;
    }
    return 0;
};

const mapIndexDocToGalleryItem = (data: PublicDeckIndex): GalleryDeckItem => ({
    token: data.token,
    title: data.title,
    topic: data.topic,
    gradeLevel: data.gradeLevel,
    subject: data.subject,
    slideCount: data.slideCount,
    ...(data.thumbnailUrl ? { thumbnailUrl: data.thumbnailUrl } : {}),
    ownerDisplayName: data.ownerDisplayName,
    publishedAt: timestampToMs(data.publishedAt),
    viewCount: typeof data.viewCount === 'number' ? data.viewCount : 0,
    remixCount: typeof data.remixCount === 'number' ? data.remixCount : 0,
});

const encodeCursor = (cursor: GalleryCursor): string =>
    Buffer.from(JSON.stringify(cursor)).toString('base64url');

const decodeCursor = (encoded: string, sort: GallerySort): GalleryCursor => {
    let parsed: GalleryCursor;
    try {
        parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as GalleryCursor;
    } catch {
        throw new Error('Invalid cursor');
    }

    if (parsed.sort !== sort) {
        throw new Error('Cursor sort does not match request sort');
    }
    if (!parsed.token || typeof parsed.token !== 'string') {
        throw new Error('Invalid cursor');
    }
    if (sort === 'recent' && typeof parsed.publishedAt !== 'number') {
        throw new Error('Invalid cursor');
    }
    if (sort === 'popular' && typeof parsed.viewCount !== 'number') {
        throw new Error('Invalid cursor');
    }

    return parsed;
};

export const listPublicDecks = async (params: ListPublicDecksParams): Promise<GalleryResponse> => {
    const { gradeLevel, subject, sort, limit, cursor } = params;

    if (gradeLevel && !GRADE_LEVELS.includes(gradeLevel)) {
        throw new Error('Invalid gradeLevel');
    }
    if (subject && !SUBJECTS.includes(subject)) {
        throw new Error('Invalid subject');
    }

    let query: FirebaseFirestore.Query = db.collection('publicDecks');

    if (subject) {
        query = query.where('subject', '==', subject);
    }
    if (gradeLevel) {
        query = query.where('gradeLevel', '==', gradeLevel);
    }

    const sortField = sort === 'popular' ? 'viewCount' : 'publishedAt';
    query = query.orderBy(sortField, 'desc').orderBy('token', 'desc');

    if (cursor) {
        const decoded = decodeCursor(cursor, sort);
        if (sort === 'popular') {
            query = query.startAfter(decoded.viewCount, decoded.token);
        } else {
            query = query.startAfter(Timestamp.fromMillis(decoded.publishedAt!), decoded.token);
        }
    }

    const snap = await query.limit(limit + 1).get();
    const docs = snap.docs;
    const hasMore = docs.length > limit;
    const pageDocs = hasMore ? docs.slice(0, limit) : docs;

    const items = pageDocs.map(doc => {
        const data = doc.data() as PublicDeckIndex;
        return mapIndexDocToGalleryItem({ ...data, token: data.token || doc.id });
    });

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
        const last = items[items.length - 1];
        nextCursor = encodeCursor(
            sort === 'popular'
                ? { sort: 'popular', viewCount: last.viewCount, token: last.token }
                : { sort: 'recent', publishedAt: last.publishedAt, token: last.token }
        );
    }

    return { items, nextCursor };
};

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

export const incrementRemixCount = (token: string): void => {
    db.collection('publicDecks').doc(token)
        .update({ remixCount: FieldValue.increment(1) })
        .catch(err => console.warn('Failed to increment remixCount for', token, err));
};
