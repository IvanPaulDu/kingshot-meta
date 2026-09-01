# Vaivén

Juego de puntería y color para Android. Una esfera cae sobre un deflector
inclinado que la manda a una de las dos columnas laterales; se puntúa cuando la
columna es del mismo color que la esfera.

Va escrito en JavaScript sobre Phaser 3 con física Matter, y se empaqueta como
aplicación nativa con Capacitor. **No hay ningún fichero de imagen, fuente ni
sonido en el proyecto**: la gráfica se pinta con Canvas 2D y el audio se
sintetiza con Web Audio, todo al arrancar. Los únicos binarios son los iconos de
lanzador que exige Android, y también salen de un guion de dibujo.

## Estructura

```
www/
  index.html
  css/app.css               Pantalla completa, safe-area, aviso de orientación
  vendor/phaser.min.js      Phaser 3.20.1 (MIT); ver vendor/README.md
  js/
    chroma.js               Muestrario de siete colores y sorteo sin repetición
    frame.js                Anclajes de composición sobre un lienzo elástico
    profile.js              Perfil del jugador, versionado, en localStorage
    artwork.js              Recetas de dibujo de las 28 imágenes
    soundforge.js           Síntesis de los efectos y del bucle musical
    jukebox.js              Único punto por el que suena el juego
    backdrop.js             Telón de franjas en movimiento
    widgets.js              Deslizadores, interruptor, botones y capa flotante
    scenes/forge.js         Arranque: fabrica el material y cede el paso
    scenes/title.js         Portada, récord y panel de opciones
    scenes/rally.js         La partida
    main.js                 Configuración, ajuste a la pantalla, sonda de pruebas
    shell.js                Gestos, orientación, audio y botón atrás del teléfono
android/                    Proyecto nativo generado por Capacitor
tools/
  checkup.js                Revisión automática en Chromium
  icons.js                  Dibuja los iconos de lanzador y el logotipo de arranque
  keystore.sh               Crea el almacén de claves de publicación
```

## Compilar

Requisitos: Node 20 o superior, JDK 17 o 21, Android SDK con la plataforma 35.

```bash
npm install
export ANDROID_HOME=/ruta/al/android-sdk

npm run apk:debug      # android/app/build/outputs/apk/debug/app-debug.apk
npm run apk:release    # android/app/build/outputs/apk/release/app-release.apk
```

El APK de publicación sale firmado si antes se ejecuta `tools/keystore.sh`, que
crea `android/upload.jks` y `android/keystore.properties`. Ninguno de los dos se
versiona: son secretos, y perder la clave impide publicar actualizaciones.

Para probar en el navegador: `npm run serve` y abrir `http://localhost:8123`.
Para pasar la revisión automática: `npm test`, con el servidor levantado.

## Cómo se juega

- La esfera espera arriba hasta que el jugador toca la pantalla.
- Dos mandos inclinan el deflector: uno la manda a la derecha, otro a la
  izquierda. También sirven las flechas del teclado.
- Acertar la columna del color de la esfera suma un punto; fallar termina la
  partida.
- Cada dos puntos una de las columnas cambia de color, y la esfera se saca cada
  vez más rápido.

## Decisiones de implementación

### Lienzo elástico

El lienzo mantiene 320 px de ancho, de donde salen todas las medidas
horizontales, y calcula el alto con la proporción real de la pantalla, acotado
entre 420 y 800 px:

```
alto = 320 × (alto del visor ÷ ancho del visor)
```

Así el modo de escalado la llena entera, sin franjas ni recorte. Ninguna
posición está escrita a mano: `frame.js` las resuelve por nombre y todo se
recoloca solo. Las imágenes que ocupan el lienzo entero se rehacen si cambia la
proporción.

| Pantalla | Lienzo | Sobra |
|---|---|---|
| Tableta 3:4 (768×1024) | 320×427 | 0,6 px |
| Móvil 16:9 (360×640) | 320×569 | 0,1 px |
| Móvil 19,5:9 (390×844) | 320×693 | 0,3 px |
| Móvil 20:9 (412×915) | 320×711 | 0,2 px |

El visor todavía crece un poco tras el arranque, cuando Android oculta las
barras de sistema. `Vaiven.refit()` recalcula y rehace la portada, pero nunca en
plena partida. Tras `scale.resize()` hay que refijar la proporción con
`displaySize.setAspectRatio()` y refrescar, o las franjas vuelven.

### Dificultad

La velocidad de saque sube con el marcador siguiendo una curva que se satura,

```
v(n) = 14 × (1 − e^(−n/60))
```

rápida al principio y cada vez más plana, en lugar de subir a tramos.

### Telón de fondo

Las franjas giran y se pasean sobre el centro, así que el bloque se dimensiona
con la diagonal del lienzo más el diámetro del paseo. Si no, al girar asoman las
esquinas. La revisión automática lo comprueba por partida doble: la cobertura
geométrica y un muestreo de los píxeles de las cuatro esquinas.

### Sonido

Cuatro piezas descritas como listas de eventos (cuándo, qué nota, qué timbre,
qué envolvente) que un único paso de render mezcla en un búfer. El bucle son
cuatro compases en re menor a 112 pulsos por minuto con bajo, arpegio, batería y
colchón. El búfer se inyecta en la caché de audio de Phaser; si el dispositivo
no tuviera Web Audio se cae a etiquetas `<audio>` con un WAV incrustado.

### Opciones

El engranaje de la portada abre un panel con volumen de música y de efectos
(0 – 100 % en pasos del 5 %, para poder fijar los extremos con el dedo),
velocidad en cinco pasos de 0,70× a 1,30× —que escala el reloj de la simulación,
no la gravedad—, mandos reflejados y acceso al tutorial cuantas veces se quiera.
Todo se guarda en un registro versionado en `localStorage`.

Al reflejar los mandos se intercambian su función **y** su icono, de modo que el
dibujo sigue diciendo la verdad sobre hacia dónde saldrá la esfera: lo que
cambia de sitio es el mando, no el significado.

## Configuración de Android

- Vertical fijo, modo inmersivo desde `MainActivity`, pantalla siempre encendida.
- `windowLayoutInDisplayCutoutMode=shortEdges` más `viewport-fit=cover` y
  `env(safe-area-inset-*)` en el CSS, para teléfonos con muesca.
- Sin permiso de INTERNET: todo se sirve desde los recursos locales.
- `minSdk 23`, `compileSdk` y `targetSdk 35`.
- Identificador `com.ipduarte.vaiven`. **Cámbialo por el tuyo antes de publicar**
  en `capacitor.config.json`, y vuelve a ejecutar `npx cap add android`.

## Origen y licencias

Todo el código, la gráfica, la tipografía del marcador y el sonido de este
repositorio se escribieron para este proyecto. La única dependencia de terceros
que se distribuye es Phaser 3.20.1, bajo licencia MIT, cuyo aviso de copyright
viaja en la cabecera del fichero (`www/vendor/`).

La mecánica de juego parte de un prototipo que aportó la persona propietaria del
proyecto. Las mecánicas y reglas de un juego no son en sí objeto de derechos de
autor, pero su presentación concreta sí puede serlo: antes de publicar conviene
confirmar qué derechos se tienen sobre ese prototipo.
