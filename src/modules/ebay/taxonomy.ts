import { z } from 'zod';
import type { EbayHttpClient } from './httpClient';

const defaultCategoryTreeIdResponseSchema = z.object({
  categoryTreeId: z.string().min(1),
  categoryTreeVersion: z.string().optional(),
});

const categoryNodeSchema = z.object({
  categoryId: z.string().min(1),
  categoryName: z.string().min(1),
});

const categorySuggestionSchema = z.object({
  category: categoryNodeSchema,
  categoryTreeNodeAncestors: z
    .array(
      z.object({
        categoryId: z.string(),
        categoryName: z.string(),
        categoryTreeNodeLevel: z.number().optional(),
      })
    )
    .optional(),
  relevancy: z.string().optional(),
});

const categorySuggestionsResponseSchema = z.object({
  categorySuggestions: z.array(categorySuggestionSchema).optional(),
});

const aspectSchema = z.object({
  localizedAspectName: z.string().min(1),
  aspectConstraint: z
    .object({
      aspectDataType: z.string().optional(),
      aspectRequired: z.boolean().optional(),
      aspectUsage: z.string().optional(),
      itemToAspectCardinality: z.string().optional(),
    })
    .optional(),
  aspectValues: z
    .array(
      z.object({
        localizedValue: z.string(),
      })
    )
    .optional(),
});

const itemAspectsResponseSchema = z.object({
  aspects: z.array(aspectSchema).optional(),
});

export interface CategorySuggestion {
  readonly categoryId: string;
  readonly categoryName: string;
  /** Ancestor path from root to just above this category (root-first). */
  readonly ancestorPath: readonly { readonly categoryId: string; readonly categoryName: string }[];
  /** eBay's opaque relevancy hint. `null` when not present. */
  readonly relevancy: string | null;
}

export interface CategoryAspect {
  readonly name: string;
  readonly required: boolean;
  /** Empty array when the aspect accepts free-form values. */
  readonly allowedValues: readonly string[];
  /** e.g. `SINGLE` / `MULTIPLE` — relevant for multi-value aspects like Compatible Brand. */
  readonly cardinality: string | null;
}

export interface TaxonomyClient {
  getDefaultCategoryTreeId(marketplaceId: string): Promise<string>;
  getCategorySuggestions(treeId: string, query: string): Promise<CategorySuggestion[]>;
  getItemAspectsForCategory(treeId: string, categoryId: string): Promise<CategoryAspect[]>;
}

/**
 * Thin Zod-validated wrapper over `/commerce/taxonomy/v1`. Does not cache —
 * the `setup:resolve-categories` CLI persists results to
 * `config-files/ebay-category-ids.json` explicitly, and the compliance gate
 * reads aspects from the Taxonomy API once per listing create.
 */
export function createTaxonomyClient(http: EbayHttpClient): TaxonomyClient {
  return {
    async getDefaultCategoryTreeId(marketplaceId) {
      const response = await http.get(
        '/commerce/taxonomy/v1/get_default_category_tree_id',
        defaultCategoryTreeIdResponseSchema,
        { query: { marketplace_id: marketplaceId } }
      );
      return response.categoryTreeId;
    },

    async getCategorySuggestions(treeId, query) {
      const response = await http.get(
        `/commerce/taxonomy/v1/category_tree/${encodeURIComponent(treeId)}/get_category_suggestions`,
        categorySuggestionsResponseSchema,
        { query: { q: query } }
      );
      return (response.categorySuggestions ?? []).map((s) => ({
        categoryId: s.category.categoryId,
        categoryName: s.category.categoryName,
        ancestorPath: (s.categoryTreeNodeAncestors ?? []).map((a) => ({
          categoryId: a.categoryId,
          categoryName: a.categoryName,
        })),
        relevancy: s.relevancy ?? null,
      }));
    },

    async getItemAspectsForCategory(treeId, categoryId) {
      const response = await http.get(
        `/commerce/taxonomy/v1/category_tree/${encodeURIComponent(treeId)}/get_item_aspects_for_category`,
        itemAspectsResponseSchema,
        { query: { category_id: categoryId } }
      );
      return (response.aspects ?? []).map((a) => ({
        name: a.localizedAspectName,
        required: a.aspectConstraint?.aspectRequired ?? false,
        allowedValues: (a.aspectValues ?? []).map((v) => v.localizedValue),
        cardinality: a.aspectConstraint?.itemToAspectCardinality ?? null,
      }));
    },
  };
}
