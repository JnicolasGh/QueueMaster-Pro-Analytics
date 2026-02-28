# Alcance de la Arquitectura - QueueMaster Pro

## 1. Resumen del Sistema
QueueMaster Pro es una solución integral de gestión de turnos diseñada para optimizar el flujo de atención al cliente. El sistema permite la emisión de turnos, visualización en pantallas públicas, gestión por parte de asesores y administración centralizada.

## 2. Objetivos de la Arquitectura
- **Segregación de Funciones**: Control de acceso basado en roles (RBAC) para Kiosco, Pantallas, Asesores y Administradores.
- **Persistencia Híbrida**: Uso de estado local para máxima velocidad de respuesta en la interfaz y escritura asíncrona en PostgreSQL para auditoría y persistencia a largo plazo.
- **Escalabilidad**: Arquitectura desacoplada que permite separar el frontend del backend si es necesario.
- **Simplicidad de Despliegue**: Contenerización mediante Docker y configuración dinámica de base de datos.

## 3. Stack Tecnológico
- **Frontend**: React 18+, Vite, Tailwind CSS (Styling), Framer Motion (Animaciones).
- **Backend**: Node.js, Express Framework.
- **Base de Datos**: PostgreSQL 16 (Relacional).
- **Comunicación**: REST API (JSON).
- **Seguridad**: Autenticación por credenciales y validación de roles en el servidor.

## 4. Roles y Funcionalidades
- **Kiosco**: Interfaz simplificada para que el cliente ingrese su documento y seleccione el trámite.
- **Pantalla (TV)**: Interfaz de visualización masiva que anuncia los turnos llamados mediante alertas visuales y sonoras.
- **Asesor (Ventanilla)**: Panel operativo para llamar, iniciar y finalizar la atención, incluyendo la tipificación (subcategorías).
- **Administrador**: Gestión de usuarios, configuración de categorías/ventanillas y mantenimiento de la conexión a la base de datos.

## 5. Estrategia de Datos
Para garantizar la velocidad solicitada, la aplicación opera bajo el principio de "Escritura Directa, Lectura Local":
- Las mutaciones de estado se reflejan instantáneamente en la UI.
- Los cambios se envían al backend de forma persistente.
- El módulo de visualización de reportes pesados se delega a herramientas externas o procesos fuera del flujo crítico de atención.
