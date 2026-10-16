// Servidor intermediário. Quem chama precisa estar logado e liberado (as regras do Firestore decidem).
// O token do Mercado Pago é lido do Firestore (salvo pelo dono no painel) usando o login de quem chamou.
const PROJECT = 'excellentspay';
const PERMITIDOS = ['/checkout/preferences', '/v1/payments/search', '/users/me'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const idToken = (req.headers.authorization || '').replace('Bearer ', '');
  if (!idToken) return res.status(401).json({ error: 'Faça login novamente.' });

  const fs = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/segredos/mp`,
    { headers: { Authorization: 'Bearer ' + idToken } });
  if (fs.status === 401 || fs.status === 403) return res.status(403).json({ error: 'Sem permissão para usar o painel.' });
  let token = process.env.MP_TOKEN;
  if (fs.ok) token = ((await fs.json()).fields?.token?.stringValue) || token;
  if (!token) return res.status(400).json({ error: 'Cadastre o Access Token do Mercado Pago em Configurações.' });

  const { path, method = 'GET', body } = req.body || {};
  if (!path || !PERMITIDOS.some(p => path.startsWith(p))) return res.status(400).json({ error: 'Caminho não permitido.' });
  const r = await fetch('https://api.mercadopago.com' + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  res.status(r.status).json(await r.json());
};
