import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCartwaveRouter } from "./cartwave/routes.js";
import { skaleRouter } from "./skalePay.js";
import { getByCodigo, getByCpf, getByTelefone, getStats as getJetStats, loadRecordsFromCsv, initMongo } from "./jetexpressService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const JET_LOG_FILE = join(__dirname, 'jetexpress.log');

const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialPath || !existsSync(credentialPath)) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS não aponta para uma chave Firebase válida.");
}

try {
  initializeApp({
    credential: cert(JSON.parse(readFileSync(credentialPath, "utf8"))),
  });
} catch (e) {
  console.warn("[Firebase Admin] Inicialização opcional:", e.message);
}

const db = getFirestore();
const app = express();
const port = Number(process.env.PORT || 3000);
const rootDir = resolve(__dirname, "..");

// Buffer de últimos 100 logs de consultas de rastreio/CPF em memória
const recentJetLogs = [];

function logJetQuery(action, key, result, req, durationMs) {
  const ts = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || 'Desconhecido';
  
  const statusStr = result.found ? "✅ ENCONTRADO" : "⚠️ NÃO ENCONTRADO";
  const details = result.found ? `Nome: ${result.data.nome || result.data.Destinatário || 'N/A'} | Loja: ${result.data.loja || result.data['Origem do Pedido'] || 'N/A'} | Pedido: ${result.data.codigo || result.data['Número de pedido JMS'] || 'N/A'}` : 'Nenhum registro correspondente';
  
  const consoleMsg = `[${ts}] 📦 [JetExpress ${action}] ${statusStr} | Chave: ${key} | ${details} | IP: ${ip} (${durationMs}ms)`;
  console.log(consoleMsg);

  const logObj = {
    timestamp: ts,
    action,
    key,
    found: result.found,
    ip,
    userAgent: ua,
    durationMs,
    details: result.found ? {
      nome: result.data.nome || result.data.Destinatário || 'N/A',
      loja: result.data.loja || result.data['Origem do Pedido'] || 'N/A',
      codigo: result.data.codigo || result.data['Número de pedido JMS'] || 'N/A',
      telefone: result.data.telefone || result.data.Telefone_Encontrado_DB || 'N/A',
      cidade: result.data.cidade || result.data['Cidade Destino'] || 'N/A',
      uf: result.data.uf || result.data['UF Destino'] || 'N/A'
    } : null
  };

  recentJetLogs.unshift(logObj);
  if (recentJetLogs.length > 150) recentJetLogs.pop();

  try {
    appendFileSync(JET_LOG_FILE, `[${ts}] [${action}] ${statusStr} | Key: ${key} | IP: ${ip} | ${details}\n`, 'utf-8');
  } catch (_) {}
}

function nowIso() {
  return new Date().toISOString();
}

function maskCpf(value) {
  const cpf = String(value || "").replace(/\D/g, "");
  if (cpf.length !== 11) return cpf ? "***invalid***" : "";
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(-2)}`;
}

function maskEmail(value) {
  const email = String(value || "").trim();
  if (!email || !email.includes("@")) return "";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0] || "*"}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

const isProduction = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use((request, response, next) => {
  const start = Date.now();
  const requestId = randomUUID();
  request.requestId = requestId;

  response.setHeader("X-Request-Id", requestId);

  response.on("finish", () => {
    const durationMs = Date.now() - start;
    if (!request.path.startsWith('/_diag') && !request.path.includes('/logs')) {
      console.log(JSON.stringify({
        level: "info",
        time: nowIso(),
        event: "api.request.finish",
        requestId,
        method: request.method,
        path: request.originalUrl,
        ip: request.headers['x-forwarded-for']?.split(',')[0] || request.socket.remoteAddress,
        userAgent: request.headers["user-agent"],
        statusCode: response.statusCode,
        durationMs,
      }));
    }
  });

  next();
});

// --- ROTAS DO CARTWAVE ---
app.use("/api/cartwave", createCartwaveRouter(db));

// --- ROTAS JETEXPRESS (MONGODB ATLAS + CACHE LOCAL COM LOGS RICOS) ---
app.get("/api/jetexpress/stats", async (_req, res) => {
  const stats = await getJetStats();
  return res.json({ success: true, ...stats });
});

app.get("/api/jetexpress/logs", (_req, res) => {
  return res.json({
    total: recentJetLogs.length,
    logs: recentJetLogs
  });
});

app.post("/api/jetexpress/reload", async (_req, res) => {
  try {
    const total = await loadRecordsFromCsv();
    return res.json({ success: true, message: `Cache recarregado com sucesso! Total: ${total} registros.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Consulta por CPF
