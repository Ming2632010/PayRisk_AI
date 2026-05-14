/**
 * Legal / storefront metadata for static pages (Privacy, Terms).
 * Set in `.env` for production (see `.env.example` at project root).
 */
export const SITE_NAME = 'PayRisk AI';

export const LEGAL_CONTACT_EMAIL =
  import.meta.env.VITE_LEGAL_CONTACT_EMAIL ?? 'info@payriskai.com';

/** Shown as “Last updated” on legal pages. Update when you change the documents. */
export const LEGAL_LAST_UPDATED = 'May 15, 2026';

/**
 * Governing law clause in Terms — replace with your company’s jurisdiction after legal review.
 * Example: "New South Wales, Australia" or "State of Delaware, United States".
 */
export const LEGAL_JURISDICTION =
  import.meta.env.VITE_LEGAL_JURISDICTION ?? 'the jurisdiction in which the Service operator is established';
