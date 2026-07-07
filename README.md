# Tamika ERP

Aplicacion interna para gestionar clientes, cotizaciones, tasas de cambio y generar propuestas comerciales en PDF.

## Stack

- Backend: Node.js, Express, Prisma
- Base de datos: PostgreSQL
- Frontend: Next.js, React, Tailwind CSS
- PDF: pdfmake, html-to-pdfmake
- Orquestacion local: Docker Compose

## Estructura

```text
backend/
  prisma/schema.prisma
  src/index.js
frontend/
  app/page.js
  app/layout.js
  public/logo.png
  public/firma.png
docker-compose.yml
```

## Configuracion

1. Copia `.env.example` a `.env`.
2. Cambia `POSTGRES_PASSWORD` y `JWT_SECRET`.
3. Levanta el entorno:

```bash
docker compose up --build
```

Servicios por defecto:

- Frontend: http://localhost:8083
- Backend: http://localhost:5000
- PostgreSQL: localhost:5433

## Ejecucion local probada

Para correr sin Docker, usa Node 20+ y PostgreSQL escuchando en `localhost:5433`.

Backend:

```bash
cd backend
DATABASE_URL=postgresql://tamika_admin:TU_PASSWORD@localhost:5433/tamika_erp_db npm start
```

Frontend:

```bash
cd frontend
API_INTERNAL_URL=http://localhost:5000 npm run build
API_INTERNAL_URL=http://localhost:5000 npm start -- -p 8083
```

## Despliegue seguro en servidor

Estos pasos estan pensados para actualizar el servidor sin perjudicar la base de datos existente.

### Antes de actualizar

1. Confirma que el servidor esta apuntando a la base de datos real en `DATABASE_URL`.
2. No reemplaces el `.env` del servidor con un `.env` local.
3. Genera un respaldo antes de tocar el codigo:

```bash
pg_dump "$DATABASE_URL" > backup_tamika_erp_$(date +%Y%m%d_%H%M).sql
```

4. Guarda el commit actual para poder volver atras si hace falta:

```bash
git rev-parse --short HEAD
```

### Comandos que NO deben usarse en produccion

No ejecutes estos comandos en el servidor si quieres conservar la data:

```bash
docker compose down -v
npx prisma migrate reset
npx prisma db push --force-reset
dropdb
createdb --clean
```

`docker compose down -v` elimina volumenes de Docker y puede borrar PostgreSQL si la base de datos vive en un volumen del compose.

### Actualizacion con Docker Compose

Desde la carpeta del proyecto en el servidor:

```bash
git fetch --all
git checkout main
git pull --ff-only
docker compose build
docker compose run --rm backend npx prisma generate
docker compose run --rm backend npx prisma migrate deploy
docker compose up -d
```

`prisma migrate deploy` aplica solo migraciones pendientes. No reinicia la base de datos y es el comando recomendado para produccion.

### Actualizacion sin Docker

Backend:

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
pm2 restart tamika-backend
```

Frontend:

```bash
cd frontend
npm ci
npm run build
pm2 restart tamika-frontend
```

Ajusta los nombres de `pm2` si en el servidor se usan otros procesos.

### Verificacion despues del despliegue

1. Abre el frontend y confirma que carga el dashboard.
2. Inicia sesion con un usuario administrador.
3. Revisa `Propuestas`, `Contabilidad`, `Reportes`, `Catalogos` y `Usuarios`.
4. Genera una propuesta o presupuesto en PDF y confirma que el membrete, correlativo, cliente y totales se ven dentro de los margenes.
5. En `Contabilidad`, valida que la tasa BCV se pueda actualizar y guardar.
6. Revisa logs si algo no carga:

```bash
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
```

### Rollback seguro

Si la aplicacion falla despues de actualizar:

```bash
git checkout <commit-anterior>
docker compose build
docker compose up -d
```

No restaures el backup de la base de datos salvo que confirmes que una migracion afecto la data. Si necesitas restaurar, haz primero otro respaldo del estado actual.

### Usuario administrador temporal

Para pruebas iniciales:

```text
Email: admin.local@tamika.test
Password: Tamika12345
Rol: ADMIN
```

Cambia esta clave apenas entres al servidor. En una base de datos nueva, el primer usuario se crea desde el flujo de configuracion inicial; en una base existente no se deben recrear usuarios ni ejecutar seeds que sobrescriban datos.

## Notas

- `.env` no debe subirse al repositorio.
- El frontend usa `/api/*` y Next redirige esas rutas al backend dentro de Docker.
- El modelo `Venta` existe en Prisma, pero actualmente no tiene pantalla ni endpoints.
