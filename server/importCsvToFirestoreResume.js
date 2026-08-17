import fs from 'fs';
import readline from 'readline';
import { adminDb } from './firebase-admin.js';

const CSV_FILE_PATH = '/Users/mac/Downloads/baseitapevaEMCSV.csv';
const BATCH_SIZE = 400;
const START_AFTER = Number(process.env.START_AFTER || 0);

async function importCsvToFirestore() {
  console.log(`Iniciando importacao resumida do CSV a partir do registro ${START_AFTER + 1}...`);

  if (!fs.existsSync(CSV_FILE_PATH)) {
    throw new Error(`Arquivo nao encontrado em: ${CSV_FILE_PATH}`);
  }

  const fileStream = fs.createReadStream(CSV_FILE_PATH, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineCount = 0;
  let dataCount = 0;
  let successCount = 0;
  let batch = adminDb.batch();
  let inBatchCount = 0;

  async function commitBatch() {
    if (!inBatchCount) return;
    await batch.commit();
    successCount += inBatchCount;
    console.log(`Lote gravado: ${inBatchCount}. Novos nesta execucao: ${successCount}. Registro CSV atual: ${dataCount}.`);
    batch = adminDb.batch();
    inBatchCount = 0;
  }

  for await (const line of rl) {
    lineCount += 1;
    if (lineCount === 1 || !line?.trim()) continue;

    dataCount += 1;
    if (dataCount <= START_AFTER) continue;

    const cols = line.split(';').map(c => c.trim());
    const cleanCpf = String(cols[0] || '').replace(/\D/g, '').padStart(11, '0');
    if (cleanCpf.length !== 11) continue;

    const endereco = {
      logradouro: `${cols[28] || ''} ${cols[29] || ''}`.trim(),
      numero: cols[30] || '',
      complemento: cols[31] || '',
      bairro: cols[32] || '',
      cidade: cols[33] || '',
      uf: cols[34] || '',
      cep: cols[35] || '',
    };

    batch.set(adminDb.collection('secfaz').doc(cleanCpf), {
      cpf: cleanCpf,
      nome: cols[1] || '',
      dtNasc: cols[2] || '',
      nomeMae: cols[3] || '',
      telefone: cols[4] || '',
      email: cols[36] || '',
      endereco,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    inBatchCount += 1;
    if (inBatchCount >= BATCH_SIZE) await commitBatch();
  }

  await commitBatch();
  console.log(`Importacao resumida concluida. Novos gravados nesta execucao: ${successCount}. Total de registros CSV vistos: ${dataCount}.`);
}

importCsvToFirestore().catch(error => {
  console.error('Erro durante a importacao resumida:', error);
  process.exit(1);
});
