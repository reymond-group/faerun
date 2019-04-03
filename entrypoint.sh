#!/bin/bash

sed -i 's@'"$DEFAULTSERVER"'@'"$SERVER"'@g' /usr/share/nginx/html/config.js
nginx -g 'daemon off;'

exec "$@"