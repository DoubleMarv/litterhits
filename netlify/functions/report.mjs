// Netlify Function: receives a litter report (multipart form with photo)
// and emails it via Brevo's transactional email API, photo attached.
//
// Environment variables (Netlify > Site configuration > Environment variables):
//   BREVO_API_KEY  Brevo API key (starts with xkeysib-, NOT the SMTP key)
//                  Falls back to "brevage" if that's what you've named it.
//   TO_EMAIL       Where reports go      (default info@doublemarvellous.com)
//   SENDER_EMAIL   Verified Brevo sender (default info@doublemarvellous.com)

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB after browser resize
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  let form;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, error: 'Bad request' }, 400);
  }

  const get = (k) => String(form.get(k) ?? '').trim().slice(0, 2000);

  // Honeypot: bots fill the hidden "website" field. Pretend success.
  if (get('website')) return json({ ok: true });

  const location = get('location');
  const county = get('county');
  const details = get('details');
  const name = get('name');
  const email = get('email');
  const featureOk = get('feature_ok') === 'yes';
  const lat = parseFloat(get('lat'));
  const lng = parseFloat(get('lng'));
  const hasPin = Number.isFinite(lat) && Number.isFinite(lng);

  const photo = form.get('photo');

  if (!location) return json({ ok: false, error: 'Please say where the litter is.' }, 400);
  if (!photo || typeof photo.arrayBuffer !== 'function' || !photo.size) {
    return json({ ok: false, error: 'Please add a photo.' }, 400);
  }
  if (!EXT[photo.type]) {
    return json({ ok: false, error: 'Please use a JPG, PNG, GIF or WebP photo.' }, 400);
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return json({ ok: false, error: 'That photo is too large. Please try a smaller one.' }, 400);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'That email address does not look right.' }, 400);
  }

  const apiKey = process.env.BREVO_API_KEY || process.env.brevage;
  const toEmail = process.env.TO_EMAIL || 'info@doublemarvellous.com';
  const senderEmail = process.env.SENDER_EMAIL || 'info@doublemarvellous.com';

  if (!apiKey) {
    console.error('Missing BREVO_API_KEY');
    return json({ ok: false, error: 'Form is not configured yet.' }, 500);
  }

  const photoBase64 = Buffer.from(await photo.arrayBuffer()).toString('base64');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const fileName = `litter-${stamp}.${EXT[photo.type]}`;

  const mapLink = hasPin
    ? `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`
    : `https://www.google.com/maps/search/${encodeURIComponent([location, county, 'Ireland'].filter(Boolean).join(', '))}`;

  const row = (label, value) =>
    `<tr><td style="padding:6px 12px 6px 0;font-weight:bold;vertical-align:top">${label}</td><td style="padding:6px 0">${value}</td></tr>`;

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#141414">
      <h2 style="margin:0 0 16px">New litter spot reported</h2>
      <table cellpadding="0" cellspacing="0">
        ${row('Location', esc(location))}
        ${row('County', esc(county) || '—')}
        ${row('Pin', hasPin ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Not pinned')}
        ${row('Map', `<a href="${mapLink}">Open in Google Maps</a>`)}
        ${row('Details', esc(details).replace(/\n/g, '<br>') || '—')}
        ${row('Name', esc(name) || '—')}
        ${row('Email', esc(email) || '—')}
        ${row('OK to feature photo', featureOk ? 'Yes' : 'No')}
      </table>
      <p style="margin-top:16px;color:#5d5a53">Photo attached: ${fileName}</p>
    </div>`;

  const payload = {
    sender: { name: 'Greatest Hits reports', email: senderEmail },
    to: [{ email: toEmail }],
    subject: `Litter report: ${location}${county ? `, Co. ${county}` : ''}`.slice(0, 200),
    htmlContent: html,
    attachment: [{ name: fileName, content: photoBase64 }]
  };
  if (email) payload.replyTo = { email, name: name || email };

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error('Brevo error', res.status, await res.text());
      return json({ ok: false, error: 'Could not send your report. Please try again.' }, 502);
    }
  } catch (err) {
    console.error('Brevo request failed', err);
    return json({ ok: false, error: 'Could not send your report. Please try again.' }, 502);
  }

  return json({ ok: true });
};

export const config = { path: '/api/report' };
