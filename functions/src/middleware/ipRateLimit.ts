import * as admin from 'firebase-admin';
import { Response, NextFunction, Request } from 'express';
import { createHash } from 'crypto';

interface IpRateLimiterOptions {
    windowMs: number;
    maxRequests: number;
    keyPrefix: string;
    failOpen?: boolean;
}

const toKey = (value: string) => createHash('sha256').update(value).digest('hex');

const getClientIp = (req: Request) => {
    if (typeof req.ip === 'string' && req.ip.length > 0) return req.ip;
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0]?.trim() || 'unknown';
    }
    return 'unknown';
};

export const createIpRateLimiter = (options: IpRateLimiterOptions) => {
    const { windowMs, maxRequests, keyPrefix, failOpen = false } = options;
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ip = getClientIp(req);
            const id = `${keyPrefix}_${toKey(ip)}`;
            const ref = admin.firestore().collection('ipRateLimits').doc(id);
            const now = Date.now();

            const allowed = await admin.firestore().runTransaction(async (tx) => {
                const snap = await tx.get(ref);
                if (!snap.exists) {
                    tx.set(ref, { count: 1, windowStart: now, lastSeenAt: now });
                    return true;
                }

                const data = snap.data() as { count?: number; windowStart?: number; lastSeenAt?: number };
                const windowStart = typeof data.windowStart === 'number' ? data.windowStart : 0;
                const count = typeof data.count === 'number' ? data.count : 0;

                if (now - windowStart > windowMs) {
                    tx.set(ref, { count: 1, windowStart: now, lastSeenAt: now }, { merge: true });
                    return true;
                }

                if (count >= maxRequests) {
                    tx.set(ref, { lastSeenAt: now }, { merge: true });
                    return false;
                }

                tx.set(ref, { count: count + 1, lastSeenAt: now }, { merge: true });
                return true;
            });

            if (!allowed) {
                res.status(429).json({ error: 'Too many requests' });
                return;
            }
            next();
        } catch (error) {
            console.error('IP rate limit check failed:', error);
            if (failOpen) {
                next();
                return;
            }
            res.status(503).json({ error: 'Service temporarily unavailable' });
        }
    };
};
