# -*- coding: utf-8 -*-

import json
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import authentication, permissions
from django.http import HttpResponseRedirect, HttpResponse, Http404
from django.db.models import Q
from data.models import *
from data.views import baseView
from data.serializers import *
from django.shortcuts import *
import re
import os
from data import celery, tasks
from django_celery_beat.models import CrontabSchedule, PeriodicTask, IntervalSchedule
from django.core.files.base import ContentFile

# /manual
class getManual(APIView):
	def get(self,request):
		file_path = 'doc/user-manual.pdf'
		if os.path.exists(file_path):
			with open(file_path, 'rb') as fh:
				response = HttpResponse(fh.read(), content_type="application/pdf")
				response['Content-Disposition'] = 'inline; filename=' + os.path.basename(file_path)
				return response
		raise Http404

# /search?content=<kw1,kw2...>
class searchQuery(APIView):
	def get(self,request):
		query=request.query_params['content'].split(',')
		print("Query : ",request.query_params['content'])
		regex=r""+request.query_params['content'].translate(str.maketrans({',':'|'}))#+"){e==0}"
		datasets=Dataset.objects.filter(Q(keywords__word__in=query)|Q(title__iregex=regex)|Q(description__iregex=regex)|Q(from_sensor__kubex__name__iregex=regex)|Q(from_sensor__kubex__users__username__iregex=regex)|Q(from_analyse__kubex__name__iregex=regex)|Q(from_analyse__kubex__users__username__iregex=regex))
		analyses=Analyse.objects.filter(Q(title__iregex=regex)|Q(description__iregex=regex)|Q(owner__username__iregex=regex)) # ! add Q(keywords__word__in=query)| after model update !
		messages=Message.objects.filter(Q(sender=request.user,recipient__username__iregex=regex)|Q(recipient=request.user,sender__username__iregex=regex)|Q(title__iregex=regex)|Q(description__iregex=regex))
		context=baseView(request.user)
		context['query_datasets']=datasets
		context['query_analyses']=analyses
		context['query_messages']=messages
		template = loader.get_template('search.html')
		return HttpResponse(template.render(context, request))

# /api/alert/delete
class deleteAlert(APIView):
	def delete(self,request, alert_id):
		if not request.user.is_authenticated:
			return redirect('/login')
		try:
			al=Alert.objects.get(owners=request.user.id, id=alert_id)
			al.owners.remove(request.user.id)
			if(al.owners.count()==0): #last lconcerned user deleted alert, clear it for good
				al.delete()
		except Dataset.DoesNotExist:
			raise Http404
			# return Response(status=status.HTTP_400_BAD_REQUEST)

		print('Delete alert {id}'.format(id=alert_id))
		return Response({'message': 'Delete alert {alert_id}'}, status=status.HTTP_200_OK);	

# /api/algorithm/(?P<algo_id>\d+)
class getAlgorithmParameters(APIView):
	def get(self, request, algo_id):
		if not request.user.is_authenticated:
			return redirect('login')
		try:
			algo=Algorithm.objects.get(id=algo_id)
		except Algorithm.DoesNotExist:
			return Response({'Error':"Algorithm doesn't exist."}, content_type='json', headers={'Access-Control-Allow-Origin': '*'})
		
		kubex=Kubex.objects.filter(users=request.user.id).values_list('SN','name')
		kube=[None]*len(kubex)
		for i,k in enumerate(kubex):
			print(i,k)
			kube[i]={"id":k[0],"name":k[1]}
		print('Load algorithm parameters')

		return Response({"kubex_allowed":kube,"description":algo.description,"parameters":algo.parameters,"inputs":algo.inputs}, status=status.HTTP_200_OK, content_type='json', headers={'Access-Control-Allow-Origin': '*'})

# /api/algorithm/list?dataFormat=<T|A|I|V>
class getAlgorithms(APIView):
	def get(self, request):
		if not request.user.is_authenticated:
			return HttpResponseRedirect('login')
		algo_format=request.query_params.get('dataFormat', None)
		try:
			algo=Algorithm.objects.filter(data_format=algo_format)
		except Algorithm.DoesNotExist:
			return Response({'Error':"No algorithm fit this data format yet, you can create a ticket to ask for one."}, content_type='json', headers={'Access-Control-Allow-Origin': '*'})
		algo_list=list()
		for a in algo:
			algo_list.append({"id": a.id, "title":a.title,"format":a.data_format,"type":a.algo_type})
		print('Load algorithms')
		return Response({"algorithms":algo_list}, status=status.HTTP_200_OK, content_type='json', headers={'Access-Control-Allow-Origin': '*'})

