/**
 * sketch.js — Boucle principale du jeu "Leader Army Game"
 *
 * Architecture :
 *   - leader       : Vehicle contrôlé par la souris (ARRIVE)
 *   - followers[]  : armée qui suit le leader en formation (BehaviorManager)
 *   - enemies[]    : ennemis qui poursuivent le leader (BehaviorManager + smart evade)
 *   - elites[]     : ennemis élites (plus forts, 2 HP, esquivent les projectiles)
 *   - projectiles[]: balles tirées par le joueur (PURSUE vers ennemi)
 *   - powerUps[]   : collectibles errants (WANDER, boost temporaire)
 *   - obstacles[]  : obstacles circulaires statiques
 *
 * Contrôles :
 *   Souris   → déplace le leader
 *   Clic     → tire un projectile
 *   D        → active/désactive le mode debug
 *   R        → relance une nouvelle partie
 *   F        → change la formation de l'armée (grid / V / circle)
 */

// ══════════════════════════════════════════════════════════════════════════
// VARIABLES GLOBALES
// ══════════════════════════════════════════════════════════════════════════

let leader;
let followers   = [];
let enemies     = [];
let projectiles = [];
let obstacles   = [];
let powerUps    = [];

// ── Score & difficulté ──────────────────────────────────────────────────────
let score = 0;
let waveTimer    = 0;
let waveInterval = 480;   // frames entre spawns (~8s à 60fps)
let difficultyLevel = 1;  // augmente avec les vagues (vitesse des ennemis)

// ── Système de niveaux ──────────────────────────────────────────────────────
let level = 1;              // niveau affiché au joueur (score-based)
const POINTS_PER_LEVEL = 50; // points nécessaires pour passer au niveau suivant

// Animation "LEVEL UP"
let levelUpAnim  = 0;       // frames restantes d'animation
let levelUpFlash = 0;       // flash d'écran au level-up

// ── État du jeu ─────────────────────────────────────────────────────────────
let gameOver    = false;
let gameStarted = false;

// ── Sliders UI ──────────────────────────────────────────────────────────────
let sliders = {};

// ══════════════════════════════════════════════════════════════════════════
// SETUP
// ══════════════════════════════════════════════════════════════════════════

function setup() {
  createCanvas(1000, 700);
  colorMode(RGB, 255, 255, 255, 255);
  createUI();
  initGame();
}

/**
 * Initialise ou réinitialise une nouvelle partie.
 */
function initGame() {
  leader = new Leader(width / 2, height / 2);

  // ── Followers ─────────────────────────────────────────────────────────────
  followers = [];
  let nbFollowers = sliders.nbFollowers.value();
  for (let i = 0; i < nbFollowers; i++) {
    followers.push(new Follower(
      random(width * 0.3, width * 0.7),
      random(height * 0.3, height * 0.7),
      i
    ));
  }

  // ── Obstacles ─────────────────────────────────────────────────────────────
  obstacles = [
    new Obstacle(200, 150, 40, color(80, 70, 50)),
    new Obstacle(800, 200, 35, color(80, 70, 50)),
    new Obstacle(500, 350, 50, color(80, 70, 50)),
    new Obstacle(150, 500, 30, color(80, 70, 50)),
    new Obstacle(700, 520, 45, color(80, 70, 50)),
    new Obstacle(350, 600, 35, color(80, 70, 50)),
    new Obstacle(850, 600, 30, color(80, 70, 50)),
  ];

  // ── Ennemis initiaux ───────────────────────────────────────────────────────
  enemies = [];
  let nbEnemies = sliders.nbEnemies.value();
  for (let i = 0; i < nbEnemies; i++) {
    enemies.push(spawnEnemy());
  }

  // ── Réinitialisation ───────────────────────────────────────────────────────
  projectiles  = [];
  powerUps     = [];
  explosions   = [];
  score        = 0;
  waveTimer    = 0;
  waveInterval = 480;
  difficultyLevel = 1;
  level           = 1;
  levelUpAnim     = 0;
  levelUpFlash    = 0;
  gameOver        = false;
  gameStarted     = true;

  // Réinitialiser la formation
  Follower.formation  = 'grid';
  Follower.totalCount = followers.length;

  screenShakeTimer     = 0;
  screenShakeIntensity = 0;
  impactFlashes        = [];
  initBgParticles();
}

// ══════════════════════════════════════════════════════════════════════════
// DRAW — BOUCLE PRINCIPALE (60 fps)
// ══════════════════════════════════════════════════════════════════════════

