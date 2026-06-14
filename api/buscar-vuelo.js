export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

  const { numero, fecha } = req.body || {};
  if (!numero || !fecha) { res.status(400).json({ ok: false, error: 'Faltan datos' }); return; }

  const prompt = `Search the web for flight ${numero} on ${fecha}. Return ONLY raw JSON, no markdown, no backticks, no explanation:
{"origen":"IATA","destino":"IATA","aorig":"airport name","adest":"airport name","sh":"HH:MM","lh":"HH:MM","lf":"DD/MM/YYYY","al":"airline name","cab":"Economy or Business or First"}`;

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await apiRes.json();
    if (!apiRes.ok) throw new Error(data.error?.message || 'Error de API');

    const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const match = txt.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('No se encontró información del vuelo');

    res.status(200).json({ ok: true, data: JSON.parse(match[0]) });
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });
  }
}
