# NGINX log

- [Getting started](Readme.md)
  
... app: myordbok, zaideih

## clean

```sh
>error.log
# ... or
truncate -s0 error.log
```

## view

```sh
# view live requests
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# list
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr

# list, remove extra spaces
awk '{print $1}' access.log | sort | uniq -c | sort -nr | sed 's/^\s*//'
# ... or just pipe
awk '{print $1}' access.log | sort | uniq -c | sort -nr | awk '{print $2, $1}'
```

## if need to reset primary log

- sum requests by ip and append to `*.ip.log`
- reset `access.*.log`
- sum request and merge ip of `*.ip.log` and copy to `tmp.log`
- delete `*.ip.log`
- rename `tmp.log` to `*.ip.log`

```sh
awk '{print $1}' access.app.log | sort | uniq -c | sort -nr | awk '{print $2, $1}' >> app.ip.log
&& truncate -s0 access.app.log
&& awk '{ seen[$1] += $2 } END { for (i in seen) print i, seen[i]  }' app.ip.log > tmp.log
&& rm app.ip.log
&& mv tmp.log app.ip.log
```

## test

... only for testing

```sh
# awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr > /var/www/html/log/ip.txt
# awk '{print $1}' access.log | sort | uniq -c | sort -nr | sed 's/^\s*//' >> testing.txt
# awk '{print $2}' testing.txt | sort -u -k1,2
# awk '{print $2}' testing.txt | sort -u -t, -r -k1,1
# awk '{ seen[$1] += $2 } END { for (i in seen) print i, seen[i] }' testing.txt

awk '{rows++; sum += $2} END{print timestamps, rows, sum} ' timestamps="$(date +%s)" app.ip.log


# awk '{print $1}' access.log | sort | uniq -c | sort -nr
awk '{ seen[$1] += $2 } END { for (i in seen) print i, seen[i]  }' app.ip.log > app.tmp.log
mv app.tmp.log > app.ip-count.log
awk '{ seen[$1] += $2 } END { for (i in seen) print i, seen[i]}' app.ip.log && user="Okey" && echo 'hello',$user



# ... temporary


sudo truncate -s0 /var/log/nginx/access.log

tail -f /var/log/nginx/access.zaideih.log
tail -f /var/log/nginx/access.myordbok.log

awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | awk '{print $2, $1}' > /var/www/media/log/myordbok.ip.log
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | awk '{print $2, $1}' > /var/www/media/log/zaideih.ip.log

awk '{rows++; sum += $2} END{print rows, sum} ' zaideih.ip.log
awk '{rows++; sum += $2} END{print rows, sum} ' myordbok.ip.log


chown -R www-data:adm /var/log/nginx/access.*.log


awk '{print $1}' access.log | sort | uniq -c | sort -nr | awk '{print $2, $1}' > app.ip.log


awk '{rows++; sum += $2} END{print timestamps, rows, sum} ' app.ip.log &&
awk '{print "a","b"}'


total= awk ' {rows++; sum += $2} END{print sum}' app.ip.log && echo 'expr $total - 444 'sed $total - '444'
# total= awk ' {rows++; sum += $2} END{print sum}' app.ip.log && final= awk '{$total - 444}' && echo $final
total= awk ' {rows++; sum += $2} END{print sum - 277}' app.ip.log && echo $total
total = awk ' {rows++; sum += $2} END{print sum}' app.ip.log && echo $sum
# user= awk '{rows++;} END{print rows}' && total= awk '{sum += $2} END{print sum}' app.ip.log && echo $user
fileIP = 'app.ip.log' && awk '{user++; total += $2} END {print user, total}' echo $fileIP > app.t1.log




awk '$11 ~ /http:\/\/www.google.com\/search?/ { print substr($11,26) ;}'

awk '{print $7}' access.myordbok/log.log
awk '$7 ~ /\/definition?/ { printf "%s\n",substr($7,3+index($7,"?")) ;}' access.myordbok/log.log
awk '$7 ~ /\/definition?/ { printf "%s\n",substr($7,14) ;}' access.myordbok/log.log
awk '$7 ~ /?/ { printf "%s\n",$7;}' access.myordbok/log.log


awk '{split($7,a,/[=&]/); print a[2]}' access.myordbok/log.log | sort | uniq -c | sort -rn


awk '/definition\?q=/{gsub(";.*","",$7);print $7}' access.myordbok/log.log

awk '$7 ~ /\/definition\?q=/ { printf "%s\n",substr($7,15) ;}' access.myordbok/log.log | sort | uniq -c | sort -rn
