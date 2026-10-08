# iStreams CRM on Ubuntu (PostgreSQL)

Ubuntu 22.04 / 24.04. One server runs PostgreSQL, the `api-pg` API and nginx (serves the React build and proxies the API).
SQL Server, LocalDB and the `api/` folder are not needed on the server.

Replace `crm.example.com` with your domain and the example passwords with your own.

## 1. Packages

```bash
sudo apt update
sudo apt install -y postgresql nginx certbot python3-certbot-nginx ufw
sudo apt install -y aspnetcore-runtime-8.0      # if apt cannot find it: https://learn.microsoft.com/dotnet/core/install/linux-ubuntu
```

## 2. Database

PostgreSQL listens on localhost only by default. Keep it that way.

```bash
sudo -u postgres psql -c "CREATE USER istreams WITH PASSWORD 'CHANGE_ME_DB_PASSWORD'"
sudo -u postgres psql -c "CREATE DATABASE istreams_crm OWNER istreams"
PGPASSWORD='CHANGE_ME_DB_PASSWORD' psql -h localhost -U istreams -d istreams_crm -f database/postgres/01_schema.sql
```

First admin: either sign up in the web app and approve it, or seed it with a BCrypt hash.

```bash
# Option A (after signing up in the browser): approve the company and make that user super admin
PGPASSWORD='CHANGE_ME_DB_PASSWORD' psql -h localhost -U istreams -d istreams_crm -c \
  "UPDATE wsm_companies SET status='ACTIVE', approved_at = now() AT TIME ZONE 'utc'; UPDATE wsm_users SET is_super_admin='T' WHERE LOWER(email)='you@example.com'"

# Option B: seed with an existing hash (for example copied from SQL Server: SELECT password_hash FROM wsm_users WHERE is_super_admin='T')
PGPASSWORD='CHANGE_ME_DB_PASSWORD' psql -h localhost -U istreams -d istreams_crm -v admin_hash='$2a$11$...' -f database/postgres/02_seed_super_admin.sql
```

## 3. API

Build on your PC (or on the server with the .NET 8 SDK) and copy it over:

```bash
dotnet publish api-pg -c Release -o publish
rsync -a publish/ user@server:/tmp/istreams-api/
```

On the server:

```bash
sudo mkdir -p /var/www/istreams/api /var/www/istreams/uploads /etc/istreams
sudo cp -r /tmp/istreams-api/* /var/www/istreams/api/
sudo chown -R www-data:www-data /var/www/istreams
```

Settings go in `/etc/istreams/api.env` (secrets stay out of the app folder and out of git):

```bash
sudo tee /etc/istreams/api.env >/dev/null <<'ENV'
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://127.0.0.1:5101
ConnectionStrings__DefaultConnection=Host=localhost;Port=5432;Database=istreams_crm;Username=istreams;Password=CHANGE_ME_DB_PASSWORD
Jwt__Key=PUT_A_RANDOM_STRING_OF_AT_LEAST_32_CHARACTERS
Cors__AllowedOrigins__0=https://crm.example.com
App__FrontendUrl=https://crm.example.com
App__PublicUrl=https://crm.example.com
Uploads__Path=/var/www/istreams/uploads
Smtp__Host=smtp.gmail.com
Smtp__Port=587
Smtp__User=you@gmail.com
Smtp__Password=GMAIL_APP_PASSWORD
Smtp__From=you@gmail.com
ENV
sudo chmod 600 /etc/istreams/api.env
```

Generate the JWT key with `openssl rand -base64 48`.
`App__PublicUrl` is the address customers open for property pages and photos, so it must be the public HTTPS domain.

`/etc/systemd/system/istreams-api.service`:

```ini
[Unit]
Description=iStreams CRM API (PostgreSQL)
After=network.target postgresql.service

[Service]
WorkingDirectory=/var/www/istreams/api
ExecStart=/usr/bin/dotnet /var/www/istreams/api/WhatsAppCrm.ApiPg.dll
EnvironmentFile=/etc/istreams/api.env
User=www-data
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now istreams-api
sudo systemctl status istreams-api
journalctl -u istreams-api -f        # live logs
```

## 4. Frontend

Create `frontend/.env.production` on your PC (do not commit the real domain), then build:

```bash
VITE_API_URI_PG=https://crm.example.com/api
VITE_DB_OPTIONS=postgres
```

```bash
cd frontend && npm ci && npm run build
rsync -a --delete dist/ user@server:/var/www/istreams/web/
```

`VITE_DB_OPTIONS=postgres` hides the database dropdown and sends everything to the PostgreSQL API.

## 5. nginx

`/etc/nginx/sites-available/istreams`:

```nginx
server {
    server_name crm.example.com;
    client_max_body_size 200m;          # property photos and brochures

    root /var/www/istreams/web;
    index index.html;

    location / {
        try_files $uri /index.html;     # React routes
    }

    location ~ ^/(api|uploads|p)/ {
        proxy_pass http://127.0.0.1:5101;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/istreams /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d crm.example.com      # HTTPS, auto-renews
```

## 6. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw enable
```

Do not open port 5432 or 5101. Only nginx talks to the API, and only the API talks to PostgreSQL.

## 7. WhatsApp and email

- Meta webhook callback URL: `https://crm.example.com/api/whatsapp/webhook/<company code>` (shown on the WhatsApp Settings page).
- Run only one API against a given mailbox. If SQL Server's API is still running on your PC with the same Gmail settings, both will import the same emails.

## 8. Backups

```bash
# nightly: /etc/cron.d/istreams-backup
0 2 * * * root PGPASSWORD='CHANGE_ME_DB_PASSWORD' pg_dump -h localhost -U istreams istreams_crm | gzip > /var/backups/istreams-$(date +\%F).sql.gz
15 2 * * * root tar czf /var/backups/istreams-uploads-$(date +\%F).tgz -C /var/www/istreams uploads
```

Copy `/var/backups` off the server regularly. Restore with `gunzip -c file.sql.gz | psql ...` on an empty database.

## 9. Updating

```bash
# API: publish again, copy, restart
sudo rsync -a /tmp/istreams-api/ /var/www/istreams/api/ && sudo systemctl restart istreams-api
# Frontend: rebuild and rsync dist/ to /var/www/istreams/web/
# Database changes: new scripts in database/postgres/ are run once with psql
```

## 10. Quick checks

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://crm.example.com/api/auth/login -H 'Content-Type: application/json' -d '{"email":"x@example.com","password":"x"}'   # expect 401
sudo systemctl status istreams-api postgresql nginx
```
