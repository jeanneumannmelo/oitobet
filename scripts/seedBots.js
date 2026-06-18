#!/usr/bin/env node
// Seed 500 Brazilian bot users into Firestore `bots` collection.
// Usage:
//   1. Set env var GOOGLE_APPLICATION_CREDENTIALS to your service-account JSON path, OR
//   2. Pass path as first arg: node scripts/seedBots.js /path/to/serviceAccount.json
//
// Install deps first:
//   npm install firebase-admin --save-dev  (in project root or scripts dir)

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, WriteBatch } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Load service account ──────────────────────────────────────────────────────
const saPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!saPath) {
  console.error('❌  Provide service account path:\n   node scripts/seedBots.js /path/to/sa.json');
  process.exit(1);
}
const sa = JSON.parse(readFileSync(resolve(saPath), 'utf-8'));
if (!getApps().length) initializeApp({ credential: cert(sa) });
const db = getFirestore();

// ── Brazilian name pools ───────────────────────────────────────────────────────
const FIRST = [
  'Lucas','Gabriel','Matheus','Pedro','João','Rafael','Guilherme','Felipe',
  'Eduardo','André','Rodrigo','Diego','Thiago','Bruno','Leonardo','Victor',
  'Carlos','Daniel','Alexandre','Leandro','Fernanda','Amanda','Camila','Mariana',
  'Juliana','Beatriz','Letícia','Gabriela','Ana','Larissa','Patricia','Viviane',
  'Renata','Vanessa','Natalia','Bianca','Aline','Priscila','Luana','Sabrina',
  'Arthur','Henrique','Igor','Samuel','Luis','Marcelo','André','Claudio',
  'Fábio','Davi','Enzo','Lorenzo','Cauã','Kaique','Vinícius','Théo',
  'Giovanna','Sofia','Isabella','Alice','Laura','Luiza','Valentina','Helena',
];
const LAST = [
  'Silva','Santos','Oliveira','Souza','Lima','Pereira','Costa','Ferreira',
  'Rodrigues','Almeida','Nascimento','Carvalho','Araújo','Ribeiro','Martins',
  'Gomes','Barbosa','Rocha','Cardoso','Correia','Mendes','Nunes','Castro',
  'Cunha','Teixeira','Moreira','Pinto','Cavalcante','Dias','Borges',
  'Freitas','Monteiro','Lopes','Ramos','Leal','Ramos','Machado','Assis',
  'Moura','Nogueira','Cruz','Azevedo','Guimarães','Faria','Braga','Pires',
];
const CITIES = [
  'São Paulo','Rio de Janeiro','Belo Horizonte','Salvador','Fortaleza',
  'Curitiba','Manaus','Recife','Porto Alegre','Belém','Goiânia','Guarulhos',
  'Campinas','São Luís','Maceió','Natal','Teresina','Campo Grande','João Pessoa',
  'Ribeirão Preto','Aracaju','Cuiabá','Macapá','Porto Velho','Boa Vista','Palmas',
];

function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(lo, hi) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }

// ── Generate 500 bots ─────────────────────────────────────────────────────────
function makeBots(count) {
  const bots = [];
  for (let i = 0; i < count; i++) {
    const wins   = rndInt(10, 600);
    const losses = rndInt(5,  400);
    const diff   = rnd([1, 1, 2, 2, 3]); // weighted toward easier
    bots.push({
      name:       `${rnd(FIRST)} ${rnd(LAST)}`,
      location:   rnd(CITIES),
      flag:       '🇧🇷',
      wins,
      losses,
      level:      Math.min(10, Math.ceil(wins / 50)),
      xp:         wins * 15 + losses * 5,
      difficulty: diff,
      avatar:     rndInt(0, 15),
      createdAt:  Timestamp.now(),
    });
  }
  return bots;
}

// ── Batch write ───────────────────────────────────────────────────────────────
async function seed(count = 500) {
  console.log(`⏳  Seeding ${count} bots…`);
  const bots = makeBots(count);
  const botsRef = db.collection('bots');

  // Firestore batch limit = 500 ops
  let batch = db.batch();
  let ops = 0;
  let total = 0;

  for (const bot of bots) {
    batch.set(botsRef.doc(), bot);
    ops++;
    if (ops === 499) {
      await batch.commit();
      total += ops;
      console.log(`   ✔ Committed ${total} bots`);
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) {
    await batch.commit();
    total += ops;
    console.log(`   ✔ Committed ${total} bots`);
  }
  console.log(`✅  Done! ${total} bots seeded to Firestore collection "bots".`);
}

seed(500).catch(e => { console.error('❌', e); process.exit(1); });
