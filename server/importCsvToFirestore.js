import fs from 'fs';
import readline from 'readline';
import { adminDb } from './firebase-admin.js';

const CSV_FILE_PATH = '/Users/mac/Downloads/baseitapevaEMCSV.csv';
const BATCH_SIZE = 500;

async function importCsvToFirestore() {
  console.log('🚀 Iniciando leitura e importação do CSV...');

  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`❌ Arquivo não encontrado em: ${CSV_FILE_PATH}`);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(CSV_FILE_PATH, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let successCount = 0;
  let batch = adminDb.batch();
  let inBatchCount = 0;
  let headers = [];

  for await (const line of rl) {
    lineCount++;
    if (!line || !line.trim()) continue;

    // A primeira linha contém os cabeçalhos
    if (lineCount === 1) {
      headers = line.split(';').map(h => h.trim());
      continue;
    }

    const cols = line.split(';').map(c => c.trim());
    const docRaw = cols[0]; // Doc (CPF)

    if (!docRaw) continue;

    // Formata o CPF preenchendo com zeros à esquerda até ter 11 dígitos
    const cleanCpf = docRaw.replace(/\D/g, '').padStart(11, '0');
    if (cleanCpf.length !== 11) continue;

    const nome = cols[1] || '';
    const dtNasc = cols[2] || '';
    const nomeMae = cols[3] || '';
    const celular1 = cols[4] || '';
    const email = cols[36] || '';
    const endereco = {
      logradouro: `${cols[28] || ''} ${cols[29] || ''}`.trim(),
      numero: cols[30] || '',
      complemento: cols[31] || '',
      bairro: cols[32] || '',
      cidade: cols[33] || 'ITAPEVA',
      uf: cols[34] || 'SP',
      cep: cols[35] || ''
    };

    const docRef = adminDb.collection('secfaz').doc(cleanCpf);

    batch.set(docRef, {
      cpf: cleanCpf,
      nome,
      dtNasc,
      nomeMae,
      telefone: celular1,
      email,
      endereco,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    inBatchCount++;
    successCount++;

    if (inBatchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`✅ Lote de ${inBatchCount} registros gravado no Firestore (Total processado: ${successCount})...`);
      batch = adminDb.batch();
      inBatchCount = 0;
    }
  }

  if (inBatchCount > 0) {
    await batch.commit();
    console.log(`✅ Lote final de ${inBatchCount} registros gravado no Firestore.`);
  }

  console.log(`🎉 Importação concluída com sucesso! Total de ${successCount} registros importados na collection 'secfaz'.`);
  process.exit(0);
}

importCsvToFirestore().catch(err => {
  console.error('❌ Erro durante a importação:', err);
  process.exit(1);
});
