# 🎓 Sujet 3 — ScholarTrack : Système de gestion académique

> **Niveau :** Avancé
> **Durée estimée :** ~30h
> **Rendu :** dépôt Git (lien à fournir avant la deadline)

## Contexte

Un établissement scolaire veut une API pour gérer ses cours, ses étudiants, ses enseignants et ses résultats. Ça peut paraître classique, mais les contraintes métier sont nombreuses : un enseignant ne doit accéder qu'à ses propres cours, un étudiant ne voit que ses propres notes, et les capacités de cours doivent être respectées à la lettre.

Ce qui complexifie le tout, c'est la gestion des **notes pondérées** (chaque type d'évaluation a un poids configurable par cours), des **présences**, et surtout d'un **import CSV de notes en masse** avec rapport d'erreurs et transaction tout-ou-rien. Le moindre bug dans la logique métier se verra dans les tests d'intégration.

L'admin dispose d'un reporting complet exportable en CSV.

## Stack imposée

- **NestJS** (modules, controllers, services, guards, pipes, middleware)
- **Prisma** comme ORM
- **Better Auth** pour l'authentification
- **class-validator** + **class-transformer** pour les DTOs
- **Jest** pour les tests

## Liste des attendus

### 🔐 Authentification & Autorisation

- [ ] Connexion / Déconnexion via Better Auth (rôles : `STUDENT`, `TEACHER`, `ADMIN`)
- [ ] Les comptes `STUDENT` et `TEACHER` sont créés par un `ADMIN` uniquement
- [ ] Guards adaptés à chaque rôle et à la propriété des ressources
- [ ] Middleware de rate limiting manuel (429 au-delà du seuil)

### 📚 Cours

- [ ] CRUD cours avec droits par rôle et configuration des poids par type d'évaluation
- [ ] Inscription d'un étudiant avec vérification de capacité via un Pipe
- [ ] Filtrage et pagination pour l'admin

### 📝 Notes

- [ ] Saisie de notes avec vérification d'appartenance au cours
- [ ] Calcul de moyenne pondérée selon la configuration du cours
- [ ] Import CSV de notes avec transaction tout-ou-rien et rapport d'erreurs

### 📅 Présences

- [ ] Enregistrement en masse des présences d'une session
- [ ] Calcul du taux de présence et flag `atRisk` si dépassement du seuil

### 🔧 Administration & Reporting

- [ ] Export CSV semestriel des résultats
- [ ] Import CSV d'inscriptions en masse avec gestion des doublons et de la capacité
- [ ] Stats globales par semestre via agrégations Prisma

### 🧪 Tests

- [ ] Tests unitaires sur `GradesService`, le Pipe de capacité et le rate limiting
- [ ] Tests d'intégration couvrant un scénario complet
- [ ] Coverage mesuré avec `jest --coverage`

## 📊 Barème

> **Total : 100 points → ramené sur 20**
> Le bonus/malus d'implication est appliqué en dernier.

### Fonctionnalités techniques (75 pts)

| Module                | Critère                                          | Pts  |
| --------------------- | ------------------------------------------------ | ---- |
| **Auth & Middleware** | Auth multi-rôles, guards et rate limiting        | 13   |
| **Cours**             | CRUD, pondérations, Pipe de capacité et filtrage | 14   |
| **Notes**             | Saisie, moyenne pondérée et import CSV           | 18   |
| **Présences**         | Enregistrement et calcul taux + atRisk           | 7    |
| **Admin**             | Export CSV, import inscriptions et stats         | 14   |
| **Tests**             | Tests unitaires et d'intégration                 | 13   |
|                       | _Coverage > 70%_                                 | _+3_ |
|                       | _Coverage < 30%_                                 | _-3_ |

### Critères annexes (25 pts)

| Critère                 | Pts | Détail                                                                                                                                                                    |
| ----------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Git Flow**            | 8   | Branches `feature/`, `fix/`, merge requests avec description, commits conventionnels (`feat:`, `fix:`, `chore:`, etc.)                                                    |
| **Documentation**       | 7   | README (setup, scripts, description des modules), Swagger configuré et à jour, `.env.example` fourni sans secrets hardcodés _(2 pts inclus)_, docstrings sur les services |
| **Qualité du code**     | 5   | Structure modulaire NestJS respectée, pas de logique métier dans les controllers, nommage cohérent                                                                        |
| **Gestion des erreurs** | 5   | HttpExceptions appropriées, messages clairs, aucun 500 exposé au client                                                                                                   |

### Bonus / Malus

|                                                                           | Pts |
| ------------------------------------------------------------------------- | --- |
| Implication générale (rendu soigné, features bonus solides, proactivité)  | +5  |
| Rendu bâclé, code illisible, fonctionnalités incomplètes sans explication | -5  |

> 💡 **Features bonus** (non différenciantes dans la note principale) : notifications en temps réel lorsqu'un étudiant passe en `atRisk` (WebSocket), cache Redis sur les stats globales, envoi d'un email de résumé de fin de semestre (simulé avec un logger).

## Livrables

- Lien vers le dépôt Git
- Un `README.md` à la racine avec les instructions de setup
- Un fichier `.env.example` à la racine
- Collection Postman/Insomnia/Bruno ou lien Swagger
