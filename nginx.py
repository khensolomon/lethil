#!/usr/bin/env python

import re
import gzip
import os
# import sys
import time
from urllib.parse import urlparse, parse_qs, parse_qsl
import csv, json

class logParser(object):
  ''' Read NGINX logs '''
  def __init__(self,argv):
    # taskType [word,visit] ,taskType='word'
    self.taskType=None
    self.argv = argv
    # self.taskType = taskType


    self.log_dir_nginx = "/var/log/nginx"
    self.log_dir_media = "/var/www/media/log"
    # self.log_dir_nginx = "/server/nginx/logs"
    # self.log_dir_media = "/storage/media/log"

    # self.ACCESSFile = "access.app.log"
    self.NOTEFile = "app.task.log"
    # datetime visits requests totalVisits totalRequests newVisit/newWord
    self.NOTEFormat = {'id':0,'item':0,'count':0,'total':0,'sum':0,'new':0}
    self.NOTEDatatime = 0

    self.CSVFile = "app.task.csv"
    self.CSVDictionary = dict()

    # ,taskType='word'
    # self.CSVFile = "app.{}.csv".format(taskType)
    self.CSVDelimiter = ','
    self.CSVQuoteChar='"'
    self.CSVQuoting=csv.QUOTE_MINIMAL
    # self.CSVQuoting=csv.QUOTE_NONNUMERIC
    self.CSVLineTerminator='\n'

  def LogFormat(self):
    ''' read standard NGINX log format '''
    return re.compile(r"""(?P<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}) - - \[(?P<datetime>\d{2}\/[a-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2} (\+|\-)\d{4})\] ((\"(GET|POST) )(?P<url>.+)(http\/[1-2]\.[0-9]")) (?P<statuscode>\d{3}) (?P<bytessent>\d+) (?P<refferer>-|"([^"]+)") (["](?P<useragent>[^"]+)["])""", re.IGNORECASE)
    # return re.compile(r"""(?P<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}) - - \[(?P<datetime>\d{2}\/[a-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2} (\+|\-)\d{4})\] ((\"(GET|POST) )(?P<url>.+)(http\/1\.1")) (?P<statuscode>\d{3}) (?P<bytessent>\d+) (["](?P<refferer>(\-)|(.+))["]) (["](?P<useragent>.+)["])""", re.IGNORECASE)

  def eraseContents(self,file):
    ''' erase Contents '''
    open(file, 'w').close()

  def readDirectory(self):
    ''' read Logs directory for .gz extension containing appId=self.argv[1] '''
    l=[]
    srcDir = os.path.join(self.log_dir_nginx)

    if not os.path.isdir(srcDir):
      return l
    if len(self.argv) > 1:
      appId = ".{}.".format(self.argv[1])
      for fs in os.listdir(srcDir):
        if fs.endswith(".gz") and appId in fs:
          # DT = os.path.getmtime(os.path.join(self.log_dir_nginx,fs))
          DT = os.stat(os.path.join(self.log_dir_nginx,fs))[-1]
          if DT > self.NOTEDatatime:
            # print(DT,self.NOTEDatatime,datetime.now().timestamp())
            # print(fs,DT,self.NOTEDatatime,int(time.time()))
            l.append(fs)
    return l

  def readDictionary(self):
    ''' read word/visit from CSV and create dictionary '''
    if self.taskType:
      self.CSVFile = self.CSVFile.replace('task',self.taskType)

    if len(self.argv) > 1:
      self.CSVFile = self.CSVFile.replace('app',self.argv[1])

    self.CSVFile = os.path.join(self.log_dir_media,self.CSVFile)

    if not os.path.isfile(self.CSVFile):
      return self.CSVDictionary

    with open(self.CSVFile, 'r', encoding='utf-8') as fs:
      for word,wordCount in self.csv_reader(fs):
        # self.CSVDictionary[word]=int(wordCount)
        if word in self.CSVDictionary:
          self.CSVDictionary[word] += int(wordCount)
        else:
          self.CSVDictionary[word] = int(wordCount)

  def readNote(self):
    ''' read word/visit from Log and get modified datetime '''
    if self.taskType:
      self.NOTEFile = self.NOTEFile.replace('task',self.taskType)

    if len(self.argv) > 1:
      self.NOTEFile = self.NOTEFile.replace('app',self.argv[1])

    self.NOTEFile = os.path.join(self.log_dir_media,self.NOTEFile)

    if not os.path.isfile(self.NOTEFile):
      return self.NOTEDatatime

    with open(self.NOTEFile, 'r', encoding='utf-8') as fs:
      for datetimes in self.csv_reader(fs):
        # print(datetimes[0])
        self.NOTEDatatime=int(datetimes[0])

    return self.NOTEDatatime

  def writeNote(self):
    with open(self.NOTEFile, 'w', encoding='utf-8') as fs:
      file = self.csv_writer(fs)
      # int(time.time())
      self.NOTEFormat['id']=int(time.time())
      file.writerow(self.NOTEFormat.values())
      # file.writerow([1577105824,'b',int(time.time())])

  def writeDictionary(self,orderBy):
    ''' erase Contents before, write CSV file with sorted '''
    self.eraseContents(self.CSVFile)

    with open(self.CSVFile, 'a', encoding='utf-8') as fs:
      file = self.csv_writer(fs)
      # for word in sorted(self.CSVDictionary.items()):
      for word in orderBy():
        file.writerow(word)

  def json_stringify(self,data,indent=0):
    ''' CSV reader with custom config '''
    return json.dumps(data,indent=indent)

  def csv_reader(self,fs):
    ''' CSV reader with custom config '''
    return csv.reader(fs, delimiter=self.CSVDelimiter, quotechar=self.CSVQuoteChar)

  def csv_writer(self,fs):
    ''' CSV writer with custom config '''
    return csv.writer(fs, delimiter=self.CSVDelimiter, quotechar=self.CSVQuoteChar, quoting=self.CSVQuoting, lineterminator=self.CSVLineTerminator)

  def openLog(self,file):
    ''' open file according to its extension '''
    if file.endswith(".gz"):
      return gzip.open(os.path.join(self.log_dir_nginx,file),'rt',encoding='utf-8')
    else:
      return open(os.path.join(self.log_dir_nginx,file),'r',encoding='utf-8')

  def readLog(self,fileName,callback):
    ''' read Logs file and parse '''
    # file = self.openLog(fileName)
    # for line in file.readlines():
    #   data = re.search(self.LogFormat(), line)
    #   if data:
    #     datadict = data.groupdict()
    #     # callable(datadict)
    #     # ip = datadict["ip"]
    #     # datetimestring = datadict["datetime"]
    #     # url = urlparse(datadict["url"])
    #     # bytessent = datadict["bytessent"]
    #     # referrer = datadict["refferer"]
    #     # useragent = datadict["useragent"]
    #     # status = datadict["statuscode"]
    #     # method = data.group(6)
    #     callback(datadict)
    # file.close()

    with self.openLog(fileName) as fs:
      for line in fs.readlines():
        data = re.search(self.LogFormat(), line)
        if data:
          datadict = data.groupdict()
          # callback(datadict)
          # callable(datadict)
          # ip = datadict["ip"]
          # datetimestring = datadict["datetime"]
          # url = urlparse(datadict["url"])
          # bytessent = datadict["bytessent"]
          # referrer = datadict["refferer"]
          # useragent = datadict["useragent"]
          # status = datadict["statuscode"]
          # method = data.group(6)
          key = callback(datadict)
          if key:
            if key in self.CSVDictionary:
              self.CSVDictionary[key] += 1
            else:
              self.CSVDictionary[key] = 1
              self.NOTEFormat['new'] += 1

  def word_Filter(self,datadict):
    url = urlparse(datadict["url"])
    query = url.query.strip()
    if url.path == "/definition" and query:
      queryWord = dict(parse_qsl(query))
      if 'q' in queryWord.keys():
        word = queryWord['q'].strip().lower()
        if word.replace(' ','').isalnum() and not word.isdigit():
          if word.isascii():
            return word

  def visit_Filter(self,datadict):
    return datadict["ip"].strip()

  def word_Order(self):
    return sorted(self.CSVDictionary.items())
  def visit_Order(self):
    return sorted(self.CSVDictionary.items(), key=lambda x: x[1], reverse=True)

if __name__ == '__main__':
  """ debug """
