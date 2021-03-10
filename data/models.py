# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models
from django.contrib.auth.models import User
# from datetime import timedelta
from django.contrib.postgres.fields import JSONField,ArrayField
from django.contrib.contenttypes.fields import GenericForeignKey,GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.core.files.storage import FileSystemStorage
import os

class KubexUser(User):
    
    def __init__(self,*args):
        super().__init__(*args)
        self.name=self.get_name()

    def get_name(self):
        name=""
        if(self.first_name or self.last_name):
            name=" ".join((self.first_name,self.last_name.upper()))
        if(not name):
            name=self.username
        return name

    class Meta:
        proxy=True
        ordering=['username']

class Kubex(models.Model):
    IP = models.GenericIPAddressField(unique=True,unpack_ipv4=True)
    SN = models.PositiveIntegerField(primary_key=True)
    name = models.CharField(max_length=40)
    users = models.ManyToManyField('KubexUser',related_name="kubex_used")
    owner = models.ForeignKey('KubexUser',related_name="kubex_owned",on_delete=models.PROTECT)
    config = models.FileField()

    class Meta:
        ordering=['name']

class Message(models.Model):
    MESSAGE_STATUS = (('N','Non lu'),('L','Lu'),('A','Archivé'))
    sender = models.ForeignKey('KubexUser',related_name="messages_from",on_delete=models.CASCADE)
    recipient = models.ForeignKey('KubexUser',related_name="messages_received",on_delete=models.CASCADE)
    title = models.CharField(max_length=100)
    time = models.DateTimeField(auto_now_add=True)
    description = models.TextField()
    status = models.CharField(max_length=1,choices=MESSAGE_STATUS,default='N')

    def __str__(self):
        return "%s\nFrom : %s\nTo : %s\nAt : %s\n\nMessage : %s" % (self.title,self.sender,self.recipient,self.time,self.description)

    def __repr__(self):
        return "%s\nFrom : %s\nTo : %s\nAt : %s\n\nMessage : %s" % (self.title,self.sender,self.recipient,self.time,self.description)

    class Meta:
        ordering=['-time']

class Ticket(models.Model):
    TICKET_STATUS = (('N','Nouveau'),('A','Assigné'),('R','Résolu'),('W','En attente'))
    owner = models.ForeignKey('KubexUser',related_name="tickets_opened",on_delete=models.CASCADE)
    in_charge = models.ForeignKey('KubexUser',limit_choices_to={'is_superuser': True},related_name="tickets_attributed",default=2,on_delete=models.SET(2))
    creation_time = models.DateTimeField(auto_now_add=True)
    modification_time = models.DateTimeField(auto_now=True)
    title = models.CharField(max_length=100)
    status = models.CharField(max_length=1,choices=TICKET_STATUS,default='N')
    description = models.TextField()
    keywords = models.ManyToManyField('Keyword') 

    class Meta:
        ordering=['-modification_time']

class Sensor(models.Model):
    kubex = models.ForeignKey('Kubex',related_name="sensors",on_delete=models.CASCADE)
    SID = models.PositiveIntegerField()
    title = models.CharField(max_length=100)
    config = models.FileField()
    data = GenericRelation('Dataset',related_query_name="from_sensor")

class Dataset(models.Model):
    FORMATS = (('T','Table'),('I','Image'),('A','Audio'),('V','Vidéo'))
    #kubex = models.ForeignKey('Kubex',related_name="datasets_generated",on_delete=models.CASCADE)
    #sensor = models.ForeignKey('Sensor',related_name="datasets_generated",on_delete=models.CASCADE)
    description = models.TextField(max_length=400)
    title = models.CharField(max_length=100)
    data_format = models.CharField(max_length=1,choices=FORMATS,default='T')
    creation_time = models.DateTimeField(auto_now_add=True)
    modification_time = models.DateTimeField(auto_now=True)
    keywords = models.ManyToManyField('Keyword')
    data = models.FileField()
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE,related_name="datasets_generated",limit_choices_to=('analyse','sensor'))
    object_id = models.PositiveIntegerField()
    origin = GenericForeignKey('content_type','object_id')  # configure to improve flexibility, linking a task to several kinds of models (dataset, etc)   

    class Meta:
        ordering=['-creation_time']

    def __init__(self,*args,**kwargs):
        super(Dataset,self).__init__(*args,**kwargs)
        try:
            self.timestamp=self.creation_time
        except NameError:
            print("Warning : unsaved object don't have timestamps yet")

    def init_timestamp(self): # for immediate timestamp use on newly created objects
        self.timestamp=self.creation_time

