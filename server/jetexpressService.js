import fs from 'fs';
import readline from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Caminhos possíveis para o CSV de registros finalizados
const CANDIDATE_PATHS = [
  join(__dirname, 'REGISTROS-FINALIZADOS-27-08-2026-17-41.csv'),
  join(__dirname, 'registros_finalizados.csv'),
  join(__dirname, '../../arquivos/REGISTROS-FINALIZADOS-27-08-2026-17-41.csv'),
  join(__dirname, '../arquivos/REGISTROS-FINALIZADOS-27-08-2026-17-41.csv')
];
const ARQUIVOS_DIRS = [
  join(__dirname, '../../arquivos'),
  join(__dirname, '../arquivos'),
  join(__dirname, 'arquivos'),
  __dirname
];

// Índices em memória para consultas ultra-rápidas (0ms)
const recordsByCodigo = new Map();
const recordsByCpf = new Map();
const recordsByTelefone = new Map();
let allRecordsList = [];
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

/**
 * Normaliza strings e remove caracteres especiais
 */
function cleanDigits(val) {
  if (!val) return '';
  return String(val).replace(/\D/g, '');
}

/**
 * Normaliza o nome da loja conforme as regras de negócio
 */
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
 * Carrega e indexa o arquivo CSV em memória
 */
export async function loadRecordsFromCsv(customCsvPath = null) {
  let targetPath = customCsvPath;

  if (!targetPath || !fs.existsSync(targetPath)) {
    for (const p of CANDIDATE_PATHS) {
      if (fs.existsSync(p)) {
        targetPath = p;
        break;
      }
    }

    if (!targetPath) {
      for (const dir of ARQUIVOS_DIRS) {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir)
            .filter(f => f.startsWith('REGISTROS-FINALIZADOS-') && f.endsWith('.csv'))
            .map(f => ({ name: f, path: join(dir, f), time: fs.statSync(join(dir, f)).mtimeMs }))
            .sort((a, b) => b.time - a.time);

          if (files.length > 0) {
            targetPath = files[0].path;
            break;
          }
        }
      }
    }
  }

  if (!targetPath || !fs.existsSync(targetPath)) {
    console.warn(`[JetExpress Service] ⚠️ Nenhum arquivo de registros finalizados encontrado.`);
    return 0;
  }

  console.log(`[JetExpress Service] 🚀 Carregando registros diretamente do CSV: ${targetPath}...`);

  recordsByCodigo.clear();
  recordsByCpf.clear();
  recordsByTelefone.clear();
  allRecordsList = [];

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

    allRecordsList.push(recordData);

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
  console.log(`[JetExpress Service] ✅ Sucesso! ${recordsByCodigo.size} pedidos JMS indexados em memória para consulta direta.`);
  return recordsByCodigo.size;
}

/**
 * Consulta por Código de Rastreio / Pedido JMS
 */
export function getByCodigo(codigo) {
  if (!codigo) return null;
  const clean = String(codigo).trim();
  return recordsByCodigo.get(clean) || null;
}

/**
 * Consulta por CPF / Documento
 */
export function getByCpf(cpf) {
  if (!cpf) return [];
  const clean = cleanDigits(cpf);
  return recordsByCpf.get(clean) || [];
}

/**
 * Consulta por Telefone
 */
export function getByTelefone(telefone) {
  if (!telefone) return null;
  const clean = cleanDigits(telefone);
  return recordsByTelefone.get(clean) || null;
}

/**
 * Retorna estatísticas da base em memória
 */
export function getStats() {
  return {
    totalPedidos: recordsByCodigo.size,
    totalCpfs: recordsByCpf.size,
    totalTelefones: recordsByTelefone.size,
    csvOrigem: loadedCsvPath
  };
}

// Inicializa automaticamente o carregamento do CSV ao importar
loadRecordsFromCsv().catch(err => {
  console.error('[JetExpress Service] Erro na inicialização:', err);
});
