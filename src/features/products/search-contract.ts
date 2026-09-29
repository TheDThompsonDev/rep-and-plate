import { z } from 'zod'
import { productSchema } from './contracts.ts'

export const productSearchRequestSchema = z.object({ query: z.string().trim().min(2).max(160) })
export const productSearchResultSchema = z.object({
  status: z.enum(['candidates', 'not-found', 'unavailable', 'rate-limited', 'invalid']),
  products: z.array(productSchema).max(8),
  message: z.string().max(1000),
  cached: z.boolean().optional(),
})
export type ProductSearchResult = z.infer<typeof productSearchResultSchema>
