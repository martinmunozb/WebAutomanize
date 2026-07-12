# alta-agencia.html / alta-agencia-admin.html — Ficha de alta de agencias ya contratadas

## Para qué sirve

Vía para que una agencia que **ya ha contratado Nize** mande la información de alta (la misma que describe `onboarding-cliente.html` / `docs/ONBOARDING_CLIENTE.md`) sin depender de WhatsApp. El acceso lo da un token de un solo uso que genera el equipo de Automanize desde el panel interno.

- **Formulario cliente**: `https://automanize.com/alta-agencia.html?token=<uuid>`
- **Panel interno**: `https://automanize.com/alta-agencia-admin.html` (login con las mismas cuentas de Supabase Auth que `finanzas.html`)

---

## Alcance del formulario (decisión deliberada)

El formulario **no replica** las secciones repetibles de la ficha completa (propietarios, inmuebles, inquilinos, gastos, equipo — secciones 2-9). Pide los campos de la sección 1 (EMPRESA) como texto: nombre de la agencia, razón social, NIF/CIF, persona que rellena, email de contacto, teléfono de administración, teléfono de notificaciones WhatsApp (puede coincidir con el de administración), IBAN de cobro, fecha, y un logo de empresa (subida de imagen aparte de los documentos).

Para todo lo demás, el cliente **sube sus propios documentos** (Excel, PDF, Word — contratos, listados de inquilinos, etc.). El equipo de Automanize los procesa después con el prompt de IA ya documentado en `onboarding-cliente.html`, y da de alta el tenant real a mano (no hay integración automática con la tabla `tenants`).

---

## ⚠️ Schema dedicado — requiere configuración manual en Supabase

Todo esto vive en un **schema propio `onboarding`** (no en `public`, para mantenerlo aislado de las tablas core de Nize). Para que el HTML pueda llamarlo hace falta que el schema esté en la lista de **Exposed schemas**:

> Supabase Dashboard → proyecto `edjugpekcntzvqaskbmc` → **Settings → API → Exposed schemas** → añadir `onboarding` a la lista (junto a `public`, `graphql_public`).

Sin este paso, cualquier llamada desde `alta-agencia.html` o `alta-agencia-admin.html` a `onboarding.*` devuelve error de PostgREST ("schema must be one of the following...").

El bucket de Storage (`onboarding-archivos`) **no** se ve afectado por esto — Storage tiene su propia API, independiente de los schemas expuestos por PostgREST.

---

## Esquema (`onboarding.*`)

### `onboarding.tokens`
Un token por agencia a la que se le envía el enlace. `token` (uuid) es lo que va en la URL. `usado`/`usado_en` se marcan al enviar el formulario (single-use). `creado_por_email` se rellena solo, leído del JWT de quien lo genera — no es un input manipulable.

### `onboarding.respuestas`
Una fila por ficha enviada: `nombre_agencia`, `razon_social`, `nif`, `email_contacto`, `telefono_admin`, `telefono_whatsapp`, `iban`, `persona_rellena`, `fecha`, `notas`, `logo_path` (ruta del logo en el bucket, o `NULL`) y `archivos` — un jsonb array `[{nombre, path}]` con las rutas del resto de documentos dentro del bucket `onboarding-archivos`.

### RLS
- `anon` no tiene policies directas sobre ninguna tabla — todo pasa por las RPCs de abajo.
- `authenticated` puede leer ambas tablas y gestionar `tokens` directamente (usado por el panel).

### RPCs (`SECURITY DEFINER`, schema `onboarding`)

| Función | Rol | Qué hace |
|---|---|---|
| `onboarding.validar_token(p_token uuid)` | `anon` | Devuelve `{valido, usado, nombre_agencia}` sin exponer la tabla completa. |
| `onboarding.submit(p_token, ...campos, p_archivos jsonb)` | `anon` | Valida el token, inserta en `respuestas`, marca el token como usado. Lanza excepción si el token no existe o ya se usó. |
| `onboarding.crear_token(p_nombre_agencia, p_email_contacto)` | `authenticated` | Inserta un token nuevo y devuelve el uuid. Usado por el panel para generar enlaces. |

### Storage

Bucket privado `onboarding-archivos`. `anon` solo puede subir (`INSERT`), nunca leer. `authenticated` puede generar signed URLs para verlos desde el panel (`createSignedUrl`, igual que `finanzas-facturas` en `finanzas.html`).

