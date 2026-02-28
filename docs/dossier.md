# Dossier - QueueMaster Pro

## 1. Nombre del Proyecto
**QueueMaster Pro** - Sistema de Gestión de Turnos y Atención al Cliente.

## 2. Problema a Resolver
Las empresas con atención presencial enfrentan ineficiencias en el flujo de clientes, tiempos de espera no medidos y falta de datos para la toma de decisiones operativas.

## 3. Solución Propuesta
Una plataforma digital modular que organiza la llegada de clientes, notifica los turnos en pantallas públicas y permite a los asesores gestionar la atención de forma ágil, centralizando los datos en una base de datos PostgreSQL para auditoría y analítica externa (Grafana).

## 4. Diferenciadores Clave
- **Segregación de Funciones (RBAC)**: Roles específicos para Kiosco, Pantallas, Asesores y Administradores.
- **Arquitectura de Alta Velocidad**: Manejo de estado local en la UI para respuesta instantánea, con persistencia asíncrona en base de datos.
- **Diseño Moderno y Adaptable**: Interfaz intuitiva basada en React y Tailwind CSS, optimizada para pantallas táctiles y monitores de gran formato.
- **Analítica Desacoplada**: Uso de Grafana para visualizaciones avanzadas, manteniendo la aplicación operativa ligera y eficiente.

## 5. Módulos del Sistema
- **Kiosco de Autoservicio**: Emisión de turnos con identificación de cliente.
- **Monitor de Llamado (TV)**: Visualización de turnos activos con alertas visuales.
- **Panel de Ventanilla (Asesor)**: Gestión del flujo de atención (Llamar, Iniciar, Finalizar, Tipificar).
- **Panel Administrativo**: Configuración de categorías, ventanillas y gestión de usuarios.

## 6. Stack Tecnológico
- **Frontend**: React 18+, Vite, Tailwind CSS, Framer Motion.
- **Backend**: Node.js, Express.
- **Base de Datos**: PostgreSQL.
- **Visualización**: Grafana.
