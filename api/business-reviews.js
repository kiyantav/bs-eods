export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  console.log('📣 /api/business-reviews invoked', req.method, req.query);

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const placesApiKey = process.env.GOOGLE_PLACES_API_KEY;
    
    if (!placesApiKey) return res.status(500).json({ error: 'Missing GOOGLE_PLACES_API_KEY' });
   

      const raw = req.query.placeId || req.query.locationId;
    if (!raw) return res.status(400).json({ error: 'Missing placeId or locationId' });

    // decode any percent-encoding and validate
    const placeId = decodeURIComponent(raw);
    if (!/^ChI/.test(placeId)) {
      return res.status(400).json({
        error: 'Invalid Place ID',
        detail: 'Place IDs from Google Places typically start with "ChI...". Use the Place ID Finder to get the correct id.'
      });
    }
 if (!placeId) return res.status(400).json({ error: 'Missing placeId or locationId' });
    // Use Google Places API - much simpler and has free quota
    const placesUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,rating,user_ratings_total,reviews&key=${encodeURIComponent(placesApiKey)}`;
    
    console.log('Calling Places API for place:', placeId);
    
    const response = await fetch(placesUrl);
    const data = await response.json();
    
    console.log('Places API response:', response.status, data.status);

    if (!response.ok || data.status !== 'OK') {
      return res.status(response.status || 502).json({ 
        error: 'Places API error', 
        detail: data 
      });
    }

    const place = data.result || {};
    const reviews = place.reviews || [];
    
    // Count 5-star reviews from the sample (Places API returns up to 5 recent reviews)
    const fiveStarCount = reviews.filter(review => review.rating === 5).length;
    const totalRatings = place.user_ratings_total || 0;
    const avgRating = place.rating || 0;

    return res.json({
      placeId,
      name: place.name,
      avgRating,
      totalRatings,
      reviewsSample: reviews.length,
      fiveStarSample: fiveStarCount,
      // Note: this is only from recent sample, not total 5-star count
      note: `5-star count is from ${reviews.length} recent reviews only. Total ratings: ${totalRatings}`,
      reviews: reviews.map(r => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text,
        time: r.relative_time_description
      }))
    });

  } catch (err) {
    console.error('handler error', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
