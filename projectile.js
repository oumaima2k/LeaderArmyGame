/**
 * projectile.js — Classe Projectile
 *
 * Les projectiles sont tirés par clic souris OU touche ESPACE depuis le leader.
 * Ils se déplacent en ligne droite dans une direction fixe (pas de tracking ennemi).
 *
 * Direction de tir :
 *   - Si le leader est en mouvement → direction = vitesse normalisée du leader
 *   - Si le leader est arrêté       → direction = vers la souris
 *
 * Comportement :
 *   - Mouvement rectiligne : la direction initiale est maintenue via SEEK
 *     sur un point fantôme loin devant (pas de poursuite d'ennemi).
 *   - AVOID obstacles : dévie pour esquiver, puis reprend la direction d'origine.
 *
 * Composition de forces (via BehaviorManager) :
 *   F = seek(pointFantôme) × 1.0   (ligne droite dans la direction de tir)
 *     + avoid(obstacles)   × 4.0   (évitement d'obstacles, priorité haute)
 *     + boundaries()       × 2.0
 *
 * Invariants :
 *   - this._direction est normalisé et immuable après construction
 *   - this.lifetime décroît de 1 par frame ; isExpired() est vrai quand lifetime <= 0
 *   - Un projectile consommé par un hit reçoit lifetime = 0 (même condition)
 */
class Projectile extends Vehicle {

  /**
   * @param {number}    x, y      - position de tir
   * @param {p5.Vector} direction - vecteur normalisé de direction
   */
  constructor(x, y, direction) {
    super(x, y);

    // ── Paramètres de pilotage ──────────────────────────────────────────────
    this.maxSpeed = 7;
    this.maxForce = 1.2; // plus élevé pour bien reprendre la trajectoire après avoid

    // ── Affichage ───────────────────────────────────────────────────────────
    this.color = color(255, 255, 80);
    this.r_pourDessin = 7;
    this.r = this.r_pourDessin * 2;

    // ── Cycle de vie ────────────────────────────────────────────────────────
    this.lifetime = 240; // ~4 secondes à 60fps

    // ── Traînée ─────────────────────────────────────────────────────────────
    this.pathMaxLength = 20;

    // ── Direction fixe de tir ────────────────────────────────────────────────
    // On normalise et on lance le projectile à vitesse max dans cette direction.
    this._direction = direction.copy().normalize();
    this.vel = this._direction.copy().mult(this.maxSpeed);

    // ── Contexte pour le BehaviorManager ────────────────────────────────────
    this._obstaclesRef = [];

    // ── BehaviorManager ──────────────────────────────────────────────────────
    this.bm = new BehaviorManager(this);
    this._setupBehaviors();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION DU BEHAVIORMANAGER
  // ══════════════════════════════════════════════════════════════════════════

  _setupBehaviors() {
    // SEEK vers un point fantôme très loin devant dans la direction de tir.
    // Cela maintient la trajectoire rectiligne via la formule steering = desired - vel.
    // Après un AVOID, la vitesse dévie ; ce SEEK la ramène doucement vers la direction originale.
    this.bm.addBehavior('seek', () => {
      // Point fantôme = position actuelle + direction × grande distance
      let ghost = p5.Vector.add(this.pos, p5.Vector.mult(this._direction, 500));
      return this.seek(ghost);
    }, 1.0);

    // AVOID obstacles — poids élevé pour dévier avant la collision
    this.bm.addBehavior('avoid', () => {
      return this.avoid(this._obstaclesRef);
    }, 4.0);

    // BOUNDARIES
    this.bm.addBehavior('boundaries', () => {
      return this.boundaries(0, 0, width, height, 30);
    }, 2.0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPORTEMENTS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * @param {Obstacle[]} obstacles - liste des obstacles à éviter
   */
  applyBehaviors(obstacles) {
    this._obstaclesRef = obstacles;
    this.applyForce(this.bm.getSteeringForce());
  }

  /**
   * Vérifie si le projectile touche un ennemi (collision cercle–cercle).
   *
   * @param {Enemy} enemy - ennemi à tester (doit avoir .pos et .r_pourDessin)
   * @returns {boolean} true si les cercles visuels se chevauchent
   * @pre  enemy.isDead == false (vérification externe dans sketch.js)
   * @note utilise r_pourDessin (rayon visuel, pas r de détection) — volontaire
   *       pour que la collision soit visuellement cohérente
   * @pure
   */
  isHitting(enemy) {
    return this.pos.dist(enemy.pos) < this.r_pourDessin + enemy.r_pourDessin;
  }

  /**
   * Indique si le projectile doit être retiré du jeu.
   *
   * @returns {boolean} true si lifetime <= 0 (expiration naturelle ou hit)
   * @note un hit met lifetime = 0 dans checkProjectileCollisions() → même chemin
   *       de sortie que l'expiration temporelle
   * @pure
   */
  isExpired() {
    return this.lifetime <= 0;
  }

  update() {
    super.update();
    this.lifetime--;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════════════════════════════════════════

  show() {
    // Smooth fading trail using base drawPath()
    this.drawPath();

    push();
    translate(this.pos.x, this.pos.y);

    // Yellow glow
    drawingContext.shadowBlur  = 20;
    drawingContext.shadowColor = 'rgba(255, 255, 0, 0.9)';

    fill(255, 200, 0, 80);
    noStroke();
    circle(0, 0, this.r_pourDessin * 3);

    fill(255, 240, 0);
    stroke(255, 255, 200);
    strokeWeight(1);
    circle(0, 0, this.r_pourDessin * 2);

    drawingContext.shadowBlur = 0;
    fill(255);
    noStroke();
    circle(-1, -1, this.r_pourDessin * 0.5);
    pop();

    if (Vehicle.debug) {
      this.drawVector(this.pos, p5.Vector.mult(this.vel, 5), color(255, 255, 0));
      // Affiche la direction de tir originale en cyan
      this.drawVector(this.pos, p5.Vector.mult(this._direction, 40), color(0, 220, 255));
      push();
      noFill();
      stroke(255, 255, 0, 80);
      circle(this.pos.x, this.pos.y, (this.r_pourDessin + 14) * 2);
      pop();
    }
  }
}
