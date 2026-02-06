import { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 60 * 1000; // 60 seconds
const MAX_REQUESTS_PER_WINDOW = 60;

interface WindowState {
    count: number;
    windowStart: number;
}

const ipWindows = new Map<string, WindowState>();

function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded !== undefined) {
        const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
        if (typeof raw === 'string') {
            const first = raw.split(',')[0]?.trim();
            if (first) return first;
        }
    }
    if (req.ip) return req.ip;
    return 'unknown';
}

export function sharePreviewRateLimit(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const ip = getClientIp(req);
    const now = Date.now();
    let state = ipWindows.get(ip);

    if (!state) {
        ipWindows.set(ip, { count: 1, windowStart: now });
        next();
        return;
    }

    if (now - state.windowStart > WINDOW_MS) {
        state = { count: 1, windowStart: now };
        ipWindows.set(ip, state);
        next();
        return;
    }

    if (state.count >= MAX_REQUESTS_PER_WINDOW) {
        res.status(429).json({ error: 'Too many requests' });
        return;
    }

    state.count += 1;
    next();
}