class Alert(models.Model):
    # owner = models.ForeignKey('auth.User',related_name="alerts_received",on_delete=models.CASCADE)
    # task = models.ForeignKey('task',related_name="task_notifications",on_delete=models.CASCADE)
    owners = models.ManyToManyField('KubexUser')
    ALERT_STATUS = (('I','Indication'),('E','Erreur'),('V','Validation'),('A','Avertissement'))
    status = models.CharField(max_length=1,choices=ALERT_STATUS,default='I')
    time = models.DateTimeField(auto_now_add=True)
    title = models.CharField(max_length=400)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE,related_name="alerts",limit_choices_to=('dataset','ticket','analyse')) #'message' 'kubex'
    object_id = models.PositiveIntegerField()
    origin = GenericForeignKey('content_type','object_id')  # configure to improve flexibility, linking a task to several kinds of models (dataset, etc)    

    def get_type_style(self):
        type_style={'dataset':'plus','ticket':'support','analyse':'gear'} #'message':'message','kubex':'cube'
        return type_style.get(self.content_type.model,'exclamation')

    def get_status_style(self):
        status_style={'I':'info','V':'success','E':'danger','A':'warning'}
        return status_style.get(self.status,'danger')

    class Meta:
        ordering=['-time']

# class Task(models.Model):
#     owner = models.ForeignKey('KubexUser',related_name='automated_tasks',on_delete=models.CASCADE)
#     kubex = models.ForeignKey('Kubex',related_name='automated_tasks',on_delete=models.CASCADE)
#     # sensors = ArrayField(models.PositiveIntegerField())
#     frequency = models.DurationField()
#     creation_time = models.DateTimeField(auto_now_add=True)
#     modification_time = models.DateTimeField(auto_now=True)
#     #algorithm = models.ForeignKey('Algorithm',related_name='in_tasks',on_delete=models.CASCADE)
#     analyses_executed = models.ManyToManyField('Analyse')
#     model_analyse=models.ForeignKey('Analyse',related_name='in_tasks',on_delete=models.CASCADE)

class Analyse(models.Model):
    AN_STATUS = (('R','en cours'),('S','arrêtée'),('E','en erreur'),('T','terminée'))
    status = models.CharField(max_length=1,choices=AN_STATUS,default='E')
    owner = models.ForeignKey('KubexUser',related_name="analyses_launched",on_delete=models.PROTECT)
    kubex = models.ForeignKey('Kubex',related_name="analyses_performed", on_delete=models.CASCADE)
    datasets = models.ManyToManyField('Dataset',related_name="analyses_performed")
    creation_time = models.DateTimeField(auto_now_add=True)
    modification_time = models.DateTimeField(auto_now=True)
    title = models.CharField(max_length=100)
    description = models.TextField()
    algorithm = models.ForeignKey('Algorithm',related_name='used_in',on_delete=models.PROTECT)
    progress = models.DecimalField(max_digits=5, decimal_places=2,default=0)
    inputs = JSONField()
    parameters = JSONField()
    command = models.CharField(max_length=1000) # think of a better way to track analyses history (parameters + data in analyses/<id> folders ?)
    results = GenericRelation('Dataset',related_query_name="from_analyse")

    @classmethod
    def replicate(cls,model):
        model_d=model.__dict__
        keys=[owner,kubex,title,inputs,description,algorithm,progress,parameters,command]
        d = {k: model_d[k] for k in keys}
        return cls()

    def get_status_style(self):
        status_style={'R':'info','T':'success','E':'danger','S':'warning'}
        return status_style.get(self.status,'danger')

    def get_status_panel(self):
        status_panel={'R':'primary','T':'green','E':'red','S':'yellow'}
        return status_panel.get(self.status,'primary')

    class Meta:
        ordering=['-modification_time']

class Algorithm(models.Model):
    TYPE = (('R','Régression'),('C','Classification'),('S','Statistiques'),('A','Apprentissage'),('F','Analyse factorielle'),('I',"Traitement d'image"))
    FORMATS = (('T','Table'),('I','Image'),('A','Audio'),('V','Vidéo'))
    algo_type = models.CharField(max_length=1,choices=TYPE)
    data_format = models.CharField(max_length=1,choices=FORMATS,default='T')
    title = models.CharField(max_length=100)
    inputs = JSONField()
    parameters = JSONField()
    description = models.TextField(max_length=400)
    command = models.CharField(max_length=100)
    progression_regex = models.CharField(max_length=100,null=True)
    output = JSONField()

    class Meta:
        ordering=['title']

class Keyword(models.Model):
    word = models.CharField(max_length=20,unique=True)

    class Meta:
        ordering=['word']
