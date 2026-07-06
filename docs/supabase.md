# Supabase — Base de datos

## Proyecto

- **ID**: `edjugpekcntzvqaskbmc`
- **Región**: eu-central-1
- **URL**: `https://edjugpekcntzvqaskbmc.supabase.co`
- **Anon key**: en el HTML de cada página que la necesite (es pública, nunca la service role key)

---

## Tablas principales

### `tenants`
Cada inmobiliaria cliente de Nize. Columnas sensibles: `whatsapp_token`, `whatsapp_phone_id`, `factura_config`. `slug` (texto único, nullable) es el identificador corto para el enlace público del formulario (`automanize.com/f/<slug>`).
- RLS SELECT: solo `authenticated` con `get_tenant_id()` coincidente.
- **No exponer a `anon`** directamente — usar `get_tenant_public_info()` o `get_tenant_by_slug()`.

### `clientes`
Leads/interesados de cada tenant. Tiene `form_token` (uuid) y `form_token_expira` para el formulario de leads.
- RLS SELECT para `anon`: solo filas con `form_token IS NOT NULL AND form_token_expira > now() AND formulario_enviado = false`.
- RLS UPDATE para `anon`: **no existe** — las actualizaciones van por RPC `submit_formulario`.

### `preguntas_catalogo`
Catálogo maestro de preguntas del formulario dinámico.
- RLS SELECT para `anon`: permitido (`anon_select_preguntas_catalogo`).

### `tenant_preguntas`
Qué preguntas tiene activas cada tenant, en qué orden y con texto personalizado.
- RLS SELECT para `anon`: permitido solo `activa = true` (`anon_select_tenant_preguntas`).

### `inmuebles_disponibles`
Vista (VIEW) que combina `pisos` y `habitaciones` con estado disponible. Columnas: `zona`, `tenant_id`, `tipo_unidad`, `estado`, entre otras.

### Otras tablas relevantes
`pisos`, `habitaciones`, `inquilinos`, `pagos`, `incidencias`, `gestores`, `perfiles_app`, `reservas`, `propietarios`, `contratos`, `gastos`.

---

## Funciones RPC (SECURITY DEFINER)

### `get_tenant_public_info(p_tenant_id uuid)`
Devuelve `{ id, nombre }` del tenant si está activo. Sin exponer tokens ni config privada.
- Llamada desde: `formulario.html` para mostrar el nombre de la inmobiliaria.

### `submit_formulario(p_token uuid, p_respuestas jsonb)`
Modo token (lead ya identificado por WhatsApp). Valida el token, guarda las respuestas del formulario en `clientes` (solo columnas mapeadas en `preguntas_catalogo`) y marca `formulario_enviado = true` + invalida el token.
- `p_respuestas`: `{ "pregunta_id_uuid": "valor_string" }` — valores siempre como string, la función castea internamente.
- Devuelve `true` en éxito, lanza excepción si el token no es válido o ha caducado.

### `crear_lead_publico(p_tenant_id uuid, p_nombre text, p_prefijo text, p_telefono bigint, p_respuestas jsonb)`
Modo público (link `/f/<slug>`, sin cliente previo). Valida que el tenant esté activo, y hace upsert en `clientes` por `(telefono, tenant_id)` (actualiza si ya existía ese teléfono para ese tenant, en vez de duplicar) con `formulario_enviado = true`. Castea `p_respuestas` igual que `submit_formulario`.

### `get_tenant_by_slug(p_slug text)`
Devuelve `{ id, nombre }` del tenant si `slug` coincide y está activo. Usada por `formulario.html` en modo público para resolver el slug de la URL al `tenant_id` real.

### `get_tenant_id()`
Función interna. Lee `perfiles_app.tenant_id` donde `user_id = auth.uid()`. Usada en las políticas RLS del panel de escritorio.

---

## Políticas RLS relevantes para el formulario web (anon)

```sql
-- Catálogo de preguntas (lectura libre)
CREATE POLICY "anon_select_preguntas_catalogo" ON preguntas_catalogo
  FOR SELECT TO anon USING (true);

-- Preguntas activas del tenant
CREATE POLICY "anon_select_tenant_preguntas" ON tenant_preguntas
  FOR SELECT TO anon USING (activa = true);

-- Clientes: solo filas con token válido y no expirado
CREATE POLICY "anon_select_clientes_form_token" ON clientes
  FOR SELECT TO anon
  USING (form_token IS NOT NULL AND form_token_expira > now() AND formulario_enviado = false);
```

**No crear** política `anon_select_tenants` directa — expone `whatsapp_token` y `factura_config`.
**No crear** política `anon_update_clientes` directa — usar `submit_formulario` RPC.
