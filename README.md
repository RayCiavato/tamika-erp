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
3. Respalda el `.env` y la base antes de tocar el codigo:

```bash
cp .env .env.backup_$(date +%Y%m%d_%H%M)
docker compose exec -T db sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup_tamika_erp_$(date +%Y%m%d_%H%M).sql
ls -lh .env.backup_* backup_tamika_erp_*.sql
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
git status --short
git fetch origin
git checkout main
git pull --ff-only origin main
docker compose build backend frontend
docker compose run --rm backend sh -lc 'npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script' > prisma_update_preview.sql
grep -Ei 'DROP|TRUNCATE|DELETE FROM' prisma_update_preview.sql
docker compose run --rm backend npx prisma db push
docker compose up -d
docker compose ps
```

El `grep` no debe mostrar operaciones destructivas. Este repositorio aun no incluye una carpeta `prisma/migrations`, por eso la sincronizacion se realiza con `prisma db push` despues del respaldo y la vista previa. Nunca agregues `--force-reset` ni `--accept-data-loss` en produccion.

La actualizacion actual solo agrega columnas opcionales (`metodoPago`, `movimientoRelacionadoId`), sus indices y la tabla de asociaciones de cotizaciones. No elimina ni renombra tablas o columnas existentes.

### Correlativo global y estados reversibles

- Propuestas y presupuestos nuevos comparten una sola secuencia. El sistema toma el mayor correlativo historico de ambos tipos y genera el siguiente con siete digitos, por ejemplo `PRES-0000001` y luego `PROP-0000002`.
- Los numeros antiguos, incluso los cargados manualmente, no se reescriben. Cambiar el tipo de un documento existente tampoco cambia su correlativo.
- La interfaz usa `Propuesta` como tipo inicial y conserva la seleccion actual mientras el usuario trabaja. Los estados operativos visibles son `APROBADO`, `FACTURADO` y `ANULADO`; el backend mantiene compatibilidad con documentos historicos en `BORRADOR` o `CONVERTIDO`.
- Productos, servicios, plantillas, usuarios, empleados, cuentas Starlink y antenas pueden activarse o desactivarse sin borrar su historia. Cada cambio deja una entrada de auditoria.
- El S/N es obligatorio para nuevas antenas Starlink y permite buscar el registro. Las antenas antiguas sin S/N siguen siendo legibles para no bloquear datos existentes.
- Las tasas BCV aceptan cuatro decimales en Contabilidad, Productos, Servicios, Nomina y Starlink.
- Esta mejora no agrega ni elimina columnas. Aun asi, conserva el respaldo y la vista previa de Prisma porque el servidor puede venir de una version anterior del proyecto.

### Actualizacion sin Docker

Backend:

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > ../prisma_update_preview.sql
npx prisma db push
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
6. Confirma el metodo de pago, las graficas y el comparativo mensual de reportes.
7. Registra dos servicios para un mismo cliente y revisa sus fechas independientes.
8. Cambia entre `Propuesta` y `Presupuesto` y confirma que ambos avanzan sobre la misma secuencia.
9. Registra una antena con S/N, buscala por ese valor y prueba desactivarla y reactivarla.
10. Revisa logs si algo no carga:

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
- Las ventas de productos y servicios quedan registradas como movimientos contables y conservan su traza de auditoria.
