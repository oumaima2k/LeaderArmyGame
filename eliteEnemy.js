/**
 * eliteEnemy.js — Classe EliteEnemy (Option A — Ennemis élites)
 *
 * Les ennemis élites sont des variantes renforcées des ennemis normaux.
 * Ils apparaissent à partir du niveau 3 avec une probabilité croissante.
 *
 * Différences par rapport à Enemy :
 *   - Plus rapides (+40%) et plus réactifs (+30%)
 *   - Couleur violette distinctive
 *   - Survivent à 2 hits (health = 2)
 *   - Esquivent activement les projectiles (EVADE toujours actif dans un rayon étendu)
 *   - Rapportent plus de points (25 au lieu de 10)
 *
 * Composition de forces :
 *   F = pursue(leader)           × 1.4   (plus agressif)
 *     + separate(allEnemies)     × 1.0
 *     + avoid(obstacles)         × 3.0
 *     + evadeProjectile(closest) × 3.5   (toujours actif si projectile proche)
 *     + boundaries()             × 2.0
 */
class EliteEnemy extends Enemy {

  // Rayon de détection étendu pour l'esquive
  static ELITE_EVADE_RADIUS = 180;
  static SCORE_VALUE = 25;

  /**
   * @param {number} x, y  - position de spawn
   * @param {number} level - niveau de difficulté
   */
  constructor(x, y, level = 1) {
    super(x, y, level);

    // ── Statistiques améliorées ─────────────────────────────────────────────
    this.maxSpeed *= 1.4;
    this.maxForce *= 1.3;

    // ── Affichage : violet au lieu de rouge ─────────────────────────────────
    this.color = color(180, 60, 255);
    this.r_pourDessin = 16;
    this.r = this.r_pourDessin * 3;

    // ── Santé : supporte 2 hits ─────────────────────────────────────────────
    this.health = 2;

    // ── Rebrancher le BM avec les paramètres élites ─────────────────────────
    // On réinitialise le BM hérité pour ajuster les poids élites.
    this.bm = new BehaviorManager(this);
    this._setupEliteBehaviors();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION DU BEHAVIORMANAGER (version élite)
  // ══════════════════════════════════════════════════════════════════════════

  _setupEliteBehaviors() {
    // PURSUE plus agressif (poids 1.4 au lieu de 1.2)
    this.bm.addBehavior('pursue', () => {
      if (!this._leaderRef) return createVector(0, 0);
      return this.pursue(this._leaderRef);
    }, 1.4);

    // SEPARATION
    this.bm.addBehavior('separate', () => {
      return this.separate(this._enemiesRef);
    }, 1.0);

    // AVOID obstacles
    this.bm.addBehavior('avoid', () => {
      return this.avoid(this._obstaclesRef);
    }, 3.0);

    // EVADE projectiles — rayon étendu, poids plus élevé
    // Toujours évalué (pas de désactivation dynamique comme chez Enemy normal).
    this.bm.addBehavior('evadeProjectile', () => {
      let closest = this._getEliteClosestProjectile();
      if (!closest) return createVector(0, 0);
      return this.evade(closest);
    }, 3.5);

    // BOUNDARIES
    this.bm.addBehavior('boundaries', () => {
      return this.boundaries(0, 0, width, height, 50);
    }, 2.0);
  }

  /**
   * Cherche le projectile le plus proche dans le rayon étendu de l'élite.
   *
   * @returns {Projectile|null} le plus proche à < ELITE_EVADE_RADIUS (180 px),
   *          ou null si aucun
   * @pre  this._projectilesRef est un tableau valide
   * @note rayon 50 % plus large que l'ennemi normal (180 vs 120 px)
   * @complexity O(p) avec p = nombre de projectiles actifs
   * @pure
   */
  _getEliteClosestProjectile() {
    let closest = null;
    let minDist = EliteEnemy.ELITE_EVADE_RADIUS;

    for (let p of this._projectilesRef) {
      let d = this.pos.dist(p.pos);
      if (d < minDist) { minDist = d; closest = p; }
    }
    return closest;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPORTEMENTS (surcharge pour ne pas appeler _getClosestProjectile parent)
  // ══════════════════════════════════════════════════════════════════════════

  applyBehaviors(leader, allEnemies, obstacles,
                 avoidWeight = 3.0, separationWeight = 1.0, projectiles = []) {

    this._leaderRef      = leader;
    this._enemiesRef     = allEnemies;
    this._obstaclesRef   = obstacles;
    this._projectilesRef = projectiles;

    this.bm.setWeight('avoid',    avoidWeight);
    this.bm.setWeight('separate', separationWeight);

    // L'élite esquive toujours — pas besoin d'activer/désactiver ici.
    // Le comportement retourne (0,0) si aucun projectile n'est proche.

    this.applyForce(this.bm.getSteeringForce());
  }

  /**
   * Enregistre un hit reçu par l'élite.
   * L'élite survit au premier hit (health passe de 2 à 1),
   * et meurt au deuxième (health <= 0 → isDead = true).
   *
   * @returns {boolean} true si l'élite est mort (health <= 0), false sinon
   * @pre  health > 0 au moment de l'appel
   * @post health = health_avant − 1
   * @post si health <= 0 : this.isDead = true (irréversible)
   * @post this._hitFlash = 8 (déclenche l'animation de flash blanc)
   * @sideeffect modifie this.health, this.isDead, this._hitFlash
   */
  takeHit() {
    this.health--;
    if (this.health <= 0) {
      this.isDead = true;
    }
    // Effet visuel : flash blanc bref
    this._hitFlash = 8;
    return this.isDead;
  }

  update() {
    super.update();
    if (this._hitFlash > 0) this._hitFlash--;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════════════════════════════════════════

  drawVehicle() {
    push();
    // Flash blanc quand touché
    if (this._hitFlash > 0 && this._hitFlash % 2 === 0) {
      fill(255);
    } else {
      fill(this.color);
    }
    stroke(220, 150, 255);
    strokeWeight(2);
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());

    // Triangle légèrement plus grand que l'ennemi normal
    triangle(
      -this.r_pourDessin,     -this.r_pourDessin / 2,
      -this.r_pourDessin,      this.r_pourDessin / 2,
       this.r_pourDessin + 6,  0
    );

    // Gemme violette au centre
    fill(255, 200, 255);
    noStroke();
    circle(0, 0, 6);

    // Yeux violets
    fill(255, 255, 100);
    circle(3, -4, 4);
    circle(3,  4, 4);

    pop();

    // Barre de vie (2 HP max)
    if (this.health > 0) {
      let bw = 36;
      let bh = 4;
      let bx = this.pos.x - bw / 2;
      let by = this.pos.y - this.r_pourDessin - 10;
      push();
      noStroke();
      fill(60);
      rect(bx, by, bw, bh, 2);
      fill(180, 60, 255);
      rect(bx, by, bw * (this.health / 2), bh, 2);
      pop();
    }
  }
}
