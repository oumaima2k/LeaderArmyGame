/**
 * vehicle.js — Classe de base Vehicle
 *
 * Basé sur les Steering Behaviors de Craig Reynolds.
 * Toutes les entités du jeu (leader, followers, ennemis, projectiles)
 * héritent de cette classe.
 *
 * Principe fondamental :
 *   steering_force = desired_velocity - current_velocity
 *
 * Le mouvement est TOUJOURS contrôlé par des forces → jamais de manipulation
 * directe de la position.
 */

/**
 * Calcule la projection orthogonale du point `a` sur la droite définie par
 * le vecteur `pos → b`. Utilisé dans le path following.
 */
function findProjection(pos, a, b) {
  let v1 = p5.Vector.sub(a, pos);
  let v2 = p5.Vector.sub(b, pos);
  v2.normalize();
  let sp = v1.dot(v2);
  v2.mult(sp);
  v2.add(pos);
  return v2;
}

/**
 * Invariants de classe Vehicle :
 *   - this.pos, this.vel, this.acc sont toujours des p5.Vector valides
 *   - this.maxSpeed > 0, this.maxForce > 0
 *   - this.acc est remis à (0,0) à la fin de chaque frame (après update())
 *   - La position n'est JAMAIS modifiée directement : passer par applyForce()
 *   - this.path.length <= this.pathMaxLength (invariant maintenu par update())
 */
class Vehicle {
  // Mode debug global : affiche les vecteurs et zones de détection
  static debug = false;

  /**
   * @param {number} x - position initiale horizontale (pixels, 0..width)
   * @param {number} y - position initiale verticale  (pixels, 0..height)
   * @pre  x et y sont des nombres finis
   * @post this.pos = (x, y), this.vel = (0,0), this.acc = (0,0)
   */
  constructor(x, y) {
    // ── Physique ────────────────────────────────────────────────────────────
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);

    // ── Paramètres de pilotage ──────────────────────────────────────────────
    this.maxSpeed = 4;   // vitesse maximale (pixels/frame)
    this.maxForce = 0.2; // force de direction maximale

    // ── Affichage ───────────────────────────────────────────────────────────
    this.color = color(255);
    this.r_pourDessin = 16;              // rayon pour le dessin
    this.r = this.r_pourDessin * 3;      // rayon de détection/séparation

    // ── Évitement d'obstacles ───────────────────────────────────────────────
    // Demi-largeur de la zone de détection devant le véhicule
    this.largeurZoneEvitementDevantVaisseau = this.r / 2;

    // ── Traînée (chemin derrière le véhicule) ───────────────────────────────
    this.path = [];
    this.pathMaxLength = 35;

    // ── Errance (wander) ────────────────────────────────────────────────────
    this.wanderTheta = random(TWO_PI); // angle courant sur le cercle de wander
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPORTEMENTS DE DIRECTION (Steering Behaviors)
  // Chaque méthode renvoie un vecteur force — elle ne l'applique PAS.
  // C'est applyBehaviors() de la sous-classe qui choisit comment combiner.
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * SEEK — Se diriger vers une cible à vitesse maximale.
   * Avec arrival=true, ralentit dans le rayon d'arrivée.
   *
   * @param {p5.Vector} target     - position cible (doit être un vecteur valide)
   * @param {boolean}   arrival    - activer le ralentissement progressif
   * @param {number}    slowRadius - rayon de freinage en pixels (> 0)
   * @returns {p5.Vector} vecteur force limité à this.maxForce
   * @pre  target != null, slowRadius > 0 si arrival = true
   * @post |retour| <= this.maxForce
   * @pure ne modifie aucun état interne
   */
  seek(target, arrival = false, slowRadius = 100) {
    let force = p5.Vector.sub(target, this.pos);
    let desiredSpeed = this.maxSpeed;

    if (arrival) {
      let distance = force.mag();
      if (distance < slowRadius) {
        // Proportionnel à la distance : plus on est proche, plus on ralentit
        desiredSpeed = map(distance, 0, slowRadius, 0, this.maxSpeed);
      }
    }

    force.setMag(desiredSpeed);
    // steering = desired - current_velocity
    force.sub(this.vel);
    force.limit(this.maxForce);
    return force;
  }

  /**
   * FLEE — Fuir une cible (inverse de seek).
   * @param {p5.Vector} target
   * @returns {p5.Vector}
   */
  flee(target) {
    return this.seek(target).mult(-1);
  }

  /**
   * ARRIVE — Seek avec décélération progressive à l'approche de la cible.
   * @param {p5.Vector} target
   * @param {number}    slowRadius (optionnel)
   * @returns {p5.Vector}
   */
  arrive(target, slowRadius = 100) {
    return this.seek(target, true, slowRadius);
  }

