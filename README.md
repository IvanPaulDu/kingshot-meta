# Selektor — Phaser 3 → APK de Android

Réplica jugable del `game.js` original (Phaser 3.20 + Matter.js) empaquetada como
aplicación nativa de Android con Capacitor.

La carpeta `assets/` del proyecto original **no existe aquí**: las 24 imágenes, la
fuente bitmap del marcador y las 4 pistas de audio que el juego cargaba desde disco
se generan en tiempo de ejecución con Canvas 2D y Web Audio (`www/js/assets.js`),
bajo exactamente las mismas claves de caché. El resultado es un APK autocontenido
sin un solo fichero binario de recursos en el repositorio.

## Estructura

```
www/                      La app web que se empaqueta
  index.html              Envoltura móvil (viewport, pantalla completa, favicon en línea)
  css/style.css           Estilos responsivos, safe-area, aviso de orientación
  js/phaser.min.js        Phaser 3.20.1 (el mismo build que usaba el original)
  js/assets.js            Generación procedural de texturas, fuente y sonidos
  js/settings.js          Ajustes persistentes y su menú (deslizadores, interruptor)
  js/game.js              El game.js original, con el preload sustituido
  js/mobile.js            Gestos, orientación, desbloqueo de audio, botón atrás
android/                  Proyecto nativo generado por Capacitor
capacitor.config.json     appId com.coreanodecalle.selektor, webDir www
tools/
  game.original.js        Fuente de referencia sin tocar
  smoke-test.js           Prueba de humo en Chromium (recursos, táctil, física)
  make-icons.js           Genera iconos de lanzador y splash por código
  make-keystore.sh        Crea el almacén de claves para firmar el release
```

## Compilar el APK

Requisitos: Node 20+, JDK 17 o 21, Android SDK con la plataforma 35.

```bash
npm install
export ANDROID_HOME=/ruta/al/android-sdk

npm run apk:debug      # android/app/build/outputs/apk/debug/app-debug.apk
npm run apk:release    # android/app/build/outputs/apk/release/app-release.apk
```

El APK de release sale firmado si antes se ha ejecutado `tools/make-keystore.sh`
(crea `android/selektor-release.jks` y `android/keystore.properties`, ambos fuera
del control de versiones). Sin ese paso, Gradle produce el APK sin firmar.

Para probar en el navegador: `npm run serve` y abrir `http://localhost:8123`.
Para pasar la prueba de humo: `npm test` (necesita el servidor levantado).

## Qué se generó por código

### Texturas (`www/js/assets.js`)

Cada clave conserva el nombre y unas dimensiones compatibles con la lógica del
juego, porque el código original calcula posiciones a partir de `.width` / `.height`
y el cuerpo físico de la bola sale de `setCircle()` (radio = ancho/2).

| Clave | Tamaño | Notas |
|---|---|---|
| `titulo` | 300×160 | Logotipo con las 7 fichas de la paleta |
| `pala`, `pala_sombra` | 92×16 | El rectángulo Matter que desvía la bola |
| `bola`, `bola_sombra` | 28×28 | Blanca, para que `setTint()` dé el color exacto |
| `pared_derecha`, `pared_izquierda` | 24×64 | Blancas puras; el juego las estira y tiñe |
| `flecha_derecha`, `flecha_izquierda` | 74×74 | Controles de giro |
| `start_button` | 200×64 | |
| `copa` | 140×48 | La cifra del récord se dibuja a la derecha del trofeo |
| `cierre_final`, `tutorial_back` | lienzo completo | Se rehacen si cambia el tamaño |
| `smash_button` | 100×100 | Indicador "toca aquí" |
| `flecha_tuto` | 160×160 | Arco de giro; envuelve la pala sin taparla |
| `destello` | 160×40 | Se tiñe del color de la bola al puntuar |
| `particula_estrella` | 24×24 | Partículas del choque |
| `bocina_on/off`, `info_button`, `ajustes_button` | 48×48 | |
| `ui_panel` | 296×352 | Fondo del menú de ajustes |
| `ui_track`, `ui_knob` | 232×12, 28×28 | Deslizadores (el relleno se recorta) |
| `ui_boton` | 200×42 | Botones del panel |
| `ui_switch_on/off`, `ui_switch_knob` | 62×32, 24×24 | Interruptor |
| `info_about` | 280×212 | Panel con hueco para los botones sociales |
| `fb_button`, `insta_button` | 33×33 | El original usaba `f_logo_33.png` |
| `score_font` | 340×48 | 10 dígitos en celdas de 34×48 |

