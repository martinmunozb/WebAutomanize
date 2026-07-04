# Supabase — Base de datos

## Proyecto

- **ID**: `edjugpekcntzvqaskbmc`
- **Región**: eu-central-1
- **URL**: `https://edjugpekcntzvqaskbmc.supabase.co`
- **Anon key**: en el HTML de cada página que la necesite (es pública, nunca la service role key)

---

## Tablas principales

### `tenants`
Cada inmobiliaria cliente de Nize. Columnas sensibles: `whatsapp_token`, `whatsapp_phone_id`, `factura_config`.
- RLS SELECT: solo `authenticated` con `get_tenant_id()` coincidente.
- **No exponer a `anon`** directamente — usar `get_tenant_public_info()`.

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
Valida el token, guarda las respuestas del formulario en `clientes` (solo columnas mapeadas en `preguntas_catalogo`) y marca `formulario_enviado = true` + invalida el token.
- `p_respuestas`: `{ "pregunta_id_uuid": "valor_string" }` — valores siempre como string, la función castea internamente.
- Devuelve `true` en éxito, lanza excepción si el token no es válido o ha caducado.

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