function draw() {
  background(15, 15, 25);

  if (!gameStarted) { drawStartScreen(); return; }
  if (gameOver)     { drawGameOver();    return; }

  // ── Fond animé ────────────────────────────────────────────────────────────
  updateBgParticles();

  // ── Screen shake ──────────────────────────────────────────────────────────
  if (screenShakeTimer > 0) {
    translate(
      random(-screenShakeIntensity, screenShakeIntensity),
      random(-screenShakeIntensity, screenShakeIntensity)
    );
    screenShakeTimer--;
    screenShakeIntensity *= 0.85;
  }

  // ── Systèmes globaux ───────────────────────────────────────────────────────
  updateDifficulty();
  updateLevel();
  syncFollowers();
  applySliderParams();

  // Synchronise le compteur total pour la formation en cercle
  Follower.totalCount = followers.length;

  // ── Flash niveau ──────────────────────────────────────────────────────────
  if (levelUpFlash > 0) {
    let alpha = map(levelUpFlash, 0, 20, 0, 60);
    push();
    fill(255, 220, 50, alpha);
    noStroke();
    rect(0, 0, width, height);
    pop();
    levelUpFlash--;
  }

  // ── Obstacles ─────────────────────────────────────────────────────────────
  for (let o of obstacles) o.show();

  // ── Power-ups ─────────────────────────────────────────────────────────────
  for (let pu of powerUps) {
    pu.applyBehaviors();
    pu.update();
    pu.show();
  }
  checkPowerUpCollisions();
  powerUps = powerUps.filter(pu => !pu.collected);

  // ── Leader ────────────────────────────────────────────────────────────────
  let mouseTarget = createVector(mouseX, mouseY);
  leader.applyBehaviors(mouseTarget, obstacles);
  leader.update();
  tickBoost(leader);
  leader.show();

  // Collision ennemi → leader
  for (let e of enemies) {
    if (e.isCollidingWith(leader)) leader.takeDamage();
  }
  if (leader.health <= 0) { gameOver = true; return; }

  // ── Followers ─────────────────────────────────────────────────────────────
  let sepW   = sliders.separationWeight.value();
  let avoidW = sliders.avoidWeight.value();

  for (let f of followers) {
    f.applyBehaviors(leader, followers, obstacles, 1.0, sepW, avoidW);
    f.update();
    tickBoost(f);
    f.show();
  }

  // ── Ennemis normaux ───────────────────────────────────────────────────────
  let enemySepW   = sliders.separationWeight.value();
  let enemyAvoidW = sliders.avoidWeight.value();

  for (let e of enemies) {
    // Passe les projectiles actifs pour le comportement d'esquive intelligent
    e.applyBehaviors(leader, enemies, obstacles, enemyAvoidW, enemySepW, projectiles);
    e.update();
    e.show();
  }

  // ── Ennemis élites ────────────────────────────────────────────────────────
  // On les stocke dans le même tableau enemies pour simplifier la gestion
  // (les élites héritent d'Enemy, isDead fonctionne pareil).

  // ── Projectiles ───────────────────────────────────────────────────────────
  for (let p of projectiles) {
    p.applyBehaviors(obstacles); // ligne droite + avoid obstacles
    p.update();
    p.show();
  }

  // ── Collisions & nettoyage ────────────────────────────────────────────────
  checkProjectileCollisions();
  checkFollowerEnemyCollisions(); // mêlée : followers tuent les ennemis au contact
  projectiles = projectiles.filter(p => !p.isExpired());
  enemies     = enemies.filter(e => !e.isDead);

  // ── HUD ───────────────────────────────────────────────────────────────────
  drawHUD();
}

// ══════════════════════════════════════════════════════════════════════════
// SYSTÈME DE NIVEAUX
// ══════════════════════════════════════════════════════════════════════════

/**
 * Vérifie si le score a atteint le prochain palier de niveau.
 * Appelé chaque frame.
 */
function updateLevel() {
  let newLevel = 1 + Math.floor(score / POINTS_PER_LEVEL);

  if (newLevel > level) {
    level = newLevel;
    levelUpAnim  = 150; // 2.5s d'animation
    levelUpFlash = 20;  // flash d'écran court
    applyLevelScaling();
  }
}

/**
 * Ajuste les paramètres de difficulté selon le niveau actuel.
 * Appelé à chaque montée de niveau.
 *
 * Courbe douce : chaque niveau augmente légèrement la pression,
 * sans saut brutal de difficulté.
 */
