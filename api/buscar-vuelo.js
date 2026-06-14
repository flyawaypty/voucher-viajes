export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

  const { texto } = req.body || {};
  if (!texto) { res.status(400).json({ ok: false, error: 'Falta el texto del itinerario' }); return; }

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
        system: 'You are a flight itinerary parser. Extract flight data and return ONLY a valid JSON array, no markdown, no explanation, no backticks.',
        messages: [{
          role: 'user',
          content: `Extract all flights from this itinerary and return ONLY a JSON array like this:
[
  {
    "num": "flight number e.g. CM444",
    "fecha": "DD/MM/YYYY departure date",
    "origen": "IATA code",
    "destino": "IATA code",
    "aorig": "full departure airport name",
    "adest": "full arrival airport name",
    "sh": "HH:MM 24h departure time",
    "lh": "HH:MM 24h arrival time",
    "lf": "DD/MM/YYYY arrival date",
    "al": "operating airline full name",
    "cab": "Economy or Premium or Business or First",
    "duracion_min": flight duration in minutes as integer,
    "avion": "aircraft model e.g. Boeing 737-800"
  }
]

Itinerary:
${texto}

Return ONLY the JSON array. If a field is unknown use empty string or 0 for duracion_min.`
        }]
      })
    });

    const data = await apiRes.json();
    if (!apiRes.ok) throw new Error(data.error?.message || 'API error');

    const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const jsonMatch = txt.replace(/```json|```/g, '').trim().match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No se pudo extraer la información del itinerario');

    const flights = JSON.parse(jsonMatch[0]);
    res.status(200).json({ ok: true, flights });

  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });
  }
}
