const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function marcarTenantPagado(tenantId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tenants?id=eq.${encodeURIComponent(tenantId)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ pagado: true, pagado_en: new Date().toISOString() }),
  });
  if (!res.ok) {
    throw new Error(`No se pudo marcar el tenant como pagado (${res.status})`);
  }
}

async function avisarPorEmail({ tenantId, email }) {
  const to = process.env.NOTIFY_EMAIL_TO;
  const user = process.env.GMAIL_SENDER_USER;
  const pass = process.env.GMAIL_SENDER_APP_PASSWORD;
  if (!to || !user || !pass) return;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: user,
    to,
    subject: 'Pago recibido — activar automatización WhatsApp',
    html: `
      <p>Se ha recibido el pago de 9,73€ de automatización WhatsApp.</p>
      <p>Tenant: ${tenantId}<br/>Email cliente: ${email}</p>
      <p>Recuerda comprar y configurar el número dedicado (whatsapp_phone_id / whatsapp_token en tenants) dentro del plazo de 48h.</p>
    `,
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const signature = event.headers['stripe-signature'];
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET_TRIAL);
  } catch (err) {
    console.error('Firma de webhook inválida:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const tenantId = session.metadata?.tenant_id;
    const email = session.metadata?.email || session.customer_email;

    if (tenantId) {
      try {
        await marcarTenantPagado(tenantId);
        await avisarPorEmail({ tenantId, email });
      } catch (err) {
        console.error('Error procesando checkout.session.completed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
