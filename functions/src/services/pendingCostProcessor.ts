import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { calculateCost, getModelPricing } from './pricingService';

const MAX_BATCH = 100;
const STUCK_THRESHOLD_MS = 15 * 60 * 1000;

type UsageEventData = {
    requestId: string;
    userId: string;
    projectId: string;
    modelKey: string;
    inputTokens: number;
    outputTokens: number;
    costStatus: 'pending' | 'calculated';
    processing?: boolean;
    processingAt?: admin.firestore.Timestamp;
};

export async function processPendingUsageEvents(): Promise<void> {
    const db = admin.firestore();
    const now = Date.now();
    const stuckCutoff = admin.firestore.Timestamp.fromMillis(now - STUCK_THRESHOLD_MS);

    const queryPending = db.collection('usageEvents')
        .where('costStatus', '==', 'pending')
        .where('processing', '==', false)
        .orderBy('createdAt', 'asc')
        .limit(MAX_BATCH);

    const queryStuck = db.collection('usageEvents')
        .where('costStatus', '==', 'pending')
        .where('processing', '==', true)
        .where('processingAt', '<', stuckCutoff)
        .orderBy('processingAt', 'asc')
        .orderBy('createdAt', 'asc')
        .limit(MAX_BATCH);

    const [pendingSnap, stuckSnap] = await Promise.all([queryPending.get(), queryStuck.get()]);

    const candidates = new Map<string, admin.firestore.QueryDocumentSnapshot>();
    pendingSnap.docs.forEach(doc => candidates.set(doc.id, doc));
    stuckSnap.docs.forEach(doc => candidates.set(doc.id, doc));

    for (const [eventId] of candidates) {
        const eventRef = db.collection('usageEvents').doc(eventId);
        const claimed = await db.runTransaction(async (transaction) => {
            const eventDoc = await transaction.get(eventRef);
            const eventData = eventDoc.data() as UsageEventData | undefined;
            if (!eventData || eventData.costStatus !== 'pending') {
                return null;
            }

            const processingAtMs = eventData.processingAt?.toMillis();
            const isStuck = processingAtMs ? (Date.now() - processingAtMs > STUCK_THRESHOLD_MS) : false;
            if (eventData.processing && !isStuck) {
                return null;
            }

            transaction.update(eventRef, {
                processing: true,
                processingAt: FieldValue.serverTimestamp()
            });

            return eventData;
        });

        if (!claimed) {
            continue;
        }

        const pricing = await getModelPricing(claimed.modelKey);
        if (!pricing) {
            await eventRef.update({
                processing: false,
                processingAt: FieldValue.delete()
            });
            continue;
        }

        if (typeof pricing.updatedAt !== 'number' || !Number.isFinite(pricing.updatedAt)) {
            console.error(`[pendingCostProcessor] Pricing ${pricing.id} missing numeric updatedAt`);
            await eventRef.update({
                processing: false,
                processingAt: FieldValue.delete()
            });
            continue;
        }

        const calculatedCost = calculateCost(
            claimed.inputTokens || 0,
            claimed.outputTokens || 0,
            pricing
        );

        await db.runTransaction(async (transaction) => {
            const eventDoc = await transaction.get(eventRef);
            const eventData = eventDoc.data() as UsageEventData | undefined;
            if (!eventData || eventData.costStatus !== 'pending') {
                return;
            }

            const projectRef = db.collection('users')
                .doc(eventData.userId)
                .collection('projects')
                .doc(eventData.projectId);

            transaction.update(eventRef, {
                costStatus: 'calculated',
                cost: calculatedCost,
                pricingId: pricing.id,
                pricingVersion: pricing.updatedAt,
                processing: false,
                processingAt: FieldValue.delete(),
                processedAt: FieldValue.serverTimestamp()
            });

            transaction.update(projectRef, {
                totalCost: FieldValue.increment(calculatedCost),
                updatedAt: FieldValue.serverTimestamp()
            });
        });
    }
}
