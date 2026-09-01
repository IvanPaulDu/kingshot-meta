//create a new scene
let gameScene = new Phaser.Scene('Game');
newBest=false;
bgMusic=0;
musicConf=null;
//Tutorial lanzado a mano desde los ajustes (se repite tantas veces como haga falta)
tutorialForzado=false;
panelAjustes=null;
volumenMusicaPrevio=0.8;

// initiate scene parameters
gameScene.init = function(){
  currentStateList=['onMenu','actionPhase','isTerminating','onCreate'];
  currentState=0;
  center_width=this.sys.game.config.width/2;
  center_height=this.sys.game.config.height/2;
  one_third_height=this.sys.game.config.height/3;

  colors=[
//    red=0xff0000,
    red=0xff2a36,
//    green=0x00ff00,
    green=0x6aca32,
//    blue=0x0000ff,
    pink=0xffa9bd,
//    yellow=0xffff00,
    yellow=0xf4c329,
//    cyan=0x00ffff,
    cyan=0x5e97d6,
//    magenta=0xff00ff,
    magenta=0xb44ea4,
//    white=0xffffff
    aqua=0x36f1e6];

  score=0;
  bgx=0.0;
  velocidadY=0;
  onTutorial=0;
  musicStatus=1;
  muestraAbout=false;
  muestraAjustes=false;
  esperandoSaque=false;
  rebotePala=false;
  this.loadFile();
};

//load assets
//Todos los recursos (imágenes, fuente bitmap y audio) se generan por código
//en assets.js, con las mismas claves de caché que usaba la carpeta assets/.
gameScene.preload = function(){
  SelektorAssets.generate(this);

  colorIzquierda=Phaser.Math.Between(0,6);
  colorDerecha=Phaser.Math.Between(0,6);
  while (colorDerecha==colorIzquierda){
    colorDerecha=Phaser.Math.Between(0,6);
}
//console.log('preload completo');
};

