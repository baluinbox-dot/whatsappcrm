# WhatsApp CRM by iStreams

Multi-company WhatsApp + Email CRM. Each company connects one business WhatsApp number and one mailbox;
admins see every chat and email and assign customers to staff, staff reply to their own customers.

- `api/` — .NET 8 Web API (Dapper, JWT) on http://localhost:5097
- `frontend/` — React 18 + Vite + Tailwind on http://localhost:5098
- `database/` — SQL scripts; tables are prefixed `wsm_` in the `project_management` database

## First-time setup

1. Run the database scripts in order:
   - `database/01_schema.sql`
   - `database/02_import_from_pm.sql` (optional; copies the PM system's WhatsApp data as company #1)
   - `database/03_staff_mobile_login.sql` (only for databases created before staff mobile sign-in)
   - `database/04_email_inbox.sql`
   - `database/05_properties_services.sql`
   - `database/06_leads.sql`
   - `database/07_matching_sharing.sql`
2. Create `api/appsettings.Development.json` (not committed):
   ```json
   {
     "Jwt": { "Key": "<random string, 32+ characters>" },
     "Smtp": { "User": "you@gmail.com", "Password": "<Gmail App Password>", "From": "you@gmail.com" }
   }
   ```
3. `cd frontend && npm install`

## Run

```
cd api && dotnet run
cd frontend && npm run dev
```

## Roles

| Role | Signs in with | Access |
|---|---|---|
| Super Admin | Admin tab: email + password | Approve / suspend companies (Super Admin page) |
| Admin | Admin tab: email + password | Whole inbox, assign customers, staff, WhatsApp settings |
| Staff | Staff tab: company admin email + own mobile + password | Only customers assigned to them |

Staff have no email of their own, so "Forgot password" is for admins; an admin resets staff passwords on the Staff page.

New sign-ups create a company in **Pending** status; a Super Admin approves it before anyone can sign in.

## Connecting WhatsApp

1. WhatsApp Settings: fill Phone Number ID, WABA ID, Access Token, Verify Token, App Secret → Save → Verify Connection.
2. Meta App → WhatsApp → Configuration → Webhook: paste the **Callback URL** shown on the settings page
   (`https://<public-host>/api/whatsapp/webhook/<company-code>`) and the same Verify Token. Subscribe to `messages`.
3. Make sure the WhatsApp Business Account is subscribed to the app: `POST https://graph.facebook.com/v23.0/{WABA-ID}/subscribed_apps`.
4. For local testing expose the API with `ngrok http 5097`.

## Connecting Email

1. Email Settings: fill Email Address, Username, Password, IMAP / SMTP servers → Save → Verify Connection.
   For Gmail turn on 2-Step Verification and use an App Password; IMAP `imap.gmail.com:993`, SMTP `smtp.gmail.com:587`.
2. The API checks every connected mailbox once a minute. Only mail that arrives **after** Verify Connection is imported.
3. A new sender is saved as a customer (email ID + name from the From header, source `Email`), unassigned.
   If a WhatsApp customer already gave that email ID, the email is attached to that same customer.
4. Admins assign the customer to staff (the same assignment as WhatsApp); staff reply from Email Inbox and the
   full sent / received history is kept per customer. Replies are threaded under the customer's last email.
