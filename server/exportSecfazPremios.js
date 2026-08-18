import fs from 'fs';
import { adminDb } from './firebase-admin.js';

const OUTPUT_FILE = process.env.OUTPUT_FILE || '/Users/mac/Downloads/secfaz_firebase_premios.csv';
const COLLECTION = process.env.COLLECTION || 'secfaz';
const PAGE_SIZE = Number(process.env.PAGE_SIZE || 200);
const PROGRAM_NAME = process.env.PROGRAM_NAME || 'Nota Fiscal Paulista';
const LINK_BASE = process.env.LINK_BASE || 'https://premios.secretariafazenda.com/?cpf=';
const START_AFTER_ID = process.env.START_AFTER_ID || '';
const APPEND = process.env.APPEND === '1';
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS || 60000);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 5);

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function csvCell(value) {
  const text = String(value ?? '');
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWithRetry(query) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await query.get();
    } catch (error) {
      if (error.code !== 8 || attempt === MAX_RETRIES) throw error;
      const delay = RETRY_DELAY_MS * (attempt + 1);
      console.warn(`Quota excedida. Tentando novamente em ${Math.round(delay / 1000)}s...`);
      await sleep(delay);
    }
  }
}

async function exportSecfazPremios() {
  const stream = fs.createWriteStream(OUTPUT_FILE, { encoding: 'utf8', flags: APPEND ? 'a' : 'w' });
  if (!APPEND) stream.write('nome;cpf;telefone;programa;link\n');

  let total = 0;
  let lastDoc = null;

  while (true) {
    let query = adminDb.collection(COLLECTION).orderBy('__name__').limit(PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    else if (START_AFTER_ID) query = query.startAfter(START_AFTER_ID);

    const snapshot = await getWithRetry(query);
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const cpf = onlyDigits(data.cpf || doc.id).padStart(11, '0');
      const telefone = onlyDigits(data.telefone);
      const row = [
        data.nome || '',
        cpf,
        telefone,
        PROGRAM_NAME,
        `${LINK_BASE}${cpf}`,
      ].map(csvCell).join(';');

      stream.write(`${row}\n`);
      total += 1;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    console.log(`Exportados ${total} registros...`);
  }

  await new Promise((resolve, reject) => {
    stream.end(resolve);
    stream.on('error', reject);
  });

  console.log(`Exportacao concluida: ${total} registros em ${OUTPUT_FILE}`);
}

exportSecfazPremios().catch(error => {
  console.error('Erro durante a exportacao:', error);
  process.exit(1);
});
