#!/usr/bin/env python
import os
import sys
import collections

from nginx import logParser

class Words(logParser):
  ''' Extract word from query '''

  def __init__(self,argv):
    super(Words, self).__init__(argv)
    self.taskType=argv[2]

  def sortedToCSV(self):
    ''' ?? '''
    file = os.path.join(self.log_dir_media,'_myordbok.word-sortByCount.csv')
    self.eraseContents(file)

    with open(file, 'a', encoding='utf-8') as fs:
      file = self.csv_writer(fs)
      for word in sorted(self.CSVDictionary.items(), key=lambda x: x[1], reverse=True):
        file.writerow(word)
    return 'sorted word: {}'.format(len(self.CSVDictionary))

  def sortedToJSON(self):
    ''' ?? '''
    self.readDictionary()
    file = os.path.join(self.log_dir_media,'_myordbok.word-sortByCount.json')
    self.eraseContents(file)

    with open(file, 'w', encoding='utf-8') as fs:
      # jsonDATA = sorted(self.CSVDictionary.items(), key=lambda x: x[1], reverse=True)
      # fs.write(json.dumps(jsonDATA,indent=2))
      data = []
      for word in sorted(self.CSVDictionary.items(), key=lambda x: x[1], reverse=True):
        # data.append(dict({'v':word,'i':wordCount}))
        if word[0].isascii():
          data.append(word[0])
      fs.write(self.json_stringify(data,indent=0))

    return 'JSON sorted word, without utf8 string: {}'.format(len(data))

  def scan(self):
    self.readNote()
    for file in self.readDirectory():
      print(file)
      # task.readLog(file,task.appendWord)
      self.readLog(file,getattr(self, '{}_Filter'.format(self.taskType)))
    # task.writeDictionary()


    self.NOTEFormat['item']=len(self.CSVDictionary)
    self.NOTEFormat['count']=sum(self.CSVDictionary.values())

    if self.NOTEFormat['item'] > 0:
      self.readDictionary()
      self.NOTEFormat['total'] = len(self.CSVDictionary)
      self.NOTEFormat['sum'] = sum(self.CSVDictionary.values())
      self.writeNote()
      print('write Note')
      self.writeDictionary(getattr(self, '{}_Order'.format(self.taskType)))
      print('write Dictionary')

    # print(len(task.CSVDictionary),sum(task.CSVDictionary.values()))

    return str(self.NOTEFormat)

  def testing(self):
    return 'testing...'

if __name__ == '__main__':
  '''
  Extract word from query
  usage: python log.py myordbok
  '''

  """
  param = sys.argv
  task = Words(param)
  task.readDictionary()
  message ='...please check the 2nd arguments'

  if len(param) > 2:
    # message = task.sortedToCSV()
    # message = task.sortedToJSON()
    # python log.py myordbok sortedToCSV
    # python log.py myordbok sortedToJSON

    if param[2] in Words.__dict__:
      message = getattr(task, param[2])()
  else:
    for file in task.readDirectory():
      print(file)
      task.readLog(file,task.appendWord)
    task.writeDictionary()
    message = 'words: {}'.format(len(task.CSVDictionary))

  print(message)
  """
  param = sys.argv
  message ='...please check the 2nd arguments'
  if len(param) > 2:
    task = Words(param)
    # task.taskType=param[2]
    # task.readNote()
    # task.readDictionary()

    message ='...please check the 3rd arguments'
    if len(param) > 3:
      if param[3] in Words.__dict__:
        message = getattr(task, param[3])()
        task.readDictionary()

  print(message)


# 1577105824,14,90
# 1580485361

# visitFilter, wordFilter
# ini_dict = [{'a':5, 'b':10, 'c':90},
#             {'a':45, 'b':78},
#             {'a':90, 'c':10}]

# # printing initial dictionary
# print ("initial dictionary", str(ini_dict))

# # sum the values with same keys
# counter = collections.Counter()
# for d in ini_dict:
#     counter.update(d)

# result = dict(counter)

# print(result)
# print("resultant dictionary : ", str(counter))

# a = dict()
# b = dict()

# a['a']=1
# a['b']=1
# b['a']=6
# b['b']=1

# ini_dict=[a,b]

# counter = collections.Counter()
# for d in ini_dict:
#     counter.update(d)

# result = dict(counter)

# total = sum(result.values())

# print(total,result)