  /**
   * PURSUE — Poursuit un véhicule en prédisant sa position future.
   * Anticipe la position dans ~10 frames → vise là-bas.
   *
   * @param {Vehicle} vehicle - véhicule à poursuivre (doit avoir .pos et .vel)
   * @returns {p5.Vector} force de direction vers la position prédite
   * @pre  vehicle.vel est un vecteur valide (peut être nul)
   * @post si vehicle.vel = (0,0) → comportement identique à seek(vehicle.pos)
   * @note l'horizon de prédiction fixe (10 frames) peut causer un dépassement
   *       si la cible s'arrête brusquement — acceptable pour ce jeu
   * @pure ne modifie aucun état interne
   */
  pursue(vehicle) {
    let target = vehicle.pos.copy();
    let prediction = vehicle.vel.copy();
    prediction.mult(10); // anticipation de 10 frames
    target.add(prediction);

    // Affichage du point prédit en mode debug
    if (Vehicle.debug) {
      push();
      fill(0, 255, 0);
      noStroke();
      circle(target.x, target.y, 10);
      pop();
    }

    return this.seek(target);
  }

  /**
   * EVADE — Fuir la position future d'un véhicule (inverse de pursue).
   * @param {Vehicle} vehicle
   * @returns {p5.Vector}
   */
  evade(vehicle) {
    let pursuit = this.pursue(vehicle);
    pursuit.mult(-1);
    return pursuit;
  }

  /**
   * WANDER — Errance : mouvement aléatoire mais fluide.
   * Déplace un point sur un cercle imaginaire devant le véhicule.
   * L'angle theta évolue doucement chaque frame → pas de saccades.
   *
   * @param {number} wanderRadius    - rayon du cercle de wander
   * @param {number} distanceCercle  - distance du cercle devant le véhicule
   * @param {number} displaceRange   - amplitude de variation de l'angle
   * @returns {p5.Vector}
   */
  wander(wanderRadius = 25, distanceCercle = 60, displaceRange = 0.3) {
    // Variation douce de l'angle (jamais aléatoire pur = pas de saccades)
    this.wanderTheta += random(-displaceRange, displaceRange);

    // Centre du cercle de wander : devant le véhicule, dans sa direction
    let circleCenter = this.vel.copy();
    circleCenter.setMag(distanceCercle);

    // Point sur le cercle correspondant à l'angle courant
    let offset = createVector(
      wanderRadius * cos(this.wanderTheta),
      wanderRadius * sin(this.wanderTheta)
    );

    // Cible = centre du cercle + offset
    let wanderTarget = p5.Vector.add(
      p5.Vector.add(this.pos, circleCenter),
      offset
    );

    if (Vehicle.debug) {
      push();
      noFill();
      stroke(255, 255, 0, 100);
      let cc = p5.Vector.add(this.pos, circleCenter);
      circle(cc.x, cc.y, wanderRadius * 2);
      fill(0, 255, 0);
      noStroke();
      circle(wanderTarget.x, wanderTarget.y, 6);
      pop();
    }

    return this.seek(wanderTarget);
  }

  /**
   * SEPARATE — Maintenir une distance minimale par rapport aux voisins.
   * Plus un voisin est proche, plus la force de répulsion est grande.
   *
   * @param {Vehicle[]} boids - liste des voisins (peut inclure this, ignoré si d==0)
   * @returns {p5.Vector} force de répulsion moyenne, ou (0,0) si aucun voisin proche
   * @pre  boids est un tableau (peut être vide)
   * @post |retour| <= this.maxForce, ou (0,0) si count == 0
   * @complexity O(n) avec n = boids.length
   * @note la force est inversement proportionnelle à la distance (1/d) :
   *       un voisin deux fois plus proche exerce deux fois plus de répulsion
   * @pure ne modifie aucun état interne
   */
  separate(boids) {
    let desiredSeparation = this.r; // distance minimale souhaitée
    let steer = createVector(0, 0);
    let count = 0;

    for (let other of boids) {
      let d = p5.Vector.dist(this.pos, other.pos);
      // Ignore soi-même (d==0) et les voisins hors de portée
      if (d > 0 && d < desiredSeparation) {
        // Vecteur pointant à l'opposé du voisin, pondéré par la distance
        let diff = p5.Vector.sub(this.pos, other.pos);
        diff.normalize();
        diff.div(d); // plus le voisin est proche, plus la force est grande
        steer.add(diff);
        count++;
      }
    }

    if (count > 0) {
      steer.div(count); // moyenne des forces de répulsion
    }

    if (steer.mag() > 0) {
      // Appliquer la formule : steering = desired - velocity
      steer.setMag(this.maxSpeed);
      steer.sub(this.vel);
      steer.limit(this.maxForce);
    }

    return steer;
  }

