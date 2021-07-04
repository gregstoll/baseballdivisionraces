#!/bin/sh

cd /home/gregstoll/projects/baseballdivisionraces.git
. .venv/bin/activate
.venv/bin/python3 getmlbstandings/getmlbstandings.py -u
cp getmlbstandings/data/*.json showdivisionraces/dist/data
