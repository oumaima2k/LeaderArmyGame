# Leader Army Game
### Steering Behaviors — Craig Reynolds | M2 MIAGE 2025-2026

---

## Demo en ligne

Jouer directement dans le navigateur :
**https://oumaima2k.github.io/LeaderArmyGame/**

---

## Description

Jeu interactif basé sur les **Steering Behaviors de Craig Reynolds**, développé en JavaScript avec **p5.js**.

Le joueur contrôle un **Leader** (triangle doré) à la souris. Une **armée de Followers** (bleu/cyan) le suit en formation dynamique. Des **Ennemis** (rouge) et des **Élites** (violet) apparaissent par vagues depuis les bords et cherchent à atteindre le leader. Le joueur tire des **Projectiles** (jaune) en cliquant pour les éliminer et marquer des points.

---

## Hébergement

Le jeu est déployé via **GitHub Pages** depuis la branche `main`.
Repo : https://github.com/oumaima2k/LeaderArmyGame

Pour redéployer après modification :
```bash
git add .
git commit -m "votre message"
git push origin main
# GitHub Pages se met à jour automatiquement en ~1 minute
```

---

## Lancer le projet en local

Ouvrir `index.html` dans un navigateur **avec un serveur local** (requis pour p5.js) :

```bash
# Option 1 — VS Code Live Server (extension)
# Clic droit sur index.html → "Open with Live Server"

# Option 2 — Python
python3 -m http.server 8000
# Ouvrir http://localhost:8000

# Option 3 — Node.js
npx serve .
```

---

## Contrôles

| Touche / Action | Effet |
|---|---|
| **Souris** | Déplace le leader (ARRIVE) |
| **Clic gauche** | Tire un projectile |
| **Espace** | Tire un projectile |
| **F** | Change la formation de l'armée (GRID → V → CIRCLE) |
| **D** | Active/désactive le mode debug |
| **R** | Relance une nouvelle partie |

---

## Structure des fichiers

```
LeaderArmyGame/
├── index.html        — Point d'entrée HTML
├── vehicle.js        — Classe de base avec tous les steering behaviors
├── leader.js         — Leader : ARRIVE + zone de danger (cône)
├── follower.js       — Followers : ARRIVE formation + SEPARATE + EVADE
├── enemy.js          — Ennemis : PURSUE + SEPARATE + AVOID + esquive projectiles
├── eliteEnemy.js     — Élites (2 HP) : hérite d'Enemy, esquive plus agressive
├── projectile.js     — Projectiles : ligne droite + AVOID obstacles
├── powerUp.js        — Collectibles : WANDER, boost vitesse ou force
├── obstacle.js       — Obstacles circulaires statiques
├── behaviorManager.js— Gestionnaire de composition de forces (poids, activation)
└── sketch.js         — Boucle p5.js, score, vagues, formations, UI sliders
```

---

## Architecture — Steering Behaviors

### Principe fondamental (Craig Reynolds)

```
steering_force = desired_velocity − current_velocity
```

Tous les déplacements passent par `applyForce()` → jamais de manipulation directe de la position.

### Hiérarchie des classes

```
Vehicle (base — vehicle.js)
  ├── Leader       — ARRIVE(souris) + AVOID + BOUNDARIES
  ├── Follower     — ARRIVE(formation) + SEPARATE + EVADE + AVOID + BOUNDARIES
  ├── Enemy        — PURSUE(leader) + SEPARATE + AVOID + EVADE(projectiles) + BOUNDARIES
  │   └── EliteEnemy — hérite d'Enemy, 2 HP, esquive plus agressive
  ├── Projectile   — SEEK(point fantôme) + AVOID + BOUNDARIES
  └── PowerUp      — WANDER + BOUNDARIES
```

---

## Steering Behaviors implémentés (vehicle.js)

| Behavior | Description |
|---|---|
| **SEEK** | Se diriger vers une cible à vitesse maximale |
| **FLEE** | Fuir une cible (inverse de seek) |
| **ARRIVE** | Seek avec décélération progressive à l'approche (rayon de freinage configurable) |
| **PURSUE** | Poursuivre un véhicule en prédisant sa position future (~10 frames) |
| **EVADE** | Fuir la position future d'un véhicule (inverse de pursue) |
| **WANDER** | Errance fluide via un cercle imaginaire devant le véhicule (angle θ évolue doucement) |
| **SEPARATE** | Repousser les voisins trop proches (force inversement proportionnelle à la distance) |
| **AVOID** | Éviter les obstacles par raycast (look-ahead devant le véhicule) |
| **BOUNDARIES** | Force de rappel pour rester dans les limites du canvas |

---

## Composition des forces par entité

### Leader
```
F = arrive(mousePos)  × 1.0
  + avoid(obstacles)  × 3.0
  + boundaries()      × 2.0
```

### Follower
```
F = arrive(formationTarget) × arriveWeight     (réglable via slider)
  + separate(allFollowers)  × separationWeight (réglable via slider)
  + evade(leader)           × 2.0              (si dans la zone de danger)
  + avoid(obstacles)        × avoidWeight      (réglable via slider)
  + boundaries()            × 2.0
```

