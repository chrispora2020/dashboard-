# KPI PDF Extractor - Dashboard

Aplicación web para seguimiento de indicadores (KPI) a partir de PDFs cargados por el usuario.

## Arquitectura

- **Frontend**: React + Vite (puerto 3000)
- **Backend**: FastAPI + Python (puerto 8000)  
- **Worker**: Celery para procesamiento asíncrono de PDFs
- **Base de datos**: PostgreSQL (puerto 5432)
- **Cache/Cola**: Redis (puerto 6379)

## Requisitos

- Docker Desktop instalado y corriendo
- Docker Compose

## Levantar el proyecto

### 1. Ubicarse en el directorio del proyecto
```bash
cd C:\c\_DESA\proyectos\dashboard
```

### 2. Levantar todos los servicios
```bash
docker-compose up -d
```

### 3. Ver logs en tiempo real
```bash
# Todos los servicios
docker-compose logs -f

# Solo un servicio específico
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f worker
```

### 4. Verificar estado de servicios
```bash
docker-compose ps
```

## Acceso a la aplicación

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000  
- **API Docs (Swagger)**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432 (usuario: appuser, password: secret, db: kpi_db)

## Comandos útiles

### Reconstruir imágenes
```bash
docker-compose build --no-cache
```

### Detener servicios
```bash
docker-compose down
```

### Reiniciar un servicio específico
```bash
docker-compose restart frontend
```

### Ver logs de un servicio
```bash
docker-compose logs --tail=200 backend
```

### Entrar a un contenedor
```bash
docker-compose exec backend bash
docker-compose exec frontend sh
```

## Pruebas rápidas de API

### Registrar usuario
```bash
curl -X POST http://localhost:8000/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"test@local\",\"password\":\"secret\",\"name\":\"Test User\"}"
```

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"test@local\",\"password\":\"secret\"}"
```

### Listar archivos
```bash
curl http://localhost:8000/api/files
```

### Subir PDF
```bash
curl -X POST http://localhost:8000/api/files -F "files=@sample.pdf" -F "period_id=2026-02"
```

## Problemas conocidos y soluciones

### Deploy en Render sin perder datos

Si despliegas en Render, **no uses SQLite** para producción. El contenedor puede reiniciarse y perder archivos locales.

Este repo ahora incluye `render.yaml` con servicios listos para usar:
- `dashboard-postgres` (PostgreSQL administrado)
- `dashboard-redis` (cola/cache)
- `dashboard-backend` (FastAPI)
- `dashboard-worker` (Celery)

Pasos:
1. En Render, crea un nuevo Blueprint apuntando a este repo.
2. Render leerá `render.yaml` y conectará `DATABASE_URL` automáticamente al PostgreSQL administrado.
3. Verifica en logs de backend que la URL activa sea `postgresql+psycopg2://...` y no `sqlite:///...`.

Nota: el backend bloquea SQLite cuando detecta entorno Render (excepto bypass explícito con `ALLOW_EPHEMERAL_SQLITE=true`).


### La base "se borra" después de reinicios/despliegues
Síntoma típico cuando la app corre con SQLite en ruta no persistente (por ejemplo `./test.db` dentro del contenedor).  

Qué validar:
1. Revisar logs de backend: ahora la app falla en ambientes productivos si detecta SQLite efímero.
2. Configurar `DATABASE_URL` a PostgreSQL en producción.
3. Si se usa SQLite, apuntar a disco persistente (`/var/data/dashboard.db`, `/data/dashboard.db` o `./data/dashboard.db`).

Configuración recomendada para evitar pérdida de datos:
- Producción: `DATABASE_URL=postgresql+psycopg2://...` (base administrada).
- Desarrollo local sin Postgres: crear carpeta `./data` y usar `SQLITE_PATH=./data/dashboard.db`.
- Nunca usar `sqlite:///./test.db` para entornos que reinician contenedores.

Variables de control:
- `ALLOW_EPHEMERAL_SQLITE=true`: bypass temporal (no recomendado en producción).
- `STRICT_EPHEMERAL_SQLITE=false`: desactiva el bloqueo estricto.

### Certificados corporativos (SELF_SIGNED_CERT_IN_CHAIN)
Si tu red usa un proxy con certificados auto-firmados:
1. Exporta el certificado CA y guárdalo como `frontend/ca.crt`
2. Reconstruye: `docker-compose build --no-cache frontend`

**Workaround temporal aplicado**: El Dockerfile usa `npm config set strict-ssl false` cuando no encuentra `ca.crt`.

### Frontend no carga / error de rollup
Resuelto mediante volumen anónimo para `node_modules` que preserva la versión de Linux.

## Estado del proyecto

✅ **Completado (Sprint 1 - MVP completo)**:
- ✅ Scaffold completo (backend + frontend + docker)
- ✅ Autenticación completa con UI moderna (login + registro)  
- ✅ Modelos de datos (usuarios, archivos PDF, mediciones)
- ✅ Dashboard visual con 7 tarjetas de KPI y gráficos de tendencia
- ✅ UI de carga de archivos con drag & drop visual
- ✅ Historial de archivos cargados con estados
- ✅ Worker Celery para procesamiento asíncrono
- ✅ Navegación con React Router
- ✅ Sistema de autenticación persistente (localStorage)

🎨 **Funcionalidades UI disponibles**:
- Login/Registro con validación
- Dashboard con 7 KPIs principales (datos de ejemplo)
- Gráfico de tendencias usando Recharts
- Interfaz de carga de PDFs con historial
- Navbar con menú de navegación
- Estado de procesamiento de archivos (uploaded/processed/error)

🔄 **Próximos pasos (siguiente sprint)**:
1. ✅ Carga y almacenamiento de PDFs + historial (COMPLETADO)
2. Pipeline de extracción PDF (texto nativo + OCR)
3. Sistema de periodos y metas dinámicas  
4. Conexión Dashboard → datos reales desde DB
5. Mapeo asistido de campos
6. Reglas/motor de cálculo extensible
