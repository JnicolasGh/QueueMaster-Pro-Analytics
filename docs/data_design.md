# Diseño de Datos - QueueMaster Pro

## 1. Modelo de Datos (PostgreSQL)

El sistema utiliza una base de datos relacional PostgreSQL para garantizar la integridad y persistencia de la información. El diseño está optimizado para escrituras rápidas y consultas externas (Grafana).

### 1.1. Tabla: `tickets`
Almacena el ciclo de vida completo de cada turno emitido. La prioridad se determina dinámicamente según el peso de la categoría asociada.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | UUID único del turno. |
| `display_id` | `TEXT` | Identificador amigable (ej. S001, P002). |
| `category_id` | `TEXT` | ID de la categoría principal (contiene el peso de prioridad). |
| `sub_category_id` | `TEXT` | ID de la tipificación realizada por el asesor. |
| `customer_document` | `TEXT` | Documento de identidad del cliente. |
| `status` | `TEXT` | Estado: `waiting`, `calling`, `serving`, `completed`, `no-show`. |
| `created_at` | `BIGINT` | Timestamp de creación (emisión). |
| `called_at` | `BIGINT` | Timestamp de llamado a ventanilla. |
| `started_at` | `BIGINT` | Timestamp de inicio de atención. |
| `completed_at` | `BIGINT` | Timestamp de finalización o abandono. |
| `counter_id` | `INTEGER` | ID de la ventanilla que atendió el turno. |

### 1.2. Tabla: `users`
Gestiona el acceso y la segregación de funciones (RBAC).

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | UUID único del usuario. |
| `username` | `TEXT` (Unique) | Nombre de usuario para login (insensible a mayúsculas). |
| `password` | `TEXT` | Contraseña (texto plano para MVP, se recomienda hash en prod). |
| `role` | `TEXT` | Rol: `admin`, `advisor`, `kiosk`, `display`. |
| `name` | `TEXT` | Nombre descriptivo del usuario o punto de atención. |

## 2. Lógica de Priorización
El sistema implementa un algoritmo de selección basado en pesos configurables:
- **Prioridad Dinámica**: Cada categoría tiene un peso numérico (1-10).
- **Algoritmo de Selección**: El sistema ordena los turnos primero por prioridad (mayor peso primero) y luego por antigüedad (FIFO).
- **Configuración en Caliente**: Los administradores pueden ajustar las prioridades desde el panel de control sin reiniciar el sistema.

## 3. Integración con Grafana

Para garantizar la velocidad de la aplicación operativa, las visualizaciones y reportes se delegan a **Grafana**.

### 2.1. Configuración de Fuente de Datos
Grafana se conecta directamente a la base de datos PostgreSQL en modo **Solo Lectura (Read-Only)**.

### 2.2. Métricas Clave (Queries Sugeridas)
- **Tiempo Medio de Espera (TME)**: `AVG(called_at - created_at)` filtrado por `status = 'completed'`.
- **Tiempo Medio de Atención (TMA)**: `AVG(completed_at - started_at)`.
- **Volumen por Categoría**: `COUNT(*)` agrupado por `category_id`.
- **Tasa de Abandono**: `(COUNT(status = 'no-show') / COUNT(*)) * 100`.

## 3. Flujo de Sincronización
1. La aplicación realiza un **INSERT/UPDATE** en Postgres ante cada cambio de estado.
2. La aplicación **NO consulta** la tabla de tickets para su funcionamiento diario (usa estado local/memoria) para evitar latencias de red.
3. Grafana consulta la base de datos de forma independiente para generar dashboards de negocio.
