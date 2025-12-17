import * as admin from 'firebase-admin';
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

export async function checkRateLimit(userId: string): Promise<boolean> {
    const rateLimitRef = admin.firestore()
        .collection('rateLimits')
        .doc(userId);

    const doc = await rateLimitRef.get();
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 10;

    if (!doc.exists) {
        await rateLimitRef.set({
            count: 1,
            windowStart: now
        });
        return true;
    }

    const data = doc.data()!;

    // Reset window if needed
    if (now - data.windowStart > windowMs) {
        await rateLimitRef.set({
            count: 1,
            windowStart: now
        });
        return true;
    }

    if (data.count >= maxRequests) {
        return false;
    }

    await rateLimitRef.update({
        count: admin.firestore.FieldValue.increment(1)
    });

    return true;
}

export async function rateLimitMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    if (!req.user) {
        // If not authenticated, auth middleware should have caught it, 
        // but just in case, let it pass or block. 
        // Choosing to let it pass to next middleware/handler which might handle public routes if any.
        return next();
    }

    try {
        const allowed = await checkRateLimit(req.user.uid);
        if (!allowed) {
            res.status(429).json({ error: 'Rate limit exceeded' });
            return;
        }
        next();
    } catch (error) {
        console.error('Rate limit check failed:', error);
        // Fail closed for security - block on error
        res.status(503).json({ error: 'Service temporarily unavailable' });
        return;
    }
}
