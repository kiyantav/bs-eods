export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  console.log('📣 /api/business-reviews invoked', req.method, req.query);

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const locationId = req.query.locationId;
    if (!keyJson) return res.status(500).json({ error: 'Missing GOOGLE_SERVICE_ACCOUNT_KEY' });
    if (!locationId) return res.status(400).json({ error: 'Missing locationId' });

    const key = typeof keyJson === 'string' ? JSON.parse(keyJson) : keyJson;

    // Build JWT for service account authentication
    const base64url = (str) => Buffer.from(str).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const claimSet = {
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/business.manage',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };
    const payload = base64url(JSON.stringify(claimSet));
    const unsignedJwt = `${header}.${payload}`;

    const crypto = require('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsignedJwt);
    const signature = sign.sign(key.private_key, 'base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const signedJwt = `${unsignedJwt}.${signature}`;

    // Exchange JWT for access token
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signedJwt
      }).toString()
    });
    const tokenJson = await tokenResp.json();
    if (!tokenJson.access_token) {
      console.error('token error', tokenJson);
      return res.status(502).json({ error: 'Failed to obtain access token', detail: tokenJson });
    }
    const accessToken = tokenJson.access_token;

    // Use current Business Profile API endpoint (not legacy mybusiness)
    const reviewsUrl = `https://businessprofileperformance.googleapis.com/v1/locations/${encodeURIComponent(locationId)}/searchkeywords/impressions/monthly?filter=monthly`;
    
    // Try the newer API structure - we may need to adjust based on available endpoints
    const r = await fetch(reviewsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = await r.json();
    console.log('API Response:', r.status, data);

    if (!r.ok) {
      // If that endpoint doesn't work, try the Business Information API for basic location data
      const locationUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${encodeURIComponent(locationId)}?readMask=name,title,websiteUri`;
      const locationResp = await fetch(locationUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const locationData = await locationResp.json();
      
      if (!locationResp.ok) {
        console.error('Business API error', locationResp.status, locationData);
        return res.status(locationResp.status).json({ error: 'Business Profile API error', detail: locationData });
      }

      // For now, return location info - reviews might need a different approach
      return res.json({
        locationId,
        locationInfo: locationData,
        note: 'Reviews endpoint needs verification - returning location data for now'
      });
    }

    return res.json({
      locationId,
      data,
      note: 'Using current Business Profile API'
    });
  } catch (err) {
    console.error('handler error', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
