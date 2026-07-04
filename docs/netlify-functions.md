# Netlify Functions — Backend serverless

## Ubicación

`netlify/functions/` — funciones Node.js desplegadas automáticamente con el site.

---

## Funciones existentes

### `crear-sesion.js`
Crea una sesión de pago en Stripe para el flujo de pago general de Automanize.
- Recibe: `{ tenant_id, email }`
- Devuelve: URL de Stripe Checkout

### `crear-sesion-trial.js`
Crea una sesión de Stripe para el trial de Nize.
- Recibe: `{ tenant_id, email }`
- Genera URLs de `success_url` y `cancel_url` apuntando a `pago-nize.html`

### `stripe-webhook-trial.js`
Webhook receptor de eventos de Stripe para el flujo trial.
- Escucha: `checkout.session.completed`
- Extrae `tenant_id` y `email` de los metadatos
- Llama a `avisarPorEmail()` — envía email interno con Gmail SMTP
- Requiere: `GMAIL_SENDER_USER` y `GMAIL_SENDER_APP_PASSWORD` como variables de entorno en Netlify

### `descarga.js`
Sirve el instalador de Nize protegido por token.

---

## Variables de entorno en Netlify

Configurar en el dashboard de Netlify → Site settings → Environment variables:

| Variable | Uso |
|---|---|
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret para verificar firma de webhooks |
| `GMAIL_SENDER_USER` | Email remitente para notificaciones internas |
| `GMAIL_SENDER_APP_PASSWORD` | App Password de Gmail (requiere 2FA) |

---

## Dependencias

`netlify/functions/package.json`:
- `nodemailer` — envío de emails SMTP desde las funciones Node.js
