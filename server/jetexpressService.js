import fs from 'fs';
import readline from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MONGO_URI = 'mongodb+srv://jeanneumann290_db_user:r7haMA3ehvGxJLXZ@cluster0.yllszn6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
let mongoClient = null;
let mongoCollection = null;
let isMongoReady = false;

// Caminhos possíveis para o CSV de registros finalizados
const CANDIDATE_PATHS = [
  join(__dirname, 'registros_finalizados.csv'),
  join(__dirname, 'REGISTROS-FINALIZADOS-27-08-2026-17-41.csv'),
  join(__dirname, '../../arquivos/REGISTROS-FINALIZADOS-27-08-2026-17-41.csv'),
  join(__dirname, '../arquivos/REGISTROS-FINALIZADOS-27-08-2026-17-41.csv')
];
const ARQUIVOS_DIRS = [
  join(__dirname, '../../arquivos'),
  join(__dirname, '../arquivos'),
  join(__dirname, 'arquivos'),
  __dirname
];

// Índices em memória para fallback / 0ms
const recordsByCodigo = new Map();
const recordsByCpf = new Map();
const recordsByTelefone = new Map();
let loadedCsvPath = '';

/**
 * Utilitário para parsear linha CSV respeitando aspas
 */
function parseCsvLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function cleanDigits(val) {
  if (!val) return '';
  return String(val).replace(/\D/g, '');
}

function normalizarLoja(origem) {
  if (!origem) return 'Ecommerce';
  const str = String(origem).toUpperCase();
  if (str.includes('TEMU')) return 'TEMU';
  if (str.includes('SHEIN')) return 'SHEIN';
  if (str.includes('MELI') || str.includes('MERCADO')) return 'Mercado Livre';
  if (str.includes('SHOPEE')) return 'SHOPEE';
  return 'Ecommerce';
}

/**
 * Conecta ao MongoDB Atlas
 */
export async function initMongo() {
  try {
    mongoClient = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await mongoClient.connect();
    const db = mongoClient.db('oitobet');
    mongoCollection = db.collection('jetexpress');
    isMongoReady = true;
    const totalDocs = await mongoCollection.countDocuments({});
    console.log(`[MongoDB Atlas] ✅ Conectado com sucesso! Total de ${totalDocs} registros disponíveis no Cluster.`);
  } catch (err) {
    isMongoReady = false;
    console.warn(`[MongoDB Atlas] ⚠️ Aviso: ${err.message}. Operando via CSV local.`);
  }
}

/**
 * Carrega e indexa o arquivo CSV em memória
 */
export async function loadRecordsFromCsv(customCsvPath = null) {
  let targetPath = customCsvPath;

  // 1. Tenta buscar no arquivo mais recente dos diretórios de arquivos
  if (!targetPath || !fs.existsSync(targetPath)) {
    for (const dir of ARQUIVOS_DIRS) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir)
          .filter(f => (f.startsWith('REGISTROS-FINALIZADOS-') || f.startsWith('CSV_FINAL_')) && f.endsWith('.csv'))
          .map(f => ({ name: f, path: join(dir, f), time: fs.statSync(join(dir, f)).mtimeMs }))
          .sort((a, b) => b.time - a.time);

        if (files.length > 0) {
          targetPath = files[0].path;
          break;
        }
      }
    }
  }

  // 2. Fallback para os caminhos fixos legados
  if (!targetPath || !fs.existsSync(targetPath)) {
    for (const p of CANDIDATE_PATHS) {
      if (fs.existsSync(p)) {
        targetPath = p;
        break;
      }
    }
  }

  if (!targetPath || !fs.existsSync(targetPath)) {
    console.warn(`[JetExpress Service] ⚠️ Nenhum arquivo de registros finalizados encontrado localmente.`);
    return 0;
  }

  console.log(`[JetExpress Service] 🚀 Carregando cache local do CSV: ${targetPath}...`);

  recordsByCodigo.clear();
  recordsByCpf.clear();
  recordsByTelefone.clear();

  const fileStream = fs.createReadStream(targetPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers = [];
  let lineCount = 0;

  for await (const line of rl) {
    lineCount++;
    if (!line || !line.trim()) continue;

    if (lineCount === 1) {
      headers = parseCsvLine(line);
      continue;
    }

    const values = parseCsvLine(line);
    const row = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = values[i] !== undefined ? values[i] : '';
    }

    const codigo = (row['Número de pedido JMS'] || row['codigo'] || '').trim();
    const docDb = cleanDigits(row['Documento_Encontrado_DB'] || row['CNPJ'] || row['CPF'] || '');
    const telDb = cleanDigits(row['Telefone_Encontrado_DB'] || row['Celular do Destinatário'] || row['telefone'] || '');
    const nome = (row['Destinatário'] || row['Destinatario'] || row['nome'] || '').trim();
    const loja = normalizarLoja(row['Origem do Pedido'] || row['loja'] || '');

    const recordData = {
      ...row,
      codigo,
      documento: docDb,
      telefone: telDb,
      nome,
      loja,
      cidade: (row['Cidade Destino'] || '').trim(),
      uf: (row['UF Destino'] || '').trim(),
      endereco: (row['Complemento'] || '').trim(),
      dataEnvio: (row['Data de criação'] || row['Tempo de entrega'] || '').trim(),
      status: (row['Marca de assinatura'] || 'Em Trânsito').trim()
    };

    if (codigo) {
      recordsByCodigo.set(codigo, recordData);
    }
    if (docDb) {
      if (!recordsByCpf.has(docDb)) recordsByCpf.set(docDb, []);
      recordsByCpf.get(docDb).push(recordData);
    }
    if (telDb) {
      recordsByTelefone.set(telDb, recordData);
    }
  }

  loadedCsvPath = targetPath;
  console.log(`[JetExpress Service] ✅ Cache local pronto: ${recordsByCodigo.size} pedidos JMS indexados.`);
  return recordsByCodigo.size;
}