`tutorial_back` es un degradado sin texto a propósito: el juego reutiliza la misma
imagen con `setFlipX(true)` para el tutorial izquierdo, y cualquier texto saldría
del revés.

### Fuente del marcador

`score_font_json` se inyecta en la caché JSON con el formato que espera
`Phaser.GameObjects.RetroFont.Parse` (`image`, `width`, `height`, `chars`,
`charsPerRow`, `offset`, `spacing`), igual que el `font.json` original.

### Audio

Se sintetizan las muestras y se registra el `AudioBuffer` directamente en la caché
de audio, que es lo que consume `Phaser.Sound.WebAudioSound`. Si el dispositivo no
tuviera Web Audio, se cae a etiquetas `<audio>` con un WAV en data-URI.

- `bounce_sound` — golpe contra la pala (seno con barrido descendente)
- `drop` — acierto de color (blip de dos notas)
- `crash_sound` — fallo (ruido más caída de tono)
- `bg_music` — bucle de 8 s a 120 BPM: bajo, arpegio, bombo, caja, charles y
  colchón sobre la progresión Am–F–C–G

### Iconos y splash

`tools/make-icons.js` dibuja el icono en un canvas dentro de Chromium y vuelca los
PNG: `ic_launcher`, `ic_launcher_round` e `ic_launcher_foreground` (icono adaptativo,
contenido dentro de la zona segura del 66 %) en las cinco densidades, más el
logotipo del splash. `drawable/splash.xml` lo compone sobre el color de marca.

## Ajuste a la pantalla

El lienzo **no es de 320x480 fijo**. Conserva 320 px de ancho, que es de donde
salen todas las medidas horizontales del juego (separación de las paredes, largo
de la pala y recorrido de la bola hasta cada lado), y calcula el alto con la
proporción real de la pantalla, acotado entre 420 y 800 px:

```
alto = 320 x (alto del visor / ancho del visor)
```

Con eso, `Scale.FIT` llena la pantalla entera: ni barras negras ni recorte. Como
todas las posiciones del juego original se derivan de `config.width` y
`config.height`, la distribución se reajusta sola.

| Pantalla | Lienzo | Sobra |
|---|---|---|
| Tableta 3:4 (768x1024) | 320x427 | 0,6 px |
| Móvil 16:9 (360x640) | 320x569 | 0,1 px |
| Móvil 19,5:9 (390x844) | 320x693 | 0,3 px |
| Móvil 20:9 (412x915) | 320x711 | 0,2 px |

Detalles:

- `cierre_final` y `tutorial_back` se generan con el tamaño real del lienzo, y
  `tex()` rehace cualquier textura cuyo tamaño haya cambiado.
- El visor todavía crece un poco después de arrancar, cuando Android oculta las
  barras del sistema. `window.ajustarLienzo()` recalcula el alto y rehace la
  escena, **solo desde el menú**: en plena partida se ignora para no perder la
  puntuación. Tras `scale.resize()` hay que refijar la proporción con
  `displaySize.setAspectRatio()` y refrescar, o vuelven a aparecer las barras.
- El `padding` de `env(safe-area-inset-*)` del `body` entra en el cálculo, así
  que en móviles con muesca el lienzo queda por debajo de ella.
- En pantallas más altas la bola cae desde más arriba: da algo más de margen de
  reacción y llega con más velocidad a la pala. Se compensa solo bastante bien,
  y en todo caso está el ajuste de velocidad.

## Menú de ajustes

El engranaje del menú principal (junto a la bocina) abre un panel con:

| Ajuste | Rango | Efecto |
|---|---|---|
| Música | 0–100 % en pasos del 5 % | Volumen del bucle de fondo, en vivo |
| Efectos | 0–100 % en pasos del 5 % | Volumen de rebote, acierto y choque |
| Velocidad | 5 pasos, de «Muy lenta» a «Muy rápida» | 0,70× a 1,30× |
| Invertir controles | Sí / no | Intercambia los dos botones de giro |
| VER TUTORIAL | — | Repite el tutorial cuando se quiera |

