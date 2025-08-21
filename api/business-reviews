export default async function handler(req, res) {
  // GET /api/business-reviews?accountId=...&locationId=...
  console.log('📣 /api/business-reviews invoked', req.method, req.query);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const accountId = req.query.accountId || process.env.GBP_ACCOUNT_ID;
  const locationId = req.query.locationId;
  if (!keyJson) return res.status(500).json({ error: 'Missing GOOGLE_SERVICE_ACCOUNT_KEY' });
  if (!accountId || !locationId) return res.status(400).json({ error: 'Missing accountId or locationId' });

  try {
    // lightweight Google auth using service account JSON
    const key = typeof keyJson === 'string' ? JSON.parse(keyJson) : keyJson;
    const jwtPayload = {
      iss: key.client_email,
      sub: key.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/business.manage',
    };

    // obtain access token via Google OAuth JWT flow
    // build raw JWT and exchange for access_token (simple implementation using built-in crypto)
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

    // sign with private_key
    const crypto = require('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsignedJwt);
    const signature = sign.sign(key.private_key, 'base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const signedJwt = `${unsignedJwt}.${signature}`;

    // exchange for access token
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

    // call Business Profile Reviews API (v4 endpoint)
    // Note: endpoint path uses accounts/{accountId}/locations/{locationId}/reviews
    const reviewsUrl = `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/reviews?pageSize=200`;
    const r = await fetch(reviewsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = await r.json();
    if (!r.ok) {
      console.error('Business API error', r.status, data);
      return res.status(r.status).json({ error: 'Business Profile API error', detail: data });
    }

    // aggregate 5-star count and return list
    const reviews = data.reviews || [];
    const fiveStarCount = reviews.reduce((c, rv) => c + (Number(rv.starRating) === 5 ? 1 : 0), 0);

    return res.json({
      accountId,
      locationId,
      totalReviews: reviews.length,
      fiveStarCount,
      reviews // raw reviews (can be trimmed)
    });
  } catch (err) {
    console.error('handler error', err);
    return res.status(500).json({ error: err.message });
  }
}
