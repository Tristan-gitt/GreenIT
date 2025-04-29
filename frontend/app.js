new Vue({
  el: '#app',
  data: {
      currentPage: '',
      username: '',
      email: '',
      password: '',
      challenges: [], // Tous les défis disponibles
      displayedChallenges: [], // Les deux défis actuellement affichés
      completedChallenges: [], // Liste des IDs des défis complétés
      isLoginMode: true, // true pour connexion, false pour inscription
      isLoggedIn: false, // État de connexion
      userId: null, // ID de l'utilisateur connecté
      userPoints: 0, // Points de l'utilisateur
      totalCo2Saved: 0, // CO2 économisé total
      maxCo2: 100 // Objectif maximum de CO2 économisé (ajustable)
  },
  computed: {
      co2FillPercentage() {
          // Calcule le pourcentage de remplissage du cercle en fonction du CO2 économisé
          return Math.min((this.totalCo2Saved / this.maxCo2) * 100, 100);
      }
  },
  methods: {
      async login() {
          try {
              const response = await axios.post('http://localhost:3000/api/login', {
                  email: this.email,
                  password: this.password
              });
              alert(response.data.message);
              this.isLoggedIn = true;
              this.userId = response.data.user.id;
              this.userPoints = response.data.user.points;
              this.currentPage = 'home';
              // Réinitialiser les champs après connexion réussie
              this.email = '';
              this.password = '';
              // Charger les défis complétés
              await this.fetchCompletedChallenges();
              // Mettre à jour les défis affichés
              this.updateDisplayedChallenges();
              // Calculer le CO2 économisé
              await this.calculateTotalCo2Saved();
          } catch (error) {
              alert(error.response.data.error);
          }
      },
      async register() {
          try {
              const response = await axios.post('http://localhost:3000/api/register', {
                  username: this.username,
                  email: this.email,
                  password: this.password
              });
              alert(response.data.message);
              // Réinitialiser les champs après inscription réussie
              this.username = '';
              this.email = '';
              this.password = '';
              // Basculer automatiquement vers le mode connexion après inscription
              this.isLoginMode = true;
          } catch (error) {
              alert(error.response.data.error);
          }
      },
      async fetchChallenges() {
          try {
              const response = await axios.get('http://localhost:3000/api/challenges');
              this.challenges = response.data;
              // Initialiser les défis affichés après avoir chargé tous les défis
              this.updateDisplayedChallenges();
          } catch (error) {
              console.error('Erreur lors de la récupération des défis:', error);
          }
      },
      async fetchCompletedChallenges() {
          if (!this.isLoggedIn) return;
          try {
              const response = await axios.get(`http://localhost:3000/api/user-challenges/${this.userId}`);
              this.completedChallenges = response.data.map(challenge => challenge.challenge_id);
              // Mettre à jour les défis affichés après avoir chargé les défis complétés
              this.updateDisplayedChallenges();
          } catch (error) {
              console.error('Erreur lors de la récupération des défis complétés:', error);
          }
      },
      async completeChallenge(challengeId, points, co2Saved) {
          if (!this.isLoggedIn) {
              alert('Veuillez vous connecter pour valider un défi.');
              this.currentPage = 'login';
              return;
          }
          try {
              const response = await axios.post('http://localhost:3000/api/complete-challenge', {
                  userId: this.userId,
                  challengeId: challengeId,
                  points: points
              });
              alert(response.data.message);
              this.userPoints += points;
              this.completedChallenges.push(challengeId);
              this.totalCo2Saved += co2Saved;
              // Remplacer le défi complété par un nouveau défi
              this.replaceChallenge(challengeId);
          } catch (error) {
              alert(error.response.data.error);
          }
      },
      isChallengeCompleted(challengeId) {
          return this.completedChallenges.includes(challengeId);
      },
      async calculateTotalCo2Saved() {
          if (!this.isLoggedIn) {
              this.totalCo2Saved = 0;
              return;
          }
          try {
              const response = await axios.get(`http://localhost:3000/api/user-challenges/${this.userId}`);
              const completedChallenges = response.data;
              this.totalCo2Saved = completedChallenges.reduce((total, challenge) => {
                  const challengeData = this.challenges.find(c => c.id === challenge.challenge_id);
                  return total + (challengeData ? challengeData.co2_saved : 0);
              }, 0);
          } catch (error) {
              console.error('Erreur lors du calcul du CO2 économisé:', error);
          }
      },
      updateDisplayedChallenges() {
          // Filtrer les défis non complétés
          const availableChallenges = this.challenges.filter(challenge => !this.isChallengeCompleted(challenge.id));
          // Si moins de 2 défis sont affichés, en ajouter de nouveaux
          if (this.displayedChallenges.length < 2 && availableChallenges.length > 0) {
              // Sélectionner aléatoirement jusqu'à 2 défis non complétés
              let newChallenges = [];
              const remainingSlots = 2 - this.displayedChallenges.length;
              for (let i = 0; i < remainingSlots && availableChallenges.length > 0; i++) {
                  const randomIndex = Math.floor(Math.random() * availableChallenges.length);
                  const selectedChallenge = availableChallenges[randomIndex];
                  newChallenges.push(selectedChallenge);
                  // Retirer le défi sélectionné pour éviter les doublons
                  availableChallenges.splice(randomIndex, 1);
              }
              this.displayedChallenges = [...this.displayedChallenges, ...newChallenges];
          }
          // Si tous les défis sont complétés, vider la liste affichée
          if (availableChallenges.length === 0) {
              this.displayedChallenges = [];
          }
      },
      replaceChallenge(completedChallengeId) {
          // Retirer le défi complété de la liste affichée
          this.displayedChallenges = this.displayedChallenges.filter(challenge => challenge.id !== completedChallengeId);
          // Ajouter un nouveau défi aléatoire
          this.updateDisplayedChallenges();
      },
      async resetChallenges() {
          if (!this.isLoggedIn) {
              alert('Veuillez vous connecter pour réinitialiser les défis.');
              return;
          }
          try {
              const response = await axios.post(`http://localhost:3000/api/reset-challenges/${this.userId}`);
              alert(response.data.message);
              // Réinitialiser les données locales
              this.completedChallenges = [];
              this.userPoints = 0;
              this.totalCo2Saved = 0;
              // Mettre à jour les défis affichés
              this.updateDisplayedChallenges();
          } catch (error) {
              alert(error.response.data.error);
          }
      },
      logout() {
          this.isLoggedIn = false;
          this.userId = null;
          this.userPoints = 0;
          this.completedChallenges = [];
          this.totalCo2Saved = 0;
          this.displayedChallenges = [];
          this.currentPage = 'home';
          // Recharger les défis affichés pour un nouvel utilisateur
          this.updateDisplayedChallenges();
      }
  },
  mounted() {
      this.fetchChallenges(); // Charger les défis au démarrage
  }
});