/**
 * Consulta por Código de Rastreio / Pedido JMS
 */
export async function getByCodigo(codigo) {
  if (!codigo) return null;
  const clean = String(codigo).trim();
  const numClean = Number(clean);

  // 1. Tenta buscar no MongoDB Atlas (String ou Numérico)
  if (isMongoReady && mongoCollection) {
    try {
      const queryOr = [{ _id: clean }, { codigo: clean }, { "Número de pedido JMS": clean }];
      if (!isNaN(numClean)) {
        queryOr.push({ _id: numClean }, { codigo: numClean }, { "Número de pedido JMS": numClean });
      }
      const doc = await mongoCollection.findOne({ $or: queryOr });
      if (doc) return doc;
    } catch (e) {
      console.warn('[MongoDB Atlas] Erro na consulta:', e.message);
    }
  }

  // 2. Fallback imediato em memória
  return recordsByCodigo.get(clean) || null;
}

/**
 * Consulta por CPF / Documento
 */
export async function getByCpf(cpf) {
  if (!cpf) return [];
  const clean = cleanDigits(cpf);
  const numClean = Number(clean);

  // 1. Tenta buscar no MongoDB Atlas (String ou Numérico)
  if (isMongoReady && mongoCollection) {
    try {
      const queryOr = [{ documento: clean }, { Documento_Encontrado_DB: clean }, { CNPJ: clean }];
      if (!isNaN(numClean)) {
        queryOr.push({ documento: numClean }, { Documento_Encontrado_DB: numClean });
      }
      const docs = await mongoCollection.find({ $or: queryOr }).toArray();
      if (docs && docs.length > 0) return docs;
    } catch (e) {
      console.warn('[MongoDB Atlas] Erro na consulta CPF:', e.message);
    }
  }

  // 2. Fallback imediato em memória
  return recordsByCpf.get(clean) || [];
}

/**
 * Consulta por Telefone
 */
export async function getByTelefone(telefone) {
  if (!telefone) return null;
  const clean = cleanDigits(telefone);
  const numClean = Number(clean);

  // 1. Tenta buscar no MongoDB Atlas (String ou Numérico)
  if (isMongoReady && mongoCollection) {
    try {
      const queryOr = [{ telefone: clean }, { Telefone_Encontrado_DB: clean }];
      if (!isNaN(numClean)) {
        queryOr.push({ telefone: numClean }, { Telefone_Encontrado_DB: numClean });
      }
      const doc = await mongoCollection.findOne({ $or: queryOr });
      if (doc) return doc;
    } catch (e) {
      console.warn('[MongoDB Atlas] Erro na consulta Telefone:', e.message);
    }
  }

  // 2. Fallback imediato em memória
  return recordsByTelefone.get(clean) || null;
}

/**
 * Retorna estatísticas da base em memória e MongoDB
 */
export async function getStats() {
  let mongoCount = 0;
  if (isMongoReady && mongoCollection) {
    try {
      mongoCount = await mongoCollection.countDocuments({});
    } catch (_) {}
  }

  return {
    mongoStatus: isMongoReady ? 'ONLINE' : 'OFFLINE',
    mongoTotalDocumentos: mongoCount,
    cacheLocalPedidos: recordsByCodigo.size,
    cacheLocalCpfs: recordsByCpf.size,
    cacheLocalTelefones: recordsByTelefone.size,
    csvOrigem: loadedCsvPath
  };
}

// Inicializações em background
initMongo().catch(() => {});
loadRecordsFromCsv().catch(err => {
  console.error('[JetExpress Service] Erro na inicialização:', err);
});
