/**
 * Backfill legacy completed decks into publicDecks via project doc updates.
 * Primary path: set visibility='public' + updatedAt → onProjectUpdate trigger upserts index.
 * --verify-only: heal orphans via local upsertPublicDeckLocal (keep in sync with publicDeckService.upsertPublicDeck).
 *
 * Usage:
 *   npm run backfill-public-decks -- --dry-run
 *   npm run backfill-public-decks
 *   npm run backfill-public-decks -- --verify-only
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS (see scripts/SETUP-SERVICE-ACCOUNT.md).
 */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Slide, ProjectData } from '../shared/types.ts';
import { isPubliclyListable } from '../shared/types.ts';
import { getOwnerDisplayName } from '../functions/src/utils/ownerDisplayName.ts';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'ai-slide-architect-9de88';
const DEFAULT_BATCH_SIZE = 25;
const BATCH_PAUSE_MS = 500;
const STORAGE_AUDIT_SAMPLE_SIZE = 20;

interface Stats {
    scanned: number;
    skipped_private: number;
    skipped_already: number;
    updated: number;
    errors: number;
    verify: { orphans: number; healed: number };
    storage_audit: { sampled: number; firebase_urls: number };
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verifyOnly = args.includes('--verify-only');
const verbose = args.includes('--verbose');

const batchSizeArg = args.find(a => a.startsWith('--batch-size='));
const limitArg = args.find(a => a.startsWith('--limit='));
const batchSize = batchSizeArg ? Number(batchSizeArg.split('=')[1]) : DEFAULT_BATCH_SIZE;
const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// keep in sync with publicDeckService.upsertPublicDeck
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

const upsertPublicDeckLocal = async (
    db: admin.firestore.Firestore,
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

const classifyImageUrl = (url: string): 'brave-external' | 'firebasestorage' | 'other' => {
    if (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com')) {
        return 'firebasestorage';
    }
    if (url.startsWith('https://') || url.startsWith('http://')) {
        return 'brave-external';
    }
    return 'other';
};

const auditSlideImageUrls = async (
    projectRef: admin.firestore.DocumentReference,
    stats: Stats
): Promise<void> => {
    const slidesSnap = await projectRef.collection('slides').get();
    for (const slideDoc of slidesSnap.docs) {
        const slide = slideDoc.data() as Slide;
        const urls: string[] = [];
        for (const img of slide.generatedImages || []) {
            if (img.source === 'search' && img.url) urls.push(img.url);
        }
        if (slide.backgroundImage) urls.push(slide.backgroundImage);

        for (const url of urls) {
            const kind = classifyImageUrl(url);
            if (kind === 'firebasestorage') {
                stats.storage_audit.firebase_urls++;
                if (verbose) {
                    console.warn(`[storage-audit] Firebase Storage URL in search images: ${url}`);
                }
            }
        }
    }
};

const verifyAndHealOrphans = async (
    db: admin.firestore.Firestore,
    isDryRun: boolean
): Promise<{ orphans: number; healed: number }> => {
    let orphans = 0;
    let healed = 0;

    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
        const projects = await userDoc.ref.collection('projects').where('status', '==', 'completed').get();
        for (const proj of projects.docs) {
            const data = proj.data() as ProjectData;
            if (!isPubliclyListable(data) || !data.shareToken) continue;

            const indexSnap = await db.collection('publicDecks').doc(data.shareToken).get();
            if (indexSnap.exists && indexSnap.data()?.projectId === proj.id) continue;

            orphans++;
            if (verbose) {
                console.log(`[verify] orphan: user=${userDoc.id} project=${proj.id} token=${data.shareToken}`);
            }

            if (!isDryRun) {
                await upsertPublicDeckLocal(db, data.shareToken, userDoc.id, proj.id, data);
                healed++;
            }
        }
    }

    return { orphans, healed };
};

const run = async () => {
    admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();

    const stats: Stats = {
        scanned: 0,
        skipped_private: 0,
        skipped_already: 0,
        updated: 0,
        errors: 0,
        verify: { orphans: 0, healed: 0 },
        storage_audit: { sampled: 0, firebase_urls: 0 },
    };

    if (verifyOnly) {
        stats.verify = await verifyAndHealOrphans(db, dryRun);
        console.log(JSON.stringify({ dryRun, verifyOnly, ...stats }, null, 2));
        const unhealed = stats.verify.orphans - (dryRun ? 0 : stats.verify.healed);
        process.exit(!dryRun && unhealed > 0 ? 1 : 0);
    }

    let processedSincePause = 0;
    let writesQueued = 0;
    const usersSnap = await db.collection('users').get();

    outer: for (const userDoc of usersSnap.docs) {
        const projects = await userDoc.ref.collection('projects').where('status', '==', 'completed').get();

        for (const proj of projects.docs) {
            if (limit !== undefined && writesQueued >= limit) {
                break outer;
            }

            stats.scanned++;
            const data = proj.data() as ProjectData;

            if (data.visibility === 'private') {
                stats.skipped_private++;
                continue;
            }

            if (!data.shareToken) {
                console.error(`[error] missing shareToken: user=${userDoc.id} project=${proj.id}`);
                stats.errors++;
                continue;
            }

            const indexSnap = await db.collection('publicDecks').doc(data.shareToken).get();
            if (indexSnap.exists && indexSnap.data()?.projectId === proj.id) {
                stats.skipped_already++;
                continue;
            }

            if (stats.storage_audit.sampled < STORAGE_AUDIT_SAMPLE_SIZE) {
                await auditSlideImageUrls(proj.ref, stats);
                stats.storage_audit.sampled++;
            }

            if (!dryRun) {
                await proj.ref.update({
                    visibility: 'public',
                    updatedAt: FieldValue.serverTimestamp(),
                });
            }

            stats.updated++;
            writesQueued++;
            processedSincePause++;

            if (verbose) {
                console.log(`[update] user=${userDoc.id} project=${proj.id} token=${data.shareToken}`);
            }

            if (processedSincePause >= batchSize) {
                processedSincePause = 0;
                if (!dryRun) {
                    await sleep(BATCH_PAUSE_MS);
                }
            }
        }
    }

    stats.verify = await verifyAndHealOrphans(db, dryRun);

    console.log(JSON.stringify({ dryRun, verifyOnly, batchSize, limit: limit ?? null, ...stats }, null, 2));
    process.exit(stats.errors > 0 ? 1 : 0);
};

run().catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
