const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRECIOS = {
  mensual: process.env.STRIPE_PRICE_MENSUAL,
  anual:   process.env.STRIPE_PRICE_ANUAL,
};

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

  const { plan, email } = body;

  if (!plan || !PRECIOS[plan]) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Plan no válido' }) };
  }
  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email no válido' }) };
  }

  const base = process.env.URL || 'https://automanize.com';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: plan === 'mensual' ? 'subscription' : 'payment',
      customer_email: email,
      line_items: [{ price: PRECIOS[plan], quantity: 1 }],
      success_url: `${base}/descarga-captador?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${base}/captador-nize`,
      metadata: { plan, email },
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
