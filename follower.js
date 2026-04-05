/**
 * follower.js — Classe Follower
 *
 * Les followers forment une armée derrière le leader.
 * Supporte 3 formations sélectionnables avec [F] :
 *   - 'grid'   : grille derrière le leader (défaut)
 *   - 'V'      : formation en V comme les oiseaux migrateurs
 *   - 'circle' : cercle autour du leader
 *
 * Composition de forces (via BehaviorManager) :
 *   F = arrive(formationTarget)  × arriveWeight
 *     + separate(allFollowers)   × separationWeight
 *     + evade(leader)            × 2.0   (si dans la zone de danger)
 *     + avoid(obstacles)         × avoidWeight
 *     + boundaries()             × 2.0
 *
 * Invariants :
 *   - Follower.formation ∈ { 'grid', 'V', 'circle' }
 *   - Follower.totalCount est synchronisé chaque frame depuis sketch.js
 *   - this.formationIndex est immuable après construction
 *   - EVADE est activé uniquement si leader.isInDangerZone(this.pos) est vrai
 */
class Follower extends Vehicle {

  // ── Formation courante (statique : partagée par tous les followers) ─────────
  static formation  = 'grid';   // 'grid' | 'V' | 'circle'
  static totalCount = 8;        // mis à jour dans sketch.js chaque frame

  /**
   * Passe en revue les 3 formations dans l'ordre.
   */
  static cycleFormation() {
    const order = ['grid', 'V', 'circle'];
    const idx   = order.indexOf(Follower.formation);
    Follower.formation = order[(idx + 1) % order.length];
  }

