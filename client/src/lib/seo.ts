import { useEffect } from "react"

export const SITE_URL = "https://www.rosterme.app"

interface SeoOptions {
  title: string
  description?: string
  /** Path starting with "/", e.g. "/features". Used for canonical + og:url. */
  path?: string
  /** Set true for app/public invite pages that must stay out of Google. */
  noindex?: boolean
  /** Optional per-page JSON-LD object (e.g. FAQPage). Injected as application/ld+json. */
  jsonLd?: Record<string, unknown>
}

function upsertMetaByName(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute("name", name)
    document.head.appendChild(el)
  }
  el.setAttribute("content", content)
}

export const OG_IMAGE = `${SITE_URL}/og-image.png`

function upsertMetaByProperty(property: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`
  )
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute("property", property)
    document.head.appendChild(el)
  }
  el.setAttribute("content", content)
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement("link")
    el.setAttribute("rel", "canonical")
    document.head.appendChild(el)
  }
  el.setAttribute("href", href)
}

/**
 * Lightweight per-route SEO for the SPA (no extra dependency).
 * Sets title, description, canonical, OG tags; restores indexable
 * defaults or applies noindex for private pages.
 */
export function useSeo({
  title,
  description,
  path,
  noindex,
  jsonLd,
}: SeoOptions) {
  useEffect(() => {
    document.title = title

    upsertMetaByName("robots", noindex ? "noindex, nofollow" : "index, follow")

    if (description) {
      upsertMetaByName("description", description)
      upsertMetaByProperty("og:description", description)
      upsertMetaByProperty("twitter:description", description)
    }

    upsertMetaByProperty("og:title", title)
    upsertMetaByProperty("twitter:title", title)
    upsertMetaByProperty("og:type", "website")
    upsertMetaByProperty("og:image", OG_IMAGE)
    upsertMetaByProperty("twitter:image", OG_IMAGE)

    if (path) {
      const canonical = `${SITE_URL}${path === "/" ? "/" : path}`
      upsertCanonical(canonical)
      upsertMetaByProperty("og:url", canonical)
    }

    const JSON_LD_ID = "route-jsonld"
    const existing = document.head.querySelector(
      `script[data-seo-jsonld="${JSON_LD_ID}"]`
    )
    if (jsonLd) {
      let el = existing as HTMLScriptElement | null
      if (!el) {
        el = document.createElement("script")
        el.setAttribute("type", "application/ld+json")
        el.setAttribute("data-seo-jsonld", JSON_LD_ID)
        document.head.appendChild(el)
      }
      el.textContent = JSON.stringify(jsonLd)
    } else if (existing) {
      existing.remove()
    }
  }, [title, description, path, noindex, jsonLd])
}
