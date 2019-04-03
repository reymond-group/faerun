FROM nginx
ENV SERVER=ws://underdark.gdb.tools/underdark
ENV DEFAULTSERVER=ws://underdark.gdb.tools/underdark
COPY /dist /usr/share/nginx/html

COPY entrypoint.sh /
RUN chmod +x /entrypoint.sh
CMD ["/bin/bash", "/entrypoint.sh"]
ENTRYPOINT ["/entrypoint.sh"]