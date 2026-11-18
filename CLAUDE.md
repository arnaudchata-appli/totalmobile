# Killzone2000 — notes pour Claude

Jeu de stratégie temps réel original (inspiré du genre « Total Annihilation » : économie en flux continu, Architecte = unité de commandement). Jouable dans le navigateur (PC et mobile), installable hors ligne (PWA), appli Android (APK via Capacitor), multijoueur en ligne 1 contre 1.

- Dépôt : https://github.com/arnaudchata-appli/totalmobile (branche `main`)
- Version web (GitHub Pages, déployée automatiquement à chaque push) : https://arnaudchata-appli.github.io/totalmobile/
- APK : release `android-latest` → https://github.com/arnaudchata-appli/totalmobile/releases/tag/android-latest

## Conventions

- L'utilisateur parle **français** : réponses, textes de l'interface, commentaires et messages de commit en français.
- Le nom du jeu est **Killzone2000**. Icône : étoile rouge en relief sur fond noir.
- Rester sur un jeu **original** (pas de noms, unités ou graphismes d'un jeu existant).
- Pas de framework ni de build pour le web : tout le jeu est dans `index.html` (JS vanilla, canvas 2D).
- Pousser sur `main` déclenche Pages + la construction de l'APK : ne pousser que lorsque l'utilisateur le demande.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Tout le jeu : données, simulation, IA, réseau, rendu, interface |
| `sw.js` | Service worker (cache hors ligne). **Incrémenter `CACHE`** quand on change la liste des fichiers ou pour forcer une mise à jour |
| `manifest.webmanifest` | Manifeste PWA (nom, icônes, paysage, plein écran) |
| `lib/peerjs.min.js` | PeerJS 1.5.4 embarqué (WebRTC), pour ne pas dépendre d'un CDN |
| `icons/` | Icônes web (192, 512, maskable, SVG) |
| `assets/` | Sources des icônes et écrans de démarrage Android (utilisées par `@capacitor/assets`) |
| `capacitor.config.json`, `package.json`, `scripts/copy-www.js` | Emballage Android (Capacitor 7) |
| `.github/workflows/android.yml` | Construit l'APK sur GitHub Actions et le publie dans la release `android-latest` |
| `tools/sim-test.js` | Test sans navigateur : IA contre IA + synchro hôte/invité (`node tools/sim-test.js`) |
| `tools/gen-icon.js` | Génère l'icône en SVG/HTML, à convertir en PNG avec Chrome headless (voir l'en-tête du fichier) |

`www/`, `android/` et `node_modules/` sont générés et ignorés par git.

## Architecture de `index.html`

Sections dans l'ordre : constantes et données (`T` = types d'unités et de bâtiments), état global, utilitaires, terrain, **graphismes** (`ART` + `spr()` : sprites pré-rendus à 3x par type, équipe et partie `hull`/`top`/`base`), son (WebAudio synthétique), entités, économie, armes et projectiles, **commandes** (`cmd()` / `applyCmd()`), IA, boucle de jeu, **réseau**, rendu, caméra et entrées, interface, démarrage.

- **Équipes** : 0 = bleu (en bas à gauche), 1 = rouge (en haut à droite). `ME` = équipe locale ; `aiTeams` = équipes jouées par l'IA (n'importe quelle équipe).
- **Modes** : `solo` (simulation locale + IA équipe 1), `host` (simule, ME=0), `guest` (ne simule pas, ME=1).
- **Toute action du joueur passe par `cmd({k:...})`**. En solo ou en hôte, elle est appliquée directement ; en invité, elle est envoyée à l'hôte, qui l'exécute via `applyCmd(c, 1)`. Pour ajouter une action, l'ajouter dans `applyCmd`.
- **Réseau** : PeerJS, identifiant de pair `kz2000-<CODE>`. L'hôte envoie `buildSnap()` 15 fois par seconde (entités compactées + événements visuels `evq` produits par `emit()`) ; l'invité applique `applySnap()` et interpole dans `guestUpdate()`. La carte est générée à partir d'une graine commune (`setupMap(seed)`, générateur `srand`). Si l'invité se déconnecte, l'IA reprend l'équipe 1.
- **Économie** : flux continu ; `consume()` fait avancer une construction au prorata des ressources disponibles.
- **Victoire** : destruction de l'Architecte adverse (son explosion fait des dégâts de zone).

## Tester

- `node tools/sim-test.js` : doit afficher « OK : synchro réseau correcte ».
- Contrôle visuel : servir le dossier en HTTP local et faire une capture d'écran avec Chrome headless (`--screenshot`, `--virtual-time-budget`).
- Vérification de syntaxe : extraire le `<script>` de `index.html` et lancer `node --check`.

## Publication et mises à jour

- Le workflow `.github/workflows/android.yml` (« Publier ») tourne à chaque push sur `main`. Le **numéro de version N = `github.run_number`** de ce workflow : ne pas renommer le fichier, sinon la numérotation repart à 1 et Android refuse d'installer une version inférieure.
- Il copie le jeu dans `www/`, remplace `__APP_VERSION__` par N dans `index.html` et `sw.js`, écrit `www/version.json` (`{version, apk, commit, date}`), construit et signe l'APK (versionCode = N), le publie dans la release `android-latest`, puis déploie `www/` sur GitHub Pages (source Pages = « GitHub Actions »).
- **Web/PWA** : chaque version a son propre cache (`killzone2000-N`). Le nouveau service worker s'installe en arrière-plan et attend ; le jeu affiche « Nouvelle version disponible » (écran d'accueil et menu ☰), et le bouton envoie `skipWaiting` puis recharge la page.
- **Appli Android** : au démarrage, au retour au menu, au retour au premier plan et toutes les 30 min, l'appli lit `version.json` sur le site. Si la version est plus récente, elle propose de télécharger l'APK, qui s'installe par-dessus l'ancien (même clé de signature, versionCode supérieur).
- En local, `APP_VERSION` vaut `__APP_VERSION__` → « Version de développement », sans vérification de mise à jour.

## Android

- Le SDK Android n'est pas nécessaire en local : l'APK est construit par GitHub Actions (Node 22, Java 21, Capacitor 7). L'activité est forcée en paysage par `sed` dans le workflow.
- `appId` : `io.github.arnaudchataappli.killzone2000`. Garder `appName` sans apostrophe droite (elle casse le `strings.xml` d'Android).
- Signature : la clé permanente est **hors du dépôt**, dans `C:\Users\Arnaud\.killzone2000\` (`release.jks` + `LISEZMOI-cle.txt` avec l'alias et le mot de passe). Le workflow la lit depuis les secrets GitHub `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`. Sans ces secrets, il produit un APK de debug (signature différente à chaque fois). **Ne jamais committer la clé ; la perdre empêche toute mise à jour de l'appli installée.** Pour la copier sur un autre PC, transférer ce dossier par un moyen privé (clé USB, gestionnaire de mots de passe).

## Environnement / pièges

- Sur le PC d'origine, Git a la vérification TLS désactivée (avertissement « TLS certificate verification has been disabled ») ; à corriger si ce n'est pas voulu.
- `gh` doit être connecté (`gh auth login`) pour gérer releases, Pages et workflows.
- « Killzone » est une marque de Sony : sans souci pour un usage personnel, mais à renommer avant toute publication sur un store.

## Idées en attente


- Brouillard de guerre, unités aériennes, épaves à recycler, plus de 2 joueurs, équilibrage.
- Test sur un vrai téléphone et en multijoueur entre deux appareils réels (pas encore fait).
