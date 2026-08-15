import fetch from 'node-fetch';

const MEDUSA_API_KEY = process.env.MEDUSA_API_KEY || 'mk_live_2e801f9c6522ca0554d55a5c4320334b60705886c3f5d6aa';
const MEDUSA_BASE_URL = process.env.MEDUSA_BASE_URL || 'https://api.medusapayments.online/api/v1/api';

/**
 * Cria uma cobrança PIX via gateway MedusaPay seguindo o endpoint oficial de produção:
 * POST https://api.medusapayments.online/api/v1/api/pagamentos
 */
export async function createMedusaPixCharge({ amount, cpf, name, email, phone, product, externalId }) {
  const cleanCpf = String(cpf || '').replace(/\D/g, '').padStart(11, '0');
  const cleanPhone = String(phone || '').replace(/\D/g, '') || '11987654321';
  const cleanEmail = email || `cliente_${cleanCpf}@contribuinte.gov.br`;

  const payload = {
    clienteNome: name || 'Contribuinte SEFAZ',
    clienteEmail: cleanEmail,
    clienteCpf: cleanCpf,
    clienteTelefone: cleanPhone,
    produto: product || 'Taxa de Renegociação Fiscal',
    valor: String(Number(amount || 58.72).toFixed(2)),
    metodo: 'PIX'
  };

  console.log('[MedusaPay Client] Enviando cobrança real para MedusaPay (medusapayments.online):', payload);

  const response = await fetch(`${MEDUSA_BASE_URL}/pagamentos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MEDUSA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = { text }; }

  if (response.ok) {
    // O gateway MedusaPay retorna status 201 com o payload real do PIX
    const copiaECola = data.pixCopiaECola || data.dadosPagamento?.copiaECola || data.venda?.dadosPix?.copiaECola || '';
    let qrDataUrl = data.pixQrCode || data.dadosPagamento?.qrCode || '';

    if (copiaECola && (!qrDataUrl || !qrDataUrl.startsWith('data:image'))) {
      qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(copiaECola)}`;
    }

    if (copiaECola) {
      console.log('[MedusaPay Client] PIX real gerado com sucesso! Venda ID:', data.venda?.id);
      return {
        id: data.venda?.id || externalId,
        copiaECola,
        qrDataUrl,
        raw: data
      };
    }
  }

  console.error('[MedusaPay Error Response]:', response.status, data);
  throw new Error(data.message || data.error || `Erro MedusaPay (${response.status})`);
}