//called once after preload
gameScene.create = function(){
  if(currentStateList[currentState]=='onMenu'){
    gameScene.backgroundAnim();
    titulo=this.add.image(center_width,one_third_height-70,'titulo');
    startButton=this.add.image(center_width,center_height,'start_button').setInteractive();
    bocinaOn=this.add.image(1000,1000,'bocina_on').setInteractive();
    bocinaOff=this.add.image(1000,1000,'bocina_off').setInteractive();
    escenaMenu=this;
    infoButton=this.add.image(1000,1000,'info_button').setInteractive();
    ajustesButton=this.add.image(1000,1000,'ajustes_button').setInteractive();
    ajustesButton.x=(ajustesButton.width/2)+5+52;
    ajustesButton.y=this.sys.game.config.height-(ajustesButton.height/2)-5;
    infoButton.x=this.sys.game.config.width-(infoButton.width/2)-3;
    infoButton.y=this.sys.game.config.height-(infoButton.height/2)-3;
    infoAbout=this.add.image(0,0,'info_about').setOrigin(0,0);
    fbButton=this.add.image(0,0,'fb_button');
    fbButton.x=(infoAbout.width/2)+35;
    fbButton.y=(infoAbout.height/2)+35;
    instaButton=this.add.image(0,0,'insta_button');
    instaButton.x=fbButton.x+(fbButton.width*1.4);
    instaButton.y=fbButton.y;
    grupoAbout=this.add.container(center_width-(infoAbout.width/2),center_height-(infoAbout.height/2),[infoAbout,fbButton,instaButton]);
    grupoAbout.setAlpha(0);
    fbButton.on('pointerup',()=>{window.open("http://www.facebook.com/coreanodecalle","_blank");});
    instaButton.on('pointerup',()=>{window.open("http://www.instagram.com/coreanodecalle","_blank");});

    if(bgMusic==0){
    bgMusic=this.sound.add('bg_music');
    musicConf={
      mute:false,
      volume:SelektorSettings.values.musicVolume,
      rate:1,
      detune:0,
      seek:0,
      loop: true,
      delay:0
    }
  }
    //La bocina y el deslizador de música manejan el mismo valor: el icono
    //refleja si el volumen es mayor que cero.
    aplicarAudioMusica=function(){
      var vol=SelektorSettings.values.musicVolume;
      musicStatus=vol>0?1:0;
      musicConf.volume=vol;
      bgMusic.setVolume(vol);
      if(musicStatus==1){
        if(!bgMusic.isPlaying){bgMusic.play(musicConf);}
        bocinaOn.x=(bocinaOn.width/2)+5;
        bocinaOn.y=(game.config.height-(bocinaOn.height/2))-5;
        bocinaOff.x=1000;
      }else{
        bgMusic.stop();
        bocinaOff.x=(bocinaOff.width/2)+5;
        bocinaOff.y=(game.config.height-(bocinaOff.height/2))-5;
        bocinaOn.x=1000;
      }
    };
    aplicarAudioMusica();

    bocinaOn.on('pointerup',function(){
      volumenMusicaPrevio=SelektorSettings.values.musicVolume||0.8;
      SelektorSettings.values.musicVolume=0;
      SelektorSettings.save();
      aplicarAudioMusica();
    });
    bocinaOff.on('pointerup',function(){
      SelektorSettings.values.musicVolume=volumenMusicaPrevio||0.8;
      SelektorSettings.save();
      aplicarAudioMusica();
    });

    infoButton.on('pointerdown',function(){
      this.scene.tweens.add({
        targets:infoButton,
        scaleX:0.9,
        scaleY:0.9,
        duration:60,
        yoyo:true
      });
      muestraAbout=!muestraAbout;
      if(muestraAbout){
        startButton.disableInteractive();
        this.scene.tweens.add({
          targets: startButton,
          alpha: 0,
          duration: 100
        });
        this.scene.tweens.add({
          targets:grupoAbout,
          alpha:1,
          duration:100
        });
        fbButton.setInteractive();
        instaButton.setInteractive();}
      else{
        fbButton.disableInteractive();
        instaButton.disableInteractive();
        this.scene.tweens.add({
          targets: startButton,
          alpha: 1,
          duration: 100
        });
        this.scene.tweens.add({
          targets:grupoAbout,
          alpha:0,
          duration:100
        });
        startButton.setInteractive();
      };
    });

    //Un solo camino de arranque para el botón START y para "ver tutorial".
    arrancarPartida=function(){
      startButton.destroy();
      titulo.destroy();
      bocinaOn.destroy();
      bocinaOff.destroy();
      infoButton.destroy();
      ajustesButton.destroy();
      currentState=3;
      if(bestScore<4||tutorialForzado){onTutorial=1;}
    };

    startButton.once('pointerup',function(){
          this.scene.tweens.add(
              {
                  targets: startButton,
                  scaleX: 0.9,
                  scaleY: 0.9,
                  duration: 100,
                  yoyo: true,
                  onComplete: arrancarPartida,
              }
          );
        }
      );

    //Panel de ajustes: volúmenes, velocidad, controles y acceso al tutorial.
    previewSfx=this.sound.add('drop');
    panelAjustes=SelektorSettings.createPanel(this,{
      onMusicVolume:function(){aplicarAudioMusica();},
      onSfxVolume:function(v){
        previewSfx.setVolume(v);
        if(v>0&&!previewSfx.isPlaying){previewSfx.play();}
      },
      onTutorial:function(){
        tutorialForzado=true;
        panelAjustes.hide();
        arrancarPartida();
      },
      onToggle:function(abierto){
        muestraAjustes=abierto;
        var otros=[titulo,startButton,infoButton,ajustesButton,bocinaOn,bocinaOff];
        if(bestScore>0&&copa){otros.push(copa,scoreEnMenu);}
        otros.forEach(function(o){
          if(!o||!o.scene){return;}
          escenaMenu.tweens.add({targets:o,alpha:abierto?0:1,duration:120});
          if(abierto&&o.disableInteractive){o.disableInteractive();}
        });
        if(!abierto){
          startButton.setInteractive();
          infoButton.setInteractive();
          ajustesButton.setInteractive();
          bocinaOn.setInteractive();
          bocinaOff.setInteractive();
        }
      }
    });

    ajustesButton.on('pointerup',function(){
      if(panelAjustes.abierto){panelAjustes.hide();}else{panelAjustes.show();}
    });
    if (bestScore>0)
    {
      copa=this.add.image(center_width,this.sys.game.config.height-90,'copa');
      configScoreFontMenu = this.cache.json.get('score_font_json');
      this.cache.bitmapFont.add('score_font',Phaser.GameObjects.RetroFont.Parse(this,configScoreFontMenu));
      if (bestScore<10){
//        scoreEnMenu=this.add.bitmapText(center_width+60,this.sys.game.config.height-88,'score_font',bestScore);
        scoreEnMenu=this.add.bitmapText(center_width+22,this.sys.game.config.height-88,'score_font',bestScore);
      }else if((bestScore>=10)&&(bestScore<100)){
//        scoreEnMenu=this.add.bitmapText(center_width+43,this.sys.game.config.height-88,'score_font',bestScore);
        scoreEnMenu=this.add.bitmapText(center_width+22,this.sys.game.config.height-88,'score_font',bestScore);
      }else if(bestScore>=100){
        scoreEnMenu=this.add.bitmapText(center_width+26,this.sys.game.config.height-88,'score_font',bestScore);
      }
      scoreEnMenu.setOrigin(0.5);
      scoreEnMenu.setScale(0.5);
      this.scoreMenuAnim();
    }
  }
  if(currentStateList[currentState]=='onCreate'){
    if (bestScore>0){
      scoreEnMenu.destroy();
      copa.destroy();
    }
    currentState=1;
    //Velocidad: escala el tiempo de la simulación de Matter, así que afecta
    //por igual a la caída, al rebote y al recorrido hasta la pared.
    this.matter.world.engine.timing.timeScale=SelektorSettings.speedFactor();
    var volEfectos=SelektorSettings.values.sfxVolume;
    dropSound=this.sound.add('drop',{volume:volEfectos});
    crashSound=this.sound.add('crash_sound',{volume:volEfectos});
    bounceSound=this.sound.add('bounce_sound',{volume:volEfectos});
    let configScoreFont = this.cache.json.get('score_font_json');
    this.cache.bitmapFont.add('score_font',Phaser.GameObjects.RetroFont.Parse(this,configScoreFont));
    scoreText=this.add.bitmapText(1000,1000,'score_font',score).setOrigin(0.5,0.5);

  teclas=this.input.keyboard.createCursorKeys();

  //destello
  destello=this.add.image(1000,1000,'destello').setAlpha(0);

paredDerecha=this.add.image(0,0,'pared_derecha');
paredDerecha.x=this.sys.game.config.width-(paredDerecha.width/2);
paredDerecha.y=center_height;
paredDerecha.setDisplaySize(paredDerecha.width,this.sys.game.config.height);
paredDerecha.setTint(colors[colorDerecha]);

paredIzquierda=this.add.image(0,0,'pared_izquierda');
paredIzquierda.x=paredIzquierda.width/2;
paredIzquierda.y=center_height;
paredIzquierda.setDisplaySize(paredIzquierda.width,this.sys.game.config.height);
paredIzquierda.setTint(colors[colorIzquierda]);

//  pala=this.physics.add.staticGroup();
  pala=this.matter.add.image(center_width,one_third_height*2,'pala');
  pala.setDepth(2);
  palaSombra=this.add.image(center_width,(one_third_height*2)+8,'pala_sombra').setAlpha(0.5);
  pala.setAngle(125);
  palaSombra.setAngle(125);
  pala.setStatic(true);

  //Controles. `derecha` e `izquierda` son los botones de cada lado de la
  //pantalla; al invertir los controles intercambian función E icono, de modo
  //que el jugador sigue viendo hacia dónde saldrá la bola.
  invertidos=SelektorSettings.values.invertControls;
  derecha=this.add.image(this.sys.game.config.width-60,this.sys.game.config.height-100,
      invertidos?'flecha_izquierda':'flecha_derecha').setInteractive();
  izquierda=this.add.image(60,this.sys.game.config.height-100,
      invertidos?'flecha_derecha':'flecha_izquierda').setInteractive();
  //botonPala45 manda la bola a la derecha; botonPala125, a la izquierda.
  botonPala45=invertidos?izquierda:derecha;
  botonPala125=invertidos?derecha:izquierda;

  var conectaGiro=function(escena,boton,angulo){
    boton.on('pointerdown',function(){
      pala.setAngle(angulo);
      palaSombra.setAngle(angulo);
      escena.tweens.add({targets:boton,scaleX:0.9,scaleY:0.9,duration:50,yoyo:true});
    });
  };
  conectaGiro(this,botonPala45,45);
  conectaGiro(this,botonPala125,125);

  bola = this.matter.add.image(center_width,10,'bola');
  bola.setDepth(2);
  bolaSombra=this.add.image(bola.x+4,bola.y+4,'bola_sombra').setAlpha(0.5);
//  dropSound.play();
  brilloBola=this.add.image(5000,5000,'bola');
  brilloBola.setDepth(3);
this.tweens.add(
    {
        targets: brilloBola,
        alpha:0,
        duration: 600,
        yoyo: true,
        ease:'Power1',
        repeat:-1
    }
);
  brilloPared=this.add.image(5000,5000,'pared_derecha');
  brilloPared.setDisplaySize(brilloPared.width,this.sys.game.config.height);
this.tweens.add(
    {
        targets: brilloPared,
        alpha:0,
        duration: 600,
        yoyo: true,
        ease:'Power1',
        repeat:-1
    }
);

  smashButton=this.add.image(5000,5000,'smash_button').setInteractive().setOrigin(0.5,0.5);
  this.tweens.add(
      {
          targets: smashButton,
          alpha:0.3,
          scaleX:1.25,
          scaleY:1.25,
          duration: 200,
          yoyo: true,
          repeat:-1
      }
  );

  smashButton.on('pointerup',function(){
        pala.setAngle(45);
        palaSombra.setAngle(45);
        bola.setStatic(false);
        bola.setCircle();
        bola.setBounce(Phaser.Math.Between(7,9)/10);
        smashButton.x=1000;
        tutorialBG.x=1000;
        flechaTuto.x=5000;
        brilloBola.x=5000;
        brilloPared.x=5000;
        onTutorial=0;
    });

  tutorialBG=this.add.image(5000,5000,'tutorial_back').setOrigin(0,0).setAlpha(0.8);
  flechaTuto=this.add.image(5000,5000,'flecha_tuto').setOrigin(0.5,0.5).setAngle(-45);
  this.tweens.add(
      {
          targets: flechaTuto,
          angle:45,
          duration: 1500,
          repeat:-1
      }
  );
  flechaTutoInv=this.add.image(5000,5000,'flecha_tuto').setFlipX(true).setOrigin(0.5,0.5).setAngle(45);
  this.tweens.add(
      {
          targets: flechaTutoInv,
          angle:-45,
          duration: 1500,
          repeat:-1
      }
  );
if(onTutorial==0){
  colorBola=Phaser.Math.Between(0,1);
  if(colorBola==0){
    colorBola=colorIzquierda;
   bola.setTint(colors[colorBola]);
 }else{
   colorBola=colorDerecha;
   bola.setTint(colors[colorBola]);
 }
}else{
  colorBola=colorDerecha;
  bola.setTint(colors[colorBola]);
}

  bola.setCircle();
  bola.setBounce(Phaser.Math.Between(7,9)/10);

  //Saque a petición: la bola espera quieta hasta que el jugador toca la
  //pantalla o pulsa una tecla. En los tutoriales manda el propio tutorial, que
  //ya retiene la bola hasta que se pulsa el botón que enseña.
  var escenaJuego=this;
  avisoSaque=this.add.image(center_width,center_height,'aviso_saque').setDepth(3);
  esperandoSaque=(onTutorial==0);
  if(esperandoSaque){
    bola.setStatic(true);
    avisoSaque.setAlpha(0);
    this.tweens.add({targets:avisoSaque,alpha:1,duration:200});
    this.tweens.add({
      targets:avisoSaque,
      scaleX:1.06,
      scaleY:1.06,
      duration:650,
      yoyo:true,
      repeat:-1,
      ease:'Sine.easeInOut'
    });
    soltarBola=function(){
      if(!esperandoSaque){return;}
      esperandoSaque=false;
      escenaJuego.tweens.killTweensOf(avisoSaque);
      avisoSaque.x=5000;
      bola.setStatic(false);
      bola.setCircle();
      bola.setBounce(Phaser.Math.Between(7,9)/10);
    };
    //Con `on` y no `once`: así el mismo toque puede además girar la pala si cae
    //sobre una flecha, y el segundo toque ya no hace nada.
    this.input.on('pointerdown',soltarBola);
    this.input.keyboard.on('keydown',soltarBola);
  }else{
    avisoSaque.x=5000;
  }

  crashParticles=this.add.particles('particula_estrella');

}
checkOrientation(this.scale.orientation);
this.scale.on('orientationchange',checkOrientation,this);

//console.log('sale de create');
};


