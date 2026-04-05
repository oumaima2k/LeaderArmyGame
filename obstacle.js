/**
 * obstacle.js — Classe Obstacle
 *
 * Obstacles circulaires statiques que tous les véhicules doivent éviter.
 * Ce ne sont PAS des Vehicle (ils ne bougent pas), mais ils participent
 * au calcul de la force d'évitement dans vehicle.avoid().
 *
 * Structure requise par vehicle.avoid() :
 *   obstacle.pos → p5.Vector (centre de l'obstacle)
 *   obstacle.r   → number    (rayon de l'obstacle)
 */
class Obstacle {

  /**
   * @param {number} x, y   - position du centre
   * @param {number} r      - rayon
   * @param {color}  couleur - couleur d'affichage
   */
  constructor(x, y, r, couleur) {
    this.pos = createVector(x, y);
    this.r = r;
    this.color = couleur || color(100, 80, 60);
  }

  show() {
    push();
    // Corps de l'obstacle
    fill(this.color);
    stroke(50, 40, 30);
    strokeWeight(3);
    ellipse(this.pos.x, this.pos.y, this.r * 2);

    // Centre sombre
    fill(30, 20, 10);
    noStroke();
    ellipse(this.pos.x, this.pos.y, 10);

    // Zone de danger (rayon étendu) en mode debug
    if (Vehicle.debug) {
      noFill();
      stroke(255, 100, 0, 60);
      strokeWeight(1);
      // Montre le rayon effectif qui inclut la zone d'évitement du véhicule
      circle(this.pos.x, this.pos.y, (this.r + 24) * 2);
    }
    pop();
  }
}
