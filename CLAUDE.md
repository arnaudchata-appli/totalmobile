# TotalKill2000 — notes pour Claude

Jeu de stratégie temps réel original (inspiré du genre « Total Annihilation » : économie en flux continu, Architecte = unité de commandement). Jouable dans le navigateur (PC et mobile), installable hors ligne (PWA), appli Android (APK via Capacitor), multijoueur en ligne de 2 à 4 joueurs (chacun pour soi), IA sur les places libres.

- Dépôt : https://github.com/arnaudchata-appli/totalmobile (branche `main`)
- Version web (GitHub Pages, déployée automatiquement à chaque push) : https://arnaudchata-appli.github.io/totalmobile/
- APK : release `android-latest` → https://github.com/arnaudchata-appli/totalmobile/releases/tag/android-latest

## Conventions

- L'utilisateur parle **français** : réponses, textes de l'interface, commentaires et messages de commit en français.
- Le nom du jeu est **TotalKill2000** (anciennement Killzone2000). Icône : étoile rouge en relief sur fond noir.
- Identifiants internes : `appId` Android `io.github.arnaudchataappli.totalkill2000` (changé depuis `…killzone2000` à la version 9 : l'ancienne appli doit être désinstallée une fois, ensuite les mises à jour s'installent par-dessus). Le dossier de la clé de signature garde son ancien nom `.killzone2000`.
- Rester sur un jeu **original** (pas de noms, unités ou graphismes d'un jeu existant).
- Pas de framework ni de build pour le web : tout le jeu est dans `index.html` (JS vanilla, canvas 2D).
- Pousser sur `main` déclenche Pages + la construction de l'APK : ne pousser que lorsque l'utilisateur le demande.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Tout le jeu : données, simulation, IA, réseau, rendu, interface |
| `sw.js` | Service worker (cache hors ligne). **Incrémenter `CACHE`** quand on change la liste des fichiers ou pour forcer une mise à jour |
| `manifest.webmanifest` | Manifeste PWA (nom, icônes, toutes orientations, plein écran) |
| `lib/peerjs.min.js` | PeerJS 1.5.4 embarqué (WebRTC), pour ne pas dépendre d'un CDN |
| `icons/` | Icônes web (192, 512, maskable, SVG) |
| `assets/` | Sources des icônes et écrans de démarrage Android (utilisées par `@capacitor/assets`) |
| `capacitor.config.json`, `package.json`, `scripts/copy-www.js` | Emballage Android (Capacitor 7) |
| `.github/workflows/android.yml` | Construit l'APK sur GitHub Actions et le publie dans la release `android-latest` |
| `tools/sim-test.js` | Test sans navigateur : IA contre IA + synchro hôte/invité (`node tools/sim-test.js`) |
| `tools/gen-icon.js` | Génère l'icône en SVG/HTML, à convertir en PNG avec Chrome headless (voir l'en-tête du fichier) |

`www/`, `android/` et `node_modules/` sont générés et ignorés par git.

## Architecture de `index.html`

Sections dans l'ordre : constantes et données (`T` = types d'unités et de bâtiments), état global, utilitaires, **cartes** (`MAPS`, `genLayout`, `genTerrain`), **brouillard & radar** (`updateFog`), **graphismes** (`ART` + `spr()` : sprites pré-rendus à 3x par type, équipe et partie `hull`/`top`/`base`), son (WebAudio synthétique), entités, économie, armes et projectiles, **commandes** (`cmd()` / `applyCmd()`), IA, boucle de jeu, **réseau**, rendu, caméra et entrées, interface, démarrage.

