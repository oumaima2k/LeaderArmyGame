/**
 * enemy.js — Classe Enemy
 *
 * Les ennemis apparaissent sur les bords du canvas et poursuivent le leader.
 *
 * Comportement intelligent (Option D) :
 *   Si un projectile s'approche à moins de EVADE_PROJECTILE_RADIUS pixels,
 *   l'ennemi déclenche un EVADE vers ce projectile — il dévie sa trajectoire
 *   plutôt que de foncer droit sur son destin.
 *
 * Composition de forces (via BehaviorManager) :
 *   F = pursue(leader)          × 1.2
 *     + separate(allEnemies)    × separationWeight
 *     + avoid(obstacles)        × avoidWeight
 *     + evadeProjectile(closest)× 2.5   (conditionnel)
 *     + boundaries()            × 2.0
 *
 * Invariants :
 *   - this.isDead est false à la construction, passe à true de façon irréversible
 *   - this.maxSpeed = 2.2 + min(level×0.1, 0.5) → toujours dans [2.2, 2.7]
 *   - evadeProjectile est actif ssi _getClosestProjectile() != null
 */
class Enemy extends Vehicle {

  // Distance de détection des projectiles pour le comportement d'esquive
  static EVADE_PROJECTILE_RADIUS = 120;

  /**
   * @param {number} x, y  - position initiale (spawn sur les bords)
   * @param {number} level - niveau de difficulté
   */
  constructor(x, y, level = 1) {
    super(x, y);

    // ── Difficulté dynamique ────────────────────────────────────────────────
    let speedBonus = min(level * 0.1, 0.5);
    this.maxSpeed = 2.2 + speedBonus;
    this.maxForce = 0.18 + speedBonus * 0.1;

    // ── Affichage ───────────────────────────────────────────────────────────
    this.color = color(220, 50, 50);
    this.r_pourDessin = 14;
    this.r = this.r_pourDessin * 3;

    // ── État ────────────────────────────────────────────────────────────────
    this.isDead = false;

    // ── Traînée ─────────────────────────────────────────────────────────────
    this.pathMaxLength = 22;

    // Vitesse initiale aléatoire pour éviter les regroupements au spawn
    this.vel = p5.Vector.random2D().mult(random(0.5, 1.5));

    // ── Contexte pour le BehaviorManager ────────────────────────────────────
    this._leaderRef      = null;
    this._enemiesRef     = [];
    this._obstaclesRef   = [];
    this._projectilesRef = [];

    // ── BehaviorManager ──────────────────────────────────────────────────────
    this.bm = new BehaviorManager(this);
    this._setupBehaviors();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION DU BEHAVIORMANAGER
  // ══════════════════════════════════════════════════════════════════════════

  _setupBehaviors() {
    // PURSUE le leader (poursuite prédictive)
    this.bm.addBehavior('pursue', () => {
      if (!this._leaderRef) return createVector(0, 0);
      return this.pursue(this._leaderRef);
    }, 1.2);

    // SEPARATION avec les autres ennemis
    this.bm.addBehavior('separate', () => {
      return this.separate(this._enemiesRef);
    }, 1.0);

    // AVOID obstacles
    this.bm.addBehavior('avoid', () => {
      return this.avoid(this._obstaclesRef);
    }, 3.0);

    // EVADE le projectile le plus proche (comportement intelligent)
    // Désactivé par défaut, activé si un projectile est trop proche.
    this.bm.addBehavior('evadeProjectile', () => {
      let closest = this._getClosestProjectile();
      if (!closest) return createVector(0, 0);
      return this.evade(closest);
    }, 2.5);
    this.bm.deactivate('evadeProjectile');

    // BOUNDARIES
    this.bm.addBehavior('boundaries', () => {
      return this.boundaries(0, 0, width, height, 50);
    }, 2.0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UTILITAIRES
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Retourne le projectile le plus proche dans le rayon de détection,
   * ou null s'il n'y en a pas.
   *
   * @returns {Projectile|null} le projectile le plus proche à < EVADE_PROJECTILE_RADIUS,
   *          ou null si aucun projectile n'est dans le rayon
   * @pre  this._projectilesRef est un tableau (peut être vide)
   * @complexity O(p) avec p = nombre de projectiles actifs
   * @pure ne modifie aucun état interne
   */
  _getClosestProjectile() {
    let closest = null;
    let minDist = Enemy.EVADE_PROJECTILE_RADIUS;

    for (let p of this._projectilesRef) {
      let d = this.pos.dist(p.pos);
      if (d < minDist) {
        minDist  = d;
        closest  = p;
      }
    }
    return closest;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPORTEMENTS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Met à jour le contexte du BM, active l'esquive si un projectile est proche,
   * puis applique la force résultante.
   *
   * @param {Leader}       leader
   * @param {Enemy[]}      allEnemies
   * @param {Obstacle[]}   obstacles
   * @param {number}       avoidWeight
   * @param {number}       separationWeight
   * @param {Projectile[]} projectiles - liste des projectiles actifs
   */
  applyBehaviors(leader, allEnemies, obstacles,
                 avoidWeight = 3.0, separationWeight = 1.0, projectiles = []) {

    // ── Mise à jour du contexte ──────────────────────────────────────────────
    this._leaderRef      = leader;
    this._enemiesRef     = allEnemies;
    this._obstaclesRef   = obstacles;
    this._projectilesRef = projectiles;

    // ── Mise à jour des poids ────────────────────────────────────────────────
    this.bm.setWeight('avoid',    avoidWeight);
    this.bm.setWeight('separate', separationWeight);

    // ── Comportement intelligent : esquiver les projectiles proches ──────────
    if (this._getClosestProjectile() !== null) {
      this.bm.activate('evadeProjectile');
    } else {
      this.bm.deactivate('evadeProjectile');
    }

    this.applyForce(this.bm.getSteeringForce());
  }

  /**
   * Vérifie si l'ennemi est en collision avec le leader (intersection de cercles).
   *
   * @param {Leader} leader - le leader (doit avoir .pos et .r_pourDessin)
   * @returns {boolean} true si les cercles d'affichage se chevauchent
   * @pre  leader.pos est valide, leader.r_pourDessin > 0
   * @note utilise r_pourDessin (rayon visuel), pas r (rayon de détection)
   *       → collision strictement visuelle, sans marge de tolérance
   * @pure
   */
  isCollidingWith(leader) {
    return this.pos.dist(leader.pos) < this.r_pourDessin + leader.r_pourDessin;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════════════════════════════════════════

  show() {
    this.drawPath();
    this.drawVehicle();

    if (Vehicle.debug) {
      this.drawVector(this.pos, p5.Vector.mult(this.vel, 10), color(255, 50, 50));
      push();
      noFill();
      stroke(255, 50, 50, 50);
      circle(this.pos.x, this.pos.y, this.r * 2);
      // Rayon de détection projectiles
      stroke(255, 200, 50, 40);
      circle(this.pos.x, this.pos.y, Enemy.EVADE_PROJECTILE_RADIUS * 2);
      pop();
    }
  }

  drawVehicle() {
    push();

    // Red glow
    drawingContext.shadowBlur  = 16;
    drawingContext.shadowColor = 'rgba(220, 50, 50, 0.8)';

    fill(this.color);
    stroke(255, 100, 100);
    strokeWeight(1.5);
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());

    triangle(
      -this.r_pourDessin,     -this.r_pourDessin / 2,
      -this.r_pourDessin,      this.r_pourDessin / 2,
       this.r_pourDessin + 4,  0
    );

    drawingContext.shadowBlur = 0;
    fill(255, 200, 0);
    noStroke();
    circle(2, -3, 4);
    circle(2,  3, 4);
    pop();
  }
}
