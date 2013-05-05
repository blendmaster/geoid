#!/bin/bash
# a simple curl invocation to grab the ECCO2 ocean dataset from OPeNDAP at
# http://ecco2.jpl.nasa.gov/opendap/data1/cube/cube92/lat_lon/quart_90S_90N/

# we only want the first depth layer, which saves a ton of space. it's really
# nice that ndap allows subselections.

curl \
  "http://ecco2.jpl.nasa.gov:80/opendap/data1/cube/cube92/lat_lon/quart_90S_90N/UVEL_monthly.nc/UVEL.1440x720x50.[1992-2010][01-12].nc.nc?UVEL\[0\]\[0\]\[0:1:719\]\[0:1:1439\]"\
  -o "uvel-#1#2.nc"

curl \
  "http://ecco2.jpl.nasa.gov:80/opendap/data1/cube/cube92/lat_lon/quart_90S_90N/VVEL_monthly.nc/VVEL.1440x720x50.[1992-2010][01-12].nc.nc?VVEL\[0\]\[0\]\[0:1:719\]\[0:1:1439\]"\
  -o "vvel-#1#2.nc"