//this is called up to 60 times per second
gameScene.update = function(){
  if(bgx<=90.0)bgx=bgx+0.01; else bgx=0.0;
  grupoBG.x=(Math.sin(bgx)*50)+center_width;
  grupoBG.y=(Math.cos(bgx)*50)+center_height;

  if (currentStateList[currentState]=='onCreate') {
    this.cameras.main.fadeIn(200);
    this.create();
  }

  //don't execute if we are terminating
//  if (this.isTerminating) return;
  if (currentStateList[currentState]!='actionPhase') return;
bolaSombra.x=bola.x+5;
bolaSombra.y=bola.y+5;
if (bola.x!=center_width&&rebotePala==0){
  rebotePala=true;
  bounceSound.play();
  this.tweens.add({
          targets: pala,
          y: (pala.y+6),
          duration: 40,
          yoyo: true,
          ease: 'Power2'
      });
      this.tweens.add({
              targets: palaSombra,
              y: (palaSombra.y+6),
              duration: 40,
              yoyo: true,
              ease: 'Power2'
          });
}

  anguloTeclaIzq=invertidos?45:125;
  anguloTeclaDer=invertidos?125:45;
  if(teclas.left.isDown)
  {
    pala.setAngle(anguloTeclaIzq);
    palaSombra.setAngle(anguloTeclaIzq);
  }
  else if(teclas.right.isDown)
  {
    pala.setAngle(anguloTeclaDer);
    palaSombra.setAngle(anguloTeclaDer);
  }

  if (bola.y>this.sys.game.config.height+20){
    bola.setPosition(center_width,10);
    bola.setVelocity(0,velocidadY);
  }
  if(onTutorial==1){
    if (bola.body.isStatic==false) {
    this.tweens.add({
        targets: botonPala45,
        scaleX: 1.1,
        scaleY: 1.1,
        yoyo: true,
        duration: 250,
        ease:'Power1',
        repeat: 4
      });
      bola.setStatic(true);}
    tutorialBG.x=0;
    tutorialBG.y=0;
    smashButton.x=botonPala45.x;
    smashButton.y=botonPala45.y;
    flechaTuto.x=pala.x;
    flechaTuto.y=pala.y;
    brilloBola.x=bola.x;
    brilloBola.y=bola.y;
    brilloPared.x=paredDerecha.x;
    brilloPared.y=paredDerecha.y;
  }
  if(onTutorial==2){
    if(bola.body.isStatic==false) {
      this.tweens.add({
          targets: botonPala125,
          scaleX: 1.1,
          scaleY: 1.1,
          yoyo: true,
          duration: 250,
          ease:'Power1',
          repeat: 4
        });
      bola.setStatic(true);
    }
    tutorialBG.x=0;
    tutorialBG.y=0;
    tutorialBG.setFlipX(true);
    flechaTutoInv.x=pala.x;
    flechaTutoInv.y=pala.y;
    smashButton.x=botonPala125.x;
    smashButton.y=botonPala125.y;
    brilloBola.x=bola.x;
    brilloBola.y=bola.y;
    brilloPared.x=paredIzquierda.x;
    brilloPared.y=paredIzquierda.y;
    smashButton.on('pointerup',function(){
          pala.setAngle(125);
          palaSombra.setAngle(125);
          bola.setStatic(false);
          bola.setCircle();
          bola.setPosition(center_width,0);
          bola.setVelocity(0,velocidadY);
          bola.setAngle(0);
          bola.setBounce(Phaser.Math.Between(4,9)/5);
          smashButton.x=1000;
          flechaTutoInv.x=5000;
          brilloBola.x=5000;
          brilloPared.x=5000;
          onTutorial=0;
          tutorialForzado=false;
      });
  }

if (bola.x < 0||bola.x>this.sys.game.config.width)
    {
        if (bola.x<=0){
          if(colorIzquierda==colorBola){
            score++;
            this.addDestello();
            dropSound.play();
          }
          else{
            if(score>bestScore){this.saveFile(); newBest=true;}
            bolaSombra.y=1000;
            crashSound.play();
            this.gameOver();
            return;
//score++;
          }
        }else{
          if(colorDerecha==colorBola){
            score++;
            this.addDestello();
            dropSound.play();
            if (((bestScore<4)||tutorialForzado)&&(score==1)){onTutorial=2;}
          }
          else{
            if(score>bestScore){this.saveFile(); newBest=true;}
            bolaSombra.y=1000;
            crashSound.play();
            this.gameOver();
            return;
//score++;
          }
        }

        bola.setPosition(center_width,10);
        rebotePala=0;
        bola.setVelocity(0,velocidadY);
        bola.setAngle(0);
        bola.setBounce(Phaser.Math.Between(4,9)/5);
        velocidadY+=0.2;
        if (score>20){velocidadY-=0.05}
        if (score>40){velocidadY-=0.05}
        if (score>60){velocidadY-=0.05}
        if ((score%2==0))
        {
          xx=Phaser.Math.Between(0,1);
          if(xx==0)
          {
            colorActual=colorIzquierda;
            colorIzquierda=Phaser.Math.Between(0,6);
            while (colorDerecha==colorIzquierda||colorActual==colorIzquierda)
            {
              colorIzquierda=Phaser.Math.Between(0,6);
            }
            this.tweens.add({
                    targets: paredIzquierda,
                    x:-paredIzquierda.width,
                    duration: 100,
                    yoyo: true,
                });
            paredIzquierda.setTint(colors[colorIzquierda]);
          }else
            {
              colorActual=colorDerecha;
              colorDerecha=Phaser.Math.Between(0,6);
              while (colorDerecha==colorIzquierda||colorActual==colorDerecha)
              {
                colorDerecha=Phaser.Math.Between(0,6);
              }
              this.tweens.add({
                      targets: paredDerecha,
                      x: this.sys.game.config.width+paredDerecha.width,
                      duration: 100,
                      yoyo: true,
                  });
              paredDerecha.setTint(colors[colorDerecha]);
            }
        }
        if(onTutorial==0){
        colorBola=Phaser.Math.Between(0,1);
        if(colorBola==0){
            colorBola=colorIzquierda
            bola.setTint(colors[colorBola]);
          }else{
            colorBola=colorDerecha
            bola.setTint(colors[colorBola]);
          }
        }else{
          colorBola=colorIzquierda
          bola.setTint(colors[colorBola]);
        }

        scoreText.setText(score);
        if (score<50){
          scoreText.setScale(1+(score/100));
          scoreText.x=center_width+(score);
          scoreText.y=one_third_height+(score);
        }

        this.tweens.add({
                targets: scoreText,
                scaleX: (scoreText.scale+0.4),
                scaleY: (scoreText.scale+0.4),
                duration: 100,
                yoyo: true,
                ease: 'Power2'
            });
    }

//console.log('sale de update');
};


