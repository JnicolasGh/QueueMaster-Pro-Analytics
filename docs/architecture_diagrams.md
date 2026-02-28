# Diagramas de Arquitectura - QueueMaster Pro

## 1. Diagrama de Arquitectura de Alto Nivel (Flujo de Datos)

```mermaid
graph TD
    subgraph Clientes
        K[Kiosco - Emisión]
        D[Display - Pantalla TV]
        A[Asesor - Ventanilla]
        AD[Admin - Configuración]
    end

    subgraph Servidor_Aplicacion [Servidor Node.js / Express]
        API[API REST Endpoints]
        Auth[Módulo de Autenticación]
        Vite[Vite Dev Server / Static Assets]
    end

    subgraph Persistencia
        DB[(PostgreSQL)]
        LS[(Local Storage - Cache)]
    end

    %% Flujos
    K -->|POST /api/tickets| API
    D -->|GET /api/tickets| API
    A -->|PUT /api/tickets/:id| API
    AD -->|POST /api/users| API
    
    API --> Auth
    Auth --> DB
    API --> DB
    
    Clientes <-->|Estado UI| LS
```

## 2. Diagrama de Contenedores (C4 Model - Nivel 2)

```mermaid
C4Container
    title Diagrama de Contenedores para QueueMaster Pro

    Person(customer, "Cliente", "Persona que solicita un turno en el Kiosco.")
    Person(advisor, "Asesor", "Funcionario que atiende los turnos.")
    Person(admin, "Administrador", "Gestiona la configuración del sistema.")

    System_Boundary(c1, "Sistema QueueMaster") {
        Container(spa, "Single Page Application", "React, Vite, Tailwind", "Provee la interfaz de usuario para todos los roles. Gestiona el estado local para velocidad.")
        Container(api, "API Application", "Node.js, Express", "Maneja la lógica de negocio, autenticación y persistencia de tickets/usuarios.")
        ContainerDb(db, "Base de Datos", "PostgreSQL", "Almacena permanentemente tickets, usuarios y configuraciones.")
    }

    System_Ext(external_analytics, "Herramientas Externas", "BI / Excel", "Consultan la DB directamente para reportes avanzados.")

    Rel(customer, spa, "Usa", "HTTPS")
    Rel(advisor, spa, "Usa", "HTTPS")
    Rel(admin, spa, "Usa", "HTTPS")

    Rel(spa, api, "Llamadas API", "JSON/HTTPS")
    Rel(api, db, "Lee/Escribe", "SQL/TCP")
    
    Rel(external_analytics, db, "Consulta datos", "SQL/TCP")
```

## 3. Segregación de Contenedores por Rol

| Contenedor | Rol Acceso | Responsabilidad Principal |
| :--- | :--- | :--- |
| **Kiosk Container** | `kiosk` | Captura de ID y selección de categoría. |
| **Display Container** | `display` | Notificación visual y auditiva de turnos. |
| **Advisor Container** | `advisor` | Gestión del ciclo de vida del turno (Llamar -> Atender -> Cerrar). |
| **Admin Container** | `admin` | CRUD de usuarios y parámetros del sistema. |
