export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

  const { numero, fecha } = req.body || {};
  if (!numero || !fecha) { res.status(400).json({ ok: false, error: 'Faltan datos' }); return; }

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
        max_tokens: 400,
        system: 'You are a flight data extractor. After searching, you MUST respond with ONLY a valid JSON object and nothing else. No markdown, no explanation, no backticks.',
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Search for flight ${numero} and return ONLY this JSON (no other text):
{"origen":"IATA","destino":"IATA","aorig":"airport name","adest":"airport name","sh":"HH:MM","lh":"HH:MM","lf":"${fecha}","al":"airline name","cab":"Economy","duracion_min":MINUTES_AS_NUMBER}`
        }]
      })
    });

    const data = await apiRes.json();
    if (!apiRes.ok) throw new Error(data.error?.message || 'API error');

    const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const jsonMatch = txt.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No se encontró información del vuelo');

    res.status(200).json({ ok: true, data: JSON.parse(jsonMatch[0]) });

  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });
  }
}