gameScene.gameOver = function(){
  //console.log('entra a game over');
  currentState=2;
  tutorialForzado=false;
//  this.isTerminating = true;

if(bola.x<100){
  crashParticles.createEmitter({
    scale:{start: 0.5, end:2.5},
    speed:100,
    angle: { min: -90, max: 45 },
    rotate: { min: -180, max: 180 },
    lifespan: { min: 200, max: 300 },
    frequency: 30,
    maxParticles: 4,
    x:bola.x+20,
    y:bola.y
  });
}else{
  crashParticles.createEmitter({
    scale:{start: 0.5, end:2.5},
    speed:100,
    angle: { min: 135, max: 270 },
    rotate: { min: -180, max: 180 },
    lifespan: { min: 200, max: 300 },
    frequency: 30,
    maxParticles: 4,
    x:bola.x-20,
    y:bola.y
  });
}

  //shake camera
  this.cameras.main.shake(200);
  cierreFinal=this.add.image(0,0,'cierre_final').setAlpha(0).setOrigin(0,0).setDepth(2);

  //listen for event completion
  this.cameras.main.on('camerashakecomplete', function(camera, effect){
if (score>0){
    this.tweens.add({
      targets:cierreFinal,
      alpha:1,
      duration:900,
      ease:'Power1',
      onComplete: ()=>{this.cameras.main.fade(500);}
    });
  } else {this.cameras.main.fade(500);}
  }, this);

  this.cameras.main.on('camerafadeoutcomplete', function(camera,effect){
    //restart the Scene
//    bgMusic.destroy();
    this.scene.restart();
  }, this);

};


