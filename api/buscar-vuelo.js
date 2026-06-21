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
        system: `You are a flight itinerary parser specialized in airline reservation systems (GDS like Sabre, Amadeus, Galileo) and standard itinerary formats.

IATA AIRLINE CODES (use these exact names):
AA=American Airlines, AC=Air Canada, AF=Air France, AM=Aeromexico, AR=Aerolineas Argentinas, AV=Avianca, AZ=Alitalia, BA=British Airways, CM=Copa Airlines, DL=Delta Air Lines, EK=Emirates, ET=Ethiopian Airlines, EY=Etihad Airways, FJ=Fiji Airways, G3=Gol, IB=Iberia, JJ=LATAM Brasil, JL=Japan Airlines, KE=Korean Air, KL=KLM, LA=LATAM Airlines, LH=Lufthansa, LO=LOT Polish Airlines, LY=El Al, MH=Malaysia Airlines, NH=ANA, NZ=Air New Zealand, OK=Czech Airlines, OS=Austrian Airlines, OU=Croatia Airlines, OZ=Asiana Airlines, PD=Porter Airlines, PR=Philippine Airlines, QF=Qantas, QR=Qatar Airways, SA=South African Airways, SK=SAS, SQ=Singapore Airlines, SU=Aeroflot, SW=Air Namibia, TG=Thai Airways, TK=Turkish Airlines, TP=TAP Air Portugal, UA=United Airlines, UX=Air Europa, VN=Vietnam Airlines, VS=Virgin Atlantic, WN=Southwest Airlines, WS=WestJet, XL=LATAM Ecuador

GDS FORMAT GUIDE (Sabre/Amadeus):
- Line format: XX NNNC DDMMM D OOOPPP SS HHMM HHMM
- XX = airline code (2 letters), NNN = flight number, C = booking class
- DDMMM = date (22JUN), D = day of week (1=Mon)
- OOO = origin IATA, PPP = destination IATA
- SS = status (HK=confirmed), HHMM = times in 24h format
- Example: CM 278L 22JUN 1 EZEPTY HK2 1449 2010
  = Copa Airlines flight 278, class L, June 22 Monday, EZE→PTY, confirmed 2 pax, departs 14:49, arrives 20:10

Return ONLY a valid JSON array, no markdown, no explanation.`,
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
