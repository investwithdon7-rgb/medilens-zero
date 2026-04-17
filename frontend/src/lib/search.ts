import { create, insert, search as oramaSearch } from '@orama/orama';
import type { Orama, Results, TypedDocument } from '@orama/orama';
import { getDrugListForSearch } from './firebase';

// Schema for the in-browser index
const drugSchema = {
  inn:        'string',
  brand_names:'string',
  drug_class: 'string',
  indication: 'string',
  atc_code:   'string',
  ai_summary: 'string',
} as const;

type DrugDoc = TypedDocument<Orama<typeof drugSchema>>;

let searchDB: Orama<typeof drugSchema> | null = null;
let indexBuilding = false;
let indexReady    = false;

/**
 * Build the in-browser Orama index from Firestore drug data.
 * Called once on first search — subsequent calls use the cached index.
 * ~200-400 Firestore reads, runs in ~1-2 seconds.
 */
export async function loadSearchIndex(): Promise<void> {
  if (indexReady || indexBuilding) return;
  indexBuilding = true;

  try {
    searchDB = await create({ schema: drugSchema });
    const drugs = await getDrugListForSearch();

    for (const drug of drugs) {
      await insert(searchDB, {
        inn:         drug.inn        ?? '',
        brand_names: drug.brand_names ?? '',
        drug_class:  drug.drug_class  ?? '',
        indication:  drug.indication  ?? '',
        atc_code:    drug.atc_code   ?? '',
        ai_summary:  drug.ai_summary  ?? '',
      });
    }

    indexReady = true;
    console.info(`[MediLens] Search index built — ${drugs.length} drugs indexed.`);
  } catch (err) {
    console.warn('[MediLens] Search index build failed:', err);
    // Fall back to empty index so UI doesn't crash
    if (!searchDB) searchDB = await create({ schema: drugSchema });
  } finally {
    indexBuilding = false;
  }
}

/** Search the in-browser index. Zero Firestore reads after first load. */
export async function searchDrugs(queryText: string): Promise<Results<DrugDoc>> {
  if (!indexReady && !indexBuilding) {
    await loadSearchIndex();
  }
  // If still building (shouldn't happen — loadSearchIndex awaits), return empty
  if (!searchDB) return { hits: [], elapsed: { raw: 0, formatted: '0ms' }, count: 0 } as any;

  return oramaSearch(searchDB!, {
    term:       queryText,
    limit:      10,
    properties: ['inn', 'brand_names', 'drug_class', 'indication', 'ai_summary'],
  });
}
