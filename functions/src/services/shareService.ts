import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import type { Slide, ProjectData, GeneratedImage } from '@shared/types';
import { isPubliclyListable } from '@shared/types';
import { deriveThumbnailUrl, incrementViewCount, incrementRemixCount } from './publicDeckService';
import { getOwnerDisplayName } from '../utils/ownerDisplayName';

const db = admin.firestore();

export const DECK_NOT_AVAILABLE = 'This deck is not available';

export const assertPreviewable = (project: ProjectData): void => {
    if (!isPubliclyListable(project)) {
        throw new Error(DECK_NOT_AVAILABLE);
    }
};

const sanitizeSearchImage = (img: GeneratedImage): GeneratedImage => ({
    id: img.id,
    url: img.url,
    thumbnailUrl: img.thumbnailUrl,
    source: img.source,
    aspectRatio: img.aspectRatio,
    createdAt: img.createdAt,
});

const sanitizeSlideForPreview = (slide: Slide): Slide => {
    const searchImages = (slide.generatedImages || [])
        .filter(img => img.source === 'search')
        .map(sanitizeSearchImage);

    const sanitized: Slide = {
        id: slide.id,
        sortOrder: slide.sortOrder,
        title: slide.title,
        content: slide.content,
        speakerNotes: '',
        layout: slide.layout,
        aspectRatio: slide.aspectRatio,
    };

    if (searchImages.length > 0) {
        sanitized.generatedImages = searchImages;
    }

    return sanitized;
};

const fetchProjectWithSlides = async (ownerId: string, projectId: string) => {
    const projectRef = db.collection('users').doc(ownerId).collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
        throw new Error(DECK_NOT_AVAILABLE);
    }
    const projectData = projectSnap.data() as ProjectData;
    const slidesSnap = await projectRef.collection('slides').orderBy('sortOrder', 'asc').get();
    const slides = slidesSnap.docs.map(doc => doc.data() as Slide);
    return { projectData, slides, projectRef };
};

export const createShareLink = async (ownerId: string, projectId: string) => {
    const { projectData, projectRef } = await fetchProjectWithSlides(ownerId, projectId);

    const existingToken = (projectData as ProjectData & { shareToken?: string }).shareToken;
    if (existingToken) {
        const shareRef = db.collection('shares').doc(existingToken);
        const shareSnap = await shareRef.get();
        if (!shareSnap.exists) {
            await shareRef.set({
                token: existingToken,
                ownerId,
                projectId,
                createdAt: FieldValue.serverTimestamp(),
                lastClaimedAt: null,
                claimCount: 0
            });
        }
        return { token: existingToken };
    }

    const token = crypto.randomUUID();
    const shareRef = db.collection('shares').doc(token);

    await shareRef.set({
        token,
        ownerId,
        projectId,
        createdAt: FieldValue.serverTimestamp(),
        lastClaimedAt: null,
        claimCount: 0
    });

    await projectRef.update({
        shareToken: token,
        shareCreatedAt: FieldValue.serverTimestamp()
    });

    return { token };
};

export const getSharePreview = async (token: string) => {
    const shareRef = db.collection('shares').doc(token);
    const shareSnap = await shareRef.get();
    if (!shareSnap.exists) {
        throw new Error(DECK_NOT_AVAILABLE);
    }
    const shareData = shareSnap.data() as { ownerId: string; projectId: string };

    const [{ projectData, slides }, ownerSnap] = await Promise.all([
        fetchProjectWithSlides(shareData.ownerId, shareData.projectId),
        db.collection('users').doc(shareData.ownerId).get()
    ]);

    assertPreviewable(projectData);

    const ownerData = ownerSnap.exists ? (ownerSnap.data() as { displayName?: string; email?: string }) : undefined;
    const ownerName = getOwnerDisplayName(ownerData);

    incrementViewCount(token);

    const thumbnailUrl = deriveThumbnailUrl(slides);

    return {
        ownerName,
        project: {
            title: projectData.title,
            topic: projectData.topic,
            gradeLevel: projectData.gradeLevel,
            subject: projectData.subject,
        },
        slides: slides.map(sanitizeSlideForPreview),
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
    };
};

const copyProjectToUser = async (projectData: ProjectData, slides: Slide[], claimantId: string) => {
    const projectRef = db.collection('users').doc(claimantId).collection('projects').doc();
    const {
        userId: _userId,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        visibility: _visibility,
        publishedAt: _publishedAt,
        shareToken: _shareToken,
        shareCreatedAt: _shareCreatedAt,
        ...rest
    } = projectData as ProjectData & {
        userId?: string;
        createdAt?: unknown;
        updatedAt?: unknown;
    };

    await projectRef.set({
        ...rest,
        userId: claimantId,
        status: 'completed',
        generationProgress: null,
        generationPhase: null,
        generationMessage: null,
        generationError: null,
        generationRequestId: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    });

    const batches: FirebaseFirestore.WriteBatch[] = [];
    let batch = db.batch();
    let operationCount = 0;

    slides.forEach((slide, index) => {
        const slideId = slide.id || crypto.randomUUID();
        const slideRef = projectRef.collection('slides').doc(slideId);
        batch.set(slideRef, {
            ...slide,
            id: slideId,
            sortOrder: typeof slide.sortOrder === 'number' ? slide.sortOrder : index,
            updatedAt: FieldValue.serverTimestamp()
        });
        operationCount += 1;

        if (operationCount >= 400) {
            batches.push(batch);
            batch = db.batch();
            operationCount = 0;
        }
    });

    if (operationCount > 0) {
        batches.push(batch);
    }

    for (const currentBatch of batches) {
        await currentBatch.commit();
    }

    return projectRef.id;
};

export const claimShareLink = async (token: string, claimantId: string) => {
    const shareRef = db.collection('shares').doc(token);
    const shareSnap = await shareRef.get();
    if (!shareSnap.exists) {
        throw new Error(DECK_NOT_AVAILABLE);
    }
    const shareData = shareSnap.data() as { ownerId: string; projectId: string };

    const claimRef = shareRef.collection('claims').doc(claimantId);
    const claimSnap = await claimRef.get();
    if (claimSnap.exists) {
        const claimData = claimSnap.data() as { newProjectId?: string };
        if (claimData?.newProjectId) {
            return { projectId: claimData.newProjectId, alreadyClaimed: true };
        }
    }

    const { projectData, slides } = await fetchProjectWithSlides(shareData.ownerId, shareData.projectId);

    assertPreviewable(projectData);

    const newProjectId = await copyProjectToUser(projectData, slides, claimantId);

    await Promise.all([
        claimRef.set({
            userId: claimantId,
            claimedAt: FieldValue.serverTimestamp(),
            newProjectId
        }),
        shareRef.set({
            claimCount: FieldValue.increment(1),
            lastClaimedAt: FieldValue.serverTimestamp()
        }, { merge: true })
    ]);

    incrementRemixCount(token);

    return { projectId: newProjectId, alreadyClaimed: false };
};
