#! /bin/bash

# This program launches server and all dependancies, to be tested !

# source cloud_virtualenv/bin/activate
python manage.py runserver 0:8080 > logs/GUI.out 2> logs/GUI.err 

