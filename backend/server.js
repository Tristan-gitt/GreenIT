const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Connexion à la base de données MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Remplacez par votre utilisateur MySQL
    password: 'Bastien.04', // Remplacez par votre mot de passe MySQL
    database: 'ecological_challenge'
});

db.connect((err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données:', err);
        return;
    }
    console.log('Connecté à la base de données MySQL');
});

// Route pour l'inscription
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    try {
        // Hacher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insérer l'utilisateur dans la base de données
        const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
        db.query(query, [username, email, hashedPassword], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'Utilisateur ou email déjà existant' });
                }
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            res.status(201).json({ message: 'Utilisateur créé avec succès' });
        });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour la connexion
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        if (results.length === 0) {
            return res.status(401).json({ error: 'Utilisateur non trouvé' });
        }

        const user = results[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Mot de passe incorrect' });
        }

        res.json({ message: 'Connexion réussie', user: { id: user.id, username: user.username, points: user.points } });
    });
});

// Route pour récupérer les défis
app.get('/api/challenges', (req, res) => {
    const query = 'SELECT * FROM challenges';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        res.json(results);
    });
});

// Route pour récupérer les défis complétés par un utilisateur
app.get('/api/user-challenges/:userId', (req, res) => {
    const userId = req.params.userId;
    const query = 'SELECT * FROM user_challenges WHERE user_id = ? AND completed = true';
    db.query(query, [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        res.json(results);
    });
});

// Route pour valider un défi
app.post('/api/complete-challenge', (req, res) => {
    const { userId, challengeId, points } = req.body;
    if (!userId || !challengeId || !points) {
        return res.status(400).json({ error: 'Données manquantes' });
    }

    // Vérifier si le défi a déjà été complété
    const checkQuery = 'SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ?';
    db.query(checkQuery, [userId, challengeId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        if (results.length > 0 && results[0].completed) {
            return res.status(400).json({ error: 'Défi déjà complété' });
        }

        // Insérer ou mettre à jour l'entrée dans user_challenges
        const insertQuery = 'INSERT INTO user_challenges (user_id, challenge_id, completed, completed_at) VALUES (?, ?, true, NOW()) ON DUPLICATE KEY UPDATE completed = true, completed_at = NOW()';
        db.query(insertQuery, [userId, challengeId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }

            // Mettre à jour les points de l'utilisateur
            const updatePointsQuery = 'UPDATE users SET points = points + ? WHERE id = ?';
            db.query(updatePointsQuery, [points, userId], (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Erreur serveur' });
                }
                res.json({ message: 'Défi validé avec succès' });
            });
        });
    });
});

// Route pour réinitialiser les défis complétés d'un utilisateur
app.post('/api/reset-challenges/:userId', (req, res) => {
    const userId = req.params.userId;
    if (!userId) {
        return res.status(400).json({ error: 'ID utilisateur manquant' });
    }

    // Supprimer les défis complétés de l'utilisateur
    const deleteQuery = 'DELETE FROM user_challenges WHERE user_id = ?';
    db.query(deleteQuery, [userId], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur lors de la suppression des défis complétés' });
        }

        // Réinitialiser les points de l'utilisateur
        const resetPointsQuery = 'UPDATE users SET points = 0 WHERE id = ?';
        db.query(resetPointsQuery, [userId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur lors de la réinitialisation des points' });
            }
            res.json({ message: 'Défis réinitialisés avec succès' });
        });
    });
});

// Démarrer le serveur
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});