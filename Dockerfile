FROM nginx:latest

RUN /bin/bash -c 'apt-get update && apt-get -y install curl && apt-get clean'

COPY . /usr/share/nginx/html
WORKDIR "/usr/share/nginx/html"

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]