# launchAnalysis option
def addPeriodicTask(task,analyse):
	schedule, _ = IntervalSchedule.objects.get_or_create(**task)
	# schedule, _ = CrontabSchedule.objects.get_or_create(**task)
	try:
		interval=timedelta(**{task['period']:task['every']})
		PeriodicTask.objects.create(interval=schedule,name=analyse.title,task='data.tasks.periodic_task',kwargs=json.dumps({'analyse':analyse.id,'interval':interval}))
	except Exception as e:
		print('Echec du lancement de la tâche périodique "{t}" : {ex}'.format(t=analyse.title,ex=str(e)))
		return " mais n'a pas pu être programmée périodiquement."
	return " et sera effectuée régulièrment ({nb} {type}).".format(nb=task['every'],type=task['period'])

# /api/analysis/launch
class launchAnalysis(APIView):
	# rewrite whole function to create separately analyse containig ALL required information, and then load inputs/launch task (and adapt cron tasks)
	def post(self,request):
		if not request.user.is_authenticated:
			return redirect('login')
		try:
			u=KubexUser.objects.get(id=request.user.id)
			an=Analyse.objects.create(**request.data['analyse'],owner=u,inputs=request.data['inputs'],parameters=request.data['parameters']) 
			# try:
			for d in request.data['datasets']:
				an.datasets.add(d)
			tasks.launchAnalysis.delay(an_id=an.id)
			msg="""L'analyse "{}" a été lancée""".format(an.title)
		except Exception as e:
			print("L'analyse n'a pas pu être lancée à cause de l'exception : {ex}".format(ex=str(e)))
			msg="L'analyse n'a pas pu être lancée. Veuillez contacter le support en précisant les paramètres utilisés."
			return Response({"message":msg},status=status.HTTP_500_INTERNAL_SERVER_ERROR, content_type='json', headers={'Access-Control-Allow-Origin': '*'})
		if(request.data.get('periodic_task',False)):
			msg+=addPeriodicTask(request.data['periodic_task'],an)
		# except Exception as e:
		# 	print(str(e))
		# 	return Response({"message":"Une erreur s'est produite durant le lancement de l'analyse","exception":str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR, content_type='json', headers={'Access-Control-Allow-Origin': '*'})		
		print('Analysis {id} launched'.format(id=an.id))
		
		return Response({"message":msg},status=status.HTTP_201_CREATED, content_type='json', headers={'Access-Control-Allow-Origin': '*'})

