# formulario.html — Formulario dinámico de leads

## Para qué sirve

Formulario wizard paso a paso que recibe un lead (persona interesada en alquilar). Reemplaza la larga conversación de preguntas por WhatsApp — el lead responde todo de una vez en el móvil. Tiene dos modos de entrada:

| Modo | URL | Cuándo se usa |
|---|---|---|
| **Token** (lead ya identificado) | `https://automanize.com/formulario.html?token=<uuid>` | n8n ya creó la fila en `clientes` (lead que escribió por WhatsApp) y envía este enlace de un solo uso. |
| **Público** (link reutilizable por tenant) | `https://automanize.com/f/<slug>` | Enlace fijo por inmobiliaria para compartir donde sea (Idealista, redes, etc.). No hay cliente todavía — el propio formulario pide nombre y teléfono al principio y crea el lead al enviar. |

---

## Cómo generar el enlace público de un tenant nuevo

1. El tenant necesita una columna `slug` en `tenants` (texto corto, único, sin espacios — ej. `invictarent`). Si es un tenant nuevo, hay que rellenarla:
   ```sql
   UPDATE tenants SET slug = 'nombretenant' WHERE id = '<tenant_id>';
   ```
2. Su enlace público es directamente: `https://automanize.com/f/<slug>`.
3. El tenant debe tener `activo = true` (si no, `get_tenant_by_slug` no lo encuentra → error "Enlace no válido").
4. **Necesita preguntas activas en `tenant_preguntas`** — crear un tenant nuevo NO las copia automáticamente, hay que poblarlas a mano (si no, error genérico "No hemos podido cargar el formulario"):
   ```sql
   insert into tenant_preguntas (tenant_id, pregunta_id, activa, orden)
   select '<tenant_id>', id, activa_por_defecto, orden_defecto
   from preguntas_catalogo;
   ```
   Esto copia el set de preguntas por defecto (`activa_por_defecto`/`orden_defecto` de `preguntas_catalogo`); luego se pueden desactivar/reordenar individualmente por tenant como con InvictaRent.

La reescritura de `/f/<slug>` → `formulario.html?t=<slug>` vive en el **Caddyfile del servidor** (`/root/caddy-main/Caddyfile`, bloque `automanize.com`), no en `_redirects` (ese archivo es de Netlify y no lo lee nada en producción — el hosting real es Caddy + nginx sobre un VPS, no Netlify, pese a lo que sugiera `netlify.toml`). Dado que Caddy reescribe la petición solo de cara al servidor, el navegador nunca ve el `?t=<slug>` resultante — por eso el JS lee el slug directamente de `location.pathname` (`/f/<slug>`), no del query string.

---

## Flujo completo

```
1. n8n detecta nuevo lead en WhatsApp
2. n8n crea registro en clientes con form_token y form_token_expira (24h)
3. n8n envía el enlace al lead por WhatsApp
4. Lead abre el enlace en el móvil
5. formulario.html carga y valida el token
6. Muestra wizard con las preguntas activas del tenant
7. Lead responde paso a paso
8. Al enviar: submit_formulario() guarda respuestas + invalida token
9. POST al webhook de n8n con { tenant_id, telefono }
10. n8n hace matching de propiedades con IA y notifica al gestor
```

---

## Diseño y UX

- **Estética**: Nize (fondo `#0D0D0D`, acento amarillo `#F0C000`, fuente Inter)
- **Mobile-first**: header y nav sticky arriba/abajo, botones mínimo 52px
- **Wizard**: una pregunta por pantalla, barra de progreso fina en amarillo
- **Sin scroll**: cada paso cabe en pantalla sin desplazar

---

## Lógica de carga (init)

1. Lee `?token` de la URL → error `notfound` si no hay token
2. `GET clientes WHERE form_token = eq.{token}` → obtiene `tenant_id`, `telefono`, `form_token_expira`, `formulario_enviado`
3. Valida caducidad y si ya se envió → pantallas de error específicas
4. `RPC get_tenant_public_info(tenant_id)` → nombre del tenant para la cabecera
5. `GET tenant_preguntas WHERE tenant_id AND activa = true ORDER BY orden` → preguntas del tenant
6. `GET preguntas_catalogo WHERE id IN (pregunta_ids)` → detalles de cada pregunta
7. Para `dynamic_zone_multi_select`: `GET inmuebles_disponibles WHERE tenant_id AND estado = 'disponible'` → zonas distintas
8. Renderiza el wizard

---

## Tipos de input

| tipo_input | Componente |
|---|---|
| `text` | Input texto libre |
| `number` | Input numérico (sin flechas) |
| `single_select` | Botones radio-style |
| `multi_select` | Botones checkbox-style, valor guardado como CSV |
| `boolean` | Dos tarjetas grandes (fácil de tocar en móvil) |
| `dynamic_zone_multi_select` | Como multi_select pero opciones vienen de `inmuebles_disponibles.zona` |

---

## Lógica condicional

- Si `clave === 'aval_ingreso'` y `answers['tieneAval'] === 'false'` → el paso se oculta y se salta.
- El payload de submit solo incluye los pasos visibles.

---

## Payload de submit

```js
// Keyed por pregunta_id (uuid), valores siempre como string
{
  "554dee00-2be1-42cc-802c-88e1d9597d52": "Chamberí,Salamanca",
  "44be1e97-53b9-4ef6-854a-325c71dc8c49": "800",
  "955abadc-f35a-4137-b54c-a3c3bd713d34": "true",
  ...
}
```

La función `submit_formulario` castea automáticamente:
- integer/smallint/bigint/numeric → `Number(v)`
- boolean → `v === 'true'`
- "" → NULL
- texto → tal cual

---

## Constantes configuradas

```js
const N8N_WEBHOOK_URL = 'https://n8n.automanize.com/webhook/formulario-completado';
```

---

## Pantallas de error

| errorKey | Cuándo |
|---|---|
| `notfound` | Token no existe en la BD |
| `expired` | `form_token_expira` ya pasó |
| `used` | `formulario_enviado = true` |
| `generic` | Error de red u otro inesperado |
