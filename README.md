![Faerun](https://github.com/reymond-group/faerun/blob/master/app/images/logo.png?raw=true)
# Faerun
Visualizing large high-dimensional datasets.

This is the front-end of the FUn framework. A reference implementation visualizing over 10 million compunds exported from the [SureChEMBL database](https://www.surechembl.org) can be found at [faerun.gdb.tools](http://faerun.gdb.tools). The backend can be found in its own [github repository](https://github.com/reymond-group/underdarkgo).

## Getting Started
The best way to get started with Faerun is to pull the respective Docker Image.
```
docker run -d -p 80:80 --name faerun daenuprobst/faerun
```
This will use the default configuration. Using the default configuration means, that faerun will connect to the default services provided by our research group (http://www.gdb.unibe.ch). If you wish to provide your own service (e.g. containing other databases) you can provide a custom server address using the environment variable `SERVER`
```
docker run -d -p 80:80 -e SERVER=ws://example.ch/underdark --name faerun daenuprobst/faerun
```
See how to deploy your own backend server [here](https://github.com/reymond-group/underdarkgo).

If you wish to change more than just the server providing the data sets, you will either have to clone this repository and build the app and then create your own docker image or you can run docker using the following command and edit the configuration file on the host
```
docker run -d -p 80:80 -v /your/host/dir:/usr/share/nginx/html --name faerun daenuprobst/faerun
```
All application files will then be stored in the directory `/your/host/dir` on your host and you are able to make changes to the configuration file `config.js`.
## Building Faerun
Dependencies:
- nodejs, npm
- gulp (install using `npm install -g gulp`)

In order to (hack and) build faerun, first clone this repository `git clone https://github.com/reymond-group/faerun.git` and then run `npm install` in the folder where you cloned faerun into (default: `faerun`). To build faerun run `gulp`, which will create the distribution folder `dist`, the contents of which you can copy and serve on any web server such as nginx, IIS or apache.

## Common Problems
- If you are cannot get the container running after building it yourself on a Windows machine, you might have hidden windows characters in the `entrypoint.sh` script. Please remove them using `dos2unix.exe` (http://waterlan.home.xs4all.nl/dos2unix.html) and try to run the container again.
