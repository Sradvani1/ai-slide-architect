import { useEffect } from 'react';

interface PageMetaOptions {
    title: string;
    description: string;
    canonical: string;
    enabled?: boolean;
}

interface SavedMetaState {
    title: string;
    description: string | null;
    descriptionExisted: boolean;
    canonical: string | null;
    canonicalExisted: boolean;
}

let savedMetaState: SavedMetaState | null = null;
let metaHookMountCount = 0;

const captureInitialMeta = () => {
    if (savedMetaState) return;

    const descriptionEl = document.querySelector('meta[name="description"]');
    const canonicalEl = document.querySelector('link[rel="canonical"]');

    savedMetaState = {
        title: document.title,
        description: descriptionEl?.getAttribute('content') ?? null,
        descriptionExisted: Boolean(descriptionEl),
        canonical: canonicalEl?.getAttribute('href') ?? null,
        canonicalExisted: Boolean(canonicalEl),
    };
};

const upsertMetaTag = (name: string, content: string) => {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
};

const upsertCanonicalLink = (href: string) => {
    let el = document.querySelector('link[rel="canonical"]');
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', 'canonical');
        document.head.appendChild(el);
    }
    el.setAttribute('href', href);
};

const restoreMeta = () => {
    if (!savedMetaState) return;

    document.title = savedMetaState.title;

    const descriptionEl = document.querySelector('meta[name="description"]');
    if (savedMetaState.descriptionExisted) {
        if (descriptionEl) {
            if (savedMetaState.description) {
                descriptionEl.setAttribute('content', savedMetaState.description);
            } else {
                descriptionEl.removeAttribute('content');
            }
        }
    } else if (descriptionEl) {
        descriptionEl.remove();
    }

    const canonicalEl = document.querySelector('link[rel="canonical"]');
    if (savedMetaState.canonicalExisted) {
        if (canonicalEl) {
            if (savedMetaState.canonical) {
                canonicalEl.setAttribute('href', savedMetaState.canonical);
            } else {
                canonicalEl.removeAttribute('href');
            }
        }
    } else if (canonicalEl) {
        canonicalEl.remove();
    }
};

export const usePageMeta = ({ title, description, canonical, enabled = true }: PageMetaOptions) => {
    useEffect(() => {
        if (!enabled) return;

        captureInitialMeta();
        metaHookMountCount += 1;

        return () => {
            metaHookMountCount -= 1;
            if (metaHookMountCount <= 0) {
                metaHookMountCount = 0;
                restoreMeta();
            }
        };
    }, [enabled]);

    useEffect(() => {
        if (!enabled) return;

        document.title = title;
        upsertMetaTag('description', description);
        upsertCanonicalLink(canonical);
    }, [enabled, title, description, canonical]);
};
