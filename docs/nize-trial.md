# prueba-nize.html — Landing trial gratuito Nize

## Para qué sirve

Landing page de captación para **Meta Ads y tráfico directo**. Un potencial cliente de Nize (inmobiliaria) rellena sus datos y solicita la prueba gratuita del software.

**URL**: `https://automanize.com/prueba-nize.html`

---

## Flujo

```
1. Usuario llega desde anuncio o link directo
2. Rellena formulario: empresa, teléfono (prefijo + número), correo
3. POST a Supabase Edge Function: /functions/v1/trial-signup
4. La función (pendiente de crear) crea el tenant en Supabase y envía email
5. Usuario ve pantalla de confirmación
```

---

## Formulario

- **Empresa**: texto libre
- **Teléfono**: selector de prefijo + campo numérico (ver `docs/telefono.md`)
- **Correo**: email
- **Honeypot**: campo oculto `website` anti-spam

### Lógica del teléfono en el submit

```js
const prefijo = document.getElementById('prefijo').value.replace('+', ''); // "34"
const telefonoNumero = document.getElementById('telefono').value.trim().replace(/\s/g, '');
const telefono = prefijo + telefonoNumero; // "34693869667" — sin el +
```

El número se envía sin `+` para que sea compatible con `bigint` en la BD (`tenants.telefono_priv_admin`).

---

## Edge Function: trial-signup

**Estado**: pendiente de crear en Supabase proyecto `edjugpekcntzvqaskbmc`.

Debe:
1. Recibir `{ empresa, telefono, email, website }`
2. Ignorar si `website` no está vacío (honeypot)
3. Crear registro en `tenants`
4. Enviar email de bienvenida con instalador y código de acceso vía Gmail SMTP
5. Notificar internamente

### Secretos necesarios en Supabase

| Variable | Valor |
|---|---|
| `GMAIL_USER` | cuenta Gmail remitente |
| `GMAIL_APP_PASSWORD` | App Password (no la contraseña normal — requiere 2FA activado) |

---

## Diseño

- Estética Nize: fondo negro, acento amarillo `#F0C000`
- Fuentes: Syne (headings) + DM Sans (body) desde Google Fonts
- Mobile-first, hero con formulario a la derecha en desktop
