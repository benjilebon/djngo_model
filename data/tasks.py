# Create your tasks here
from __future__ import absolute_import, unicode_literals
from celery import Celery,shared_task,task
import subprocess
from data.models import *
from django.db.models import F
import re
import json
import pandas
import os
from copy import deepcopy
import base64
from datetime import *

# from spark_celery import *
# from pyspark import SparkContext, SparkConf
# from rest_framework.settings import api_settings

#############################################################
#                    	UTILS FUNCTIONS						#
#############################################################


class cd:
	"""Context manager for changing the current working directory"""
	def __init__(self, newPath):
		self.newPath = os.path.expanduser(newPath)

	def __enter__(self):
		self.savedPath = os.getcwd()
		os.chdir(self.newPath)

	def __exit__(self, etype, value, traceback):
		os.chdir(self.savedPath)

def load_values(datasets,inputs,user):
		dataset=dict();
		res=deepcopy(inputs)
		for d in datasets.all():
			tmp=Dataset.objects.get(from_sensor__kubex__users=user,id=d.id)
			jsondata = tmp.data.read() # data is string with '\', need to transfer to dictionary or json format
			data=json.loads(jsondata.decode('utf-8'))
			dataset[d.id]=data['data']		
		
		for f in res:
			for i,col in enumerate(res[f]['fields']):
				for j,val in enumerate(col['values']):
					values=dataset[int(val['dataset'])][int(val['column_index'])]
					res[f]['fields'][i]['values'][j]=values # load values in object
		return res

def write_input_csv(fields,data_format):
	data_format["delimiter"]=","
	return write_input_table(fields,data_format)

def write_input_tsv(fields,data_format):
	data_format["delimiter"]="\t"
	return write_input_table(fields,data_format)

def write_input_table(fields,data_format):
	sep=str(data_format["delimiter"])
	with open(data_format["fileName"],"w") as f:
		if(data_format["order"]=="rows"):
			for vi in fields:
				for vj in vi["values"]:
					if(data_format["header"]):
						f.write(vi["fieldName"])
						if(len(vi["values"])>1):
							f.write("."+str(vj))
						f.write(sep)
					f.write(sep.join(str(val) for val in vj))
					f.write("\n")
		elif(data_format["order"]=="columns"):
			if(data_format["header"]):
				head=list()
				for vi in fields:
					if(len(vi["values"])==1):
						head+=[vi["fieldName"]]
					else:
						for j,vj in enumerate(vi["values"]):
							head+=[vi["fieldName"]+"."+str(j)]
				f.write(sep.join(head)) 
				f.write("\n")
			vals=list()
			for vi in fields:
				vals+=vi["values"]
			data=zip(*[v for v in vals])
			for d in data:
				f.write(sep.join(str(n) for n in d))
				f.write("\n")
		else:
			print("Write_table : Format inconnu %s" %data_format["order"])
			return False
	return True

def write_input_default(fields,data_format):
	print("The file format {} can't be created".format(data_format["type"]))
	return False

def format_inputs(inputs):
	in_files=[]
	write_funcs={"T":write_input_table,"table":write_input_table,"tsv":write_input_tsv,"csv":write_input_csv}
	
	for i in sorted(inputs): #files
		try:
			func=write_funcs.get(inputs[i]["fileFormat"]["type"],write_input_default)
			if(not func(inputs[i]["fields"],inputs[i]["fileFormat"])):
				print("Writing error")
				return  False
		except Exception as e:
			print("Exception occured",e)
			return False
		if('prefix' in inputs[i]):
			in_files+=[inputs[i]["prefix"]]+[inputs[i]["fileFormat"]["fileName"]]
		else:
			in_files+=[inputs[i]["fileFormat"]["fileName"]]
	return in_files

def format_parameters(par):
	parameters=[]
	for p in sorted(par):
		if('prefix' in par[p]):
			parameters+=[par[p]['prefix']]+[str(par[p]['value'])]
		else:
			parameters+=[par[p]['value']]
	return parameters

def load_table(filename,metadata,analyse,delimiter=","):
	data=pandas.read_csv(filename,sep=metadata["delimiter"],names=metadata["header"],index_col=metadata["index"]) 
	if(metadata["by_col"]):
		data=data.transpose()
	for i,h in enumerate(data.index): # writes titles from index
		metadata["fields"][i]["title"]=h
	data=data.to_json(orient='values')
	return data

def load_image(filename,metadata,analyse,extension="jpg"):
	with open(filename,'rb') as f:
		img=base64.encodebytes(f.read())
	img=img.decode('ascii').replace("\n","")
	now=int(datetime.now().timestamp())
	return [[now],[img]]