Detalles que no se ven en la tabla:

- **Música y bocina son el mismo valor.** El icono de la bocina refleja si el
  volumen es mayor que cero, y al pulsarlo se silencia recordando el nivel
  anterior para restaurarlo. Bajar el deslizador a 0 % apaga el icono.
- **Los efectos suenan mientras se ajustan**: al mover el deslizador se
  reproduce el sonido de acierto al volumen elegido.
- **La velocidad escala `engine.timing.timeScale` de Matter**, así que afecta
  por igual a la caída, al rebote y al recorrido hasta la pared, sin tocar la
  progresión de dificultad original (`velocidadY += 0.2` por punto).
- **Al invertir los controles se intercambian la función y el icono** de los dos
  botones: el de la izquierda pasa a mostrar «→» y a desviar la bola hacia la
  derecha. Así el jugador sigue viendo hacia dónde saldrá la bola, y quien
  prefiera ese gesto bajo el otro pulgar puede cambiarlo. El teclado sigue la
  misma inversión y los tutoriales resaltan el botón que toca en cada caso.
- **El tutorial a demanda encadena sus dos partes** (desviar a la derecha y
  luego a la izquierda) aunque el récord esté muy por encima del umbral de 4
  puntos con el que aparece automáticamente la primera vez.

Todo se guarda en el mismo registro `selektorFile` de localStorage. Los
registros antiguos, que solo tenían `bestScore` y `musicStatus`, se siguen
leyendo: los ajustes que falten toman su valor por omisión.

## Cambios respecto al `game.js` original

La lógica de juego —física, estados, puntuación, colores, rotación de la pala,
colisiones, interfaz y los dos tutoriales— está intacta. Solo se tocó lo mínimo
para que funcione sin ficheros externos y en un teléfono:

1. **`preload`**: las llamadas a `this.load.image/audio/json` se sustituyen por
   `SelektorAssets.generate(this)`. El sorteo inicial de colores de las paredes se
   mantiene tal cual.
2. **`musicConf` pasa a ámbito global**. En el original se declaraba con `var`
   dentro de `if (bgMusic == 0)`, que solo se cumple la primera vez; tras reiniciar
   la escena el botón de bocina llamaba a `bgMusic.play(undefined)` y perdía el
   `loop: true`. Ahora la configuración persiste.
3. **`scale`**: se añaden `autoCenter: CENTER_BOTH` y `parent: 'game-root'` al
   config, manteniendo `mode: FIT`. El lienzo sigue siendo de 320×480.
4. **`window.game = game`** al final del fichero: `let` no crea propiedad en
   `window`, y la envoltura móvil necesita la instancia.
5. **Tamaño del lienzo**: `width`/`height` del config salen de
   `altoSegunPantalla()` en lugar de ser 320x480 fijos, y se añade
   `window.ajustarLienzo()`. Ninguna posición del juego estaba escrita a mano,
   así que no hizo falta tocar la distribución.
6. **Ajustes** (añadido posterior): `loadFile`/`saveFile` delegan en
   `SelektorSettings`, el arranque de partida se extrae a `arrancarPartida()`
   para que lo compartan START y «VER TUTORIAL», los dos botones de giro se
   crean a partir de `invertControls`, y la condición del segundo tutorial pasa
   a `((bestScore<4)||tutorialForzado)`. La lógica de física, puntuación,
   colores y colisiones sigue intacta.

## Configuración de Android

- Orientación bloqueada en vertical (`android:screenOrientation="portrait"`).
- Modo inmersivo real desde `MainActivity`: se ocultan las barras de sistema
  (reaparecen al deslizar) y se mantiene la pantalla encendida.
- `windowLayoutInDisplayCutoutMode=shortEdges` más `viewport-fit=cover` y
  `env(safe-area-inset-*)` en el CSS, para teléfonos con muesca.
- Sin permiso de INTERNET: todo se sirve desde los assets locales.
- `minSdk 23`, `compileSdk`/`targetSdk 35`.
