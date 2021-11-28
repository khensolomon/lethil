# NGINX log

- [Getting started](Readme.md)
  
... app: myordbok, zaideih

## clean

```sh
#!/usr/bin/env sh
chmod +x ~/update-visits.sh
# chmod +x update-visits.sh

# Usage: sh ~/update-visits.sh zaideih 6,12
# Usage: sh ~/update-visits.sh myordbok 6,12

ID="app";
ACCESS="access.$ID.log";
IP="$ID.ip.log";
VISITS="$ID.visits.log";
T1="tmp-one.log";
T2="tmp-two.log";

LOGNGINX="/var/log/nginx";
if [ ! -z "$LOGNGINX" ]
  then
    ACCESS="$LOGNGINX/$ACCESS"
fi

LOGMEDIA="/var/www/media/log";
if [ ! -z "$LOGMEDIA" ]
  then
    IP="$LOGMEDIA/$IP"
    VISITS="$LOGMEDIA/$VISITS"
    T1="$LOGMEDIA/$T1"
    T2="$LOGMEDIA/$T2"
fi

# Check first argument as ID
if [ -z "$1" ]
  then
    echo "ID(myordbok/zaideih) requested"; exit 1;
  else
    # ACCESS=${ACCESS/$ID/$1}
    # IP=${IP/$ID/$1}
    # VISITS=${VISITS/$ID/$1}
    ACCESS=$(echo $ACCESS | sed -e "s/$ID/$1/g")
    IP=$(echo $IP | sed -e "s/$ID/$1/g")
    VISITS=$(echo $VISITS | sed -e "s/$ID/$1/g")
fi

# Check second argument exit
if [ ! -z "$2" ]
  then
    ACCESS="$ACCESS.$2.gz"
fi

# Check file exit
if [ -f "$ACCESS" ]
  then
    # Check file is empty
    if [ ! -s $ACCESS ]
      then
        echo "$ACCESS is empty"; exit 1;
    fi
  else
    echo "$ACCESS does not exist"; exit 1;
fi

# Check file is log or archive(gz) by second argument
if [ -z "$2" ]
  then
    awk '{print $1}' $ACCESS | sort | uniq -c | sort -nr | awk '{print $2, $1}' > $T1
    # if Log file then empty
    truncate -s0 $ACCESS
  else
    zcat $ACCESS | awk '{print $1}' | sort | uniq -c | sort -nr | awk '{print $2, $1}' > $T1
fi

awk '{print $1, $2}' $T1 >> $IP
awk '{ seen[$1] += $2 } END { for (i in seen) print i, seen[i]  }' $IP > $T2
rm $IP
mv $T2 $IP
awk '{rows++; sum += $2} END{print timestamps, rows, sum}' timestamps="$(date +%s)" $T1 > $VISITS
rm $T1
awk '{rows++; sum += $2} END{print rows, sum} ' $IP >> $VISITS

# echo "Done: $1";
