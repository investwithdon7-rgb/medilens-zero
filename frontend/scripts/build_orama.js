import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { create, insertMultiple } from '@orama/orama';
import { persistToFile } from '@orama/plugin-data-persistence/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const MANIFEST_PATH = path.join(DATA_DIR, 'search_index_manifest.json');
const OUTPUT_PATH = path.join(DATA_DIR, 'search-index.orama.bin');

const drugSchema = {
  inn: 'string',
  brand_names: 'string',
  drug_class: 'string',
  conditions: 'string',
  atc_code: 'string',
  ai_summary: 'string',
};

async function buildIndex() {
  console.log('Reading search_index_manifest.json...');
  try {
    const rawData = await fs.readFile(MANIFEST_PATH, 'utf-8');
    const drugs = JSON.parse(rawData);

    console.log(`Creating Orama index for ${drugs.length} drugs...`);
    const db = await create({ schema: drugSchema });

    const formattedDrugs = drugs.map((d) => ({
      inn: d.inn || '',
      brand_names: Array.isArray(d.brand_names) ? d.brand_names.join(', ') : (d.brand_names || ''),
      drug_class: d.therapeutic_class || '',
      conditions: '', // Not strictly extracted in python yet, fallback to empty
      atc_code: Array.isArray(d.atc) ? d.atc.join(', ') : (d.atc || ''),
      ai_summary: d.ai_summary || '',
    }));

    await insertMultiple(db, formattedDrugs);
    
    console.log(`Persisting binary index to ${OUTPUT_PATH}...`);
    // Pass format: 'binary' directly to persistToFile
    await persistToFile(db, 'binary', OUTPUT_PATH);
    console.log('Orama binary index creation complete!');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn('search_index_manifest.json not found. Run python data extractor first.');
    } else {
      console.error('Error building Orama index:', error);
      process.exit(1);
    }
  }
}

buildIndex();
