# incidencias/fotos/ — Subida de fotos de incidencias

## Para qué sirve

Permite a un inquilino subir fotos de una incidencia sin necesidad de tener cuenta. Accede mediante un enlace con token único enviado por WhatsApp.

**URL**: `https://automanize.com/incidencias/fotos/?token=<uuid>`

## Lógica

- El token es un `token_fotos` (uuid) almacenado en la tabla `incidencias`.
- El enlace lo genera n8n cuando se crea la incidencia y se envía al inquilino por WhatsApp.
- Las fotos se suben a Google Drive (carpeta de la incidencia).
- La tabla `incidencias` tiene `drive_folder_id` y `drive_folder_url` para saber dónde subir.