---

## Flujo completo

```
1. Equipo genera un token desde alta-agencia-admin.html (pestaña "Generar token")
2. Copia el enlace https://automanize.com/alta-agencia.html?token=<uuid> y se lo manda a la agencia
3. La agencia abre el enlace, rellena los campos básicos y sube sus documentos
4. Al enviar: los archivos se suben primero a Storage, luego onboarding.submit() guarda la respuesta e invalida el token
5. El navegador dispara (best-effort) un POST a N8N_WEBHOOK_URL con un resumen — el equipo recibe un email
6. El equipo revisa la respuesta y los archivos desde alta-agencia-admin.html
```

---

## Notificación por email — configuración pendiente en n8n

El front-end dispara un `fetch` no bloqueante a:

```
https://n8n.automanize.com/webhook/onboarding-completado
```

con el payload:

```json
{
  "nombre_agencia": "...", "razon_social": "...", "nif": "...",
  "persona_rellena": "...", "email_contacto": "...", "telefono_admin": "...", "fecha": "...",
  "num_archivos": 2,
  "archivos": [{ "nombre": "contrato.pdf", "content": "<base64...>" }],
  "logo": { "nombre": "logo.png", "content": "<base64...>" }
}
```

(`content` es el archivo entero en base64, leído directamente en el navegador — no una ruta de Supabase.)

**Hay que crear este workflow en n8n** (no existe todavía): un nodo Webhook (POST, path `onboarding-completado`) seguido de un nodo de email que mande ese resumen a quien corresponda, con un enlace a `alta-agencia-admin.html` para ver el detalle. Si el webhook no existe, el envío del formulario funciona igual (es best-effort) pero no llega ningún aviso.

### Workflow ya exportado, listo para importar

`docs/n8n-onboarding-completado.json` tiene el workflow completo (Webhook → Code que arma el email con los adjuntos → HTTP Request a la API de **Resend**) para importar directamente en `n8n.automanize.com` (menú ⋯ → **Import from File**).

Se eligió Resend en vez de SMTP (Gmail) porque SMTP necesita verificación en dos pasos + contraseña de aplicación y a veces tiene problemas de entrega. Resend es un servicio de email transaccional con API HTTP, con credencial propia gestionada desde la UI de n8n (Credentials → Resend API) — nada de SMTP, nada de variables de entorno.

**Los archivos llegan al aviso ya adjuntos desde el propio formulario, sin pasar por Supabase en este paso**: `alta-agencia.html` lee cada archivo seleccionado con `FileReader` y lo manda codificado en base64 dentro del mismo POST al webhook (`archivos: [{nombre, content}]`, y `logo: {nombre, content}` si hay logo). El nodo de código de n8n solo tiene que montar el body de Resend con esos adjuntos — no necesita ninguna key de Supabase ni ir a buscar nada a Storage. (Los archivos se guardan también en el bucket `onboarding-archivos` por separado, en paralelo, para que el panel admin pueda seguir mostrándolos — ver más abajo — pero esa subida y el envío del email son dos caminos independientes.)

Pasos tras importar:

1. **Crear cuenta en [resend.com](https://resend.com)** (gratis, 3.000 emails/mes) y verificar un dominio propio (`automanize.com` u otro) siguiendo los registros DNS que da Resend — sin dominio verificado solo se puede mandar a la propia dirección de registro.
2. Generar una **API key** en Resend (Dashboard → API Keys) y crear la credencial en n8n: en el nodo de HTTP Request, Authentication → "Predefined Credential Type" → "Resend API" → pegar la key ahí.
3. Abrir el nodo **"Preparar Email con Adjuntos"** y ajustar `from` (dirección con el dominio verificado en Resend) y `to` (destinatario real).
4. Activar el workflow.

Si algún archivo no trae contenido (por lo que sea) simplemente no se adjunta — el cuerpo del email dice cuántos de cuántos se adjuntaron, con un link al panel para revisarlo desde ahí.

---

## Pantallas de error (formulario cliente)

| Estado | Cuándo |
|---|---|
| `Invalid` | No hay `?token=` en la URL, o `validar_token` dice que no existe |
| `Used` | El token ya se usó (`usado = true`) |
| `Form` | Token válido y pendiente — se muestra el formulario |