//El registro de localStorage sigue siendo 'selektorFile'; SelektorSettings le
//añade los ajustes nuevos y sabe leer los registros antiguos.
gameScene.saveFile = function(){
  if(score>bestScore){bestScore=score;}
  SelektorSettings.values.bestScore=bestScore;
  SelektorSettings.save();
};

gameScene.loadFile = function(){
  var ajustes=SelektorSettings.load();
  bestScore=ajustes.bestScore;
  musicStatus=ajustes.musicStatus;
};


function getRootBody (body)
{
    if (body.parent === body) { return body; }
    while (body.parent !== body)
    {
        body = body.parent;
    }
    return body;
}

function checkOrientation (orientation){
  if (orientation===Phaser.Scale.LANDSCAPE){
    //console.log("CAMBIA ORIENTACION POR FAVOR");
  } else if(orientation===Phaser.Scale.PORTRAIT){
    //console.log('Buena Orientacion');
  }
}

gameScene.backgroundAnim=function (){
  //Las barras giran 360 grados, así que el bloque tiene que cubrir la diagonal
  //del lienzo o asoma el fondo blanco por las esquinas. Además update() pasea el
  //grupo describiendo un círculo de 50 px de radio, que hay que sumar (100 px de
  //diámetro) más un margen. Las barras conservan sus 125 px de ancho, el aspecto
  //del original, y se añaden las que hagan falta.
  var VAIVEN_BG=50;   //el radio del paseo de update()
  var diagonalBG=Math.ceil(Math.sqrt(
    Math.pow(this.sys.game.config.width,2)+Math.pow(this.sys.game.config.height,2)))
    +(VAIVEN_BG*2)+20;
  var anchoBarraBG=125;
  var numBarrasBG=Math.ceil(diagonalBG/anchoBarraBG);
  if(numBarrasBG%2===0){numBarrasBG++;}   //impar: una barra queda centrada
  var tonosBG=[0x509c23,0x5e97d6,0xd3a410,0xb44ea4,0xff2a36];
  var barrasBG=[];
  for(var iBG=0;iBG<numBarrasBG;iBG++){
    var barraBG=this.add.image((iBG-(numBarrasBG-1)/2)*anchoBarraBG,0,'pared_derecha');
    barraBG.setTint(tonosBG[iBG%tonosBG.length]);
    barraBG.setDisplaySize(anchoBarraBG,diagonalBG);
    barrasBG.push(barraBG);
  }

  grupoBG=this.add.container(center_width,center_height,barrasBG);
  grupoBG.setAlpha(0.85);
  bgTimeLine=this.tweens.timeline({
    targets: grupoBG,
    loop: -1,
    totalDuration: 60000,
    ease: 'Sine.easeOut',
    tweens: [
      {
        angle: 360,
        scaleX:1.8,
        alpha:0.65,
        yoyo: true
      },
      {
        angle: -360,
        scaleX:1.8,
        alpha:0.65,
        yoyo:true,
      }
    ]
  });
}

