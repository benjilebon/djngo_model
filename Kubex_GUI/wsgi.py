"""
WSGI config for Kubex_GUI project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/1.11/howto/deployment/wsgi/
"""

import os,sys

# add the project path into the sys.path
print(sys.version)
# cwd=os.path.abspath(os.path.realpath(__file__))
# # print("adding paths {p1}, {p2}, {p3}, {p4}".format(p1=os.path.abspath(cwd+'/..'),p2=os.path.abspath(cwd+'../../cloud_virtualenv'),
# #	p3=os.path.abspath('home/audensiel/anaconda3/pkgs/django-2.0.7-py35_0/lib/python3.5/site-packages'),p4=os.path.abspath('/home/audensiel/anaconda3/lib/python3.5/site-packages')))

# sys.path.append(os.path.abspath('/home/audensiel/.local/lib/python3.5/site-packages'))
# sys.path.append(os.path.abspath(cwd+'/..'))

# # add the virtualenv site-packages path to the sys.path
# sys.path.append(os.path.abspath(cwd+'/../../cloud_virtualenv'))
# sys.path.append(os.path.abspath('/home/audensiel/anaconda3/pkgs/django-2.0.7-py35_0/lib/python3.5/site-packages'))
# sys.path.append(os.path.abspath('/home/audensiel/anaconda3/lib/python3.5/site-packages'))
# sys.path.append(os.path.abspath('/home/audensiel/anaconda3/lib/python3.5/lib-dynload'))
print("global path in WGSI : {p}".format(p=sys.path))
# print("WSGI loaded modules : {m}".format(m=sys.modules))
# print (help('modules') )
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Kubex_GUI.settings")

application = get_wsgi_application()
