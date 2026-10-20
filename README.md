# Datos solares y lunares de Reconquista

Aplicación web experimental para recopilar, organizar, consultar y exportar datos diarios del Sol y la Luna correspondientes a **Reconquista, Santa Fe, Argentina**.

El proyecto no realiza por sí mismo los cálculos astronómicos de salida, puesta o tránsito. Esos datos se obtienen del **Astronomical Applications Department del U.S. Naval Observatory (USNO)** y luego la aplicación los organiza, almacena y presenta de una forma más cómoda para consultar un mes o un año completo.

## Qué permite hacer

- Seleccionar un año entre **1700 y 2100**.
- Consultar los datos separados por mes.
- Recopilar automáticamente los datos de todos los días del año.
- Ver el inicio y el final del crepúsculo civil.
- Consultar la salida, el tránsito y la puesta del Sol.
- Consultar la salida y la puesta de la Luna.
- Ver la fase lunar y el porcentaje de iluminación.
- Calcular la duración del día a partir de la salida y la puesta del Sol.
- Calcular la duración aproximada de la luz visible a partir del crepúsculo civil.
- Elegir qué columnas mostrar en la tabla.
- Exportar un mes a Excel.
- Exportar el año completo a un archivo Excel con una hoja por mes.
- Guardar los datos localmente en una base SQLite.

## Fuente de los datos

La aplicación consulta la herramienta de datos diarios del U.S. Naval Observatory:

https://aa.usno.navy.mil/calculated/rstt/oneday

Para este proyecto se utilizan los siguientes datos de ubicación:

- Lugar: **Reconquista, Santa Fe, Argentina**
- Latitud: **-29.15**
- Longitud: **-59.65**
- Zona horaria configurada: **UTC-3**
- Horario de verano: desactivado

El servidor consulta la página del USNO para cada fecha, extrae los datos disponibles y los guarda en SQLite.

Por ese motivo, si el USNO cambia la estructura de la página que devuelve los resultados, el mecanismo de extracción puede necesitar una actualización.

## Demostración rápida

Un recorrido típico es el siguiente:

1. Elegir, por ejemplo, **2026** en el selector de año.
2. Pulsar **Iniciar Recopilación 2026**.
3. La aplicación consulta y guarda los datos diarios del año.
4. Elegir un mes para consultar sus registros.
5. Personalizar las columnas que se quieren mostrar.
6. Pulsar **Exportar Mes** para obtener solamente el mes visible, o **Exportar Año** para generar un libro de Excel con todos los meses disponibles.

Ejemplo de la información que puede aparecer para cada día:

```text
Día | Amanecer | Mediodía solar | Atardecer | Duración del día | Salida de la Luna | Puesta de la Luna | Fase lunar
```

La interfaz está pensada para mostrar esta información como una tabla navegable y permitir su exportación sin tener que consultar manualmente cada fecha en el sitio del USNO.

## Tecnologías utilizadas

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Lucide React

### Backend

- Node.js
- Express
- Cheerio, para extraer los datos de las respuestas HTML
- better-sqlite3, para almacenar los registros localmente

### Exportación

- SheetJS / XLSX

## Cómo instalarlo y ejecutarlo

### Requisitos

- Node.js
- npm

### Instalación

Clonar el repositorio:

```bash
git clone https://github.com/imparable2022/obtener-datos-de-salida-y-puesta-de-sol-y-luna-para-un-a-o.git
```

Entrar a la carpeta:

```bash
cd obtener-datos-de-salida-y-puesta-de-sol-y-luna-para-un-a-o
```

Instalar las dependencias:

```bash
npm install
```

Iniciar la aplicación:

```bash
npm run dev
```

Después se puede abrir en el navegador:

```text
http://localhost:3000
```

La funcionalidad actual de consulta solar y lunar **no necesita una clave de Gemini**.

## Base de datos

Al iniciar el servidor se crea, si todavía no existe, el archivo:

```text
solar_moon_data.db
```

La tabla principal se llama `daily_data` y guarda un registro por fecha.

Esto permite evitar repetir consultas para fechas que ya fueron recopiladas.

## Accesibilidad

El proyecto está incorporando mejoras para que la interfaz pueda utilizarse también con teclado y tecnologías de asistencia.

Entre las mejoras aplicadas al código se encuentran:

- etiquetas asociadas a los selectores de año y mes;
- nombres accesibles para botones que visualmente utilizan iconos;
- información de progreso expuesta como estado;
- tabla con descripción y encabezados semánticos;
- encabezados de fila para identificar cada día;
- diálogos identificados semánticamente;
- etiquetas asociadas a los campos de edición;
- elementos puramente visuales ocultos a las tecnologías de asistencia cuando la misma información ya está disponible como texto.

Estas mejoras se realizaron mediante revisión del código. **Todavía corresponde realizar una prueba completa con NVDA y otros lectores de pantalla antes de afirmar compatibilidad total.**

## Estado del proyecto

Este repositorio es un **proyecto experimental y educativo**.

Su objetivo es explorar una forma práctica de recopilar, almacenar, consultar y exportar datos astronómicos públicos para una ubicación concreta.

No pretende reemplazar al U.S. Naval Observatory ni presentarse como una fuente astronómica oficial. Para usos donde la precisión sea crítica, se debe consultar la fuente oficial.

La aplicación tampoco está preparada actualmente para exponerse como servicio público multiusuario: las funciones de administración de la base de datos no incluyen autenticación.

## Posibles mejoras

- Permitir elegir otras ciudades o introducir coordenadas.
- Añadir pruebas automatizadas del proceso de extracción.
- Continuar las pruebas de accesibilidad con lectores de pantalla.
- Mejorar el manejo de errores si la fuente externa no responde.
- Validar de forma más estricta los datos antes de guardarlos.
- Separar las funciones de administración de la interfaz de consulta.
- Incorporar autenticación si en el futuro se publica con funciones de escritura.

## Autor

Proyecto publicado por [imparable2022](https://github.com/imparable2022).

Los datos astronómicos consultados pertenecen a sus respectivas fuentes. La aplicación se limita a recopilarlos, organizarlos y facilitar su consulta y exportación.
