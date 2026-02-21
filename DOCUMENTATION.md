# QueueMaster Pro: Sistema de Gestión de Turnos MVP

## 1. Definición del Alcance (Implementación MVP)

### Objetivo
Entregar una plataforma funcional de gestión de turnos (Queue Management System) que:
- Simule un entorno real de atención al cliente con múltiples vistas (Kiosco, Asesor, TV).
- Implemente una arquitectura de datos persistente en PostgreSQL.
- Proporcione analíticas operativas basadas en datos históricos sintéticos.
- Permita la tipificación y sub-tipificación de trámites en tiempo real.

## 2. Alcance Funcional

### 2.1 Canales de Entrada
- **Kiosco Físico (Simulado):** Interfaz táctil para toma de turnos con ingreso de documento de identidad.
- **Generador de Datos:** Motor de generación masiva de historial (6 meses) para pruebas de carga y analítica.

### 2.2 Ingestión y Flujo
- Registro de turnos vía REST API.
- Validación de documentos de identidad (8 dígitos aleatorios en sintéticos).
- Asignación determinística de prefijos por categoría (S, P, C, A).

### 2.3 Capas de Datos
- **Raw (Memoria/LocalStorage):** Estado inmediato para baja latencia en la UI.
- **Gold (PostgreSQL):** Tablas relacionales finales para persistencia y auditoría.
- **Sync Layer:** Sincronización en bloque (Bulk) para datos históricos.

### 2.4 Simulación de Operación
- Generación de picos de tráfico (mañana/tarde).
- Simulación de tiempos de espera (5-45 min) y atención (3-20 min).
- Tasa de abandono (No-show) configurable (~10%).

### 2.5 Gobernanza y Modelo
- Seguimiento de estados: `waiting`, `calling`, `serving`, `completed`, `no-show`.
- Trazabilidad de tiempos: `created_at`, `called_at`, `started_at`, `completed_at`.
- Identificación de ventanillas/asesores.

### 2.6 Modelo Operativo de Turnos
- **Categorías:** Servicio al Cliente, Preferencial, Caja, Asesoría.
- **Sub-tipificación:** Clasificación detallada del trámite durante la atención.
- **Cálculo de SLA:** Monitoreo de tiempos promedio de espera y servicio.

### 2.7 Tableros (Dashboards)
- **Vista Ejecutiva (Analytics):** Gráficos de volumen, tiempos y distribución por categoría.
- **Vista Operativa (TV):** Llamado de turnos en tiempo real con alertas visuales.
- **Panel de Control (Admin):** Configuración de ventanillas, categorías y base de datos.

## 3. Alcance Técnico

### Servicios Contenedores
- **Frontend:** React 18 + Vite (SPA).
- **Backend:** Node.js + Express (API REST).
- **Base de Datos:** PostgreSQL 16 (Dockerizado).
- **Estilización:** Tailwind CSS + Framer Motion (Animaciones).
- **Visualización:** Recharts (Gráficos dinámicos).

## 4. Fuera del Alcance (MVP)
- Integración con impresoras térmicas físicas.
- Autenticación avanzada (OAuth/RBAC) por asesor.
- Soporte multi-sucursal/Sede.
- Aplicación móvil nativa.
- Gestión de colas virtuales por WhatsApp/SMS.

## 5. Definición de "Hecho" (Definition of Done)
- El Kiosco genera turnos y los registra en Postgres.
- La vista de TV se actualiza instantáneamente al llamar un turno.
- El Asesor puede iniciar, tipificar y finalizar una atención.
- El Dashboard de Analytics muestra KPIs basados en los 6 meses de datos generados.
- La base de datos PostgreSQL mantiene la integridad de los registros tras reiniciar el servidor.

## 6. Restricciones de Tiempo
- Foco en la simplicidad de la interfaz (UX limpia).
- Prioridad a la reproducibilidad del entorno mediante Docker.
- Valor educativo sobre la trazabilidad del dato desde el Kiosco hasta la DB.

## 7. Consideraciones de Riesgo
- Latencia en la conexión remota a PostgreSQL.
- Desincronización de estado entre pestañas (Mitigado con polling/refresh).
- Configuración de SSL en bases de datos cloud.
