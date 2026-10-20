# Emotional

Un espacio estático para descubrir música y videos. HTML, CSS y JavaScript sin framework, backend, cuentas, base de datos ni paso de compilación. Los 44 videos únicos del catálogo original se conservan.

## Usar y publicar

Sirve la carpeta del repositorio con cualquier servidor estático, por ejemplo `python -m http.server 8000`, y abre `http://localhost:8000`. GitHub Pages puede publicar directamente la raíz de la rama principal. Las rutas de recursos son relativas para funcionar también bajo `/emotional-/`.

## Funciones

- Categorías enlazables mediante `?category=spanish`, `english`, `hope`, `tiktok` o `favorites`.
- Búsqueda por categoría, idioma y creador; orden inicial estable y mezcla voluntaria.
- Favoritos guardados en `localStorage` de este navegador, con alternativa temporal si el navegador bloquea el almacenamiento. Se pueden borrar desde Privacidad y contenido.
- Carga por lotes independiente por categoría, carruseles adaptables y navegación con teclado.
- Un único reproductor en un diálogo nativo. YouTube se carga solo al reproducir; errores, espera limitada, reintento y enlace externo. TikTok usa tarjetas locales sin peticiones oEmbed.
- Cierre con Escape y al ocultar la página; limpieza del reproductor al cerrar.
- Animaciones y microinteracciones con alternativa `prefers-reduced-motion`.
- QR de Yape original, enlaces sociales y explicación de privacidad.

## Archivos

- `index.html`: estructura, textos y diálogos.
- `assets/styles.css`: diseño, componentes y animaciones.
- `assets/catalog.js`: identificadores originales de YouTube y pares `{ id, user }` de TikTok.
- `assets/app.js`: catálogo, filtros, favoritos y reproductor.
- `tests/browser.test.cjs`: pruebas de navegador con plataformas externas simuladas.

Para añadir videos, edita los arreglos de `assets/catalog.js`. Los duplicados se eliminan por ID dentro de cada categoría. Los títulos de canciones siguen siendo etiquetas descriptivas numeradas porque el catálogo original no contiene títulos verificados. La búsqueda no busca letras ni títulos reales de canciones.

## Verificación

Con Node.js 24 y pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm run check
pnpm test
```

Las pruebas levantan su propio servidor local. Comprueban favoritos persistentes, búsqueda, conservación de lotes, errores y carga tardía de YouTube, cierre con teclado, foco del modal, almacenamiento bloqueado y ausencia de desbordamiento horizontal a 320, 375, 768 y 1440 px. Las plataformas externas se simulan para que los tests no dependan de su red o disponibilidad.

Opcional: `BROWSER_EXECUTABLE` permite usar un Chromium/Edge instalado y `SCREENSHOT_DIR` guarda capturas. La reproducción real, restricciones regionales y disponibilidad del catálogo requieren comprobación manual en YouTube/TikTok. Un evento `load` de TikTok no garantiza que el video pueda reproducirse; el enlace externo está siempre disponible.

## Privacidad y contenido

No hay analítica propia. Las miniaturas de YouTube hacen conexiones a sus servidores; reproducir carga servicios externos. Los favoritos no se sincronizan entre dispositivos. Los videos pertenecen a sus autores. El QR original se conserva: comprueba el destinatario real antes de usarlo. No se incorpora una licencia de terceros sin decisión del propietario del repositorio.