def load_default(filename,metadata,analyse):
	print("The file format {form} can't be created, skipping file {f}".format(form=metadata[data_type],f=file))
	return None

def write_output(filename,metadata,analyse):
	load_functions={'T':load_table,'I':load_image}
	# ,'csv':('load_table',{'delimiter':','}),'tsv':('load_table',{'delimiter':'\t'}),
	# ,'png':('load_image',{'extension':'png'}),'jpg':('load_image',{'extension':'jpg'}),'bmp':('load_image',{'extension':'bmp'})}
	datafile={"metadata":{"kubex_SN":analyse.kubex.SN,"kubex_IP":"127.0.0.1","sensor_id":0,"sensor_IP":"127.0.0.1","title": analyse.title, "data_format":metadata["data_format"],"fields": metadata["fields"], "analyse":"analyse_"+str(analyse.id)}}
	func=load_functions.get(metadata["data_format"],'load_default')
	datafile["data"]=func(filename,metadata,analyse)
	if(not datafile["data"]):
		print("No data loaded")
		return []
	d=Dataset.objects.create(origin=analyse,description=analyse.description, title=analyse.title, data_format=metadata["data_format"])
	analyse.datasets.add(d)
	print("Dataset {d} created !".format(d=d.id))
	new_file=os.path.join("datasets",str(analyse.kubex.SN),str(d.id))
	with open(os.path.join("kubex_data",new_file),"w") as output:
		json.dump(datafile,output)
	print("File {f} written".format(f=new_file))
	d.data=new_file
	d.save()
	for w in metadata["keywords"]:
		try :
			kw=Keyword.objects.get(word=w)
		except Keyword.DoesNotExist:
			kw=Keyword.objects.create(word=w)
		d.keywords.add(kw)
	return [str(d.id)]

#############################################################
#						CELERY TASKS						#
#############################################################

