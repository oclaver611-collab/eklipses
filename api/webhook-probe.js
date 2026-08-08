// api/webhook-probe.js — TEMPORARY PROOF ENDPOINT, DELETE AFTER TEST
//
// Signs a real invoice.payment_failed payload using the production
// STRIPE_WEBHOOK_SECRET (which is only accessible inside Vercel) and
// sends it to /api/webhook to prove end-to-end signature verification
// and DB write without ever exposing the secret value outside Vercel.
//
// Protected by DEV_BYPASS_KEY — only accessible from internal tooling.
// Remove this file after the proof run.

const crypto = require('crypto');
const https  = require('https');

module.exports = async function handler(req, res) {
  // Guard: only accessible with the internal dev key
  const devKey = process.env.DEV_BYPASS_KEY;
  if (!devKey || req.headers['x-dev-key'] !== devKey) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET not set' });
  }

  // Use the real Stripe test customer created for this proof run
  const customerId = req.query.cus || 'cus_V25yepwm43E7CK';

  // Realistic invoice.payment_failed payload (structure matches what Stripe sends)
  const payload = JSON.stringify({
    id:       'evt_probe_' + Date.now(),
    object:   'event',
    api_version: '2024-06-20',
    type:     'invoice.payment_failed',
    livemode: false,
    created:  Math.floor(Date.now() / 1000),
    data: {
      object: {
        id:         'in_probe_' + Date.now(),
        object:     'invoice',
        customer:   customerId,
        status:     'open',
        amount_due: 999,
        currency:   'usd',
        attempt_count: 1,
        paid: false,
      },
    },
  });

  // Stripe's HMAC-SHA256 signature algorithm (publicly documented):
  //   signed_payload = "<timestamp>.<raw_json>"
  //   sig = HMAC-SHA256(key=webhookSecret, data=signed_payload)
  //   header = "t=<timestamp>,v1=<hex_sig>"
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const sig = crypto.createHmac('sha256', webhookSecret).update(signedPayload, 'utf8').digest('hex');
  const stripeSignature = `t=${timestamp},v1=${sig}`;

  // POST to /api/webhook on this same host (internal Vercel-to-Vercel call)
  const payloadBuf = Buffer.from(payload, 'utf8');
  const webhookResult = await new Promise((resolve, reject) => {
    const wreq = https.request({
      hostname: 'eklipses.vercel.app',
      path:     '/api/webhook',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': payloadBuf.length,
        'stripe-signature': stripeSignature,
      },
    }, wres => {
      const chunks = [];
      wres.on('data', c => chunks.push(c));
      wres.on('end', () => {
        try { resolve({ status: wres.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch { resolve({ status: wres.statusCode, body: {} }); }
      });
    });
    wreq.on('error', reject);
    wreq.write(payload);
    wreq.end();
  });

  return res.json({
    proof: 'webhook-probe',
    customerId,
    signatureAlgorithm: 'HMAC-SHA256 t=timestamp,v1=hex (Stripe standard)',
    secretSource: 'process.env.STRIPE_WEBHOOK_SECRET (Vercel production)',
    webhookStatus: webhookResult.status,
    webhookResponse: webhookResult.body,
    success: webhookResult.status === 200 && webhookResult.body?.handled === true,
  });
};
