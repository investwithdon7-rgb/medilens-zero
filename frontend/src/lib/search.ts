import { create, insert, search as oramaSearch } from '@orama/orama';
import type { Orama, Results, TypedDocument } from '@orama/orama';

// Schema for the in-browser index
const drugSchema = {
  inn:        'string',
  brand_names:'string',
  drug_class: 'string',
  conditions: 'string',
  atc_code:   'string',
  ai_summary: 'string',
} as const;

type DrugDoc = TypedDocument<Orama<typeof drugSchema>>;

let searchDB: Orama<typeof drugSchema> | null = null;

/**
 * Load the Orama search index from Bluehost static file.
 * Falls back to a minimal in-memory index if not yet built.
 */
export async function loadSearchIndex(): Promise<void> {
  if (searchDB) return;

  try {
    // Try to load from Bluehost
    const res = await fetch('/search-index.orama.bin', { cache: 'force-cache' });
    if (res.ok) {
      // When the binary index is available, restore it
      const data = await res.arrayBuffer();
      const { restore } = await import('@orama/plugin-data-persistence');
      searchDB = await restore('binary', new Uint8Array(data));
      return;
    }
  } catch {
    // Fall through to empty index
  }

  // Create empty index (populated when real index is deployed)
  searchDB = await create({ schema: drugSchema });
}

/** Insert a drug into the in-memory index (used during development / seeding). */
export async function indexDrug(drug: Partial<DrugDoc>): Promise<void> {
  if (!searchDB) await loadSearchIndex();
  await insert(searchDB!, {
    inn:        drug.inn        ?? '',
    brand_names: drug.brand_names ?? '',
    drug_class:  drug.drug_class  ?? '',
    conditions:  drug.conditions  ?? '',
    atc_code:    drug.atc_code   ?? '',
    ai_summary:  drug.ai_summary  ?? '',
  });
}

/** Search the in-browser index. Zero Firestore reads. */
export async function searchDrugs(queryText: string): Promise<Results<DrugDoc>> {
  if (!searchDB) await loadSearchIndex();
  return oramaSearch(searchDB!, {
    term:  queryText,
    limit: 10,
    properties: ['inn', 'brand_names', 'drug_class', 'conditions', 'ai_summary'],
  });
}
