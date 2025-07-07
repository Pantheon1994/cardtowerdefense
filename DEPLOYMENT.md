# 🚀 Guide de Déploiement - Card Tower Defense

## Option 1: Render (Gratuit et Simple)

### Étapes :

1. **Préparer le repository GitHub**
   ```bash
   # Si pas encore fait, initialisez git
   git init
   git add .
   git commit -m "Initial commit"
   
   # Créez un repository sur GitHub et poussez le code
   git remote add origin https://github.com/VOTRE_USERNAME/card-tower-defense.git
   git push -u origin main
   ```

2. **Déployer sur Render**
   - Allez sur [render.com](https://render.com)
   - Cliquez "Get Started for Free"
   - Connectez votre compte GitHub
   - Cliquez "New Web Service"
   - Sélectionnez votre repository `card-tower-defense`
   - Paramètres de déploiement :
     * **Name**: `card-tower-defense`
     * **Region**: `Oregon (US West)`
     * **Build Command**: `npm install`
     * **Start Command**: `npm start`
     * **Environment**: `Node`
     * **Publish Directory**: **(LAISSER VIDE ou mettre ".")**
   - Cliquez "Create Web Service"

3. **Accès au jeu**
   - Render vous donnera une URL comme : `https://card-tower-defense-xyz.onrender.com`
   - Partagez cette URL avec vos amis !

## Option 2: Railway (Alternative)

1. Allez sur [railway.app](https://railway.app)
2. "Start a New Project" → "Deploy from GitHub repo"
3. Sélectionnez votre repository
4. Railway détecte automatiquement Node.js
5. Votre app sera déployée automatiquement

## Option 3: Heroku (Plus complexe mais gratuit)

1. Installez [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. Commandes :
   ```bash
   heroku login
   heroku create card-tower-defense-VOTRE_NOM
   git push heroku main
   heroku open
   ```

## 📱 Partage avec vos amis

Une fois déployé :
1. Copiez l'URL fournie par la plateforme
2. Envoyez-la à vos amis
3. Créez une room avec un nom unique
4. Vos amis rejoignent avec le même nom de room
5. Lancez la partie à 4 joueurs maximum !

## 🔧 Résolution de problèmes

### Si le déploiement échoue :
- Vérifiez que `package.json` est à la racine
- Assurez-vous que `npm start` fonctionne localement
- Consultez les logs de la plateforme de déploiement

### Si vous obtenez "Not Found" :
- Vérifiez que votre `server.js` contient bien les routes pour servir `index.html`
- Assurez-vous que le dossier `public` contient bien `index.html`
- Testez localement avec `npm start` avant de déployer

### Si les amis ne peuvent pas se connecter :
- Vérifiez que l'URL est correcte (https://)
- Testez d'abord vous-même sur l'URL de déploiement
- Assurez-vous que tous utilisent le même nom de room

## ⚡ Conseils

- **Render** : Plus stable mais peut prendre 30s pour se "réveiller" si inactif
- **Railway** : Plus rapide mais avec des limitations de bande passante
- **Heroku** : Gratuit mais l'app "dort" après 30min d'inactivité

Le jeu est maintenant prêt pour jouer en ligne avec vos amis ! 🎮
