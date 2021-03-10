# Kubex cloud Graphical User Interface

Ce projet contient tous les fichiers nécessaires au déploiement d'une interface utilisateur "exemple jrojet django", y compris une base de données basique et les prérequis de l'environnement virtuel.

## Langages et spécifications

Cette interface est codée en html, css et javascript pour la partie front-end, tandis que la partie back-end est assurée par le framework django dans un environnement virtuel en python > v3.5; les modules requis pour cet environnement peuvent être importés depuis le fichier requirements.txt. La base de donnée utilisée est postgreSQL; une copie de la base de donnée utilisée pour le développement se trouve dans le fichier database.psql pour les besoins des tests. Le déploiement en production est prévu via un serveur Heroku

## Déploiement du serveur


Une fois le git téléchargé, crer l'environnement virtuel et installer les diférents modules :

```shell
virtualenv --python=python3.5 my_env
pip install -r requirements.txt
```

Installer postgreSQL et charger la base de donées par défaut si nécessaire :

```shell
sudo apt-get install postgresql postgresql-contrib
psql < database.psql
```

Pour sauvegarder les modifications de la base de données dans le fichier backup.psql, la commande est :

```shell
pg_dump -a kubex > backup/database.psql
```

Pour la suite, les commandes s'effectueront depuis l'environnement virtuel, qu'on active par :

```shell
source my_env/bin/activate
```

Pour sortir de l'environnement virtuel, il suffira de taper `deactivate`.

Vérifier que la base de données est à jour avec les modèles django et réaliser les migrations sinon :

```shell
python manage.py makemigrations
python manage.py migrate
```

Enfin, pour lancer tous les services :

```shell
./launcher.sh
```

Cette commande lance simultanément le serveur, le service de réception des données, et les agents effectuant les tâches asynchrones, mais il est également possible de les lancer séparément.

Serveur Django (! uniquement pour le développement) :

```shell
python manage.py runserver 0:8080
```


Pour y accéder ensuite, entrer l'adresse [http://localhost:8080]
