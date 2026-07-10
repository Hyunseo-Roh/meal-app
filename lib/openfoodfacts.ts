/**
 * Open Food Facts product lookup (read-only, keyless). Turns a scanned barcode
 * into a product name/brand/image. Fields are crowdsourced and frequently
 * missing, so mapping is defensive. No Supabase, no writes — this module only
 * fetches from OFF.
 *
 * OFF asks read clients to send a descriptive User-Agent and to cache results.
 * The User-Agent identifies the app but carries no contact address — swap in a
 * real contact address before any public production deploy (see CLAUDE.md).
 */

export type OFFResult =
  | {
      status: 'found';
      barcode: string;
      name: string;
      brand: string | null;
      imageUrl: string | null;
      categoriesEn: string[];
    }
  | { status: 'not_found'; barcode: string }
  | { status: 'error'; barcode: string; message: string };

const FIELDS =
  'product_name,product_name_en,brands,image_front_small_url,image_small_url,categories_tags_en,quantity,generic_name';
const USER_AGENT = 'Sate/1.0 (student capstone project)';
const TIMEOUT_MS = 8000;

// In-memory cache (OFF asks clients to cache; also makes re-scanning the same
// item instant). Cache found + not_found; never cache errors.
const cache = new Map<string, OFFResult>();

export async function lookupProduct(barcode: string): Promise<OFFResult> {
  const cached = cache.get(barcode);
  if (cached) return cached;

  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${FIELDS}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });

    // Not-ok HTTP → error (not cached).
    if (!res.ok) {
      return { status: 'error', barcode, message: 'lookup failed' };
    }

    const json = await res.json();

    // OFF returns { status: 1|0, product }. 0 / missing product → not found.
    if (json?.status !== 1 || !json?.product) {
      const result: OFFResult = { status: 'not_found', barcode };
      cache.set(barcode, result);
      return result;
    }

    const p = json.product;
    const name =
      p.product_name?.trim() || p.product_name_en?.trim() || p.generic_name?.trim() || '';

    // Nothing useful to show → treat as not found.
    if (!name) {
      const result: OFFResult = { status: 'not_found', barcode };
      cache.set(barcode, result);
      return result;
    }

    const brand: string | null = p.brands?.trim() || null;
    const imageUrl: string | null = p.image_front_small_url || p.image_small_url || null;
    const categoriesEn: string[] = Array.isArray(p.categories_tags_en) ? p.categories_tags_en : [];

    const result: OFFResult = { status: 'found', barcode, name, brand, imageUrl, categoriesEn };
    cache.set(barcode, result);
    return result;
  } catch {
    // AbortError (timeout) or network failure — not cached.
    return { status: 'error', barcode, message: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
