# Casa Piloto

Web inmobiliaria de demostración creada con Astro. El vídeo aportado se transforma en un recorrido continuo de scroll por salón, baño y cocina, con textos sobre cada estancia y una ficha inmobiliaria inferior.

## Abrir

Web pública: https://guillermocmspain.github.io/casa-piloto/

Repositorio: https://github.com/guillermocmspain/casa-piloto

Con Apache/XAMPP iniciado: http://localhost/Astro-webs/casa-piloto/

- Código fuente: la carpeta donde clones este repositorio.
- Web compilada servida por Apache: `C:/xampp/htdocs/Astro-webs/casa-piloto`.
- No hace falta mantener Node ejecutándose para visitar la versión de Apache.

## Desarrollo y actualización

Desde la carpeta de código fuente:

```powershell
npm install
npm run dev
```

Para actualizar la web de Apache después de editar:

```powershell
npm run build
npm run publish:local
```

El script copia `dist` únicamente a la carpeta de esta web. No cambia la configuración de Apache ni otros proyectos.

## Publicación en GitHub Pages

Cada push a `main` ejecuta las pruebas, compila Astro y publica `dist` mediante GitHub Actions. El estado se ve en la pestaña Actions del repositorio. La configuración local mantiene `/Astro-webs/casa-piloto/`; el workflow utiliza `ASTRO_BASE=/casa-piloto/` y `ASTRO_SITE=https://guillermocmspain.github.io` para la versión pública.

Se puede abrir este repositorio local desde GitHub Desktop con **File → Add local repository**. Después de editar, crear un commit y pulsar **Push origin** publica los cambios automáticamente cuando termina el workflow. También se puede usar Git desde terminal.

No se suben `node_modules`, compilaciones, capturas de pruebas, variables de entorno, el MOV original ni las versiones antiguas de los medios. El repositorio incluye los fotogramas y el MP4 Full HD necesarios para que la demostración sea reproducible sin el vídeo original.

## Contenido y recorrido

- `src/pages/index.astro`: textos, ficha comercial, paradas, galería y diálogos.
- `src/styles/global.css`: diseño, capa oscura y adaptación responsive.
- `src/scripts/tour.ts`: sincronización del scroll, carga de imágenes y diálogos.
- `src/scripts/scroll-motion.mjs`: avance continuo, suavizado temporal y selección de textos según el fotograma visible.
- `public/media`: imágenes y vídeo optimizados. Las fuentes tipográficas se sirven localmente a través de Fontsource.

El vídeo original `IMG_5888.MOV` dura 33,76 segundos y no se modifica. La versión actual utiliza fotogramas WebP a 30 fps y 1920×1080, calidad 84. Se conserva la resolución del original sin inventar detalle. La página solicita fotogramas próximos y anticipa la dirección y velocidad del scroll, con un máximo de cinco cargas simultáneas y una caché de 14 imágenes en móvil o 20 en escritorio. El navegador puede conservar su propia caché adicional. La versión anterior se conserva en disco como respaldo, pero ya no se solicita.

No hay tramos congelados. La posición de scroll se convierte de forma continua en tiempo de vídeo y un filtro exponencial de 120 ms suaviza los impulsos de la rueda, tanto al avanzar como al retroceder. Cuanto más rápido se desplaza el visitante, más rápido avanza la secuencia. Al soltar se estabiliza rápidamente y el bucle de animación deja de trabajar. Los textos siguen el fotograma efectivamente dibujado para evitar anunciar una estancia antes de que su imagen llegue. El recorte móvil permanece constante, sin saltos laterales artificiales.

El MP4 Full HD a 30 fps (CRF 19) se carga solo al pulsar «Ver vídeo completo». Se publica sin sonido ni metadatos del archivo original. Con movimiento reducido, ahorro de datos o sin JavaScript se presenta una versión de secciones con fotografías. No se necesita backend.

Para regenerar medios (si se sustituye el vídeo también hay que revisar los tiempos de parada):

```powershell
node scripts/prepare-media.mjs 'ruta/al/video-original.MOV'
```

## Datos de demostración

El precio, las superficies, la ubicación genérica y las características comerciales son ilustrativos. No constituyen un anuncio verificado. El formulario simula una solicitud en el navegador; no envía mensajes, no guarda datos y no confirma reservas reales. Antes de convertirlo en un anuncio real hay que sustituir y verificar estos datos y conectar un canal de contacto.

## Verificación

Build de Astro correcto; página y medios servidos por Apache. Revisados en navegador a 1440×900 y 390×844: navegación entre paradas, vuelta al inicio, ficha inferior, reproducción MP4, apertura/cierre de diálogos y envío simulado. Sin errores de consola durante estas pruebas. No se han realizado pruebas en un iPhone físico ni con red móvil limitada.

`node --test scripts/scroll-motion.test.mjs` comprueba el avance sin congelaciones en las tres estancias, el suavizado sin sobrepasar el destino, la inversión del scroll, la equivalencia entre pantallas de 60/120 Hz y la sincronización de los accesos a cada estancia.
