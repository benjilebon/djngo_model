# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.shortcuts import render,redirect
from django.http import HttpResponse, Http404, HttpResponseRedirect
from django.template import loader,Context
from django.contrib.auth import authenticate, login
from django.core.exceptions import PermissionDenied
from rest_framework import permissions, routers, serializers, viewsets
import os
# from datetime import date,datetitme
from data.models import *

def baseView(user):
	tasks=Analyse.objects.filter(owner=user).order_by('-modification_time')
	notif=Alert.objects.filter(owners=user).order_by('-time')
	msg=Message.objects.filter(recipient=user).order_by('-time')
	tick=Ticket.objects.filter(owner=user)
	kube=Kubex.objects.filter(users=user)
	keywords=Keyword.objects.all()
	username=KubexUser.objects.get(id=user.id).name
	context = {"username":username,"messages":msg,"notifications":notif,"analyses":tasks,"tickets":tick,"kubex":kube, "keywords": keywords}
	return context

def root(request):
	print('Redirecting / to dashboard')
	return HttpResponseRedirect('dashboard')

def index(request):
	print('Redirecting index to dashboard')
	return HttpResponseRedirect('dashboard')

# def base(request):
# 	print('Base')
# 	template = loader.get_template('base.html')
# 	context = baseView(request.user)
# 	return HttpResponse(template.render(context, request))

# def login(request):
# 	print('Signing in...')
# 	username = request.POST['username']
# 	password = request.POST['password']
# 	user = authenticate(request, username=username, password=password)
# 	if user is not None:
# 		login(request, user)
# 		print('%s signed in',username)
# 		return HttpResponseRedirect('dashboard')
# 	else:
# 		print('wrong authentication for %s',username)
# 		return HttpResponseRedirect('login')

def admin(request):
	if not request.user.is_authenticated:
		return HttpResponseRedirect('login')
	if not request.user.is_superuser:
		return HttpResponseRedirect('dashboard')
	print('Administration panel')
	template = loader.get_template('admin.html')
	context=baseView(request.user)
	context['tickets']=Ticket.objects.all()
	context['kubex']=Kubex.objects.all()
	context['users']=KubexUser.objects.all()
	return HttpResponse(template.render(context, request))

def dashboard(request):
	if not request.user.is_authenticated:
		return HttpResponseRedirect('login')
	print('Dashboard')
	template = loader.get_template('dashboard.html')
	context=baseView(request.user)
	# if request.user.is_superuser:
	# 	context['datasets']=Dataset.objects.all()
	# else:
	context['messages_new']=Message.objects.filter(recipient=request.user,status='N').count()
	context['analyses_ongoing']=Analyse.objects.filter(owner=request.user,status__in=('R','E','S')).count()
	context['datasets']=Dataset.objects.filter(from_sensor__kubex__users=request.user)|Dataset.objects.filter(from_analyse__kubex__users=request.user)
	# context['keywords']=Keyword.objects.all()
	return HttpResponse(template.render(context, request))


def graphics(request):
	if not request.user.is_authenticated:
		return HttpResponseRedirect('login')
	print('List Graphics')
	template = loader.get_template('graphics.html')
	context=baseView(request.user)
	context['datasets']=Dataset.objects.filter(from_sensor__kubex__users=request.user)|Dataset.objects.filter(from_analyse__kubex__users=request.user)
	context['formats']=Dataset.FORMATS
	return HttpResponse(template.render(context, request))

def analysis(request):
	if not request.user.is_authenticated:
		return HttpResponseRedirect('login')
	print('Data Analysis')
	template = loader.get_template('analysis.html')
	context=baseView(request.user)
	context['datasets']=Dataset.objects.filter(from_sensor__kubex__users=request.user)|Dataset.objects.filter(from_analyse__kubex__users=request.user)
	context['formats']=Dataset.FORMATS
	context['analyses']=Analyse.objects.filter(owner=request.user)
	context['algorithms']=Algorithm.objects.all()
	context['algo_type']=Algorithm.TYPE
	return HttpResponse(template.render(context, request))

def kubex(request):
	if not request.user.is_authenticated:
		return HttpResponseRedirect('login')
	print('Data Analysis')
	template = loader.get_template('kubex.html')
	context=baseView(request.user)
	if request.user.is_superuser:
		context['kubex']=Kubex.objects.all()
	else:
		context['kubex']=Kubex.objects.filter(users=request.user)
	return HttpResponse(template.render(context, request))