  /**
   * AVOID — Éviter les obstacles circulaires.
   * Calcule deux points de look-ahead devant le véhicule.
   * Si la trajectoire prédite intersecte un obstacle → force de déviation.
   *
   * Algorithme :
   *   1. Projeter deux points devant : ahead = vel×30, ahead2 = vel×15
   *   2. Trouver l'obstacle le plus proche du véhicule
   *   3. Parmi {ahead, ahead2, pos}, prendre le plus proche de l'obstacle
   *   4. Si distance < obstacle.r + largeurZone → force = (point − obstacle.pos)
   *
   * @param {Obstacle[]} obstacles - liste des obstacles (chacun a .pos et .r)
   * @returns {p5.Vector} force de déviation normalisée à this.maxForce, ou (0,0)
   * @pre  obstacles peut être null ou vide (retourne (0,0) dans ce cas)
   * @post |retour| <= this.maxForce, ou (0,0) si aucun obstacle menaçant
   * @note ne considère que l'obstacle le plus proche : si deux obstacles se
   *       chevauchent, seul le plus proche est évité par frame
   * @pure ne modifie aucun état interne
   */
  avoid(obstacles) {
    if (!obstacles || obstacles.length === 0) return createVector(0, 0);

    // Vecteurs de look-ahead (points devant le véhicule)
    let ahead = this.vel.copy().mult(30);
    let ahead2 = this.vel.copy().mult(15);

    let pointAuBoutDeAhead = p5.Vector.add(this.pos, ahead);
    let pointAuBoutDeAhead2 = p5.Vector.add(this.pos, ahead2);

    if (Vehicle.debug) {
      push();
      stroke("yellow");
      strokeWeight(2);
      line(this.pos.x, this.pos.y, pointAuBoutDeAhead.x, pointAuBoutDeAhead.y);
      fill("red");
      noStroke();
      circle(pointAuBoutDeAhead.x, pointAuBoutDeAhead.y, 8);
      fill("lightblue");
      circle(pointAuBoutDeAhead2.x, pointAuBoutDeAhead2.y, 8);
      pop();
    }

    // Trouver l'obstacle le plus proche
    let obstacleLePlusProche = this.getObstacleLePlusProche(obstacles);
    if (!obstacleLePlusProche) return createVector(0, 0);

    // Distances entre les points de look-ahead et le centre de l'obstacle
    let d1 = obstacleLePlusProche.pos.dist(pointAuBoutDeAhead);
    let d2 = obstacleLePlusProche.pos.dist(pointAuBoutDeAhead2);
    let d3 = obstacleLePlusProche.pos.dist(this.pos);

    // On utilise le point le plus proche de l'obstacle
    let distance = d1;
    let pointLePlusProche = pointAuBoutDeAhead;

    if (d2 < distance) { distance = d2; pointLePlusProche = pointAuBoutDeAhead2; }
    if (d3 < distance) { distance = d3; pointLePlusProche = this.pos; }

    // Seuil de collision : rayon de l'obstacle + demi-largeur de la zone
    if (distance < obstacleLePlusProche.r + this.largeurZoneEvitementDevantVaisseau) {
      // Force de déviation : du centre de l'obstacle vers le point le plus proche
      let force = p5.Vector.sub(pointLePlusProche, obstacleLePlusProche.pos);
      force.setMag(this.maxForce);
      return force;
    }

    return createVector(0, 0);
  }

