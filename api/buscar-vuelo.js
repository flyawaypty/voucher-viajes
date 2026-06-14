export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

  const { numero, fecha } = req.body || {};
  if (!numero || !fecha) { res.status(400).json({ ok: false, error: 'Faltan datos' }); return; }

  try {
    // Paso 1: buscar con web search
    const searchRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Search for flight ${numero} schedule: departure airport, arrival airport, departure time, arrival time.`
        }]
      })
    });

    const searchData = await searchRes.json();
    if (!searchRes.ok) throw new Error(searchData.error?.message || 'Search error');

    const searchText = (searchData.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    // Paso 2: extraer JSON sin web search
    const parseRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Based on this flight information:\n\n${searchText}\n\nExtract data for flight ${numero} and return ONLY this JSON, no other text:\n{"origen":"IATA","destino":"IATA","aorig":"airport name","adest":"airport name","sh":"HH:MM","lh":"HH:MM","lf":"${fecha}","al":"airline name","cab":"Economy"}\n\nReturn ONLY the JSON.`
        }]
      })
    });

    const parseData = await parseRes.json();
    if (!parseRes.ok) throw new Error(parseData.error?.message || 'Parse error');

    const parseText = (parseData.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const jsonMatch = parseText.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No se pudo estructurar la información');

    res.status(200).json({ ok: true, data: JSON.parse(jsonMatch[0]) });

  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });
  }
}
