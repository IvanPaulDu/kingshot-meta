/*
 * forge.js — Arranque: se fabrica todo el material y se cede el paso.
 *
 * Esta escena solo corre una vez. Deja el perfil y el reproductor de sonido en
 * el registro del juego, que sobrevive a los cambios de escena.
 */
(function (global) {
  'use strict';

  function ForgeScene() {
    global.Phaser.Scene.call(this, { key: 'forge' });
  }

  ForgeScene.prototype = Object.create(global.Phaser.Scene.prototype);
  ForgeScene.prototype.constructor = ForgeScene;

  ForgeScene.prototype.create = function () {
    global.Artwork.build(this);
    global.SoundForge.build(this);

    this.cache.bitmapFont.add('numerals',
      global.Phaser.GameObjects.RetroFont.Parse(this, global.Artwork.numeralAtlas()));

    var profile = new global.Profile();
    profile.load();
    var jukebox = new global.Jukebox(this, profile);
    jukebox.syncMusic();

    this.registry.set('profile', profile);
    this.registry.set('jukebox', jukebox);
    global.Vaiven.profile = profile;
    global.Vaiven.jukebox = jukebox;

    this.scene.start('title');
  };

  global.ForgeScene = ForgeScene;

})(window);
