# Automanize — Arquitectura general

## Qué es este proyecto

Web de marketing y utilidades de **Automanize** / **Nize**. Hospedada en `automanize.com`.

- **Automanize**: empresa que vende automatizaciones para negocios (diseño web, CRM, WhatsApp, facturación).
- **Nize**: producto SaaS de gestión inmobiliaria multi-tenant (pisos, inquilinos, cobros, incidencias, WhatsApp).

---

## Stack

| Capa | Tecnología |
|---|---|
| Hosting | **VPS propio**: Caddy (reverse proxy, Docker, `/root/caddy-main/`) → contenedor `webAutomanize` (nginx:alpine sirviendo `/var/www/automanize` directo) |
| Backend / DB | Supabase — proyecto `edjugpekcntzvqaskbmc` (región eu-central-1) |
| Funciones serverless | Netlify Functions (Node.js) — ⚠️ pendiente de confirmar si siguen desplegadas en Netlify real o hay que migrarlas |
| Pagos | Stripe |
| Automatización | n8n (`n8n.automanize.com`, mismo Caddy) |
| Fuentes | Inter (Google Fonts) |

**Importante**: `netlify.toml`, `_headers` y `_redirects` están en el repo pero **no los lee nada en producción** — el sitio no lo sirve Netlify, lo sirve el Caddy del VPS. Cualquier redirect, rewrite o header nuevo tiene que ir en `/root/caddy-main/Caddyfile` (ese Caddy también sirve `n8n.automanize.com`, `controldeplagastmm.com` y `captador.automanize.com` — reiniciarlo afecta a los cuatro).

---

## Estructura de archivos

```
/
├── index.html              — Landing principal Automanize
├── prueba-nize.html        — Landing trial gratuito Nize (Meta Ads / tráfico directo)
├── formulario.html         — Formulario dinámico de leads por token (WhatsApp / n8n)
├── pago-nize.html          — Página de pago/confirmación Nize
├── captador-nize.html      — Landing captador de inmuebles
├── crm.html                — Landing CRM
├── radar.html              — Landing Radar
├── facturacion.html        — Landing Facturación
├── diseno-web.html         — Landing Diseño Web
├── reservas.html           — Sistema de reservas
├── docs/                   — Documentación de lógica (este directorio)
├── netlify/functions/      — Funciones serverless (Stripe, descarga)
├── incidencias/fotos/      — Subida de fotos de incidencias por token
├── seleccionar/            — Selección de inmuebles por lead
└── subir/                  — Subida de archivos
```

---

## Sistema multi-tenant (Nize)

- Cada inmobiliaria cliente es un **tenant** (tabla `tenants` en Supabase).
- Todos los datos (clientes, pisos, incidencias, pagos…) tienen `tenant_id` como columna de aislamiento.
- El acceso autenticado usa `get_tenant_id()` (función SECURITY DEFINER que lee `perfiles_app.tenant_id` a partir de `auth.uid()`).
- Los usuarios anónimos (leads, inquilinos desde WhatsApp) acceden por token o funciones RPC específicas.

---

## Fuentes relacionadas

- `docs/supabase.md` — tablas, RLS y funciones RPC
- `docs/formulario.md` — formulario dinámico de leads
- `docs/nize-trial.md` — landing de prueba gratis
- `docs/netlify-functions.md` — funciones de Netlify / Stripe
- `docs/telefono.md` — lógica del prefijo telefónico