gameScene.addDestello = function (){
  destello.x=bola.x;
  destello.y=bola.y;
  destello.setTint(colors[colorBola]);
  destello.setDepth(1);
  destelloX=Phaser.Math.Between(18,22)/10;
  destelloY=Phaser.Math.Between(18,22)/10;
//  destelloAlpha=Phaser.Math.Between(3,5)/10;
  destelloAlpha=Phaser.Math.Between(6,8)/10;
  this.tweens.add({
    targets: destello,
    alpha: destelloAlpha,
    scaleX:destelloX,
    scaleY:destelloY,
    duration:40,
    yoyo:true,
  });
}

gameScene.scoreMenuAnim = function(){
if (newBest){
  this.tweens.add(
    {
    targets:scoreEnMenu,
    scaleX:0.6,
    scaleY:0.6,
    duration:150,
    yoyo:true,
    repeat:1
  }
);
newBest=false;
}
}


//El lienzo conserva 320 px de ancho, que es de donde salen todas las medidas
//horizontales del juego (separación de las paredes, largo de la pala y recorrido
//de la bola), y calcula el alto con la proporción real de la pantalla. Así
//Scale.FIT la llena entera: ni barras negras ni recorte. Todas las posiciones
//del juego se derivan de config.width/config.height, de modo que la distribución
//se reajusta sola.
const ANCHO_BASE=320;
const ALTO_MIN=420;   //más ancho que 4:3 (tabletas)
const ALTO_MAX=800;   //más alto que 21:9 (móviles muy alargados)

