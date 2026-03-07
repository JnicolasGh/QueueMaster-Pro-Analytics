# QueueMaster Pro & Analytics

Sistema profesional de gestión de turnos con análisis de datos en tiempo real, paneles de asesor, pantallas públicas y generación de datos sintéticos.

## 🚀 Características

- **Kiosco de Registro**: Interfaz táctil para que los clientes soliciten su turno por categoría.
- **Panel del Asesor**: Gestión de ventanillas, llamado de clientes y control de tiempos de atención.
- **Pantalla de TV**: Visualización pública con alertas visuales y ticker de noticias.
- **Dashboard de Analytics**: Visualización de KPIs como TME (Tiempo Medio de Espera), TMA (Tiempo Medio de Atención) y volumen de turnos.
- **Generador de Datos**: Herramienta para generar 6 meses de datos históricos realistas para demostraciones.

## 🛠️ Tecnologías

- **Frontend**: React 19, TypeScript, Tailwind CSS.
- **Animaciones**: Motion (Framer Motion).
- **Gráficos**: Recharts.
- **Iconos**: Lucide React.
- **Utilidades**: date-fns.

## 📦 Instalación y Uso

1. Clona el repositorio:
   ```bash
   git clone <url-del-repositorio>
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## Docker (App + PostgreSQL)

1. Construir y levantar contenedores:
   ```bash
   docker compose up --build
   ```
2. Aplicacion disponible en:
   - `http://localhost:3000`
3. Base de datos PostgreSQL:
   - Host: `localhost`
   - Puerto: `5432`
   - DB: `queuemaster_db`
   - User: `queuemaster`
   - Password: `queuemaster123`

### Cargar copia de base de datos (opcional)

La restauracion automatica solo ocurre cuando el volumen de PostgreSQL se crea por primera vez.

1. Copia tu backup en `infra/postgres/backups/` (formatos soportados: `.sql`, `.dump`, `.backup`).
2. En `docker-compose.yml`, en el servicio `queuemaster-postgres`, asigna:
   - `POSTGRES_RESTORE_FILE: "tu_archivo.sql"` (o `.dump`)
3. Levanta contenedores:
   ```bash
   docker compose up --build
   ```

Si el volumen ya existe y quieres restaurar desde cero:
```bash
docker compose down -v
docker compose up --build
```

## 🏗️ Arquitectura Lakehouse (Implementación)

El sistema utiliza un flujo de datos en capas dentro de PostgreSQL para optimizar la analítica:

### 1. Capa Raw (Operativa)
- **Origen**: Aplicación Node.js.
- **Tabla**: `tickets`.
- **Contenido**: Datos crudos tal como se generan en el kiosco y la ventanilla.

### 2. Capa Bronze (Limpieza)
- **Proceso**: `make run-raw-to-bronze`.
- **Acción**: Convierte timestamps a fechas reales, separa tipos de documento y calcula tiempos en segundos.
- **Tabla**: `bronze_tickets`.

### 3. Capa Silver (Métricas)
- **Proceso**: `make run-bronze-to-silver`.
- **Acción**: Agrupa datos por día y calcula KPIs (TME, TMA, Tasa de Abandono).
- **Tabla**: `silver_daily_metrics`.

### 4. Visualización (Grafana)
- Conecte Grafana a PostgreSQL y use la tabla `silver_daily_metrics` para dashboards de alto rendimiento.