@shared_task
def launchAnalysis(an_id):
	# command=command.split(" ")+in_files+parameters,analyse=an,progression=an.algorithm.progression_regex,user=u,directory=an_dir
	_SCRIPTS_FOLDER="/home/audensiel/Kubex_git/DME/scripts/"
	analyse=Analyse.objects.get(id=an_id)
	try:
		val=load_values(analyse.datasets,analyse.inputs,analyse.owner)
		# for d in datasets:
		# 	dat=Dataset.objects.get(id=d,from_sensor__kubex__users=analyse.owner)
		# 	analyse.datasets.add(d)
	except Dataset.DoesNotExist as dne:
		msg="""L'analyse "{an}" n'a pas pu récupérer les données : {ex}""".format(an=analyse.title,ex=str(dne))
		print(msg,analyse.id)
		al=Alert.objects.create(status='E',title=msg,origin=analyse)
		al.owners.add(analyse.owner)
		return 403
	# launch request
	directory=os.path.abspath("analyses/"+str(analyse.id))
	os.mkdir(directory)
	try:
		with cd(directory):
			in_files=format_inputs(val)
			if(not in_files): 
				return 500
			parameters=format_parameters(analyse.parameters)
			command=[_SCRIPTS_FOLDER+analyse.algorithm.command]+in_files+parameters
			analyse.command=" ".join(command)
			analyse.save()
			print("Analyse directory : {dir}".format(dir=directory))
			print("Command line : {}".format(subprocess.list2cmdline(command)))
			# Exceptions handled by API level
			out=open(str(analyse.id)+".out","w")
			err=open(str(analyse.id)+".err","w")
			# analyse.command=" ".join(command)
			# spark_cmd="spark-submit --master spark://localhost:7077"
			proc=subprocess.Popen(command,stdin=None, stdout=subprocess.PIPE, stderr=err)
			# print(proc)
			# app=SparkCeleryApp(broker=api_settings.CELERY_BROKER_URL,backend='rpc://')
			# sconf=SparkConf()
			# SparkContext( master = None, appName = None, sparkHome = None, pyFiles = None, environment = None, batchSize = 0,
			# serializer = PickleSerializer(), conf = None, gateway = None, jsc = None, profiler_cls = <class 'pyspark.profiler.BasicProfiler'>)
			# scont=SparkContext(master = "spark://localhost:7077", appName = name, conf = sconf)
			
			code=proc.poll() # first check to confirm correct launching
			if(code):
				analyse.status='E'
				analyse.save()
				msg="""Une erreur s'est produite lors du lancement de l'analyse "{an}" (code d'erreur {cd})""".format(an=analyse.title,cd=str(code))
				print(msg,analyse.id)
				al=Alert.objects.create(status='V',title=msg,origin=an)
				al.owners.add(analyse.owner)
				return code
			else:
				analyse.status='R'
				analyse.save()
				msg="""L'analyse "{}" a été lancée""".format(analyse.title)
				print(msg,analyse.id)
				al=Alert.objects.create(status='V',title=msg,origin=analyse)
				al.owners.add(analyse.owner)
			if(analyse.algorithm.progression_regex): 
				# print("Loading progression...")
				regex=re.compile(analyse.algorithm.progression_regex)
				for l in proc.stdout:
					line=l.decode('utf-8')
					m=re.match(regex,line)
					if(m):
						p=m.groupdict()
						# print(p)
						prog=float(p.get("current",0))/float(p.get("max",100)) # default progression 0 %
						analyse.progress=prog*100
						analyse.save()
					out.write(line)	
			out.close()
			err.close()

		code=proc.wait()
		if(code==0): # success !
			res=analyse.algorithm.output
			# print(res) # TODO parse & write outputs
			dat=[]
			for file in res: # {"output.dat": {"title": "Résultat d'analyse", "fields": [{"unit": "NA", "title": "Analyse", "data_type": "float", "data_nature": "analyse"}], "data_format": "T"}}
				dat+=write_output(os.path.join(directory,file),res[file],analyse)
			analyse.status='T'
			analyse.progress=100
			analyse.save()
			msg="""L'analyse "{an}" est terminée, les données ont été insérées dans les datasets : {data}""".format(an=analyse.title,data=",".join(dat))
			print(msg,analyse.id)
			al=Alert.objects.create(status='V',title=msg,origin=analyse)
			al.owners.add(analyse.owner)
		else: # failure
			analyse.status='E'
			if(analyse.progress==0):
				analyse.progress=50
			analyse.save()
			msg="""L'analyse "{an}" s'est arrêtée avec le code {cd}""".format(an=analyse.title,cd=str(code))
			print(msg,analyse.id)
			al=Alert.objects.create(status='E',title=msg,origin=analyse)
			al.owners.add(analyse.owner)

	except Exception as e:
		if(hasattr(e,'errno')):
			code=e.errno
		else:
			code=-1
		analyse.status='E'
		if(analyse.progress==0):
			analyse.progress=50
		analyse.save()
		msg="""L'analyse "{an}" s'est arrêtée avec l'exception {ex}""".format(an=analyse.title,ex=str(e))
		print(msg,analyse.id)
		al=Alert.objects.create(status='E',title=msg,origin=analyse)
		al.owners.add(analyse.owner)
		raise

	return code

def fetch_inputs(dataset,analyse):
	for i in analyse.inputs:
		for j,f in enumerate(analyse.inputs[i]['fields']):
			for k,v in enumerate(f['values']): # use full adress for and value for get
				tmp=v['dataset']
				analyse.inputs[i]['fields'][j]['values'][k]['dataset']=dataset
				analyse.inputs[i]['fields'][j]['values'][k]['column']=v['column'].replace(str(tmp),str(dataset))
	return

@task
def periodic_task(an_id,int_mn):
	analyse=Analyse.objects.get(id=an_id)
	interval=timedelta(minutes=int_mn)
	print('Periodic task "{title}" executing now'.format(title=analyse.title))
	now=datetime.now()
	data_new=Dataset.objects.filter(creation_time__gt=now-interval,from_sensor__in=[d.sensor for d in analyse.datasets]).values_list('id', flat=True)
	for d in data_new:
		a=Analyse.replicate(analyse=analyse)
		fetch_inputs(a,d)
		a.datasets.add(d)
		launchAnalysis.delay(an_id=a.id)
		# code code code

# @task
# def hour_check():
# 	print("Hourly task check executing now")
# 	now=datetime.now()
# 	tasks=Task.objects.filter(modification_time__lt=now-F('frequency'))
# 	#data_new=Dataset.objects.filter(creation_time__gt=now-timedelta(days=1)).values_list('id', flat=True)
# 	for t in tasks:
# 		data_new=Dataset.objects.filter(creation_time__gt=t.modification_time,sensor__in=t.sensors).values_list('id', flat=True)
# 		for d in data_new:
# 			a=Analyse.replicate(t.model_analyse)
# 			fetch_inputs(d,a)
# 			launchAnalysis.delay(analyse=a,datasets=d)
# 		# code code code
		
