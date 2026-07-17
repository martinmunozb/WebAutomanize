const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function tenantPerteneceAlEmail(tenantId, email) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/tenants?id=eq.${encodeURIComponent(tenantId)}&select=email_contacto`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  if (!res.ok) return false;
  const rows = await res.json();
  if (!rows.length || !rows[0].email_contacto) return false;
  return rows[0].email_contacto.trim().toLowerCase() === email.trim().toLowerCase();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { tenant_id, email } = body;

  if (!tenant_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta tenant_id' }) };
  }
  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email no válido' }) };
  }

  const perteneceAlEmail = await tenantPerteneceAlEmail(tenant_id, email);
  if (!perteneceAlEmail) {
    return { statusCode: 403, body: JSON.stringify({ error: 'No autorizado para este tenant' }) };
  }

  const base = process.env.URL || 'https://automanize.com';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: 973,
          product_data: { name: 'Nize — Automatización WhatsApp' },
        },
        quantity: 1,
      }],
      success_url: `${base}/pago-nize.html?tenant_id=${encodeURIComponent(tenant_id)}&email=${encodeURIComponent(email)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pago-nize.html?tenant_id=${encodeURIComponent(tenant_id)}&email=${encodeURIComponent(email)}`,
      metadata: { tenant_id, email },
      payment_method_types: ['card'],
      locale: 'es',
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al crear sesión de pago' }),
    };
  }
};
