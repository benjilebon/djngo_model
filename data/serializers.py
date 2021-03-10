from rest_framework import serializers
from django.core.exceptions import *
from .models import *


class KubexSerializer(serializers.ModelSerializer):
	class Meta:
		model=Kubex
		fields = ('SN','name','IP','users')

class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ('time','owner','title')

class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ('sender', 'recipient', 'title', 'message','time')

class AnalyseSerializer(serializers.ModelSerializer):
     class Meta:
        model = Analyse
        fields = '__all__'

class TicketSerializer(serializers.ModelSerializer):
     class Meta:
        model = Ticket
        fields = ('owner','in_charge','title','status','time')

class KeywordSerializer(serializers.ModelSerializer):
    class Meta:
        model = Keyword
        fields = ('word')


class CreatableSlugRelatedField(serializers.SlugRelatedField):

    def to_internal_value(self, data):
        try:
            return self.get_queryset().get_or_create(**{self.slug_field: data})[0]
        except ObjectDoesNotExist:
            self.fail('does_not_exist', slug_name=self.slug_field, value=smart_text(data))
        except (TypeError, ValueError):
            self.fail('invalid')

class DatasetSerializer(serializers.ModelSerializer):
    keywords=CreatableSlugRelatedField(many=True,slug_field='word',queryset=Keyword.objects.all())

    class Meta:
        model = Dataset
        fields = '__all__'
        # fields = ('kubex','description','title','data','data_format','keywords')
