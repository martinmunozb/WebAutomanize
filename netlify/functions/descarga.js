const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY;
const BUCKET          = process.env.SUPABASE_BUCKET;
const FILE            = process.env.SUPABASE_FILE;
const EXPIRES_IN      = 3600; // 1 hora

async function getSignedUrl() {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${FILE}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: EXPIRES_IN }),
    }
  );
  const data = await res.json();
  if (!res.ok || !data.signedURL) throw new Error('No se pudo generar URL firmada');
  return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}

exports.handler = async (event) => {
  const { session_id } = event.queryStringParameters || {};

  if (!session_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'session_id requerido' }) };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Pago no completado' }) };
    }

    const download_url = await getSignedUrl();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        email: session.customer_email,
        plan: session.metadata?.plan,
        download_url,
      }),
    };
  } catch (err) {
    console.error('Error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Error verificando pago' }) };
  }
};
