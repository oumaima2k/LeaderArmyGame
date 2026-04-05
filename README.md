# Leader Army Game
### Steering Behaviors — Craig Reynolds | M2 MIAGE 2025-2026

---

## Demo en ligne

Jouer directement dans le navigateur :
**https://oumaima2k.github.io/LeaderArmyGame/**

Vidéo de démonstration : **https://youtu.be/5-NbKCBNPCs**

---

## Description

Jeu interactif basé sur les **Steering Behaviors de Craig Reynolds**, développé en JavaScript avec **p5.js**.

Le joueur contrôle un **Leader** (triangle doré) à la souris. Une **armée de Followers** (bleu/cyan) le suit en formation dynamique. Des **Ennemis** (rouge) et des **Élites** (violet) apparaissent par vagues depuis les bords et cherchent à atteindre le leader. Le joueur tire des **Projectiles** (jaune) en cliquant pour les éliminer et marquer des points.

---

## Hébergement & lancer en local

Déployé via **GitHub Pages** (branche `main`) — Repo : https://github.com/oumaima2k/LeaderArmyGame

En local, ouvrir `index.html` avec un serveur local (ex : VS Code Live Server, `python3 -m http.server 8000`, ou `npx serve .`).

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

## Formations (touche F)

Cycle : **GRID → V → CIRCLE → GRID …**

- **GRID** : rangées/colonnes derrière le leader (5 par rangée, 40 × 45 px)
- **V** : deux ailes symétriques (style oiseaux migrateurs)
- **CIRCLE** : cercle de rayon 90 px autour du leader (formation défensive)

## Fonctionnalités avancées

- **Zone de danger (cône)** : cône rouge 90°/130 px devant le leader — les followers à l'intérieur déclenchent `evade(leader)` puis reprennent leur formation
- **Difficulté dynamique** : vagues toutes les ~8 s, intervalle et vitesse ennemis croissants par niveau ; EliteEnemy (2 HP, violet) dès le niveau 3
- **Système de niveaux** : +1 niveau tous les 50 pts, animation "LEVEL UP !", power-ups aux niveaux pairs
- **Effets visuels** : glow, traînées, explosions particules, screen shake, fond animé
- **Mode debug (D)** : affiche vecteurs, zones de détection, look-ahead, positions prédites

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

## MON EXPÉRIENCE

### Pourquoi ce jeu ?

Au début, les steering behaviors me semblaient assez abstraits. Mais en avançant, j’ai réalisé que ce sont exactement les mécanismes utilisés dans beaucoup de jeux pour gérer les déplacements (ennemis, groupes, évitement…).

J’ai donc choisi de faire un jeu avec un leader et une armée pour pouvoir combiner plusieurs behaviors de façon visible et interactive, plutôt qu’une simple démo technique.

---

### Les comportements utilisés

J’ai utilisé principalement :

- **Arrive** pour le leader et les followers, pour avoir des déplacements fluides sans oscillation  
- **Pursue** pour les ennemis, afin qu’ils anticipent les mouvements du joueur  
- **Separation** pour éviter que les entités se superposent  
- **Avoid** pour gérer les obstacles de manière réaliste  

J’ai essayé de ne pas utiliser trop de behaviors, mais plutôt de bien comprendre et maîtriser ceux-ci.

---

### Réglage des paramètres

Le réglage s’est fait surtout par tests en jouant.

Le plus difficile était l’équilibre entre **Arrive** et **Separation** pour les followers :
- trop d’Arrive → ils se collent
- trop de Separation → la formation se casse

C’est pour ça que j’ai ajouté des sliders, ce qui permet aussi de mieux comprendre l’impact de chaque comportement.

---

### Difficultés rencontrées

- **Formation des followers** : gérer les positions par rapport au leader (repère local) a été assez compliqué au début  
- **Effets visuels (glow, trails)** : p5.js ne propose pas directement ce genre d’effets, il a fallu utiliser le contexte canvas  
- **Comportements combinés** : trouver les bons poids pour que les comportements fonctionnent ensemble de manière naturelle  

---

### Conclusion

Ce projet m’a permis de mieux comprendre comment des comportements simples peuvent produire des mouvements réalistes lorsqu’ils sont combinés. C’était plus complexe que prévu, surtout pour les réglages, mais aussi très intéressant à implémenter.

### Outils utilisés

- **IDE** : Visual Studio Code avec l'extension Live Server pour recharger la page automatiquement
- **IA** : Claude Sonnet (via Claude Code, le CLI d'Anthropic intégré dans VS Code)

---

## Références

- Craig Reynolds, *Steering Behaviors For Autonomous Characters*, GDC 1999
- Daniel Shiffman, *The Nature of Code*, Chapter 6 — Autonomous Agents
- Cours M2 MIAGE — Michel Buffa — 2025-2026
