import { useEffect, useRef } from 'react';

interface OpenGraphMeta {
    title: string;
    description: string;
    image: string;
    url: string;
}

interface PageMetaOptions {
    title: string;
    description: string;
    canonical: string;
    enabled?: boolean;
    openGraph?: OpenGraphMeta;
    jsonLd?: Record<string, unknown>;
}

interface SavedMetaState {
    title: string;
    description: string | null;
    descriptionExisted: boolean;
    canonical: string | null;
    canonicalExisted: boolean;
    ogTags: Array<{ property: string; content: string | null }>;
    twitterTags: Array<{ name: string; content: string | null }>;
    jsonLdContent: string | null;
    jsonLdExisted: boolean;
}

let savedMetaState: SavedMetaState | null = null;
let metaHookMountCount = 0;

const OG_PROPERTIES = ['og:type', 'og:title', 'og:description', 'og:image', 'og:url'] as const;
const TWITTER_NAMES = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'] as const;

const captureInitialMeta = () => {
    if (savedMetaState) return;

    const descriptionEl = document.querySelector('meta[name="description"]');
    const canonicalEl = document.querySelector('link[rel="canonical"]');
    const jsonLdEl = document.querySelector('script#page-jsonld');

    savedMetaState = {
        title: document.title,
        description: descriptionEl?.getAttribute('content') ?? null,
        descriptionExisted: Boolean(descriptionEl),
        canonical: canonicalEl?.getAttribute('href') ?? null,
        canonicalExisted: Boolean(canonicalEl),
        ogTags: OG_PROPERTIES.map(property => {
            const el = document.querySelector(`meta[property="${property}"]`);
            return { property, content: el?.getAttribute('content') ?? null };
        }),
        twitterTags: TWITTER_NAMES.map(name => {
            const el = document.querySelector(`meta[name="${name}"]`);
            return { name, content: el?.getAttribute('content') ?? null };
        }),
        jsonLdContent: jsonLdEl?.textContent ?? null,
        jsonLdExisted: Boolean(jsonLdEl),
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

const upsertPropertyMetaTag = (property: string, content: string) => {
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
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

const upsertJsonLd = (jsonLd: Record<string, unknown>) => {
    let el = document.querySelector('script#page-jsonld');
    if (!el) {
        el = document.createElement('script');
        el.setAttribute('type', 'application/ld+json');
        el.setAttribute('id', 'page-jsonld');
        document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(jsonLd);
};

const removeInjectedOgTags = () => {
    OG_PROPERTIES.forEach(property => {
        const el = document.querySelector(`meta[property="${property}"]`);
        if (el) el.remove();
    });
};

const removeInjectedTwitterTags = () => {
    TWITTER_NAMES.forEach(name => {
        const el = document.querySelector(`meta[name="${name}"]`);
        if (el) el.remove();
    });
};

const removeInjectedJsonLd = () => {
    const el = document.querySelector('script#page-jsonld');
    if (el) el.remove();
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

    removeInjectedOgTags();
    savedMetaState.ogTags.forEach(({ property, content }) => {
        if (content !== null) {
            upsertPropertyMetaTag(property, content);
        }
    });

    removeInjectedTwitterTags();
    savedMetaState.twitterTags.forEach(({ name, content }) => {
        if (content !== null) {
            upsertMetaTag(name, content);
        }
    });

    removeInjectedJsonLd();
    if (savedMetaState.jsonLdExisted && savedMetaState.jsonLdContent) {
        const el = document.createElement('script');
        el.setAttribute('type', 'application/ld+json');
        el.setAttribute('id', 'page-jsonld');
        el.textContent = savedMetaState.jsonLdContent;
        document.head.appendChild(el);
    }
};

export const usePageMeta = ({
    title,
    description,
    canonical,
    enabled = true,
    openGraph,
    jsonLd,
}: PageMetaOptions) => {
    const hadOpenGraphRef = useRef(false);
    const hadJsonLdRef = useRef(false);

    useEffect(() => {
        if (!enabled) return;

        captureInitialMeta();
        metaHookMountCount += 1;

        return () => {
            metaHookMountCount -= 1;
            hadOpenGraphRef.current = false;
            hadJsonLdRef.current = false;
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

        if (openGraph) {
            upsertPropertyMetaTag('og:type', 'website');
            upsertPropertyMetaTag('og:title', openGraph.title);
            upsertPropertyMetaTag('og:description', openGraph.description);
            upsertPropertyMetaTag('og:image', openGraph.image);
            upsertPropertyMetaTag('og:url', openGraph.url);
            upsertMetaTag('twitter:card', 'summary_large_image');
            upsertMetaTag('twitter:title', openGraph.title);
            upsertMetaTag('twitter:description', openGraph.description);
            upsertMetaTag('twitter:image', openGraph.image);
            hadOpenGraphRef.current = true;
        } else if (hadOpenGraphRef.current) {
            removeInjectedOgTags();
            removeInjectedTwitterTags();
            hadOpenGraphRef.current = false;
        }

        if (jsonLd) {
            upsertJsonLd(jsonLd);
            hadJsonLdRef.current = true;
        } else if (hadJsonLdRef.current) {
            removeInjectedJsonLd();
            hadJsonLdRef.current = false;
        }
    }, [enabled, title, description, canonical, openGraph, jsonLd]);
};
