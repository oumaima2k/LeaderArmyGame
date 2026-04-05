/**
 * leader.js — Classe Leader
 *
 * Le joueur contrôle le Leader à la souris.
 * Le Leader utilise ARRIVE pour se déplacer vers la position de la souris.
 *
 * Particularité : il possède une "zone de danger" en forme de cône devant lui.
 * Les followers qui entrent dans cette zone doivent s'écarter (EVADE).
 *
 * Composition de forces (via BehaviorManager) :
 *   F = arrive(mousePos) × 1.0
 *     + avoid(obstacles)  × 3.0
 *     + boundaries()      × 2.0
 *
 * Invariants :
 *   - 0 <= this.health <= this.maxHealth
 *   - this.hitCooldown >= 0 (décrémenté chaque frame dans update())
 *   - this.color est or (255, 215, 0) hors état de dégât
 */
class Leader extends Vehicle {

  constructor(x, y) {
    super(x, y);

    // ── Paramètres de pilotage ──────────────────────────────────────────────
    this.maxSpeed = 5;
    this.maxForce = 0.4;

    // ── Affichage ───────────────────────────────────────────────────────────
    this.color = color(255, 215, 0); // or / gold
    this.r_pourDessin = 20;
    this.r = this.r_pourDessin * 3;

    // ── Zone de danger (cône avant) ─────────────────────────────────────────
    this.dangerZoneAngle    = PI / 4;   // 45° de chaque côté = cône de 90°
    this.dangerZoneDistance = 130;

    // ── Traînée dorée ───────────────────────────────────────────────────────
    this.pathMaxLength = 55;

    // ── Points de vie ───────────────────────────────────────────────────────
    this.maxHealth  = 5;
    this.health     = this.maxHealth;
    this.hitCooldown = 0;

    // ── Contexte pour le BehaviorManager ────────────────────────────────────
    this._mouseTarget = createVector(x, y);
    this._obstacles   = [];

    // ── BehaviorManager ──────────────────────────────────────────────────────
    this.bm = new BehaviorManager(this);
    this._setupBehaviors();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION DU BEHAVIORMANAGER
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Enregistre les comportements du leader dans son BehaviorManager.
   * Les fermetures référencent this._mouseTarget et this._obstacles,
   * mis à jour chaque frame dans applyBehaviors().
   */
  _setupBehaviors() {
    // ARRIVE vers la souris (ralentit dans un rayon de 80px)
    this.bm.addBehavior('arrive', () => {
      return this.arrive(this._mouseTarget, 80);
    }, 1.0);

    // AVOID obstacles
    this.bm.addBehavior('avoid', () => {
      return this.avoid(this._obstacles);
    }, 3.0);

    // BOUNDARIES : rester dans le canvas
    this.bm.addBehavior('boundaries', () => {
      return this.boundaries(0, 0, width, height, 50);
    }, 2.0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ZONE DE DANGER
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Vérifie si une position est à l'intérieur du cône de danger avant du leader.
   *
   * Le cône est défini dans l'espace local du leader :
   *   - Axe principal : direction de this.vel
   *   - Demi-angle    : this.dangerZoneAngle (PI/4 = 45°)
   *   - Profondeur    : this.dangerZoneDistance (130 px)
   *
   * @param {p5.Vector} pos - position à tester (coordonnées monde)
   * @returns {boolean} true si pos est dans le cône ET à portée
   * @pre  pos est un p5.Vector valide
   * @post retourne toujours false si |this.vel| < 0.5 (leader à l'arrêt)
   * @pure ne modifie aucun état interne
   */
  isInDangerZone(pos) {
    if (this.vel.mag() < 0.5) return false;

    let toPos    = p5.Vector.sub(pos, this.pos);
    let distance = toPos.mag();

    if (distance > this.dangerZoneDistance) return false;

    let angle = this.vel.angleBetween(toPos);
    return abs(angle) < this.dangerZoneAngle;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPORTEMENTS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Met à jour le contexte du BehaviorManager, puis applique la force résultante.
   * @param {p5.Vector}  mouseTarget
   * @param {Obstacle[]} obstacles
   */
  applyBehaviors(mouseTarget, obstacles) {
    // Mise à jour du contexte (lu par les fermetures du BM)
    this._mouseTarget = mouseTarget;
    this._obstacles   = obstacles;

    this.applyForce(this.bm.getSteeringForce());
  }

  /**
   * Enregistre un coup reçu d'un ennemi.
   * Le cooldown d'invincibilité empêche de perdre plusieurs PV par contact continu.
   *
   * @pre  appelé uniquement quand une collision ennemi–leader est détectée
   * @post si this.hitCooldown <= 0 : this.health -= 1, this.hitCooldown = 60
   * @post si this.hitCooldown > 0  : aucun effet (période d'invincibilité)
   * @sideeffect modifie this.health et this.hitCooldown
   * @note la mort (health <= 0) est détectée dans sketch.js, pas ici
   */
  takeDamage() {
    if (this.hitCooldown <= 0) {
      this.health -= 1;
      this.hitCooldown = 60; // 1 seconde d'invincibilité
    }
  }

  update() {
    super.update();
    if (this.hitCooldown > 0) this.hitCooldown--;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════════════════════════════════════════

  show() {
    this.drawPath();
    this.drawDangerZone();
    this.drawVehicle();
    this.drawHealthBar();

    if (Vehicle.debug) {
      this.drawVector(this.pos, p5.Vector.mult(this.vel, 10), color(255, 80, 80));
      this.drawVector(this.pos, p5.Vector.mult(this.acc, 50), color(255));
    }
  }

  drawDangerZone() {
    if (this.vel.mag() < 0.5) return;

    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());

    fill(255, 60, 60, 50);
    stroke(255, 80, 80, 120);
    strokeWeight(1);

    beginShape();
    vertex(0, 0);
    for (let a = -this.dangerZoneAngle; a <= this.dangerZoneAngle; a += 0.05) {
      vertex(cos(a) * this.dangerZoneDistance, sin(a) * this.dangerZoneDistance);
    }
    endShape(CLOSE);
    pop();
  }

  drawHealthBar() {
    let barW = 50;
    let barH = 6;
    let x    = this.pos.x - barW / 2;
    let y    = this.pos.y - this.r_pourDessin - 14;
    let ratio = this.health / this.maxHealth;

    push();
    noStroke();
    fill(80);
    rect(x, y, barW, barH, 3);
    fill(lerpColor(color(220, 50, 50), color(50, 220, 50), ratio));
    rect(x, y, barW * ratio, barH, 3);
    pop();
  }

  drawVehicle() {
    push();

    // Gold glow
    drawingContext.shadowBlur  = 22;
    drawingContext.shadowColor = 'rgba(255, 200, 0, 0.75)';

    if (this.hitCooldown > 0 && frameCount % 6 < 3) {
      fill(255, 80, 80);
      drawingContext.shadowColor = 'rgba(255, 80, 80, 0.9)';
    } else {
      fill(this.color);
    }
    stroke(255, 200, 0);
    strokeWeight(2);
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());

    triangle(
      -this.r_pourDessin, -this.r_pourDessin / 2,
      -this.r_pourDessin,  this.r_pourDessin / 2,
       this.r_pourDessin,  0
    );

    drawingContext.shadowBlur = 0;
    fill(255, 255, 200);
    noStroke();
    circle(0, 0, 6);
    pop();
  }
}
