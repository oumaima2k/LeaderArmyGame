/**
 * behaviorManager.js — Gestionnaire de comportements (BehaviorManager)
 *
 * Permet à chaque Vehicle de combiner plusieurs steering behaviors
 * avec des poids individuels, de façon modulaire et dynamique.
 *
 * Principe :
 *   Chaque comportement est une fonction () → p5.Vector.
 *   getSteeringForce() somme toutes les forces actives, pondérées.
 *
 * Usage typique (dans le constructeur d'un Vehicle) :
 *   this.bm = new BehaviorManager(this);
 *   this.bm.addBehavior('arrive', () => this.arrive(this._target), 1.0);
 *   this.bm.addBehavior('avoid',  () => this.avoid(this._obstacles), 3.0);
 *
 * Usage dans applyBehaviors() :
 *   this._target    = target;       // met à jour le contexte
 *   this._obstacles = obstacles;
 *   this.applyForce(this.bm.getSteeringForce());
 *
 * Invariants :
 *   - Les noms de comportements sont uniques dans this.behaviors
 *   - Un comportement désactivé (active=false) ne contribue JAMAIS à la force
 *   - getSteeringForce() ne modifie pas les comportements enregistrés
 *   - L'ordre d'itération de la Map est l'ordre d'insertion (garanti en ES6)
 */
class BehaviorManager {

  /**
   * @param {Vehicle} vehicle - le véhicule propriétaire
   */
  constructor(vehicle) {
    this.vehicle = vehicle;
    // Map : name → { fn: Function, weight: number, active: boolean }
    this.behaviors = new Map();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GESTION DES COMPORTEMENTS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Enregistre un comportement.
   * @param {string}   name   - identifiant unique (ex: 'arrive', 'separate')
   * @param {Function} fn     - () => p5.Vector, fermeture sur le contexte du Vehicle
   * @param {number}   weight - poids multiplicateur (1.0 = neutre)
   */
  addBehavior(name, fn, weight = 1.0) {
    this.behaviors.set(name, { fn, weight, active: true });
  }

  /** Supprime définitivement un comportement. */
  removeBehavior(name) {
    this.behaviors.delete(name);
  }

  /**
   * Modifie le poids d'un comportement existant.
   * Utile pour ajuster la pondération dynamiquement (ex: sliders UI).
   */
  setWeight(name, weight) {
    const b = this.behaviors.get(name);
    if (b) b.weight = weight;
  }

  /** Active un comportement (inclus dans getSteeringForce). */
  activate(name) {
    const b = this.behaviors.get(name);
    if (b) b.active = true;
  }

  /**
   * Désactive un comportement (exclu du calcul, mais conservé en mémoire).
   * Permet de le réactiver rapidement avec activate().
   */
  deactivate(name) {
    const b = this.behaviors.get(name);
    if (b) b.active = false;
  }

  /** Retourne true si le comportement est actif. */
  isActive(name) {
    const b = this.behaviors.get(name);
    return b ? b.active : false;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CALCUL DE LA FORCE RÉSULTANTE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Calcule et retourne la force de direction combinée.
   *   force_totale = Σ (fn_i() × weight_i)  pour tout comportement i actif
   *
   * Les comportements qui retournent un vecteur nul (mag=0) ne contribuent pas.
   *
   * @returns {p5.Vector} force résultante (peut être (0,0) si tout est inactif)
   * @pre  les fermetures fn_i doivent lire des contextes à jour (mis à jour
   *       avant cet appel dans applyBehaviors() du Vehicle concerné)
   * @post ne modifie aucun comportement enregistré
   * @complexity O(k) avec k = nombre de comportements enregistrés
   * @note la force retournée n'est PAS limitée à maxForce — c'est Vehicle.applyForce()
   *       et Vehicle.update() qui contraignent vel via limit(maxSpeed)
   */
  getSteeringForce() {
    let total = createVector(0, 0);

    for (const [, b] of this.behaviors) {
      if (!b.active) continue;

      const f = b.fn();
      if (f && f.mag() > 0) {
        f.mult(b.weight);
        total.add(f);
      }
    }

    return total;
  }
}