- **Joueurs / équipes** : `NP` = 2 à 4 joueurs, chacun pour soi. Équipes 0 = bleu, 1 = rouge, 2 = vert, 3 = violet (`COL`, `TEAM_NAME`). `ME` = équipe locale ; `aiTeams` = équipes jouées par l'IA. Un joueur dont l'Architecte meurt est éliminé (`eliminate()` : toute sa base est détruite, équipe ajoutée à `elim`) ; s'il reste au moins 2 joueurs, le joueur local éliminé peut regarder la suite (`spectate`, brouillard levé). Le dernier survivant gagne (`checkEnd()`).
- **Modes** : `solo` (simulation locale, IA pour les équipes 1 à NP-1), `host` (simule, ME=0), `guest` (ne simule pas, ME = équipe attribuée par l'hôte).
- **Toute action du joueur passe par `cmd({k:...})`**. En solo ou en hôte, elle est appliquée directement ; en invité, elle est envoyée à l'hôte, qui l'exécute via `applyCmd(c, équipe de la connexion)`. Pour ajouter une action, l'ajouter dans `applyCmd`.
- **Réseau** : PeerJS, identifiant de pair `tk2000-<CODE>`. L'hôte accepte jusqu'à NP-1 invités (`net.conns` = `{conn, team, ready}` ; côté invité : `net.conn`). Salle d'attente (`lobbyStatus()`) : la partie démarre quand toutes les places sont prises, ou avec le bouton « Lancer » (`hostLaunch()`), l'IA prenant les places libres. L'hôte envoie `buildSnap()` 15 fois par seconde à tous (entités compactées, ordres et files de production des équipes humaines distantes, ressources par équipe dans `r[équipe]`, événements visuels `evq` produits par `emit()`) ; l'invité applique `applySnap()` et interpole dans `guestUpdate()`. Messages : `{t:'start', map, fog, np, me}`, `cmd`, `snap`, `elim`, `end`, `full`. Chaque carte a une graine fixe, donc tout le monde génère la même. Si un invité se déconnecte, l'IA reprend son équipe.
- **Économie** : flux continu ; `consume()` fait avancer une construction au prorata des ressources disponibles.
- **Cartes** : 10 définitions dans `MAPS` (taille, disposition des bases `diag`/`horiz`/`vert`, palette, obstacles `rock`/`water`/`ice`/`lava`/`swamp`/`ridge`, nombre de gisements par camp) + « Aléatoire ». Chaque carte a une graine fixe. À 2 joueurs, elle est symétrique par rapport au centre (bases selon la disposition) ; à 3 ou 4 joueurs, `genLayout(def, np)` place les bases dans les 4 coins et rend la carte invariante par quart de tour (un peu moins d'obstacles, 80 % des gisements par camp). `W`, `H` et `BASES` sont donc variables. Les obstacles sont des cercles infranchissables (évitement local dans `steer()` via `blockers`, collision dans `collide()`) ; `freePoint()` sort une destination d'un obstacle. Le choix de carte, du brouillard et du nombre de joueurs est mémorisé dans `localStorage` (`tk-map`, `tk-fog`, `tk-np`).
- **Brouillard de guerre** : grille de `FOG_CELL` = 40 px ; `explored` / `visibleF` / `fogLvl` pour l'équipe locale, recalculés toutes les 0,15 s à partir de `VISION`. Rendu par une petite texture lissée (`fogCv`). `isVis(e)` = visible maintenant, `shown(e)` = visible ou bâtiment ennemi déjà aperçu (`e.seen`). L'IA ne tient pas compte du brouillard (elle voit tout).
- **Radar** : bâtiment avec `radar: 1500` (portée) et `upkeepE: 8` (énergie/s ; sans énergie il s'éteint : `e.working`). Les ennemis cachés dans sa portée vont dans `radarBlips` (échos rouges sur la carte et la minicarte).
- **Décor** : `genTerrain()` peint une seule fois la texture du terrain (`terr`, `TS` ≈ 0,8 px par unité) avec les éléments `DECO` (arbres, buissons, cactus, sapins, roseaux…) listés par carte dans `MAP_DECO`, les obstacles (`paintObstacle`) et les gisements (`paintDeposit`). Le rendu ne copie que la partie visible de la texture. `drawObstacleFx()` anime la lave, l'eau et la glace.
- **Animations** (purement visuelles, locales, jamais envoyées sur le réseau) : `animT`/`rdt` (horloge du rendu), particules décoratives `fx` (`puff`, `spark2`, flammes). Chenilles animées (`TREADS`, `drawTreads`, `e.trk` = distance parcourue, le sprite de coque est généré sans chenilles via `spr(..., 'hull', 1)`), poussière, réacteurs de l'Éclaireur, recul des canons, gyrophare du Constructeur. Usine (`drawFactoryAnim`) : ventilateurs, fumée, étincelles de soudure, hologramme de l'unité en cours, barre de progression. Balayage du radar, générateurs qui pulsent, voyants des défenses.
- **Avions** : types avec `air: true` (`chasseur`, `bombardier`, produits par l'`aeroport`). Ils volent toujours (`flyUnit()` : sans destination, ils tournent autour de `e.anc`), ignorent obstacles et unités au sol (`collide()`), et ne sont touchés que par les armes `air: true` (`canHit()`). Une arme `gnd: false` (`dca`) ne vise que les avions. Les projectiles portent `air` (couche visée) ; les obus et bombes à effet de zone ne touchent que le sol. Rendu : ombre portée décalée (`shadowSpr`), inclinaison dans les virages, réacteurs (`ENGINES`), traînées.
- **Épaves** : `kill()` appelle `addWreck()` (50 % du coût en minerai). Tableau `wrecks` + `wById` (hors `ents`/`byId`). Ordre `reclaim` (commande `{k:'reclaim', ids, x, y, q}` : toutes les épaves autour du point), `RECLAIM_RATE` minerai/s par point de `bp`. Synchronisées dans le snapshot (`s.w`, une fois sur cinq). Sprite grisé et rouillé `wspr()`. L'IA recycle les épaves proches de sa base quand elle manque de minerai.
- **Victoire** : être le dernier Architecte debout (son explosion fait des dégâts de zone).

## Tester

- `node tools/sim-test.js` : teste les 10 cartes, le radar, le brouillard, des parties IA à 4 joueurs et une partie réseau à 3 (hôte + 2 invités, élimination, déconnexion) ; doit afficher « OK : cartes, 4 joueurs, brouillard et synchro réseau corrects ».
- Contrôle visuel : servir le dossier en HTTP local et faire une capture d'écran avec Chrome headless (`--screenshot`, `--virtual-time-budget`).
- Vérification de syntaxe : extraire le `<script>` de `index.html` et lancer `node --check`.

## Publication et mises à jour

- Le workflow `.github/workflows/android.yml` (« Publier ») tourne à chaque push sur `main`. Le **numéro de version N = `github.run_number`** de ce workflow : ne pas renommer le fichier, sinon la numérotation repart à 1 et Android refuse d'installer une version inférieure.
- Il copie le jeu dans `www/`, remplace `__APP_VERSION__` par N dans `index.html` et `sw.js`, écrit `www/version.json` (`{version, apk, commit, date}`), construit et signe l'APK (versionCode = N), le publie dans la release `android-latest`, puis déploie `www/` sur GitHub Pages (source Pages = « GitHub Actions »).
- **Web/PWA** : chaque version a son propre cache (`totalkill2000-N`). Le nouveau service worker s'installe en arrière-plan et attend ; le jeu affiche « Nouvelle version disponible » (écran d'accueil et menu ☰), et le bouton envoie `skipWaiting` puis recharge la page.
- **Appli Android** : au démarrage, au retour au menu, au retour au premier plan et toutes les 30 min, l'appli lit `version.json` sur le site. Si la version est plus récente, elle propose de télécharger l'APK, qui s'installe par-dessus l'ancien (même clé de signature, versionCode supérieur).
- En local, `APP_VERSION` vaut `__APP_VERSION__` → « Version de développement », sans vérification de mise à jour.

## Android

- Le SDK Android n'est pas nécessaire en local : l'APK est construit par GitHub Actions (Node 22, Java 21, Capacitor 7). L'activité est en rotation libre (`screenOrientation="fullUser"`, portrait et paysage, respecte le verrouillage du téléphone), réglée par `sed` dans le workflow.
- `appId` : `io.github.arnaudchataappli.totalkill2000`. **Ne plus le changer** (sinon Android y voit une autre appli). Garder `appName` sans apostrophe droite (elle casse le `strings.xml` d'Android).
- Signature : la clé permanente est **hors du dépôt**, dans `C:\Users\Arnaud\.killzone2000\` (`release.jks` + `LISEZMOI-cle.txt` avec l'alias et le mot de passe). Le workflow la lit depuis les secrets GitHub `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`. Sans ces secrets, il produit un APK de debug (signature différente à chaque fois). **Ne jamais committer la clé ; la perdre empêche toute mise à jour de l'appli installée.** Pour la copier sur un autre PC, transférer ce dossier par un moyen privé (clé USB, gestionnaire de mots de passe).

## Environnement / pièges

- Sur le PC d'origine, Git a la vérification TLS désactivée (avertissement « TLS certificate verification has been disabled ») ; à corriger si ce n'est pas voulu.
- `gh` doit être connecté (`gh auth login`) pour gérer releases, Pages et workflows.
- « Killzone » (l'ancien nom) est une marque de Sony ; vérifier qu'aucune marque proche de « TotalKill » n'existe avant toute publication sur un store (usage personnel : sans souci).

## Idées en attente


- Alliances / équipes 2 contre 2, IA qui respecte le brouillard, équilibrage.
- Test sur un vrai téléphone et en multijoueur entre deux appareils réels (pas encore fait).
