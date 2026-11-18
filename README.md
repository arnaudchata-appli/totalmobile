# Front d'Acier

Jeu de stratégie temps réel pour navigateur, PC et Android. Développe ton économie (minerai + énergie), construis une base et une armée, et détruis l'Architecte ennemi.

- **Solo contre l'IA** (3 niveaux) : fonctionne **hors ligne**.
- **Multijoueur en ligne 1 contre 1** : un joueur crée la partie et partage le code, l'autre le saisit.

## Jouer

- **Navigateur / mobile** : https://arnaudchata-appli.github.io/totalmobile/
  Le jeu s'installe comme une appli (« Ajouter à l'écran d'accueil » ou bouton *Installer l'appli*) et reste jouable sans connexion.
- **Appli Android (APK)** : télécharge `FrontDAcier.apk` depuis la release [android-latest](https://github.com/arnaudchata-appli/totalmobile/releases/tag/android-latest), puis ouvre le fichier sur ton téléphone pour l'installer.

## Commandes

- **Mobile** : toucher = sélectionner / ordonner, glisser = caméra, pincer = zoom, ▢ Boîte = sélection de zone, double-touche = toutes les unités du même type.
- **PC** : clic gauche = sélection, clic droit = ordre, molette = zoom, A = mode attaque, S = stop, Maj = file d'ordres.

## Technique

- Tout le jeu est dans `index.html` (canvas 2D, sprites dessinés par programme).
- Hors ligne : `sw.js` (service worker) + `manifest.webmanifest`.
- Multijoueur : WebRTC pair-à-pair via [PeerJS](https://peerjs.com/) (`lib/peerjs.min.js`). L'hôte fait tourner la simulation, l'invité envoie ses ordres et reçoit l'état ~15 fois par seconde.
- Android : [Capacitor](https://capacitorjs.com/). Le workflow `.github/workflows/android.yml` construit l'APK à chaque push sur `main` et le publie dans la release `android-latest`.
  - Sans secrets, l'APK est signé avec une clé de debug générée à chaque build (il faut désinstaller l'ancienne version avant d'installer la nouvelle).
  - Pour des mises à jour directes, ajouter les secrets `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD` et `ANDROID_KEY_ALIAS`.