# /api/dataset/(?P<data_id>\d+)
class getDatasetMetadata(APIView):
	def get(self, request, data_id):
		if not request.user.is_authenticated:
			return redirect('/login')
		try:
			dataview=Dataset.objects.get(Q(from_sensor__kubex__users=request.user)|Q(from_analyse__kubex__users=request.user),id=data_id)

		except Dataset.DoesNotExist:
			return Response({'Error':"Dataset doesn't exist."}, status=status.HTTP_400_BAD_REQUEST, content_type='json', headers={'Access-Control-Allow-Origin': '*'})
		print('View Graphics')

		try:
				data=dataview.data.read().decode('utf8') # data is string with '\', need to transfer to dictionary or json format
				meta=json.loads(data)
		except Exception as e:
			return Response({'Error':"Error occured while opening data file.","exception":str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR, content_type='json', headers={'Access-Control-Allow-Origin': '*'})
		return Response({'metadata': meta['metadata'],'title':dataview.title, 'id': dataview.id}, status=status.HTTP_200_OK, content_type='json', headers={'Access-Control-Allow-Origin': '*'})

# /api/dataset/add
class addDataset(APIView):
	def post(self,request):
		if not request.user.is_authenticated:
			return redirect('/login')

		# request.data.setlist('keywords',request.data['keywords-input'].split(','))
		# ds=DatasetSerializer(data=request.data)
		# print "Serializer : ",ds
		# print "Initial data :",ds.initial_data
		# print "Valid ? ",ds.is_valid()
		# if ds.is_valid():
		# 	print "Serialized data : ",ds.validated_data
		# 	ds.save()
		# print ds.data
		# file="kubex_data/"+str(request.data['kubex'])+"/"+str(ds.data['id'])
		# with open(ds.data['data'], 'wb+') as destination:
		# 	for chunk in request.data['data'].chunks():
		# 		destination.write(chunk)
		# print ds.data
		# check if data is valid (add checks in html/js too)

		sens=Sensor.objects.get(kubex=request.data['kubex'],SID=request.data['sensor'])
		d=Dataset.objects.create(from_sensor=sens,description=request.data['description'],title=request.data['title'],data_format=request.data['data_format'])

		# possible to replace by d=Dataset.objects.create(request.data) ssi request.data contains ONLY dataset key/values, and kubex.id is kubex_id
		d.data=os.path.join("datasets",request.data['kubex'],str(d.id))
		file=os.path.join("kubex_data",d.data)
		print(file)
		with open(file, 'wb+') as destination:
			for chunk in request.data['data'].chunks():
				destination.write(chunk)

		# add maaaany checks to this asap !
		keywords = request.data['keywords-input'].split(',')
		for k in keywords:
			try :
				kw=Keyword.objects.get(word=k)
			except Keyword.DoesNotExist:
				kw=Keyword.objects.create(word=k)
			d.keywords.add(kw)
		d.save()
		msg='Le jeu de données "{}" a été ajouté'.format(d.title)
		a=Alert.objects.create(status='V',title=msg,origin=d)
		for u in kube.users.all():
			a.owners.add(u)
		print('Added Dataset')

		return redirect('/datasets')

# /api/dataset/column

# IN : "datasets":[id1,id2...] , "columns":{"X":[{"dataset":d1,"column":c1},{"dataset":d2,"column":c2},...],"Y":[{"dataset":d1,"column":c1},{"dataset":d2,"column":c2}}...
# OUT : { "columns" : { nom du champ X : [ {"dataset":id, "column":name, "values":[ valeurs ]}, {...}, ...] 

class getDatasetColumns(APIView):
	def post(self,request):
		if not request.user.is_authenticated:
			return redirect('/login')
		resp=self.getAllColumns(request.data['datasets'],request.data['columns'],request.user.id)
		if(not resp):
			return Response({'Error':"Error occured while opening data file."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR, content_type='json', headers={'Access-Control-Allow-Origin': '*'})
		return Response(resp, status=status.HTTP_200_OK, content_type='json', headers={'Access-Control-Allow-Origin': '*'})

	def getAllColumns(self,datasets,columns,user_id):
		data = dict();
		for data_id in set(datasets):
			tmp=Dataset.objects.get(Q(from_sensor__kubex__users=user_id)|Q(from_analyse__kubex__users=user_id),id=data_id)
			try:
				jsondata=tmp.data.read().decode('utf8')
				dataset = json.loads(jsondata)
			except Exception as e:
				return False

			data[data_id]=dataset['data']
		for var in columns:
			for i,col in enumerate(columns[var]):
				#col_id=data['metadata']['columns'][col["column"]]
				col_id=int(col['column_index'])
				values=data[col['dataset']][col_id]
				columns[var][i]['values']=values
		return columns

# /api/dataset/edit
class editDataset(APIView):
	def post(self,request):
		if not request.user.is_authenticated:
			return redirect('/login')
		print(request)
		try:		
			dataview=Dataset.objects.get(Q(from_sensor__kubex__users=request.user.id)|Q(from_analyse__kubex__users=request.user.id),id=request.data['dataset_id'])
		except Dataset.DoesNotExist:
			print("No dataset {id} for user {u}".format(id=request.data['dataset_id']),request.user.name)
			raise Http404
		try:
			dataview.title=request.data['title']
			dataview.description=request.data['description']
			news=request.data['keywords'].split(",")
			olds=dataview.keywords.all()
			for old in olds:
				if(old not in news):
					dataview.keywords.remove(old)
			for new in news:
				if(new not in olds):
					try :
						kw=Keyword.objects.get(word=new)
					except Keyword.DoesNotExist:
						kw=Keyword.objects.create(word=new)
					dataview.keywords.add(kw)
			dataview.save()
		except Exception as e:
			print("Couldn't update dataset {id} : {ex}".format(id=request.data['dataset_id'],ex=str(e)))
			return Response({'msg':"Couldn't updatedataset"},status=status.HTTP_500_INTERNAL_SERVER_ERROR, content_type='json', headers={'Access-Control-Allow-Origin': '*'})
		msg='Updated dataset {id}'.format(id=request.data['dataset_id'])
		print(msg)
		return Response({'msg':msg},status=status.HTTP_200_OK, content_type='json', headers={'Access-Control-Allow-Origin': '*'})

# /api/dataset/delete
class deleteDataset(APIView):
	def delete(self, request, data_id):
		if not request.user.is_authenticated:
			return redirect('/login')
		try:
			dataview=Dataset.objects.get(Q(from_sensor__kubex__admin=request.user.id)|Q(from_analyse__kubex__admin=request.user.id),id=data_id)
			dataview.keywords.clear()
			os.remove(dataview.data.path)
			dataview.delete()
		except Dataset.DoesNotExist:
			raise Http404
			# return Response(status=status.HTTP_400_BAD_REQUEST)
		print('Delete Dataset {id}'.format(id=data_id))
		return Response({'message': 'Delete Dataset {data_id}'}, status=status.HTTP_200_OK)

# /api/dataset/list?dataFormat=<T|V|I|A>
class getDatasetList(APIView):
	def get(self, request):
		if not request.user.is_authenticated:
			return redirect('/login')
		dataFormat = request.query_params.get('dataFormat', None)
		try:
			datasets = Dataset.objects.filter(Q(from_sensor__kubex__users=request.user.id)|Q(from_analyse__kubex__users=request.user.id))
			if dataFormat:
				datasets=datasets.filter(data_format=dataFormat)
		except Dataset.DoesNotExist:
			return Response({'Error':"Dataset doesn't exist."}, status=status.HTTP_400_BAD_REQUEST, content_type='json', headers={'Access-Control-Allow-Origin': '*'})
		res = [{'id': dataset.id, 'title': dataset.title} for dataset in datasets]
		return Response({'datasets': res}, status=status.HTTP_200_OK, content_type='json', headers={'Access-Control-Allow-Origin': '*'})    

# /api/dataset/search?content=<kw1,kw2...>&fields=<f1,f2...>
class searchDataset(APIView):
	def get(self,request):
		if not request.user.is_authenticated:
			return redirect('login')
		print("Dataset search")
		fields=request.query_params['filter'].split(',')
		regex=r""+request.query_params['content'].translate(str.maketrans({',':'|'}))
		query=Q()
		if('title' in fields):
			query=Q(title__iregex=regex)
		if('description' in fields):
			query.add(Q(description__iregex=regex),Q.OR)
		if('keywords' in fields):
			words=request.query_params['content'].split(',')
			query.add(Q(keywords__word__in=words), Q.OR)
		print(query)
		datasets=Dataset.objects.filter(query).values_list('id', flat=True)
		return Response({"datasets":datasets},status=status.HTTP_200_OK, content_type='json', headers={'Access-Control-Allow-Origin': '*'})

# /api/kubex/status
class getKubexConfig(APIView):
	def get(self,request):
		if not request.user.is_authenticated:
			return redirect('login')
		try:
			k=Kubex.objects.get(SN=request.query_params['kubex'])
		except Kubex.DoesNotExist:
			raise Http404
		if(request.user.id != k.owner.id and not request.user.is_superuser): # llow users or only k.admin ?
			return Response({msg:"Erreur : Seuls les administrateurs ont accès à cette fonctionnalité."},status=status.HTTP_403_FORBIDDEN,content_type='json', headers={'Access-Control-Allow-Origin': '*'})
		try:
			if(request.query_params.get('sensor',False)):
				sens=Sensor.objects.get(SID=request.query_params['sensor'],kubex=request.query_params['kubex'])
				conf=json.loads(sens.config.read().decode('utf-8'))
				print("Get Kubex {n} sensor {s} configuration".format(n=k.SN,s=sens.SID))
			else:
				conf=json.loads(k.config.read().decode('utf-8'))
				conf['sensors'] = dict()
				for s in k.sensors.all():
					conf["sensors"][s.SID]=s.title
				print("Get Kubex {n} configuration".format(n=k.SN))
		except Sensor.DoesNotExist:
			raise Http404
		except Exception as e:
			print("Kubex status failed with exception : {ex}".format(ex=str(e)))
			return Response({"msg":"Une erreur est survenue durant la récupération de la configuration"},status=status.HTTP_500_INTERNAL_SERVER_ERROR,content_type='json', headers={'Access-Control-Allow-Origin': '*'})
		#print(k.config.read().decode('utf-8'))
		#conf={'IP':k.IP,'SN':k.SN,'name':k.name,'config':json.loads(k.config.read().decode('utf-8')),'sensors':sensors}
		return Response(conf,status=status.HTTP_200_OK,content_type='json', headers={'Access-Control-Allow-Origin': '*'})

# extension of kubex config
def addAutomatedTask(kubex,tasks):
	for a in tasks:
		kubex.config.automated_tasks+=a
	return

# extension of kubex config
def updateConfig(target,new):
	try:
		config=json.loads(target.config.read().decode('utf-8'))
		name=str(target.config)
		config.update(new)
		target.config.delete()
		target.config.save(name, ContentFile(json.dumps(config)))
	except Exception as e:
		print("Error occured during config file update")
		raise e
	return

# /api/kubex/config
class setKubexConfig(APIView):
	def post(self,request):
		if not request.user.is_authenticated:
			return redirect('login')
		try:
			k=Kubex.objects.get(SN=request.data['kubex'])
		except Kubex.DoesNotExist:
			raise Http404
		if(request.user.id != k.owner.id and not request.user.is_superuser): # allow users or only k.admin ?
			return Response({"msg":"Erreur, vous devez être administrateur pour modifier cette valeur"},status=status.HTTP_403_FORBIDDEN,content_type='json', headers={'Access-Control-Allow-Origin': '*'})
		
		try:
			if(request.data.get('sensor',False)):
				s=Sensor.objects.get(SID=request.data['sensor'],kubex=request.data['kubex'])
				print("Editing Kubex {n} Sensor {i} configuration".format(n=k.SN,i=s.SID))
				updateConfig(s,request.data['config'])
				if(request.data.get('auto_tasks',False)):
					addAutomatedTask(k,request.data['auto_tasks'])
			else:
				print("Editing Kubex {n} configuration".format(n=k.SN))
				updateConfig(k,request.data['config'])
		except Sensor.DoesNotExist:
			raise Http404
		except Exception as e:
			print("Kubex status failed with exception : {ex}".format(ex=str(e)))
			return Response({"msg":"Une erreur est survenue durant la récupération de la configuration"},status=status.HTTP_500_INTERNAL_SERVER_ERROR,content_type='json', headers={'Access-Control-Allow-Origin': '*'})
		return Response({"msg":"La configuration du Kube a été mise à jour !"},status=status.HTTP_200_OK,content_type='json', headers={'Access-Control-Allow-Origin': '*'})

# /api/message/add
class addMessage(APIView):
	def post(self,request):
		if not request.user.is_authenticated:
			return redirect('login')
		m=Message.objects.create(sender=request.user,recipient=request.data['recipient'],title=request.data['object'],description=request.data['message'])
		print("{s} sent message {t} to {r}".format(s=m.sender,t=m.title,r=m.recipient))
		return redirect('/inbox')


# /api/support/add
class addTicket(APIView):
	def post(self,request):
		if not request.user.is_authenticated:
			return redirect('login')
		t=Ticket.objects.create(owner=request.user,title=request.data['title'],description=request.data['description'])
		keywords = request.data['keywords-input'].split(',')
		for k in keywords:
			try :
				kw=Keyword.objects.get(word=k)
			except Keyword.DoesNotExist:
				kw=Keyword.objects.create(word=k)
			t.keywords.add(kw)
		msg='Le ticket "{}" a été ouvert'.format(t.title)
		a=Alert.objects.create(status='V',title=msg,origin=t)
		a.owners.add(request.user)
		for adm in User.objects.filter(is_superuser=True):
			a.owners.add(adm)

		print('Created ticket')

		return redirect('/datasets')
		return Response(status=status.HTTP_201_CREATED)

# /api/support/assign
class assignTicket(APIView):
	def post(self,request):
		if not request.user.is_authenticated:
			return redirect('login')
		try:
			adm=KubexUser.objects.get(id=request.data['assignee'],is_superuser=True)
			t=Ticket.object.get(owner=request.data['ticket_owner'],id=request.data['ticket_id'])
			t.update(in_charge=adm,status='A')	
		except Ticket.DoesNotExist:
			raise Http404
		msg='Le ticket "{title}" a été assigné à {user}'.format(title=t.title,user=adm.name)
		a=Alert.objects.create(status="I",title=msg,origin=t)

		return redirect('/support')
