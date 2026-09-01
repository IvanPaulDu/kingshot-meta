/*
 * main.js — Configuración y arranque.
 *
 * El lienzo mantiene 320 px de ancho, que es de donde salen todas las medidas
 * horizontales del juego, y calcula el alto con la proporción real de la
 * pantalla. Así el modo de escalado la llena entera: ni franjas ni recorte.
 */
(function (global) {
  'use strict';

  var DESIGN_WIDTH = 320;
  var MIN_HEIGHT = 420;    // más ancho que 4:3
  var MAX_HEIGHT = 800;    // más alto que 21:9

  function stageHeight() {
    var box = document.getElementById('stage');
    var rect = box ? box.getBoundingClientRect() : null;
    var w = (rect && rect.width) || global.innerWidth || DESIGN_WIDTH;
    var h = (rect && rect.height) || global.innerHeight || 480;
    var proposed = Math.round(DESIGN_WIDTH * (h / w));
    return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, proposed));
  }

  global.Vaiven = {
    game: null,
    profile: null,
    jukebox: null,

    /**
     * Reajusta el lienzo cuando cambia el visor: al arrancar, Android oculta
     * las barras del sistema y la ventana crece. Solo se aplica en la portada,
     * porque rehacer la escena en plena partida perdería la puntuación.
     */
    refit: function () {
      var game = global.Vaiven.game;
      if (!game || !game.isBooted) { return false; }

      var height = stageHeight();
      if (Math.abs(height - game.config.height) < 3) { return false; }

      var title = game.scene.getScene('title');
      if (!title || !game.scene.isActive('title')) { return false; }

      game.config.height = height;
      game.scale.resize(DESIGN_WIDTH, height);
      // resize() deja el tamaño mostrado con la proporción anterior y volverían
      // a salir franjas: hay que refijar la proporción y refrescar.
      game.scale.displaySize.setAspectRatio(DESIGN_WIDTH / height);
      game.scale.refresh();

      global.Artwork.build(title);      // rehace lo que ocupa el lienzo entero
      title.scene.restart();
      return true;
    },

    /** Estado observable, para las pruebas automáticas. */
    probe: function () {
      var game = global.Vaiven.game;
      var live = game.scene.getScenes(true);
      var top = live[live.length - 1];
      var snap = (top && top.snapshot) ? top.snapshot()
        : { scene: top ? top.scene.key : null };
      snap.canvas = { width: game.config.width, height: game.config.height };
      if (top && top.backdrop) { snap.backdrop = top.backdrop.coverage(); }
      return snap;
    }
  };

  var config = {
    type: global.Phaser.AUTO,
    width: DESIGN_WIDTH,
    height: stageHeight(),
    backgroundColor: global.Chroma.INK,
    physics: {
      default: 'matter',
      matter: { gravity: { y: 1 } }
    },
    scene: [global.ForgeScene, global.TitleScene, global.RallyScene],
    scale: {
      mode: global.Phaser.Scale.FIT,
      autoCenter: global.Phaser.Scale.CENTER_BOTH,
      parent: 'stage'
    }
  };

  global.Vaiven.game = new global.Phaser.Game(config);

})(window);
