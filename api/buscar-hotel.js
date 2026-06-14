export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

  const { query, action, place_id } = req.body || {};
  const KEY = process.env.GOOGLE_PLACES_KEY;

  try {
    // Action: autocomplete — returns list of suggestions
    if (action === 'autocomplete') {
      if (!query) return res.status(400).json({ ok: false, error: 'Falta query' });
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=lodging&key=${KEY}&language=es`;
      const r = await fetch(url);
      const data = await r.json();
      const predictions = (data.predictions || []).map(p => ({
        place_id: p.place_id,
        name: p.structured_formatting?.main_text || p.description,
        address: p.structured_formatting?.secondary_text || ''
      }));
      return res.status(200).json({ ok: true, predictions });
    }

    // Action: details — returns full info + photo
    if (action === 'details') {
      if (!place_id) return res.status(400).json({ ok: false, error: 'Falta place_id' });
      const fields = 'name,formatted_address,formatted_phone_number,photos,rating,website';
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=${fields}&key=${KEY}&language=es`;
      const r = await fetch(url);
      const data = await r.json();
      const p = data.result || {};

      // Get first photo URL if available
      let photoUrl = '';
      if (p.photos && p.photos.length > 0) {
        const ref = p.photos[0].photo_reference;
        photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${ref}&key=${KEY}`;
      }

      return res.status(200).json({
        ok: true,
        hotel: {
          name: p.name || '',
          address: p.formatted_address || '',
          phone: p.formatted_phone_number || '',
          rating: p.rating || null,
          photoUrl
        }
      });
    }

    res.status(400).json({ ok: false, error: 'Acción no válida' });
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });
  }
}
