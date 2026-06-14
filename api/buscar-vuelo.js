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
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [
          {
            role: 'user',
            content: `Search the web for the schedule of flight ${numero} on ${fecha}. Find departure airport, arrival airport, departure time, and arrival time. Then respond with ONLY this JSON and nothing else:
{"origen":"3-letter IATA code","destino":"3-letter IATA code","aorig":"Full airport name","adest":"Full airport name","sh":"HH:MM departure local","lh":"HH:MM arrival local","lf":"${fecha}","al":"Airline name","cab":"Economy"}`
          }
        ]
      })
    });

    const data = await apiRes.json();
    if (!apiRes.ok) throw new Error(data.error?.message || 'API error: ' + JSON.stringify(data));

    const allText = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    const jsonMatch = allText.match(/\{[^{}]*"origen"[^{}]*\}/s) || 
                      allText.match(/\{[\s\S]*?\}/);
    
    if (!jsonMatch) {
      return res.status(200).json({ 
        ok: false, 
        error: 'No JSON encontrado. Respuesta: ' + allText.substring(0, 300)
      });
    }

    const info = JSON.parse(jsonMatch[0]);
    res.status(200).json({ ok: true, data: info });

  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });
  }
}