  /**
   * @param {number} x, y          - position initiale
   * @param {number} formationIndex - index dans l'armée
   */
  constructor(x, y, formationIndex = 0) {
    super(x, y);

    // ── Paramètres de pilotage ──────────────────────────────────────────────
    this.maxSpeed = 3.8;
    this.maxForce = 0.28;

    // ── Affichage ───────────────────────────────────────────────────────────
    let t = formationIndex / 20;
    this.color = lerpColor(color(30, 100, 255), color(0, 220, 220), t);
    this.r_pourDessin = 13;
    this.r = this.r_pourDessin * 3;

    // ── Offset de formation (grille) ────────────────────────────────────────
    this.formationIndex = formationIndex;
    let row = Math.floor(formationIndex / 5);
    let col = formationIndex % 5;
    this.offsetBack = 60 + row * 45;
    this.offsetSide = (col - 2) * 40;

    // ── Traînée bleue ───────────────────────────────────────────────────────
    this.pathMaxLength = 20;

    // ── Contexte pour le BehaviorManager ────────────────────────────────────
    this._leaderRef    = null;
    this._followersRef = [];
    this._obstaclesRef = [];

    // ── BehaviorManager ──────────────────────────────────────────────────────
    this.bm = new BehaviorManager(this);
    this._setupBehaviors();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION DU BEHAVIORMANAGER
  // ══════════════════════════════════════════════════════════════════════════

  _setupBehaviors() {
    // ARRIVE vers la position de formation
    this.bm.addBehavior('arrive', () => {
      if (!this._leaderRef) return createVector(0, 0);
      let target = this.getFormationTarget(this._leaderRef);
      return this.arrive(target, 150);
    }, 1.0);

    // SEPARATION avec les autres followers
    this.bm.addBehavior('separate', () => {
      return this.separate(this._followersRef);
    }, 1.5);

    // EVADE le leader si dans sa zone de danger (désactivé par défaut)
    this.bm.addBehavior('evade', () => {
      if (!this._leaderRef) return createVector(0, 0);
      return this.evade(this._leaderRef);
    }, 2.0);
    this.bm.deactivate('evade'); // activé dynamiquement dans applyBehaviors

    // AVOID obstacles
    this.bm.addBehavior('avoid', () => {
      return this.avoid(this._obstaclesRef);
    }, 3.0);

    // BOUNDARIES
    this.bm.addBehavior('boundaries', () => {
      return this.boundaries(0, 0, width, height, 50);
    }, 2.0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CALCUL DE LA CIBLE DE FORMATION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Calcule la position cible du follower selon la formation active (Follower.formation).
   * La cible est exprimée dans le repère monde (coordonnées absolues).
   *
   * @param {Leader} leader - le leader à suivre (doit avoir .pos et .vel)
   * @returns {p5.Vector} position cible absolue dans le canvas
   * @pre  leader.pos et leader.vel sont des vecteurs valides
   * @post retourne toujours un vecteur valide (jamais null)
   * @note si |leader.vel| < 0.5 (arrêt), la cible est calculée dans
   *       l'orientation par défaut (axe X) pour éviter l'effondrement
   * @pure ne modifie aucun état interne
   */
  getFormationTarget(leader) {
    switch (Follower.formation) {
      case 'V':      return this._getVFormationTarget(leader);
      case 'circle': return this._getCircleFormationTarget(leader);
      default:       return this._getGridFormationTarget(leader);
    }
  }

  /**
   * Formation GRID — grille rectangulaire derrière le leader.
   *
   * Repère local du leader :
   *   axe longitudinal = leader.vel.normalize()    (direction de marche)
   *   axe latéral      = perpendiculaire (-dir.y, dir.x)
   *
   * Disposition :
   *   col = formationIndex % 5       → position latérale (0..4, centré sur 2)
   *   row = floor(formationIndex / 5)→ distance en profondeur
   *   offsetBack = 60 + row × 45 px
   *   offsetSide = (col − 2) × 40 px
   *
   * @param {Leader} leader
   * @returns {p5.Vector} position cible absolue
   * @pure
   */
  _getGridFormationTarget(leader) {
    if (leader.vel.mag() < 0.5) {
      return createVector(
        leader.pos.x - this.offsetBack,
        leader.pos.y + this.offsetSide
      );
    }
    let leaderDir  = leader.vel.copy().normalize();
    let leaderPerp = createVector(-leaderDir.y, leaderDir.x);
    let target = leader.pos.copy();
    target.sub(p5.Vector.mult(leaderDir,  this.offsetBack));
    target.add(p5.Vector.mult(leaderPerp, this.offsetSide));
    return target;
  }

  /**
   * Formation V — deux ailes symétriques derrière le leader (style oiseaux).
   *
   * Règles de placement :
   *   armIdx = floor(formationIndex / 2) → rang dans l'aile (0 = plus proche)
   *   side   = formationIndex % 2 == 0 ? −1 (gauche) : +1 (droite)
   *   back    = 55 + armIdx × 38 px
   *   lateral = side × (25 + armIdx × 30 px)
   *
   * @param {Leader} leader
   * @returns {p5.Vector} position cible absolue
   * @pre  formationIndex >= 0
   * @pure
   */
  _getVFormationTarget(leader) {
    let armIdx  = Math.floor(this.formationIndex / 2);
    let side    = (this.formationIndex % 2 === 0) ? -1 : 1;
    let back    = 55 + armIdx * 38;
    let lateral = side * (25 + armIdx * 30);

    if (leader.vel.mag() < 0.5) {
      return createVector(
        leader.pos.x - back,
        leader.pos.y + lateral
      );
    }
    let dir  = leader.vel.copy().normalize();
    let perp = createVector(-dir.y, dir.x);
    let target = leader.pos.copy();
    target.sub(p5.Vector.mult(dir,  back));
    target.add(p5.Vector.mult(perp, lateral));
    return target;
  }

  /**
   * Formation CIRCLE — répartition uniforme sur un cercle autour du leader.
   *
   * Angle du follower i = (i / total) × 2π  (sens trigonométrique)
   * Rayon fixe = 90 px, centré sur leader.pos.
   *
   * @param {Leader} leader
   * @returns {p5.Vector} position cible absolue
   * @pre  Follower.totalCount >= 1 (garanti par max() dans le code)
   * @note la formation ne tourne PAS avec la direction du leader (cercle fixe)
   * @pure
   */
  _getCircleFormationTarget(leader) {
    let total  = max(Follower.totalCount, 1);
    let angle  = (this.formationIndex / total) * TWO_PI;
    let radius = 90;
    let offset = createVector(cos(angle) * radius, sin(angle) * radius);
    return p5.Vector.add(leader.pos, offset);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPORTEMENTS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Met à jour le contexte et les poids du BM, active/désactive evade
   * selon la zone de danger, puis applique la force résultante.
   */
  applyBehaviors(leader, allFollowers, obstacles,
                 arriveWeight = 1.0, separationWeight = 1.5, avoidWeight = 3.0) {

    // ── Mise à jour du contexte ──────────────────────────────────────────────
    this._leaderRef    = leader;
    this._followersRef = allFollowers;
    this._obstaclesRef = obstacles;

    // ── Mise à jour des poids depuis les sliders ─────────────────────────────
    this.bm.setWeight('arrive',    arriveWeight);
    this.bm.setWeight('separate',  separationWeight);
    this.bm.setWeight('avoid',     avoidWeight);

    // ── Activation conditionnelle de EVADE ──────────────────────────────────
    // BM power : on active/désactive dynamiquement sans dupliquer de code.
    if (leader.isInDangerZone(this.pos)) {
      this.bm.activate('evade');
    } else {
      this.bm.deactivate('evade');
    }

    this.applyForce(this.bm.getSteeringForce());
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════════════════════════════════════════

  show() {
    this.drawPath();
    this.drawVehicle();

    if (Vehicle.debug) {
      this.drawVector(this.pos, p5.Vector.mult(this.vel, 10), color(50, 150, 255));
      push();
      noFill();
      stroke(50, 150, 255, 60);
      circle(this.pos.x, this.pos.y, this.r * 2);
      pop();
    }
  }

  drawVehicle() {
    push();
    fill(this.color);
    stroke(100, 180, 255);
    strokeWeight(1.5);
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());

    triangle(
      -this.r_pourDessin, -this.r_pourDessin / 2,
      -this.r_pourDessin,  this.r_pourDessin / 2,
       this.r_pourDessin,  0
    );
    pop();
  }
}
