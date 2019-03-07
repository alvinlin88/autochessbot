How to run locally
==================
## BOT APP

- Create a Discord Server
- Set up Discord Application: https://discordapp.com/developers/applications/
- Grab Client ID: Example `538445434251000000`
- Create a bot `https://discordapp.com/developers/applications/<client_id>/bots`
- Make the bot join your server: `https://discordapp.com/oauth2/authorize?client_id=<client_id>&scope=bot`
- Grab bot token `https://discordapp.com/developers/applications/<client_id>/bots`
- Put bot token in `config.js` `config.discord_token`
- Start server: nodejs app.js (Node v10.15.1)
- Get a steam api key `https://steamcommunity.com/dev/apikey`
- Make sure you have region roles and lobbies created on your discord according to your config.js file

Set up your server with the proper channels and roles (or else the bot will throw errors when it tries to grab channel ID's by name.)

## VM Setup
```
(install node as root)
36  wget https://nodejs.org/dist/v10.15.2/node-v10.15.2-linux-x64.tar.xz
37  tar xvf node-v10.15.2-linux-x64.tar.xz
39  cd node-v10.15.2-linux-x64/
44  cp -r bin/* /usr/local/bin/
46  cp -r include/* /usr/local/include/
47  cp -r lib/* /usr/local/lib
48  cp -r share/* /usr/local/share
54  ln -s /usr/local/bin/node /usr/bin/node
55  ln -s /usr/local/bin/npm /usr/bin/npm


curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.32.0/install.sh | bash
. ~/.nvm/nvm.sh
nvm install 10.15.1

/etc/systemd/system/autochessbot.service
[Unit]
Description=AutoChessBot
Documentation=https://example.com
After=network.target

[Service]
Environment=NODE_PORT=8080
Type=simple
User=root
LimitNOFILE=65536
ExecStart=/usr/bin/node /home/ec2-user/autochessbot/app.js
Restart=on-failure
StandardOutput=syslog+console
StandardError=syslog+console
SyslogIdentifier=autochessbot

[Install]
WantedBy=multi-user.target


/etc/systemd/system/autochessverify.service
[Unit]
Description=AutoChessBotVerify
Documentation=https://example.com
After=network.target

[Service]
Environment=NODE_PORT=80
Type=simple
User=root
ExecStart=/usr/bin/node /home/ec2-user/autochessbot/verifyapp/verifyapp.js
Restart=on-failure
StandardOutput=syslog+console
StandardError=syslog+console
SyslogIdentifier=autochessbotverify

[Install]
WantedBy=multi-user.target

sudo yum install git
cd ~
git clone git@gitlab.com:autochessbot/autochessbot.git

cd autochessbot
edit config.js with information
npm install

sudo amazon-linux-extras install nginx1.12

sudo wget -r --no-parent -A 'epel-release-*.rpm' http://dl.fedoraproject.org/pub/epel/7/x86_64/Packages/e/
sudo rpm -Uvh dl.fedoraproject.org/pub/epel/7/x86_64/Packages/e/epel-release-*.rpm
sudo yum-config-manager --enable epel*
sudo yum install -y certbot python2-certbot-nginx

location / {
proxy_pass http://localhost:8080;
proxy_read_timeout 90;
}

cd verifyapp
ln -s ../config.js config.js

sudo systemctl enable nginx
sudo systemctl enable autochessbot
sudo systemctl enable autochessverify

```

## VERIFY APP

- Similar to the bot app set up, you'll need to configure the following:
  - `discord_client_id`
  - `discord_client_secret`
  - `steam_token` which is the steam api key, get one at `https://steamcommunity.com/dev/apikey`
- Check the port for verifyapp. Normally it's `8080`
- Change `config.verify_redirect_url` to `http://localhost:<port>/callback`
- Go to your the discord oauth page `https://discordapp.com/developers/applications/<client_id>/oauth` and add `http://localhost:<port>/callback` to `Redirects`
- Start server: `node verifyapp.js` and test verification at `http://localhost:<port>`

Let's Encrypt
=============
```
sudo wget -r --no-parent -A 'epel-release-*.rpm' http://dl.fedoraproject.org/pub/epel/7/x86_64/Packages/e/
sudo rpm -Uvh dl.fedoraproject.org/pub/epel/7/x86_64/Packages/e/epel-release-*.rpm
sudo yum-config-manager --enable epel*
sudo yum repolist all
sudo yum install -y certbot python2-certbot-nginx
sudo certbot
```
Follow instructions to generate a certificate for the subdomain. Have certbot install the cert or you can install it yourself.
Use proxy pass for `location /` for example:
```
location / {
    proxy_set_header        Host $host;
    proxy_set_header        X-Real-IP $remote_addr;
    proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header        X-Forwarded-Proto $scheme;

    proxy_pass              http://localhost:8080;
    proxy_read_timeout      90;

    proxy_redirect          http://localhost:8080 https://autochessbot.vinthian.com;
}
```


Metrics
=======
### Prometheus
```
wget https://github.com/prometheus/prometheus/releases/download/v2.7.2/prometheus-2.7.2.linux-amd64.tar.gz

cd
tar xvf prometheus-2.7.2.linux-amd64.tar.gz
mv prometheus-2.7.2.linux-amd64 prometheus


prometheus.yml:

scrape_configs:
  - job_name: 'autochessbot'
    static_configs:
    - targets: ['localhost:3000']


[ec2-user@ip-10-0-1-234 prometheus]$ cat /etc/systemd/system/autochessbotprom.service
[Unit]
Description=AutoChessBot
Documentation=https://example.com
After=network.target

[Service]
#Environment=NODE_PORT=8080
Type=simple
User=root
LimitNOFILE=65536
ExecStart=/home/ec2-user/prometheus/prometheus --config.file=/home/ec2-user/prometheus/prometheus.yml --storage.tsdb.retention=15d
Restart=on-failure
StandardOutput=syslog+console
StandardError=syslog+console
SyslogIdentifier=autochessbotprom

[Install]
WantedBy=multi-user.target

systemctl daemon-reload
systemctl enable autochessbotprom
```
### Grafana
```
wget https://dl.grafana.com/oss/release/grafana-6.0.1.linux-amd64.tar.gz 
tar -zxf grafana-6.0.1.linux-amd64.tar.gz 
mv grafana-6.0.1/ grafana

cat /etc/systemd/system/autochessbotgrafana.service

[Unit]
Description=AutoChessBotGrafana
Documentation=https://example.com
After=network.target

[Service]
Type=simple
User=root
LimitNOFILE=65536
WorkingDirectory=/home/ec2-user/grafana
ExecStart=/home/ec2-user/grafana/bin/grafana-server web
Restart=on-failure
StandardOutput=syslog+console
StandardError=syslog+console
SyslogIdentifier=autochessbotgrafana

[Install]
WantedBy=multi-user.target
```
### Nginx
```
/etc/nginx/nginx.conf

--- (not needed)
server {
server_name autochessbotmetrics.vinthian.com;
location / {

proxy_set_header        Host $host;
proxy_set_header        X-Real-IP $remote_addr;
proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header        X-Forwarded-Proto $scheme;

# Fix the “It appears that your reverse proxy set up is broken" error.
proxy_pass          http://localhost:3000;
}
}

--- (also not needed if using grafana)
server {
server_name autochessbotprom.vinthian.com;
location / {

proxy_set_header        Host $host;
proxy_set_header        X-Real-IP $remote_addr;
proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header        X-Forwarded-Proto $scheme;

# Fix the “It appears that your reverse proxy set up is broken" error.
proxy_pass          http://localhost:9090;
}
}
```

