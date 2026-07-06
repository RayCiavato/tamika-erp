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

## Notas

- `.env` no debe subirse al repositorio.
- El frontend usa `/api/*` y Next redirige esas rutas al backend dentro de Docker.
- El modelo `Venta` existe en Prisma, pero actualmente no tiene pantalla ni endpoints.