def datasets(request):
	if not request.user.is_authenticated:
		return HttpResponseRedirect('login')

	# old view-based method to add datasets, now replaced by addDadaset API, kept temporary in case of API validation

	# if request.method == 'POST':
	# 	# check if data is valid (add checks in html/js too)
	# 	kube=Kubex.objects.get(SN=request.POST['kubex'])

	# 	# lic=Licence.objects.get(title=request.POST['licence'])
	# 	d=Dataset.objects.create(kubex=kube,description=request.POST['description'],title=request.POST['title'],data_format=request.POST['data_format'])
	# 	file=os.path.join("kubex_data","datasets",str(request.POST['kubex']),str(d.id))
	# 	with open(file, 'wb+') as destination:
	# 		for chunk in request.FILES['data'].chunks():
	# 			destination.write(chunk)
	# 	d.data=file
	# 	# add maaaany checks to this asap !
	# 	keywords = request.POST['keywords-input'].split(',')
	# 	for k in keywords:
	# 		try :
	# 			kw=Keyword.objects.get(word=k)
	# 		except Keyword.DoesNotExist:
	# 			kw=Keyword.objects.create(word=k)
	# 		d.keywords.add(kw)
	# 	d.save()
	# 	msg='Le jeu de données "'+d.title+'" a été ajouté'
	# 	a=Alert.objects.create(status='V',title=msg,origin=d)
	# 	for u in kube.users.all():
	# 		a.owners.add(u)
	# 	a.save
	# 	print('Added Dataset')
	# else:

	print('Manage Datasets')
	template = loader.get_template('datasets.html')
	context=baseView(request.user)
	context['datasets']=Dataset.objects.filter(from_sensor__kubex__users=request.user)|Dataset.objects.filter(from_analyse__kubex__users=request.user)
	context['kubex']=Kubex.objects.filter(users=request.user)
	context['formats']=Dataset.FORMATS
	return HttpResponse(template.render(context, request))

def inbox(request):
	if not request.user.is_authenticated:
		return HttpResponseRedirect('login')
	print('Inbox')
	template = loader.get_template('inbox.html')
	context=baseView(request.user)
	# context['messages_received']=Message.objects.filter(recipient=request.user)
	context['contacts']=KubexUser.objects.all()
	context['messages_sent']=Message.objects.filter(sender=request.user)
	return HttpResponse(template.render(context, request))

def tasks(request):
	if not request.user.is_authenticated:
		return HttpResponseRedirect('login')
	print('Analyses monitoring')
	template = loader.get_template('tasks.html')
	context=baseView(request.user)
	context['analyses']=Analyse.objects.filter(owner=request.user)
	return HttpResponse(template.render(context, request))

def alerts(request):
	if not request.user.is_authenticated:
		return HttpResponseRedirect('login')
	print('Notifications')
	template = loader.get_template('notifications.html')
	context=baseView(request.user)
	context['notifications']=Alert.objects.filter(owners=request.user)
	return HttpResponse(template.render(context, request))

def settings(request):
	if not request.user.is_authenticated:
		return HttpResponseRedirect('login')
	print('User Settings')
	template = loader.get_template('settings.html')
	context=baseView(request.user)
	return HttpResponse(template.render(context, request))

def profile(request):
	if not request.user.is_authenticated:
		return HttpResponseRedirect('login')
	context=baseView(request.user)
	context['profile_user']=KubexUser.objects.get(id=request.user.id) # default is current user profile
	if request.POST:
		if(request.POST['user_id'] != request.user.id and not request.user.is_superuser): # trying to modify another user profil while not being and admin : forbid it !
			raise PermissionDenied
		user=KubexUser.objects.get(id=request.POST['user_id'])
		if request.POST['first_name'] != '':
			user.first_name=request.POST['first_name']
		if request.POST['last_name'] != '':
			user.last_name=request.POST['last_name']
		if request.POST['email'] != '':
			user.email=request.POST['email']
		user.save()
		context['profile_user']=user

# 	username = request.POST['username']
# 	password = request.POST['password']
# 	user = authenticate(request, username=username, password=password)
# 	if user is not None:
# 		login(request, user)
# 		print('%s signed in',username)
# 		return HttpResponseRedirect('dashboard')
# 	else:
# 		print('wrong authentication for %s',username)
# 		return HttpResponseRedirect('login')
	else :
		print('User profile')
		if(request.GET.get('user',False) and request.user.is_superuser):
			context['profile_user']= KubexUser.objects.get(id=request.GET['user'])
	template = loader.get_template('profile.html')
	return HttpResponse(template.render(context, request))

def search(request):
	if not request.user.is_authenticated:
		return Redirect('login')
	print('Search')
	template = loader.get_template('search.html')
	context=baseView(request.user)
	return HttpResponse(template.render(context, request))


def support(request):
	if not request.user.is_authenticated:
		return HttpResponseRedirect('login')
	print('Support')
	template = loader.get_template('support.html')
	context=baseView(request.user)
	context['tickets']=Ticket.objects.filter(owner=request.user)
	return HttpResponse(template.render(context, request))

def manual(request):
	if not request.user.is_authenticated:
		return HttpResponseRedirect('login')
	print('Manual')
	template = loader.get_template('manual.html')
	context=baseView(request.user)
	return HttpResponse(template.render(context, request))

# def test(request,pagename):
# 	if not request.user.is_authenticated:
# 		return HttpResponseRedirect('login')
# 	pagename+=".html"
# 	print("Testing page",pagename)
# 	template = loader.get_template(pagename)
# 	context = baseView(request.user)
# 	return HttpResponse(template.render(context, request))