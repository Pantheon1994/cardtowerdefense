#!/bin/bash

echo "🎮 Card Tower Defense - Déploiement"
echo "=================================="

# Vérifier si git est initialisé
if [ ! -d ".git" ]; then
    echo "🔧 Initialisation du dépôt Git..."
    git init
    git add .
    git commit -m "Initial commit - Card Tower Defense"
fi

echo ""
echo "📦 Options de déploiement:"
echo "1. Render (Gratuit, recommandé)"
echo "2. Railway (Gratuit avec limitations)"
echo "3. Heroku (Gratuit limité)"
echo "4. Vercel (Gratuit, pour Node.js)"
echo ""

read -p "Choisissez une option (1-4): " choice

case $choice in
    1)
        echo "🚀 Déploiement sur Render:"
        echo "1. Allez sur https://render.com"
        echo "2. Connectez votre compte GitHub"
        echo "3. Créez un nouveau 'Web Service'"
        echo "4. Sélectionnez votre repository"
        echo "5. Utilisez ces paramètres:"
        echo "   - Build Command: npm install"
        echo "   - Start Command: npm start"
        echo "   - Environment: Node"
        echo "   - Port: 10000"
        ;;
    2)
        echo "🚀 Déploiement sur Railway:"
        echo "1. Allez sur https://railway.app"
        echo "2. Connectez votre compte GitHub"
        echo "3. Créez un nouveau projet"
        echo "4. Sélectionnez votre repository"
        echo "5. Railway détectera automatiquement Node.js"
        ;;
    3)
        echo "🚀 Déploiement sur Heroku:"
        echo "1. Allez sur https://dashboard.heroku.com"
        echo "2. Créez une nouvelle app"
        echo "3. Connectez votre compte GitHub"
        echo "4. Sélectionnez votre repository"
        echo "5. Activez le déploiement automatique"
        ;;
    4)
        echo "🚀 Déploiement sur Vercel:"
        echo "1. Allez sur https://vercel.com"
        echo "2. Connectez votre compte GitHub"
        echo "3. Importez votre project"
        echo "4. Vercel détectera automatiquement Node.js"
        ;;
    *)
        echo "❌ Option invalide"
        exit 1
        ;;
esac

echo ""
echo "✅ Prêt pour le déploiement!"
echo "📋 N'oubliez pas de pousser vos changements sur GitHub avant de déployer."
