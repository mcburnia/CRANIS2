/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/* ══════════════════════════════════════
   usePageMeta – dynamic document title + meta tags
   Sets title, description, robots, canonical, OG, and Twitter Card tags.
   For public pages, supplements the static meta injected at build time.
   For auth/admin pages, provides dynamic titles (all noindex).
   ══════════════════════════════════════ */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ROUTE_META,
  AUTH_PAGE_TITLES,
  ADMIN_PAGE_TITLES,
  SITE_NAME,
  SITE_URL,
  DEFAULT_OG_IMAGE,
} from '../seo/meta-config';

interface UsePageMetaOptions {
  title?: string;
  description?: string;
  noindex?: boolean;
}

function setMetaTag(name: string, content: string, isProperty = false): void {
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string): void {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

export function usePageMeta(options?: UsePageMetaOptions): void {
  const { pathname } = useLocation();

  useEffect(() => {
    const routeMeta = ROUTE_META[pathname];
    const authTitle = AUTH_PAGE_TITLES[pathname];
    const adminTitle = ADMIN_PAGE_TITLES[pathname];

    /* ── Title ── */
    let title: string;
    if (options?.title) {
      title = `${options.title} – ${SITE_NAME}`;
    } else if (routeMeta) {
      title = routeMeta.title;
    } else if (adminTitle) {
      title = `${adminTitle} – ${SITE_NAME}`;
    } else if (authTitle) {
      title = `${authTitle} – ${SITE_NAME}`;
    } else {
      title = SITE_NAME;
    }
    document.title = title;

    /* ── Description ── */
    const description = options?.description || routeMeta?.description || '';
    if (description) {
      setMetaTag('description', description);
    }

    /* ── Robots ── */
    const shouldNoindex = options?.noindex ?? routeMeta?.noindex ?? !routeMeta;
    setMetaTag('robots', shouldNoindex ? 'noindex, nofollow' : 'index, follow');

    /* ── Canonical ── */
    const canonical = routeMeta?.canonical
      ? `${SITE_URL}${routeMeta.canonical}`
      : `${SITE_URL}${pathname}`;
    setCanonical(canonical);

    /* ── Open Graph ── */
    setMetaTag('og:title', title, true);
    if (description) setMetaTag('og:description', description, true);
    setMetaTag('og:url', canonical, true);
    setMetaTag('og:type', routeMeta?.ogType || 'website', true);
    setMetaTag('og:site_name', SITE_NAME, true);
    setMetaTag('og:image', `${SITE_URL}${routeMeta?.ogImage || DEFAULT_OG_IMAGE}`, true);
    setMetaTag('og:image:width', '1200', true);
    setMetaTag('og:image:height', '630', true);
    setMetaTag('og:locale', 'en_GB', true);

    /* ── Twitter Card ── */
    setMetaTag('twitter:card', routeMeta?.twitterCard || 'summary_large_image');
    setMetaTag('twitter:title', title);
    if (description) setMetaTag('twitter:description', description);
    setMetaTag('twitter:image', `${SITE_URL}${routeMeta?.ogImage || DEFAULT_OG_IMAGE}`);
  }, [pathname, options?.title, options?.description, options?.noindex]);
}
