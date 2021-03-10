FROM python:3.8.6-buster
ENV PYTHONUNBUFFERED=1
RUN mkdir /kubex_gui
WORKDIR /kubex_gui
COPY requirements.txt /kubex_gui
RUN pip install -r requirements.txt
COPY . /kubex_gui/
