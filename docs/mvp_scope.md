# Alcance - MVP (Actual)

## 1. Funcionalidades Incluidas

### 1.1. Gestión de Identidad y Acceso
- Sistema de Login con autenticación basada en base de datos.
- Cuatro roles definidos: `admin`, `advisor`, `kiosk`, `display`.
- **Experiencia de Usuario Mejorada**: Mensajes de error en pop-up con auto-limpieza de campos y auto-focus para reintento rápido.
- Persistencia de sesión en el navegador.

### 1.2. Módulo de Kiosco
- Ingreso de documento de identidad del cliente.
- Selección de categoría de trámite.
- Generación de ticket con ID amigable (Prefijo + Número).
- **Priorización Dinámica**: Los turnos se registran con la prioridad configurada en su categoría.
- Registro automático en PostgreSQL (`created_at`).

### 1.3. Módulo de Pantalla (TV)
- Visualización del turno actual llamado y la ventanilla correspondiente.
- Historial de los últimos 5 llamados.
- Barra de noticias/mensajes en la parte inferior.
- Actualización en tiempo real de los llamados.

### 1.4. Módulo de Asesor (Ventanilla)
- Selección de ventanilla de atención.
- **Llamado Inteligente**: El sistema selecciona el siguiente turno basándose en el peso de prioridad (1-10) y el tiempo de espera.
- Control de estados: Iniciar Atención, Finalizar Atención, Marcar como "No se presentó".
- Tipificación de la atención mediante subcategorías (restauración automática de valores base).

### 1.5. Módulo Administrativo
- Gestión de Usuarios (Crear/Eliminar).
- Configuración de Categorías, Subcategorías y **Pesos de Prioridad**.
- Configuración de conexión a PostgreSQL.
- Herramientas de mantenimiento (Limpiar historial, Generar datos de prueba).

## 2. Exclusiones (Fuera de Alcance MVP)
- **Analítica Interna**: Las gráficas y reportes se manejan externamente vía Grafana.
- **Notificaciones SMS/Email**: El cliente solo recibe el turno visualmente en el kiosco.
- **Multisede**: El sistema está diseñado para una única ubicación física por instancia.

## 3. Requerimientos Técnicos Actuales
- Navegador moderno (Chrome, Edge, Safari).
- Servidor Node.js activo.
- Instancia de PostgreSQL accesible.
