/**
 * powerUp.js — Classe PowerUp (Option B — Power-ups)
 *
 * Les power-ups errent aléatoirement sur la carte (comportement WANDER).
 * Quand le leader ou un follower les touche, un boost temporaire est appliqué.
 *
 * Types de power-up :
 *   'speed'  — boost de vitesse × 1.6 pendant 5 secondes
 *   'force'  — boost de force (manœuvrabilité) × 1.5 pendant 5 secondes
 *
 * Composition de forces :
 *   F = wander() × 1.0   (errance fluide)
 *     + boundaries() × 3.0 (reste bien visible dans le canvas)
 */
class PowerUp extends Vehicle {

  static BOOST_DURATION = 300;  // frames (~5s à 60fps)
  static COLLECT_RADIUS = 28;   // rayon de collection

  /**
   * @param {number} x, y
   * @param {string} type - 'speed' | 'force'
   */
  constructor(x, y, type = 'speed') {
    super(x, y);

    this.type = type;

    // ── Physique légère (flottement) ────────────────────────────────────────
    this.maxSpeed = 1.2;
    this.maxForce = 0.08;
    this.r_pourDessin = 12;
    this.r = this.r_pourDessin;

    // ── Visuel ───────────────────────────────────────────────────────────────
    this.color = (type === 'speed')
      ? color(50, 255, 150)    // vert menthe → boost vitesse
      : color(255, 180, 50);   // or → boost force

    // ── Cycle de vie ─────────────────────────────────────────────────────────
    this.collected = false;
    this._pulse = 0; // compteur pour l'effet pulsant

    // Vitesse initiale aléatoire légère
    this.vel = p5.Vector.random2D().mult(0.5);

    // ── BehaviorManager ──────────────────────────────────────────────────────
    this.bm = new BehaviorManager(this);
    this.bm.addBehavior('wander', () => {
      return this.wander(20, 50, 0.25);
    }, 1.0);
    this.bm.addBehavior('boundaries', () => {
      return this.boundaries(50, 50, width - 100, height - 100, 60);
    }, 3.0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPORTEMENTS
  // ══════════════════════════════════════════════════════════════════════════

  applyBehaviors() {
    this.applyForce(this.bm.getSteeringForce());
  }

  /**
   * Vérifie si un véhicule est dans le rayon de collection.
   * @param {Vehicle} vehicle
   * @returns {boolean}
   */
  isCollidingWith(vehicle) {
    return this.pos.dist(vehicle.pos) < PowerUp.COLLECT_RADIUS + vehicle.r_pourDessin;
  }

  /**
   * Applique le boost au véhicule collecteur et marque le power-up comme collecté.
   * Sauvegarde les stats originales pour les restaurer après expiration du boost.
   *
   * @param {Vehicle} vehicle - le véhicule qui collecte (leader ou follower)
   * @pre  vehicle._boostTimer == 0 ou undefined (sinon le boost précédent est écrasé)
   * @post this.collected = true
   * @post vehicle._boostTimer = PowerUp.BOOST_DURATION (300 frames)
   * @post vehicle._boostType  = this.type
   * @post vehicle.maxSpeed *= 1.6 (si 'speed') OU vehicle.maxForce *= 1.5 (si 'force')
   * @post vehicle._originalMaxSpeed et _originalMaxForce sauvegardent les valeurs d'avant
   * @sideeffect modifie vehicle.maxSpeed ou maxForce, plus les champs _boost*
   * @note la restauration est effectuée par tickBoost() dans sketch.js, pas ici
   */
  applyTo(vehicle) {
    this.collected = true;

    // Sauvegarde des valeurs originales
    vehicle._originalMaxSpeed = vehicle.maxSpeed;
    vehicle._originalMaxForce = vehicle.maxForce;
    vehicle._boostTimer       = PowerUp.BOOST_DURATION;
    vehicle._boostType        = this.type;

    // Application du boost
    if (this.type === 'speed') {
      vehicle.maxSpeed *= 1.6;
    } else {
      vehicle.maxForce *= 1.5;
    }
  }

  update() {
    super.update();
    this._pulse++;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════════════════════════════════════════

  show() {
    let pulseFactor = 0.3 * sin(this._pulse * 0.1);
    let r = this.r_pourDessin * (1 + pulseFactor);

    push();
    translate(this.pos.x, this.pos.y);

    // Halo extérieur pulsant
    let c = this.color;
    fill(red(c), green(c), blue(c), 50 + 40 * sin(this._pulse * 0.1));
    noStroke();
    circle(0, 0, r * 3.5);

    // Corps principal
    fill(c);
    stroke(255, 255, 255, 160);
    strokeWeight(1.5);
    circle(0, 0, r * 2);

    // Icône au centre
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(12);
    text(this.type === 'speed' ? '⚡' : '★', 0, 1);

    pop();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// UTILITAIRE — Tick du boost sur un véhicule
// ══════════════════════════════════════════════════════════════════════════

/**
 * À appeler dans update() de chaque véhicule boosté,
 * ou centralement dans sketch.js pour le leader et les followers.
 * Restaure les stats quand le boost expire.
 *
 * @param {Vehicle} vehicle
 */
function tickBoost(vehicle) {
  if (!vehicle._boostTimer) return;

  vehicle._boostTimer--;

  if (vehicle._boostTimer <= 0) {
    // Restauration
    vehicle.maxSpeed  = vehicle._originalMaxSpeed;
    vehicle.maxForce  = vehicle._originalMaxForce;
    vehicle._boostTimer = 0;
    vehicle._boostType  = null;
  }
}
