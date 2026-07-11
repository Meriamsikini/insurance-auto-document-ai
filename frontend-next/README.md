# AssurAuto Next.js

Frontend Next.js pour la plateforme AssurAuto.

## Demarrage

```bash
npm install
npm run dev
```

Par defaut, les appels `/api/v1/*` sont proxies vers `http://127.0.0.1:8000`.
Pour changer l'URL backend:

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev
```

Le backend FastAPI existant reste dans `../app`.
