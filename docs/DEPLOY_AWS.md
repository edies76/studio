# Docs Studio — producción en AWS (barato / free-tier friendly)

Antes de desplegar, revisa [`PRODUCT_POSITIONING.md`](PRODUCT_POSITIONING.md): Docs Studio es una capa documental contextual y revisable, no un reemplazo general de Word. Esa distinción también define qué debe compartir la superficie web y el endpoint MCP.

Las versiones seguras se guardan en el mismo registro de DynamoDB (`versions`); no requieren otra base de datos. El MCP expone `list_versions` y `restore_version`, y cada propuesta aceptada crea su propio snapshot.

## Arquitectura (una sola pieza)

**No hay backend separado.** Todo es **un solo servidor Next.js**:

| Capa | Dónde |
|------|--------|
| UI (editor, home, login) | Next.js App Router |
| API (chat, draft, docs, auth) | `src/app/api/*` en el **mismo** proceso |
| Auth Google | Auth.js (`/api/auth/*`) |
| Datos | **DynamoDB** en AWS o **`.data/` local** sin AWS |

```
Browser  →  Next.js (puerto 3000)  →  DeepSeek API
                 ↓
            DynamoDB (docs + chat por usuario)
```

Un solo deploy. Un solo dominio corto.

---

## Costo recomendado (lo más barato con buen rendimiento)

| Servicio | Uso | Free tier / barato |
|----------|-----|---------------------|
| **Amplify Hosting** o **App Runner** | App Next.js | Amplify free tier; App Runner ~$5+/mes |
| **DynamoDB on-demand** | Docs + chat | 25 GB free forever (on-demand light) |
| **Route 53** + dominio corto | `docs.bambalunar.app` | ~$0.50/mes zona + dominio si ya tenés bambalunar.app |
| **Cognito** (opcional) | Alternativa a Auth.js | Free 50k MAU — **no lo usamos por defecto** |

**Recomendación:**  
1. **Amplify Hosting** (SSR Next 15) + **DynamoDB** + subdominio `docs.bambalunar.app`  
2. Auth **Google vía Auth.js** (gratis; no cobra Cognito)

Si Amplify se complica con Next 15, alternativa **Lightsail $3.50–5/mes** (Node) o **EC2 t3.micro free 12 meses**.

---

## Variables de entorno (producción)

```bash
# DeepSeek
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-v4-flash

# Auth.js + Google OAuth
AUTH_SECRET=  # openssl rand -base64 32
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_URL=https://docs.bambalunar.app
NEXTAUTH_URL=https://docs.bambalunar.app

# AWS data (opcional en local)
AWS_REGION=us-east-1
DOCS_TABLE=docs-studio
# Credenciales: IAM role en Amplify/EC2 o keys en env

# Forzar login en prod
FORCE_AUTH=1
```

Google Cloud Console → OAuth client → redirect URI:
```
https://docs.bambalunar.app/api/auth/callback/google
http://localhost:9003/api/auth/callback/google
```

---

## Crear tabla DynamoDB (AWS CLI)

```bash
# scripts/aws-create-table.sh  (o PowerShell abajo)
aws dynamodb create-table \
  --table-name docs-studio \
  --attribute-definitions \
      AttributeName=pk,AttributeType=S \
      AttributeName=sk,AttributeType=S \
  --key-schema \
      AttributeName=pk,KeyType=HASH \
      AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

---

## Deploy rápido (script)

Ver `scripts/aws-deploy.md` y:

```bash
# 1) Tabla
aws dynamodb create-table ...  # arriba

# 2) Amplify (interfaz o CLI)
# Conectá el repo edies76/docs-studio o edies76/studio
# Build: npm ci && npm run build
# Start: npm start   (o el preset Next.js de Amplify)

# 3) Env vars en la consola Amplify / App Runner
# 4) Dominio personalizado docs.bambalunar.app
```

## MCP remoto en el mismo deploy

El MCP cloud no necesita otro servidor. La ruta Next.js `/api/mcp` usa el mismo dominio, el mismo DeepSeek y el mismo almacenamiento de documentos:

```text
https://docs.bambalunar.app/api/mcp
```

Configura estos secretos en Amplify/App Runner:

```bash
MCP_API_KEY=<secreto largo y aleatorio>
MCP_KEY_ID=agent-main
MCP_USER_ID=workspace-main
DOCS_STUDIO_URL=https://docs.bambalunar.app
```

El endpoint exige `Authorization: Bearer <MCP_API_KEY>` y rechaza el tráfico si no hay DynamoDB configurado. Para varias identidades, usa `MCP_API_KEYS` con el formato documentado en [`docs/mcp/README.md`](mcp/README.md).

Configuración MCP de un cliente compatible:

```json
{
  "mcpServers": {
    "docs-studio": {
      "url": "https://docs.bambalunar.app/api/mcp",
      "headers": { "Authorization": "Bearer <MCP_API_KEY>" }
    }
  }
}
```

### Permisos IAM mínimos para el runtime

La identidad IAM que ejecuta Next.js necesita acceso a la tabla configurada:

- `dynamodb:Query` para listar documentos.
- `dynamodb:GetItem` para leerlos.
- `dynamodb:PutItem` para guardar documentos y propuestas.
- `dynamodb:DeleteItem` para borrar documentos.

El MCP usa Streamable HTTP stateless; no depende de una sesión guardada en memoria ni de sticky sessions.

### URL corta

Usá un subdominio del dominio Bamba:

- **docs.bambalunar.app** (recomendado)
- **d.bambalunar.app**

Route 53 → CNAME / ALIAS al hosting Amplify.

---

## Local sin AWS (gratis)

Sin `DOCS_TABLE` / credentials:

- Docs y chat se guardan en **`.data/docs/`** (gitignored)
- Auth opcional: sin Google OAuth → usuario `local-guest`
- `npm run dev` en `:9003`

---

## Checklist pre-prod

- [ ] `DEEPSEEK_API_KEY` en prod
- [ ] Google OAuth + `AUTH_SECRET`
- [ ] Tabla DynamoDB creada
- [ ] `FORCE_AUTH=1` en prod
- [ ] Dominio corto + HTTPS
- [ ] Probar: login Google → home → nuevo doc → autosave → chat persiste
- [ ] Probar externamente: `initialize` → `tools/list` → `create_document` en `/api/mcp`
- [ ] Confirmar que `MCP_API_KEY` no aparece en el repo ni en logs
