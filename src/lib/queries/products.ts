/**
 * @deprecated Esta archivo re-exporta desde products-neon.ts para
 * mantener compatibilidad con imports existentes.
 *
 * Tras la migración a Neon, importar directamente de:
 *   import { ... } from '@/lib/queries/products-neon'
 */

export {
  type ProductListItem,
  type ProductDetail,
  type ProductFilters,
  type FlashCodeInfo,
  DEFAULT_FILTERS,
  parseFiltersFromSearchParams,
  listProducts,
  getProductBySlug,
  getValidFlashCode,
  getUnlockedProductIds,
  looksLikeFlashCode,
  applyFlashDiscount,
  listAllProductsForAdmin,
  getProductByIdForAdmin,
  getProductBySlugAdmin,
} from './products-neon'
