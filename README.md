# tidb-backend

Express API used by the Angular `portfolio/` app.

## Local

```bash
npm install
npm start
```

Default: `http://localhost:5000/`

## Render deploy notes

- Start command: `npm start`
- Port: Render provides `PORT` automatically (this app reads `process.env.PORT`)
- Optional CORS allowlist: set `CORS_ORIGIN` to a comma-separated list of allowed frontend origins, e.g. `https://your-site.vercel.app`

You must set any required secrets (examples):

- `JWT_SECRET`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `DB_SSL` (`true`/`false`), `DB_SSL_REJECT_UNAUTHORIZED` (`true`/`false`)
- Email settings used by `utils/sendEmail` (check your `.env` for names)