function altoSegunPantalla(){
  const caja=document.getElementById('game-root');
  const r=caja?caja.getBoundingClientRect():null;
  const w=(r&&r.width)||window.innerWidth||ANCHO_BASE;
  const h=(r&&r.height)||window.innerHeight||480;
  return Math.max(ALTO_MIN,Math.min(ALTO_MAX,Math.round(ANCHO_BASE*(h/w))));
}

//set the configuration of the Game--js object
let config = {
  type: Phaser.AUTO, //Phaser will use WebGL if available, otherwise Canvas
//    type: Phaser.CANVAS,
//  width: 360,
//  height: 640,
  width: ANCHO_BASE,
  height: altoSegunPantalla(),
  backgroundColor: '#ffffff',
  physics: {
      default: 'matter',
      matter:{
          gravity:{y:1},
//          debug: true
      }
  },
  scene: gameScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game-root'
  },
  fps:30
};

//create a new game, pass the configuration
let game = new Phaser.Game(config);

//se expone la instancia para la envoltura móvil (let no crea propiedad en window)
window.game = game;

//Al arrancar, el visor todavía puede cambiar de alto (Android oculta las barras
//del sistema justo después). Se recalcula el lienzo y se rehace la escena, pero
//solo desde el menú: reiniciar en plena partida perdería la puntuación.
window.ajustarLienzo=function(){
  if(!game||!game.isBooted){return false;}
  const alto=altoSegunPantalla();
  if(Math.abs(alto-game.config.height)<3){return false;}
  if(currentStateList[currentState]!=='onMenu'){return false;}
  game.config.height=alto;
  game.scale.resize(ANCHO_BASE,alto);
  //scale.resize() deja el tamaño mostrado con la proporción anterior y volverían
  //a salir barras: hay que refijar la proporción y refrescar.
  game.scale.displaySize.setAspectRatio(ANCHO_BASE/alto);
  game.scale.refresh();
  game.scene.getScene('Game').scene.restart();
  return true;
};