app.get("/api/jetexpress/cpf/:cpf", async (req, res) => {
  const t0 = Date.now();
  const cpfRaw = (req.params.cpf || "").replace(/\D/g, "");
  
  try {
    if (!cpfRaw) {
      logJetQuery("CONSULTA_CPF", "CPF_INVALIDO", { found: false }, req, Date.now() - t0);
      return res.status(400).json({ error: "CPF inválido." });
    }

    const records = await getByCpf(cpfRaw);
    if (!records || records.length === 0) {
      logJetQuery("CONSULTA_CPF", cpfRaw, { found: false }, req, Date.now() - t0);
      return res.status(404).json({ error: "Nenhum pedido encontrado para este CPF." });
    }

    // Se houver mais de um pedido, retorna o mais recente
    const sorted = [...records].sort((a, b) => {
      const dateA = new Date(a["Data de criação"] || 0);
      const dateB = new Date(b["Data de criação"] || 0);
      return dateB - dateA;
    });

    const pedido = sorted[0];
    const codigo = pedido.codigo || pedido["Número de pedido JMS"] || pedido._id;
    
    logJetQuery("CONSULTA_CPF", cpfRaw, { found: true, data: pedido }, req, Date.now() - t0);
    return res.json({ success: true, data: { id: codigo, ...pedido } });
  } catch (err) {
    console.error("❌ Erro na rota jetexpress CPF:", err);
    logJetQuery("CONSULTA_CPF_ERRO", cpfRaw, { found: false }, req, Date.now() - t0);
    return res.status(500).json({ error: "Erro interno." });
  }
});

// Consulta por Rastreio / Código JMS
app.get("/api/jetexpress/rastreio/:codigo", async (req, res) => {
  const t0 = Date.now();
  const codigo = (req.params.codigo || "").trim();

  try {
    if (!codigo) {
      logJetQuery("CONSULTA_RASTREIO", "CODIGO_VAZIO", { found: false }, req, Date.now() - t0);
      return res.status(400).json({ error: "Código inválido." });
    }

    const pedido = await getByCodigo(codigo);
    if (!pedido) {
      logJetQuery("CONSULTA_RASTREIO", codigo, { found: false }, req, Date.now() - t0);
      return res.status(404).json({ error: "Pedido não encontrado com este código de rastreio." });
    }

    const cod = pedido.codigo || pedido["Número de pedido JMS"] || pedido._id;
    logJetQuery("CONSULTA_RASTREIO", codigo, { found: true, data: pedido }, req, Date.now() - t0);
    return res.json({ success: true, data: { id: cod, ...pedido } });
  } catch (err) {
    console.error("❌ Erro na rota jetexpress Rastreio:", err);
    logJetQuery("CONSULTA_RASTREIO_ERRO", codigo, { found: false }, req, Date.now() - t0);
    return res.status(500).json({ error: "Erro interno." });
  }
});

app.get("/api/jetexpress/:codigo", async (req, res) => {
  const t0 = Date.now();
  const codigo = (req.params.codigo || "").trim();

  try {
    if (!codigo) {
      logJetQuery("CONSULTA_CODIGO", "CODIGO_VAZIO", { found: false }, req, Date.now() - t0);
      return res.status(400).json({ error: "Código inválido." });
    }

    const pedido = await getByCodigo(codigo);
    if (!pedido) {
      logJetQuery("CONSULTA_CODIGO", codigo, { found: false }, req, Date.now() - t0);
      return res.status(404).json({ error: "Pedido não encontrado para o código informado." });
    }

    const cod = pedido.codigo || pedido["Número de pedido JMS"] || pedido._id;
    logJetQuery("CONSULTA_CODIGO", codigo, { found: true, data: pedido }, req, Date.now() - t0);
    return res.json({ success: true, data: { id: cod, ...pedido } });
  } catch (err) {
    console.error("❌ Erro na rota jetexpress Código:", err);
    logJetQuery("CONSULTA_CODIGO_ERRO", codigo, { found: false }, req, Date.now() - t0);
    return res.status(500).json({ error: "Erro interno." });
  }
});

// Consulta por Telefone
app.get("/api/jetexpress/telefone/:tel", async (req, res) => {
  const t0 = Date.now();
  const tel = (req.params.tel || "").replace(/\D/g, "");

  try {
    if (!tel) {
      logJetQuery("CONSULTA_TELEFONE", "TEL_VAZIO", { found: false }, req, Date.now() - t0);
      return res.status(400).json({ error: "Telefone inválido." });
    }

    const pedido = await getByTelefone(tel);
    if (!pedido) {
      logJetQuery("CONSULTA_TELEFONE", tel, { found: false }, req, Date.now() - t0);
      return res.status(404).json({ error: "Nenhum pedido encontrado para este telefone." });
    }

    const cod = pedido.codigo || pedido["Número de pedido JMS"] || pedido._id;
    logJetQuery("CONSULTA_TELEFONE", tel, { found: true, data: pedido }, req, Date.now() - t0);
    return res.json({ success: true, data: { id: cod, ...pedido } });
  } catch (err) {
    console.error("❌ Erro na rota jetexpress Telefone:", err);
    logJetQuery("CONSULTA_TELEFONE_ERRO", tel, { found: false }, req, Date.now() - t0);
    return res.status(500).json({ error: "Erro interno." });
  }
});
// ------------------------

app.use("/api/skalepay", skaleRouter);

app.use(express.static(resolve(rootDir, "dist"), { maxAge: "1h" }));
app.use((_request, response) => response.sendFile(resolve(rootDir, "dist", "index.html")));

app.listen(port, "127.0.0.1", () => {
  console.log(`Fireboard ativo na porta ${port}`);
});