function applyLevelScaling() {
  // Réduire l'intervalle entre les vagues (minimum : 3 secondes)
  waveInterval = max(180, 480 - level * 25);

  // difficultyLevel influence la vitesse des ennemis dans spawnEnemy()
  // On le synchronise avec le niveau de score.
  difficultyLevel = max(difficultyLevel, level);

  // Spawner un ennemi supplémentaire à chaque niveau pour marquer l'événement
  enemies.push(spawnEnemy());

  // À partir du niveau 3, les élites peuvent apparaître
  if (level >= 3 && random() < 0.4) {
    enemies.push(spawnEliteEnemy());
  }

  // Spawner un power-up en récompense
  if (level % 2 === 0) {
    spawnPowerUp();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// DIFFICULTÉ DYNAMIQUE (wave-based)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Toutes les waveInterval frames, spawne une nouvelle vague d'ennemis.
 * Le nombre d'ennemis par vague augmente avec le niveau.
 */
function updateDifficulty() {
  waveTimer++;

  if (waveTimer >= waveInterval) {
    waveTimer = 0;
    difficultyLevel++;
    waveInterval = max(180, waveInterval - 20);

    // Nombre d'ennemis par vague augmente avec le niveau
    let spawnCount = 1 + Math.floor(level / 3);
    for (let i = 0; i < spawnCount; i++) {
      // Chance d'élite proportionnelle au niveau (0% < niveau 3, max 35%)
      if (level >= 3 && random() < min(0.1 + level * 0.04, 0.35)) {
        enemies.push(spawnEliteEnemy());
      } else {
        enemies.push(spawnEnemy());
      }
    }
  }
}

/**
 * Crée un ennemi normal sur un bord aléatoire.
 * @returns {Enemy}
 */
function spawnEnemy() {
  let { x, y } = randomEdgePosition();
  return new Enemy(x, y, difficultyLevel);
}

/**
 * Crée un ennemi élite sur un bord aléatoire.
 * @returns {EliteEnemy}
 */
function spawnEliteEnemy() {
  let { x, y } = randomEdgePosition();
  return new EliteEnemy(x, y, difficultyLevel);
}

/**
 * Retourne une position aléatoire sur l'un des 4 bords du canvas.
 */
function randomEdgePosition() {
  let x, y;
  let edge = floor(random(4));
  if (edge === 0)      { x = random(width); y = -20; }
  else if (edge === 1) { x = random(width); y = height + 20; }
  else if (edge === 2) { x = -20; y = random(height); }
  else                 { x = width + 20; y = random(height); }
  return { x, y };
}

// ══════════════════════════════════════════════════════════════════════════
// POWER-UPS
// ══════════════════════════════════════════════════════════════════════════

/**
 * Spawne un power-up aléatoire dans une zone sûre du canvas.
 */
function spawnPowerUp() {
  let type = random() < 0.5 ? 'speed' : 'force';
  let x    = random(100, width - 100);
  let y    = random(80, height - 80);
  powerUps.push(new PowerUp(x, y, type));
}

/**
 * Vérifie si le leader ou un follower collecte un power-up.
 */
function checkPowerUpCollisions() {
  for (let pu of powerUps) {
    if (pu.collected) continue;

    if (pu.isCollidingWith(leader)) {
      pu.applyTo(leader);
      spawnCollectEffect(pu.pos.x, pu.pos.y, pu.type);
      continue;
    }

    for (let f of followers) {
      if (pu.isCollidingWith(f)) {
        pu.applyTo(f);
        spawnCollectEffect(pu.pos.x, pu.pos.y, pu.type);
        break;
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// SYNCHRONISATION DES SLIDERS
// ══════════════════════════════════════════════════════════════════════════

function syncFollowers() {
  let target = sliders.nbFollowers.value();

  if (followers.length < target) {
    let i = followers.length;
    followers.push(new Follower(leader.pos.x, leader.pos.y, i));
  } else if (followers.length > target) {
    followers.pop();
  }
}

function applySliderParams() {
  let ms = sliders.maxSpeed.value();
  let mf = sliders.maxForce.value();

  leader.maxSpeed = ms + 1;
  leader.maxForce = mf + 0.1;

  for (let f of followers) {
    // Ne pas écraser le boost en cours
    if (!f._boostTimer) {
      f.maxSpeed = ms;
      f.maxForce = mf;
    }
  }
  // Les ennemis conservent leur vitesse dynamique
}

// ══════════════════════════════════════════════════════════════════════════
// COLLISIONS
// ══════════════════════════════════════════════════════════════════════════

/**
 * Vérifie les collisions projectile → ennemi (appelée chaque frame).
 *
 * Pour chaque paire (projectile actif, ennemi vivant) :
 *   - Enemy normal : isDead = true, score += 10
 *   - EliteEnemy   : health -= 1 ; isDead = true si health <= 0, score += 25
 * Dans les deux cas : déclenche explosion + flash d'impact + screen shake.
 * Un projectile ne peut toucher qu'un seul ennemi par frame (break après hit).
 *
 * @pre  projectiles et enemies sont les tableaux globaux à jour
 * @post chaque projectile consommé a lifetime = 0
 * @post chaque ennemi tué a isDead = true
 * @sideeffect modifie score, projectiles[i].lifetime, enemies[i].isDead/health,
 *             explosions, impactFlashes, screenShakeTimer
 * @complexity O(p × e) avec p = projectiles actifs, e = ennemis vivants
 */
function checkProjectileCollisions() {
  for (let p of projectiles) {
    for (let e of enemies) {
      if (e.isDead || !p.isHitting(e)) continue;

      if (e instanceof EliteEnemy) {
        let killed = e.takeHit();
        if (killed) {
          score += EliteEnemy.SCORE_VALUE;
          spawnExplosion(e.pos.x, e.pos.y, true);
          triggerScreenShake(6, 10);
        } else {
          spawnExplosion(e.pos.x, e.pos.y, false);
          triggerScreenShake(3, 6);
        }
      } else {
        e.isDead = true;
        score += 10;
        spawnExplosion(e.pos.x, e.pos.y, false);
        triggerScreenShake(4, 7);
      }

      spawnImpactFlash(e.pos.x, e.pos.y);
      p.lifetime = 0; // projectile consommé
      break;
    }
  }
}

/**
 * Vérifie les collisions follower → ennemi (mêlée, appelée chaque frame).
 *
 * Condition de collision : distance(follower.pos, enemy.pos) < sum des r_pourDessin.
 *   - Enemy normal : isDead = true, score += 10
 *   - EliteEnemy   : health -= 1 ; isDead si health <= 0, score += 25
 * Dans les deux cas : déclenche un effet de mêlée (anneau + étincelles).
 *
 * @pre  followers et enemies sont les tableaux globaux à jour
 * @post chaque ennemi tué a isDead = true
 * @sideeffect modifie score, enemies[i].isDead/health, meleeEffects
 * @complexity O(f × e) avec f = followers, e = ennemis vivants
 */
function checkFollowerEnemyCollisions() {
  for (let f of followers) {
    for (let e of enemies) {
      if (e.isDead) continue;

      let d = f.pos.dist(e.pos);
      if (d < f.r_pourDessin + e.r_pourDessin) {
        if (e instanceof EliteEnemy) {
          let killed = e.takeHit();
          if (killed) {
            score += EliteEnemy.SCORE_VALUE;
            spawnMeleeEffect(e.pos.x, e.pos.y, f.color, true);
          } else {
            spawnMeleeEffect(e.pos.x, e.pos.y, f.color, false);
          }
        } else {
          e.isDead = true;
          score += 10;
          spawnMeleeEffect(e.pos.x, e.pos.y, f.color, false);
        }
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// EFFETS VISUELS
// ══════════════════════════════════════════════════════════════════════════

let explosions    = [];
let impactFlashes = [];

// ── Screen shake ─────────────────────────────────────────────────────────────
let screenShakeTimer     = 0;
let screenShakeIntensity = 0;

/**
 * Déclenche un screen shake (tremblement de caméra).
 * L'intensité décroît de 15 % par frame (×0.85) jusqu'à expiration.
 *
 * @param {number} intensity - amplitude max du déplacement aléatoire (pixels)
 * @param {number} duration  - nombre de frames pendant lesquelles le shake est actif
 * @pre  intensity > 0, duration > 0
 * @post screenShakeTimer = duration, screenShakeIntensity = intensity
 * @note un appel pendant un shake actif réinitialise les deux valeurs
 * @sideeffect modifie les globales screenShakeTimer et screenShakeIntensity
 */
function triggerScreenShake(intensity = 5, duration = 8) {
  screenShakeTimer     = duration;
  screenShakeIntensity = intensity;
}

// ── Background particles ──────────────────────────────────────────────────────
let bgParticles = [];

function initBgParticles() {
  bgParticles = [];
  for (let i = 0; i < 55; i++) {
    bgParticles.push({
      x:     random(width),
      y:     random(height),
      vx:    random(-0.25, 0.25),
      vy:    random(-0.25, 0.25),
      size:  random(1, 2.5),
      alpha: random(18, 55)
    });
  }
}

function updateBgParticles() {
  for (let p of bgParticles) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0)      p.x = width;
    if (p.x > width)  p.x = 0;
    if (p.y < 0)      p.y = height;
    if (p.y > height) p.y = 0;

    push();
    fill(70, 90, 180, p.alpha);
    noStroke();
    circle(p.x, p.y, p.size);
    pop();
  }
}

/**
 * Spawne une explosion de particules à la position d'un ennemi tué.
 *
 * @param {number}  x   - coordonnée X du centre de l'explosion
 * @param {number}  y   - coordonnée Y du centre de l'explosion
 * @param {boolean} big - true pour une élite (plus de particules, plus rapides,
 *                        couleur violette au lieu d'orange)
 * @post explosions.length += (big ? 16 : 8) nouvelles particules
 * @sideeffect modifie le tableau global explosions
 */
function spawnExplosion(x, y, big = false) {
  let count = big ? 16 : 8;
  for (let i = 0; i < count; i++) {
    explosions.push({
      pos:     createVector(x, y),
      vel:     p5.Vector.random2D().mult(random(1, big ? 6 : 4)),
      life:    big ? 45 : 30,
      maxLife: big ? 45 : 30,
      col:     big
        ? color(random(180, 255), random(50, 100), random(200, 255))  // violet
        : color(random(200, 255), random(50, 150), 30)                // orange
    });
  }
}

// ── Effets de mêlée (follower → ennemi) ─────────────────────────────────────
// Structure distincte : anneaux de choc expansifs + étincelles colorées.
let meleeEffects = [];

/**
 * Spawne un effet de mêlée à la position de l'ennemi tué.
 *
 * Composé de deux couches :
 *  1. Shockwave — anneau qui s'élargit et s'estompe rapidement
 *  2. Sparks — 6-10 étincelles aux couleurs du follower qui a frappé
 *
 * @param {number}  x, y       - position de l'impact
 * @param {p5.Color} followerColor - couleur du follower auteur du coup
 * @param {boolean} big        - true si ennemi élite (anneau + étincelles plus grands)
 */
function spawnMeleeEffect(x, y, followerColor, big = false) {
  // ── Shockwave : 1 anneau expansif ─────────────────────────────────────────
  meleeEffects.push({
    type:    'ring',
    pos:     createVector(x, y),
    radius:  big ? 18 : 10,   // rayon de départ
    maxR:    big ? 70 : 45,   // rayon final
    life:    20,
    maxLife: 20,
    col:     followerColor
  });

  // Second anneau décalé pour l'élite (effet double impact)
  if (big) {
    meleeEffects.push({
      type:    'ring',
      pos:     createVector(x, y),
      radius:  5,
      maxR:    90,
      life:    28,
      maxLife: 28,
      col:     color(255, 255, 255)  // anneau blanc pour l'élite
    });
  }

  // ── Sparks : étincelles directionnelles ────────────────────────────────────
  let sparkCount = big ? 10 : 6;
  for (let i = 0; i < sparkCount; i++) {
    // Répartition uniforme en étoile + légère variation angulaire
    let angle = (TWO_PI / sparkCount) * i + random(-0.3, 0.3);
    let speed = random(big ? 2.5 : 1.5, big ? 5 : 3.5);
    meleeEffects.push({
      type:    'spark',
      pos:     createVector(x, y),
      vel:     createVector(cos(angle) * speed, sin(angle) * speed),
      life:    big ? 22 : 16,
      maxLife: big ? 22 : 16,
      col:     followerColor
    });
  }
}

/**
 * Met à jour et dessine tous les effets de mêlée actifs.
 * Appelé chaque frame depuis drawHUD().
 */
function updateMeleeEffects() {
  for (let fx of meleeEffects) {
    fx.life--;

    if (fx.type === 'ring') {
      // L'anneau grossit de son rayon initial jusqu'à maxR
      fx.radius = map(fx.life, fx.maxLife, 0, fx.radius, fx.maxR);
      let alpha = map(fx.life, fx.maxLife, 0, 220, 0);
      let sw    = map(fx.life, fx.maxLife, 0, 3, 0.5);

      push();
      noFill();
      stroke(red(fx.col), green(fx.col), blue(fx.col), alpha);
      strokeWeight(sw);
      circle(fx.pos.x, fx.pos.y, fx.radius * 2);
      pop();

    } else {
      // Spark : se déplace et ralentit
      fx.pos.add(fx.vel);
      fx.vel.mult(0.85);

      let alpha = map(fx.life, fx.maxLife, 0, 255, 0);
      let sz    = map(fx.life, fx.maxLife, 0, 5, 1);

      push();
      fill(red(fx.col), green(fx.col), blue(fx.col), alpha);
      // Petit trait directionnel (ligne courte dans la direction de vel)
      stroke(255, 255, 255, alpha * 0.5);
      strokeWeight(1);
      let tip = p5.Vector.add(fx.pos, p5.Vector.mult(fx.vel, 2.5));
      line(fx.pos.x, fx.pos.y, tip.x, tip.y);
      noStroke();
      circle(fx.pos.x, fx.pos.y, sz);
      pop();
    }
  }

  meleeEffects = meleeEffects.filter(fx => fx.life > 0);
}

function spawnCollectEffect(x, y, type) {
  let c = (type === 'speed') ? color(50, 255, 150) : color(255, 180, 50);
  for (let i = 0; i < 10; i++) {
    explosions.push({
      pos:     createVector(x, y),
      vel:     p5.Vector.random2D().mult(random(1, 3)),
      life:    25,
      maxLife: 25,
      col:     c
    });
  }
}

/**
 * Spawne un flash d'impact (anneau blanc expansif) à la position d'un hit.
 *
 * @param {number} x - coordonnée X du point d'impact
 * @param {number} y - coordonnée Y du point d'impact
 * @post impactFlashes.length += 1
 * @sideeffect modifie le tableau global impactFlashes
 */
function spawnImpactFlash(x, y) {
  impactFlashes.push({ x, y, life: 12, maxLife: 12 });
}

function updateImpactFlashes() {
  for (let f of impactFlashes) {
    f.life--;
    let alpha = map(f.life, 0, f.maxLife, 0, 220);
    let r     = map(f.life, f.maxLife, 0, 4, 40);
    push();
    noFill();
    stroke(255, 255, 200, alpha);
    strokeWeight(map(f.life, f.maxLife, 0, 3, 0.5));
    circle(f.x, f.y, r * 2);
    pop();
  }
  impactFlashes = impactFlashes.filter(f => f.life > 0);
}

function updateExplosions() {
  for (let ex of explosions) {
    ex.pos.add(ex.vel);
    ex.vel.mult(0.92);
    ex.life--;

    let alpha = map(ex.life, 0, ex.maxLife, 0, 255);
    push();
    fill(red(ex.col), green(ex.col), blue(ex.col), alpha);
    noStroke();
    circle(ex.pos.x, ex.pos.y, map(ex.life, 0, ex.maxLife, 1, 8));
    pop();
  }
  explosions = explosions.filter(ex => ex.life > 0);
}

// ══════════════════════════════════════════════════════════════════════════
// HUD (Heads-Up Display)
// ══════════════════════════════════════════════════════════════════════════

function drawHUD() {
  updateExplosions();
  updateImpactFlashes();
  updateMeleeEffects();

  // ── Bande supérieure ───────────────────────────────────────────────────────
  push();
  fill(0, 0, 0, 170);
  noStroke();
  rect(0, 0, width, 42);

  textSize(16);
  textAlign(LEFT, CENTER);

  // Score
  fill(255, 220, 50);
  text(`Score : ${score}`, 20, 21);

  // Niveau (avec couleur progressive)
  let lvlColor = lerpColor(color(180, 180, 255), color(255, 120, 30),
                           min((level - 1) / 10, 1));
  fill(lvlColor);
  text(`Niveau : ${level}`, 160, 21);

  // Ennemis actifs
  let eliteCount = enemies.filter(e => e instanceof EliteEnemy).length;
  fill(220, 80, 80);
  text(`Ennemis : ${enemies.length - eliteCount}`, 300, 21);
  if (eliteCount > 0) {
    fill(200, 80, 255);
    text(`Élites : ${eliteCount}`, 430, 21);
  }

  // Armée
  fill(50, 150, 255);
  text(`Armée : ${followers.length}`, eliteCount > 0 ? 540 : 430, 21);

  // Formation courante
  fill(100, 220, 180);
  text(`Formation : ${Follower.formation.toUpperCase()}`, eliteCount > 0 ? 660 : 560, 21);

  // Contrôles
  fill(150, 150, 150);
  textSize(11);
  textAlign(RIGHT, CENTER);
  text("[Clic/Espace] Tirer  [F] Formation  [D] Debug  [R] Rejouer", width - 20, 21);

  pop();

  // ── Indicateur boost leader ──────────────────────────────────────────────
  if (leader._boostTimer > 0) {
    push();
    let ratio = leader._boostTimer / PowerUp.BOOST_DURATION;
    let bc    = (leader._boostType === 'speed') ? color(50, 255, 150) : color(255, 180, 50);
    fill(red(bc), green(bc), blue(bc), 200);
    noStroke();
    textSize(12);
    textAlign(LEFT, TOP);
    text(`BOOST : ${leader._boostType.toUpperCase()} [${ceil(leader._boostTimer / 60)}s]`,
         20, height - 24);

    // Barre de boost
    fill(red(bc), green(bc), blue(bc), 140);
    rect(0, height - 8, width * ratio, 8, 3);
    pop();
  }

  // ── Barre de progression de la vague ────────────────────────────────────
  let ratio = waveTimer / waveInterval;
  push();
  fill(40, 40, 40);
  noStroke();
  if (leader._boostTimer <= 0) {
    rect(0, height - 4, width, 4);
    fill(220, 80, 80);
    rect(0, height - 4, width * ratio, 4);
  }
  pop();

  // ── Animation LEVEL UP ───────────────────────────────────────────────────
  if (levelUpAnim > 0) {
    drawLevelUpAnim();
    levelUpAnim--;
  }
}

/**
 * Affiche le texte "LEVEL UP !" avec un fondu entrant/sortant.
 */
function drawLevelUpAnim() {
  // Phases : fade in (30f) → tenu (90f) → fade out (30f)
  let alpha;
  if (levelUpAnim > 120)       alpha = map(levelUpAnim, 150, 120, 0, 255);
  else if (levelUpAnim > 30)   alpha = 255;
  else                         alpha = map(levelUpAnim, 30, 0, 255, 0);

  push();
  textAlign(CENTER, CENTER);

  // Ombre portée
  fill(0, 0, 0, alpha * 0.6);
  textSize(52);
  text(`LEVEL UP !`, width / 2 + 3, height / 2 - 47);

  // Texte principal
  fill(255, 220, 50, alpha);
  text(`LEVEL UP !`, width / 2, height / 2 - 50);

  // Sous-titre
  fill(200, 200, 255, alpha * 0.85);
  textSize(22);
  text(`Niveau ${level}`, width / 2, height / 2 - 10);

  pop();
}

// ══════════════════════════════════════════════════════════════════════════
// ÉCRANS (START / GAME OVER)
// ══════════════════════════════════════════════════════════════════════════

function drawStartScreen() {
  background(10, 10, 20);
  push();
  textAlign(CENTER, CENTER);

  fill(255, 215, 0);
  textSize(42);
  text("LEADER ARMY GAME", width / 2, height / 2 - 100);

  fill(200, 200, 255);
  textSize(16);
  text("Déplacez la souris pour guider votre armée.", width / 2, height / 2 - 35);
  text("Clic ou ESPACE pour tirer · Direction = mouvement du leader (ou souris si arrêté).", width / 2, height / 2 - 10);
  text("[F] Change la formation  ·  [D] Mode debug  ·  [R] Rejouer", width / 2, height / 2 + 20);

  fill(180, 80, 255);
  textSize(14);
  text("★  Les ennemis VIOLETS sont des ÉLITES (2 HP, esquivent les tirs)  ★", width / 2, height / 2 + 60);
  fill(50, 255, 150);
  text("⚡  Collectez les POWER-UPS pour booster votre vitesse ou votre force  ⚡", width / 2, height / 2 + 85);

  fill(100, 220, 100);
  textSize(22);
  text("Cliquez pour commencer", width / 2, height / 2 + 140);

  pop();
}

function drawGameOver() {
  push();
  fill(0, 0, 0, 180);
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER);

  fill(220, 50, 50);
  textSize(48);
  text("GAME OVER", width / 2, height / 2 - 80);

  fill(255, 220, 80);
  textSize(28);
  text(`Score final : ${score}`, width / 2, height / 2 - 20);

  fill(200, 200, 200);
  textSize(20);
  text(`Niveau atteint : ${level}`, width / 2, height / 2 + 25);

  fill(180, 80, 255);
  textSize(16);
  let eliteKills = Math.floor(score / EliteEnemy.SCORE_VALUE);
  // Indication orientative — on affiche le nombre de niveaux franchis
  text(`Niveaux franchis : ${level - 1}`, width / 2, height / 2 + 60);

  fill(100, 220, 100);
  textSize(20);
  text("Appuyez sur [R] pour rejouer", width / 2, height / 2 + 110);

  pop();
}

// ══════════════════════════════════════════════════════════════════════════
// INTERFACE (Sliders)
// ══════════════════════════════════════════════════════════════════════════

function createUI() {
  let container = createDiv('');
  container.style('display', 'flex');
  container.style('flex-wrap', 'wrap');
  container.style('gap', '16px');
  container.style('padding', '12px');
  container.style('background', '#111');
  container.style('font-family', 'monospace');
  container.style('color', '#ccc');
  container.style('font-size', '13px');
  container.style('max-width', '1000px');

  function makeSlider(key, labelTxt, min, max, defaultVal, step) {
    let wrapper = createDiv('');
    wrapper.style('display', 'flex');
    wrapper.style('flex-direction', 'column');
    wrapper.style('min-width', '150px');
    wrapper.parent(container);

    let lbl = createP(`${labelTxt}: <b id="${key}_val">${defaultVal}</b>`);
    lbl.style('margin', '0 0 4px 0');
    lbl.parent(wrapper);

    let sl = createSlider(min, max, defaultVal, step);
    sl.style('width', '140px');
    sl.parent(wrapper);

    sl.input(() => { select(`#${key}_val`).html(sl.value()); });
    sliders[key] = sl;
  }

  makeSlider('maxSpeed',         'Vitesse max',       1,  8,   4,    0.5);
  makeSlider('maxForce',         'Force max',        0.1, 1.0, 0.3,  0.05);
  makeSlider('separationWeight', 'Séparation ×',     0,   4,   1.5,  0.1);
  makeSlider('avoidWeight',      'Évitement ×',      0,   6,   3.0,  0.5);
  makeSlider('nbFollowers',      'Nombre followers', 1,  20,   8,    1);
  makeSlider('nbEnemies',        'Ennemis initiaux', 1,  10,   3,    1);
}

// ══════════════════════════════════════════════════════════════════════════
// ENTRÉES CLAVIER / SOURIS
// ══════════════════════════════════════════════════════════════════════════

/**
 * Calcule la direction de tir du prochain projectile.
 *
 *   - Si |leader.vel| > 0.5 → direction = leader.vel normalisée
 *   - Sinon                 → direction = vecteur leader.pos → souris normalisé
 *
 * @returns {p5.Vector} vecteur normalisé (mag = 1) indiquant la direction de tir
 * @pre  leader est initialisé, mouseX/mouseY sont valides
 * @post |retour| == 1
 * @note si leader.pos == souris (distance < 1 px), la direction par défaut est (1,0)
 *       pour éviter une division par zéro
 * @pure ne modifie aucun état global
 */
function getShootDirection() {
  if (leader.vel.mag() > 0.5) {
    return leader.vel.copy().normalize();
  }
  // Fallback : vers la souris
  let toMouse = createVector(mouseX - leader.pos.x, mouseY - leader.pos.y);
  if (toMouse.mag() < 1) toMouse.set(1, 0); // sécurité division par zéro
  return toMouse.normalize();
}

function fireProjectile() {
  let dir = getShootDirection();
  projectiles.push(new Projectile(leader.pos.x, leader.pos.y, dir));
}

function mousePressed() {
  if (!gameStarted) { initGame(); return; }
  if (gameOver)     return;

  fireProjectile();
}

function keyPressed() {
  // ESPACE → tirer
  if (key === ' ') {
    if (gameStarted && !gameOver) fireProjectile();
  }

  // D → toggle debug
  if (key === 'd' || key === 'D') {
    Vehicle.debug = !Vehicle.debug;
  }

  // R → relancer la partie
  if (key === 'r' || key === 'R') {
    initGame();
  }

  // F → changer la formation de l'armée
  if (key === 'f' || key === 'F') {
    Follower.cycleFormation();
    levelUpFlash = 8;
  }
}
