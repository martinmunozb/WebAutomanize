# Lógica de teléfono con prefijo

## Dónde se usa

- `prueba-nize.html` — formulario de registro de nuevo tenant

## UI

Selector de prefijo de país + campo numérico separado, que aparecen como un único campo unificado visualmente.

```html
<div class="phone-group">
  <select id="prefijo">
    <option value="+34">🇪🇸 +34</option>
    <option value="+52">🇲🇽 +52</option>
    <!-- ... -->
  </select>
  <input type="tel" id="telefono" placeholder="6XX XXX XXX" />
</div>
```

## Lógica de construcción del número

```js
const prefijo        = document.getElementById('prefijo').value.replace('+', ''); // "34"
const telefonoNumero = document.getElementById('telefono').value.trim().replace(/\s/g, '');
const telefono       = prefijo + telefonoNumero; // "34693869667"
```

El `+` se elimina del prefijo para que el número resultante sea un entero puro, compatible con columnas `bigint` en Supabase (`tenants.telefono_priv_admin`, `clientes.telefono`).

## Lo que se envía al backend

```js
body: JSON.stringify({ empresa, telefono, email, website })
// telefono = "34693869667"  ← sin + ni espacios
```

## Prefijos incluidos

España, México, Argentina, Colombia, Chile, Perú, Uruguay, Paraguay, Bolivia, EE.UU./Canadá, Reino Unido, Francia, Alemania, Italia, Portugal.
