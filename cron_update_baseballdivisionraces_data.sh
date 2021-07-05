#!/bin/bash

pushd /home/gregstoll/projects/baseballdivisionraces.git > /dev/null
. .venv/bin/activate
.venv/bin/python3 getmlbstandings/getmlbstandings.py -u
oldfilesize=$(wc -c <"showdivisionraces/dist/data/$(date +%Y).json")
newfilesize=$(wc -c <"getmlbstandings/data/$(date +%Y).json")
#echo "old file size $oldfilesize"
#echo "new file size $newfilesize"
if [ $newfilesize -ge $oldfilesize ]; then
    #echo "copying"
    cp getmlbstandings/data/$(date +%Y).json showdivisionraces/dist/data
fi
popd > /dev/null
