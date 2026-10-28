# Casa Piloto

Demostración inmobiliaria con Astro: recorrido continuo por salón, baño y cocina, ficha comercial y solicitud de visita simulada.

- Web: https://guillermocmspain.github.io/casa-piloto/
- Repositorio: https://github.com/guillermocmspain/casa-piloto
- Local con Apache/XAMPP: http://localhost/Astro-webs/casa-piloto/

## Desarrollo

Requiere Node 24. Ejecuta `npm ci` y `npm run dev` desde la carpeta del repositorio.

- `npm run check`: comprobación de tipos de Astro y TypeScript.
- `npm test`: pruebas del movimiento, descarga completa, progreso, cancelación y fallos de red.
- `npm run build`: compilación estática.
- `npm run publish:local`: copia `dist` a `C:/xampp/htdocs/Astro-webs/casa-piloto`.

Cada push a `main` ejecuta comprobaciones, compila y publica mediante GitHub Actions. El workflow configura `ASTRO_BASE=/casa-piloto/` y `ASTRO_SITE=https://guillermocmspain.github.io`. El build local conserva `/Astro-webs/casa-piloto/`.

En GitHub Desktop se puede añadir esta carpeta con File → Add local repository. Commit y Push origin activan el despliegue automático.

## Recorrido y primera carga

El recorrido utiliza un MP4 H.264 preparado para búsquedas rápidas: 30 fps, un fotograma clave cada tres fotogramas, sin B-frames, sin sonido y sin metadatos del original. El perfil de escritorio conserva 1920×1080 (37,83 MB). En móvil vertical se descarga un recorte de 720×1080 (17,49 MB), manteniendo la altura nativa del original y el encuadre estable.

Antes de activar el scroll se descarga por completo un solo perfil. El loader mide bytes recibidos, muestra la preparación del primer fotograma y permite pasar directamente a la ficha. La descarga tiene cancelación, límite de espera, detección de respuestas incompletas y reintento. Si el navegador requiere un gesto para preparar el vídeo, aparece el botón de entrada. Con ahorro de datos, movimiento reducido o sin JavaScript se ofrece la versión con fotos.

El archivo se reproduce desde una URL Blob local al navegador. Durante el recorrido no se solicitan fotogramas a la red ni se mantienen centenares de imágenes descomprimidas. El vídeo lo presenta el compositor del navegador. Solo se permite una búsqueda de tiempo simultánea; los siguientes movimientos de la rueda se agrupan para buscar siempre la posición más reciente. El suavizado de 120 ms se mantiene y los textos siguen el fotograma presentado mediante requestVideoFrameCallback, con alternativa para navegadores antiguos.

La reproducción completa reutiliza el Blob ya cargado en escritorio. En móvil, si se abre el vídeo completo, se solicita la versión horizontal. La caché HTTP del navegador puede evitar la descarga en una siguiente visita; no se depende de ella para funcionar en la primera.

## Archivos

- `src/pages/index.astro`: contenido, vídeo, loader y diálogos.
- `src/styles/global.css`: diseño responsive y loader.
- `src/scripts/tour.ts`: carga, interacción y reproducción.
- `src/scripts/download-video.mjs`: descarga completa y progreso real.
- `src/scripts/scroll-motion.mjs`: avance continuo, suavizado y ventanas de texto.
- `src/data/tour-media.json`: archivos, tamaños y resoluciones.
- `scripts/prepare-tour.mjs`: generación de los dos perfiles desde el original.

Para regenerar: `node scripts/prepare-tour.mjs 'ruta/al/video-original.MOV'`. Al cambiar el vídeo, revisar encuadre, duración y momentos de aparición de textos. Cambiar la versión de los nombres de medios para evitar reutilizar copias antiguas en caché. El script anterior `prepare-media.mjs` se conserva como referencia del sistema de secuencias, pero no es necesario para esta versión.

Los antiguos fotogramas y MP4 se han conservado localmente en `inspection/legacy-media`, fuera de `public` y del repositorio actual. No forman parte de los nuevos despliegues. `node_modules`, capturas de pruebas, MOV original y variables de entorno tampoco se publican.

## Investigación

Astro copia los archivos de `public` sin transformarlos; no precarga ni optimiza una secuencia de vídeos por sí solo. Se usa el soporte de scripts cliente de Astro junto con APIs nativas del navegador:

- https://docs.astro.build/en/guides/images/
- https://docs.astro.build/en/guides/client-side-scripts/
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback

## Datos y verificación

Precio, superficies y características comerciales son ilustrativos, no un anuncio verificado. El formulario no envía mensajes, no guarda datos y no reserva visitas reales.

Pruebas automáticas de avance sin congelaciones, inversión inmediata, suavizado sin sobrepasar el destino, equivalencia 60/120 Hz, correspondencia de textos, bytes recibidos, respuestas truncadas, HTTP 503 y cancelación. Pruebas de navegador con servidor local sin caché y transferencia limitada a unos 2 MB/s, loader, fallo inicial y reintento. Las capturas y el servidor de prueba quedan en `inspection` y no se suben. No se ha probado en un iPhone físico; las prestaciones finales dependen del dispositivo y navegador.