  /**
   * BOUNDARIES — Rester à l'intérieur d'une zone rectangulaire.
   * Si le véhicule s'approche d'un bord, applique une force vers l'intérieur.
   *
   * @param {number} bx - bord gauche (pixels)
   * @param {number} by - bord haut   (pixels)
   * @param {number} bw - largeur de la zone (pixels)
   * @param {number} bh - hauteur de la zone (pixels)
   * @param {number} d  - marge de détection (pixels, > 0)
   * @returns {p5.Vector} force vers l'intérieur, ou (0,0) si hors zone de marge
   * @pre  d > 0, bw > 2*d, bh > 2*d pour que la zone intérieure ait du sens
   * @post |retour| <= this.maxForce
   * @note comportement "soft" (force progressive) — le véhicule peut dépasser
   *       légèrement la zone si sa vitesse est supérieure à la force max
   * @pure ne modifie aucun état interne
   */
  boundaries(bx, by, bw, bh, d) {
    let vitesseDesiree = null;

    if (this.pos.x < bx + d) {
      vitesseDesiree = createVector(this.maxSpeed, this.vel.y);
    } else if (this.pos.x > bx + bw - d) {
      vitesseDesiree = createVector(-this.maxSpeed, this.vel.y);
    }

    if (this.pos.y < by + d) {
      vitesseDesiree = createVector(this.vel.x, this.maxSpeed);
    } else if (this.pos.y > by + bh - d) {
      vitesseDesiree = createVector(this.vel.x, -this.maxSpeed);
    }

    if (vitesseDesiree !== null) {
      vitesseDesiree.setMag(this.maxSpeed);
      // steering = desired - velocity
      let force = p5.Vector.sub(vitesseDesiree, this.vel);
      force.limit(this.maxForce);
      return force;
    }

    return createVector(0, 0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UTILITAIRES
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Retourne l'obstacle le plus proche du véhicule.
   * @param {Obstacle[]} obstacles
   * @returns {Obstacle|undefined}
   */
  getObstacleLePlusProche(obstacles) {
    let minDist = Infinity;
    let closest = undefined;
    for (let o of obstacles) {
      let d = this.pos.dist(o.pos);
      if (d < minDist) {
        minDist = d;
        closest = o;
      }
    }
    return closest;
  }

  /**
   * Applique une force à l'accélération (intégration d'Euler).
   * C'est la SEULE façon d'influencer le mouvement.
   *
   * @param {p5.Vector} force - vecteur force à accumuler (peut être nul)
   * @pre  force est un p5.Vector valide
   * @post this.acc += force
   * @sideeffect modifie this.acc
   */
  applyForce(force) {
    this.acc.add(force);
  }

  /**
   * Met à jour la physique du véhicule (appelé une fois par frame).
   * Intégration d'Euler : acc → vel → pos, puis reset acc.
   *
   * @pre  appelé exactement une fois par frame après tous les applyForce()
   * @post this.vel limitée à this.maxSpeed
   * @post this.acc remise à (0,0) — prête pour la prochaine frame
   * @post this.path.length <= this.pathMaxLength (suppression FIFO de la tête)
   * @sideeffect modifie this.pos, this.vel, this.acc, this.path
   */
  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.set(0, 0); // reset accélération chaque frame

    // Mise à jour de la traînée
    this.path.push(this.pos.copy());
    if (this.path.length > this.pathMaxLength) {
      this.path.shift();
    }
  }

  /**
   * Téléporte le véhicule de l'autre côté du canvas s'il sort.
   * (Wrap-around, non utilisé dans ce jeu — on utilise boundaries à la place)
   */
  edges() {
    if (this.pos.x > width + this.r)  this.pos.x = -this.r;
    else if (this.pos.x < -this.r)    this.pos.x = width + this.r;
    if (this.pos.y > height + this.r) this.pos.y = -this.r;
    else if (this.pos.y < -this.r)    this.pos.y = height + this.r;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════════════════════════════════════════

  show() {
    this.drawPath();
    this.drawVehicle();
  }

  drawVehicle() {
    push();
    stroke(255);
    strokeWeight(2);
    fill(this.color);
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading()); // oriente le triangle vers la direction de déplacement

    // Triangle : pointe vers la droite (direction de déplacement)
    triangle(
      -this.r_pourDessin, -this.r_pourDessin / 2,
      -this.r_pourDessin,  this.r_pourDessin / 2,
       this.r_pourDessin,  0
    );

    if (Vehicle.debug) {
      noFill();
      stroke(255, 100);
      circle(0, 0, this.r * 2);
    }
    pop();
  }

  drawPath() {
    if (this.path.length < 2) return;
    push();
    noFill();
    for (let i = 1; i < this.path.length; i++) {
      let alpha = map(i, 0, this.path.length, 0, 110);
      let sw    = map(i, 0, this.path.length, 0.3, 1.8);
      stroke(red(this.color), green(this.color), blue(this.color), alpha);
      strokeWeight(sw);
      line(this.path[i - 1].x, this.path[i - 1].y,
           this.path[i].x,     this.path[i].y);
    }
    pop();
  }

  /**
   * Dessine un vecteur comme une flèche colorée (pour debug).
   * @param {p5.Vector} pos    - point de départ
   * @param {p5.Vector} v      - vecteur à dessiner
   * @param {color}     couleur
   */
  drawVector(pos, v, couleur) {
    push();
    strokeWeight(2);
    stroke(couleur);
    line(pos.x, pos.y, pos.x + v.x, pos.y + v.y);
    let arrowSize = 5;
    translate(pos.x + v.x, pos.y + v.y);
    rotate(v.heading());
    translate(-arrowSize / 2, 0);
    fill(couleur);
    noStroke();
    triangle(0, arrowSize / 2, 0, -arrowSize / 2, arrowSize, 0);
    pop();
  }
}
