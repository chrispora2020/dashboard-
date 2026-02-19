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
