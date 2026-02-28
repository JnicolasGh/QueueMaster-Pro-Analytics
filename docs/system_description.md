# Descripción General del Sistema - QueueMaster Pro

## 1. Introducción
QueueMaster Pro es una aplicación web de gestión de colas diseñada para optimizar la atención al cliente en entornos físicos. El sistema organiza la llegada de clientes, facilita el llamado a ventanillas y recopila datos operativos para el análisis de desempeño.

## 2. Arquitectura del Sistema
El sistema sigue una arquitectura **Cliente-Servidor** moderna y desacoplada:

### 2.1. Frontend (SPA)
Desarrollado con **React 18** y **Vite**, el frontend es una aplicación de página única (SPA) que gestiona el estado local para ofrecer una experiencia de usuario fluida y sin recargas de página. Utiliza **Tailwind CSS** para un diseño responsivo y **Framer Motion** para animaciones suaves.

### 2.2. Backend (API)
El servidor está construido sobre **Node.js** utilizando el framework **Express**. Actúa como una capa de servicios REST que gestiona la autenticación de usuarios, la lógica de negocio de los turnos y la persistencia de datos.

### 2.3. Base de Datos (PostgreSQL)
Se utiliza **PostgreSQL** como motor de base de datos relacional. El sistema está configurado para escribir cada evento de turno (creación, llamado, inicio, fin) de forma persistente, permitiendo auditorías y análisis de datos externos.

## 3. Módulos y Flujo de Trabajo

### 3.1. Emisión de Turnos (Kiosco)
El cliente inicia el proceso ingresando su documento de identidad y seleccionando el trámite deseado. El sistema genera un ticket único y lo registra en la base de datos.

### 3.2. Llamado y Atención (Asesor)
El asesor, desde su panel de ventanilla, solicita el siguiente turno disponible. El sistema utiliza un **motor de priorización dinámica** que selecciona el turno con mayor peso (configurado por el administrador) y mayor tiempo de espera. El asesor gestiona el ciclo de vida del turno (Llamar -> Iniciar -> Finalizar/No se presentó) y tipifica la atención con subcategorías preconfiguradas.

### 3.3. Visualización Pública (TV Display)
Una pantalla de gran formato muestra el turno que está siendo llamado y la ventanilla a la que debe dirigirse el cliente, acompañada de alertas visuales para captar la atención.

### 3.4. Administración y Seguridad
El administrador gestiona los usuarios, define las categorías, sus **pesos de prioridad** y subcategorías. El sistema cuenta con un modelo de login robusto que incluye validación insensible a mayúsculas y una interfaz de error optimizada para la productividad (pop-ups con auto-focus).

## 4. Integración de Analítica (Grafana)
El sistema está diseñado para ser monitoreado externamente. Al escribir todos los eventos en PostgreSQL, se facilita la creación de dashboards en **Grafana** para visualizar KPIs como el Tiempo Medio de Espera (TME) y el Tiempo Medio de Atención (TMA) sin afectar el rendimiento de la aplicación operativa.
