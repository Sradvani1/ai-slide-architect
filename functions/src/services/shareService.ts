import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import type { Slide, ProjectData } from '@shared/types';

const db = admin.firestore();
const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const getOwnerDisplayName = (ownerData?: { displayName?: string | null; email?: string | null }) => {
    const name = ownerData?.displayName?.trim();
    if (name) return name;
    const email = ownerData?.email?.trim();
    if (!email) return 'A teacher';
    return email.split('@')[0] || 'A teacher';
};

const sanitizeSlideForPreview = (slide: Slide): Slide => {
    const {
        speakerNotes,
        promptGenerationState,
        promptGenerationError,
        promptRequestId,
        updatedAt,
        ...rest
    } = slide as Slide & {
        speakerNotes?: string;
        promptGenerationState?: string;
        promptGenerationError?: string;
        promptRequestId?: string;
        updatedAt?: unknown;
    };
    return rest;
};

const fetchProjectWithSlides = async (ownerId: string, projectId: string) => {
    const projectRef = db.collection('users').doc(ownerId).collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
        throw new Error('Project not found');
    }
    const projectData = projectSnap.data() as ProjectData;
    const slidesSnap = await projectRef.collection('slides').orderBy('sortOrder', 'asc').get();
    const slides = slidesSnap.docs.map(doc => doc.data() as Slide);
    return { projectData, slides, projectRef };
};

export const createShareLink = async (ownerId: string, projectId: string) => {
    const { projectData } = await fetchProjectWithSlides(ownerId, projectId);

    if (projectData.status === 'generating') {
        throw new Error('Project is still generating');
    }

    const token = crypto.randomUUID();
    const shareRef = db.collection('shares').doc(token);

    await shareRef.set({
        token,
        ownerId,
        projectId,
        createdAt: FieldValue.serverTimestamp(),
        lastClaimedAt: null,
        claimCount: 0,
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + SHARE_TTL_MS)
    });

    return { token };
};

const assertShareNotExpired = (shareData: { expiresAt?: FirebaseFirestore.Timestamp | null }) => {
    const expiresAt = shareData?.expiresAt;
    if (!expiresAt) return;
    if (expiresAt.toMillis() <= Date.now()) {
        throw new Error('Share link expired');
    }
};

export const getSharePreview = async (token: string) => {
    const shareRef = db.collection('shares').doc(token);
    const shareSnap = await shareRef.get();
    if (!shareSnap.exists) {
        throw new Error('Share link not found');
    }
    const shareData = shareSnap.data() as { ownerId: string; projectId: string; expiresAt?: FirebaseFirestore.Timestamp | null };
    assertShareNotExpired(shareData);

    const [{ projectData, slides }, ownerSnap] = await Promise.all([
        fetchProjectWithSlides(shareData.ownerId, shareData.projectId),
        db.collection('users').doc(shareData.ownerId).get()
    ]);

    const ownerData = ownerSnap.exists ? (ownerSnap.data() as { displayName?: string; email?: string }) : undefined;
    const ownerName = getOwnerDisplayName(ownerData);

    return {
        ownerName,
        project: {
            title: projectData.title,
            topic: projectData.topic,
            gradeLevel: projectData.gradeLevel,
            subject: projectData.subject,
        },
        slides: slides.map(sanitizeSlideForPreview)
    };
};

const copyProjectToUser = async (projectData: ProjectData, slides: Slide[], claimantId: string) => {
    const projectRef = db.collection('users').doc(claimantId).collection('projects').doc();
    const { userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = projectData as ProjectData & {
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
        throw new Error('Share link not found');
    }
    const shareData = shareSnap.data() as { ownerId: string; projectId: string; expiresAt?: FirebaseFirestore.Timestamp | null };
    assertShareNotExpired(shareData);

    const claimRef = shareRef.collection('claims').doc(claimantId);
    const claimSnap = await claimRef.get();
    if (claimSnap.exists) {
        const claimData = claimSnap.data() as { newProjectId?: string };
        if (claimData?.newProjectId) {
            return { projectId: claimData.newProjectId, alreadyClaimed: true };
        }
    }

    const { projectData, slides } = await fetchProjectWithSlides(shareData.ownerId, shareData.projectId);

    if (projectData.status === 'generating') {
        throw new Error('Project is still generating');
    }

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

    return { projectId: newProjectId, alreadyClaimed: false };
};