### Enemy
```
F = pursue(leader)          × 1.2   (poursuite prédictive)
  + separate(allEnemies)    × 1.0
  + avoid(obstacles)        × 3.0
  + evade(closestProjectile)× 2.5   (conditionnel, rayon de détection 120 px)
  + boundaries()            × 2.0
```
Vitesse dynamique : `maxSpeed = 2.2 + level × 0.1` (plafonné à +50 %)

### Projectile
```
F = seek(ghostPoint)  × 1.0   (point fantôme loin devant = trajectoire rectiligne)
  + avoid(obstacles)  × 4.0
  + boundaries()      × 2.0
```
Durée de vie 240 frames (~4s). Disparaît aussi à l'impact.

---

## Formations (touche F)

Cycle : **GRID → V → CIRCLE → GRID …**

### GRID — Grille (défaut)
Les followers se placent en rangées et colonnes derrière le leader, dans son repère local.
- Jusqu'à 5 par rangée, espacées de 40 px en largeur et 45 px en profondeur.

```
        [Leader] →
  [f][f][f][f][f]
  [f][f][f]
```

### V — Formation en V
Les followers se répartissent sur deux ailes symétriques derrière le leader (style oiseaux migrateurs).
- Index pair → aile gauche, index impair → aile droite.
- Plus l'index est élevé, plus le follower est éloigné en arrière et sur le côté.

```
[f]           [f]
   [f]     [f]
      [Leader] →
```

### CIRCLE — Cercle
Les followers se répartissent uniformément sur un cercle de rayon 90 px autour du leader (formation défensive).
- Angle = `(index / total) × 2π`

```
   [f] [f]
[f] [Leader] [f]
   [f] [f]
```

---

## Fonctionnalités avancées

### Zone de danger du leader (cône)
Le leader projette un **cône rouge** (90°, rayon 130 px) devant lui. Tout follower entrant dans ce cône déclenche `evade(leader)` (force × 2.0) pour s'écarter immédiatement, puis reprend sa position de formation.

Algorithme de détection :
1. Calculer le vecteur `leader.pos → follower.pos`
2. Calculer l'angle entre ce vecteur et `leader.vel` (`angleBetween`)
3. Si angle < 45° **ET** distance < 130 px → dans la zone de danger

### Difficulté dynamique (vagues)
- Toutes les ~8 secondes (`waveInterval = 480` frames), une vague d'ennemis spawne sur les bords
- L'intervalle se réduit à chaque niveau (minimum ~3s)
- Les ennemis gagnent en vitesse à chaque niveau (`difficultyLevel`)
- À partir du niveau 3, des **EliteEnemy** (2 HP, violet) peuvent apparaître

### Système de niveaux
- Passage de niveau tous les 50 points (`POINTS_PER_LEVEL`)
- Animation "LEVEL UP !" à chaque palier + flash d'écran
- Chaque niveau spawn un ennemi supplémentaire et peut déclencher un power-up (niveaux pairs)

### Power-ups
Deux types de collectibles apparaissent en jeu (WANDER) et se ramassent au contact :
- **Speed** (vert) : boost de vitesse temporaire pour le leader ou un follower
- **Force** (orange) : boost de force de direction temporaire

### Effets visuels
- **Glow** : halo lumineux autour du leader (or), des ennemis (rouge) et des projectiles (jaune) via `drawingContext.shadowBlur`
- **Traînées** : lignes lissées avec alpha et épaisseur croissants (leader 55 pts, ennemis 22 pts, projectiles 20 pts)
- **Explosions** : particules à l'impact (orange pour ennemis normaux, violet pour élites)
- **Flash d'impact** : anneau blanc expansif à chaque hit de projectile
- **Screen shake** : légère secousse de caméra à l'impact (intensité plus forte sur élites)
- **Fond animé** : 55 particules bleutées à dérive lente

### Mode debug (touche D)
Affiche pour chaque véhicule :
- Vecteur vitesse et accélération
- Zone de détection (cercle)
- Points de look-ahead pour AVOID
- Point de position prédite pour PURSUE
- Rayon d'esquive des projectiles (ennemis)

---

## Interface utilisateur (sliders)

| Slider | Effet |
|---|---|
| Vitesse max | `maxSpeed` du leader et des followers |
| Force max | `maxForce` du leader et des followers |
| Séparation × | Poids du comportement SEPARATE |
| Évitement × | Poids du comportement AVOID |
| Nombre followers | Taille de l'armée (synchronisé dynamiquement) |
| Ennemis initiaux | Nombre d'ennemis au démarrage |

---

## Références

- Craig Reynolds, *Steering Behaviors For Autonomous Characters*, GDC 1999
- Daniel Shiffman, *The Nature of Code*, Chapter 6 — Autonomous Agents
- Cours M2 MIAGE — Michel Buffa — 2025-2026
