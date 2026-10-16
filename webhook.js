// Recebe o aviso do Mercado Pago quando um pagamento muda de status e atualiza a cobrança no Firestore.
// Na Vercel este arquivo precisa ficar em  api/webhook.js
// Variável de ambiente necessária na Vercel: FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço do Firebase).
// O token do Mercado Pago é lido do Firestore (segredos/mp) ou da variável MP_TOKEN.
const admin = require('firebase-admin');

function getDb() {
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  return admin.firestore();
}

module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    const b = req.body || {};
    const tipo = q.type || q.topic || b.type || b.topic || 'payment';
    const id = q['data.id'] || (b.data && b.data.id) || (q.topic === 'payment' ? q.id : null);
    if (!id || !String(tipo).includes('payment')) return res.status(200).json({ ok: true });

    const db = getDb();
    const seg = await db.doc('segredos/mp').get();
    const token = (seg.exists && seg.data().token) || process.env.MP_TOKEN;
    if (!token) return res.status(200).json({ ok: false, error: 'sem token' });

    // Busca o pagamento direto no Mercado Pago com o seu token (não confia no corpo recebido).
    const r = await fetch('https://api.mercadopago.com/v1/payments/' + id, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) return res.status(200).json({ ok: false });
    const p = await r.json();
    if (!p.external_reference) return res.status(200).json({ ok: true });

    const ref = db.doc('cobrancas/' + p.external_reference);
    const snap = await ref.get();
    if (!snap.exists) return res.status(200).json({ ok: true });

    // Em análise no Mercado Pago -> "processando"; se for recusado/cancelado, volta para "pendente".
    if (p.status !== 'approved') {
      const atual = snap.data().status;
      if (p.status === 'in_process' && atual === 'pendente') await ref.update({ status: 'processando' });
      else if (['rejected', 'cancelled'].includes(p.status) && atual === 'processando') await ref.update({ status: 'pendente' });
      return res.status(200).json({ ok: true });
    }

    const taxa = Math.round((p.fee_details || []).filter(f => f.fee_payer === 'collector').reduce((s, f) => s + (f.amount || 0), 0) * 100) / 100;
    const liquido = (p.transaction_details && p.transaction_details.net_received_amount) ?? null;
    const dados = { taxa };
    if (liquido !== null) dados.liquido = liquido;
    const tp = p.transaction_details && p.transaction_details.total_paid_amount;
    if (snap.data().alvo != null && tp > p.transaction_amount) dados.taxaCli = Math.round((tp - p.transaction_amount) * 100) / 100;
    if (snap.data().status !== 'pago') {
      dados.status = 'pago';
      dados.pagoEm = new Date(p.date_approved || Date.now()).getTime();
    }
    await ref.update(dados);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
