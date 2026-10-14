# LexDominio Ecuador 🇪🇨
### Sistema de Investigación y Preparación Jurídica en Prescripción Extraordinaria Adquisitiva de Dominio

**LexDominio Ecuador** es una aplicación web funcional, técnica y profesional diseñada para apoyar a abogadas y abogados ecuatorianos en el análisis procesal y sustantivo de juicios de **prescripción extraordinaria adquisitiva de dominio** sobre bienes inmuebles, de conformidad con el ordenamiento jurídico de la República del Ecuador.

---

## ⚖️ Declaración Deontológica y Alcance Profesional

> **ADVERTENCIA FUNDAMENTAL:**  
> Esta aplicación es una herramienta de apoyo profesional, organización técnica e investigación jurídica. **No reemplaza el criterio ni el patrocinio del profesional del derecho**, **no garantiza un resultado judicial favorable** y **no constituye asesoría jurídica definitiva**.  
> El sistema se rige **estrictamente por la normativa y jurisprudencia ecuatoriana** y no utiliza normas ni precedentes extranjeros para fundamentar sus dictámenes.

---

## 🏛️ Fuentes Jurídicas Oficiales y Comprobación Técnica

Durante el desarrollo de la aplicación se verificó el acceso a las fuentes primarias oficiales ecuatorianas:

| Fuente Oficial | Enlace Oficial Verificado | Estado de Acceso Técnico | Integración Efectiva |
| :--- | :--- | :--- | :--- |
| **Corte Constitucional del Ecuador** | [corteconstitucional.gob.ec](https://www.corteconstitucional.gob.ec/) | **HTTP 200 OK** | Enlace directo, precedentes vinculantes verificados (p. ej., Sentencia 1158-17-EP/21 sobre test de motivación). |
| **Buscador Externo de la Corte Constitucional** | [buscador.corteconstitucional.gob.ec](https://buscador.corteconstitucional.gob.ec/buscador-externo/principal) | **HTTP 200 OK** (Aplicación SPA Angular) | No dispone de API pública abierta sin sesión/tokens. Se implementó **asistente de consulta asistida con enlaces directos** y registro manual verificado. |
| **Corte Nacional de Justicia (CNJ)** | [cortenacional.gob.ec](https://www.cortenacional.gob.ec/) | **HTTP 200 OK** | Resoluciones canónicas de casación civil integradas en el corpus (Res. 076-2012, Res. 047-2015, Res. 182-2014, Res. 341-2017). |
| **Registro Oficial del Ecuador** | [registroficial.gob.ec](https://www.registroficial.gob.ec/) | **HTTP 200 OK** | Comprobación de textos vigentes del Código Civil (RO Supl. 46), COGEP (RO Supl. 506), COOTAD (RO Supl. 303) y Ley de Tierras Rurales (RO Supl. 711). |
| **Consejo de la Judicatura (SATJE)** | [procesosjudiciales.funcionjudicial.gob.ec](https://procesosjudiciales.funcionjudicial.gob.ec/) | **HTTP 200 OK** | Asistente de enlaces para verificación de causas previas e interrupción civil. |

### Integraciones Reales vs. Funciones con Acceso Manual Asistido
- **Corpus Jurídico Verificado Local:** Base de datos estructurada con el texto íntegro, fecha de publicación, órgano emisor, problema jurídico y regla aplicable de las disposiciones del Código Civil ecuatoriano y fallos de la CNJ/CC.
- **Buscadores Oficiales del Estado:** Los portales de la Corte Constitucional y la Función Judicial operan mediante interfaces dinámicas (SPA/Angular) y cortafuegos gubernamentales. En estricto cumplimiento de las reglas éticas y técnicas, **no se realiza scraping invasivo ni se simulan resultados falsos**. En su lugar, el sistema ofrece comprobación de disponibilidad en tiempo real (*healthcheck* de latencia), enlaces de búsqueda asistida y un formulario de ingreso manual para que el abogado agregue sentencias encontradas, las cuales quedan identificadas de forma transparente como:  
  `aportado por el usuario, pendiente de verificación`.

---

## 🔍 Niveles y Estados Visibles de Verificación

Toda cita jurídica exhibida en la aplicación cuenta con un distintivo explícito de confiabilidad:
- 🟢 **`verificado en fuente oficial`**: Texto legal o precedente contrastado con publicación en el Registro Oficial, Gaceta Judicial o repositorio oficial del órgano.
- 🟡 **`pendiente de verificación`**: Criterio en proceso de contrastación; no utilizable como fundamento concluyente.
- 🔴 **`sin acceso a fuente`**: La fuente remota se encuentra temporalmente caída o no accesible.
- 🟣 **`aportado por el usuario, pendiente de verificación`**: Cita añadida manualmente por el abogado en su sesión de trabajo.

---

## 🚀 Características Principales

### 1. Gestión de Expedientes y Selección de Rol
- Creación de expedientes con códigos locales (`EXP-AAAA-XXX`).
- Tres perspectivas de análisis diferenciadas:
  - **Parte Actora:** Enfocada en acreditar los cuatro presupuestos de casación (Cosa susceptible, Posesión con *animus domini*, 15 años continuos y Legítimo contradictor), teoría del caso y mitigación del riesgo de mera tenencia.
  - **Parte Demandada:** Desglose de excepciones de fondo (mera tenencia bajo Art. 730/734 C.C., interrupción natural o civil Art. 2403 C.C., imprescriptibilidad por bien público o municipal Art. 417 COOTAD) y excepciones previas (litisconsorcio pasivo necesario Art. 153 COGEP, falta de citación a herederos o individualización deficiente).
  - **Análisis Neutral:** Auditoría cualitativa ponderada de fortalezas, debilidades y hechos dirimentes decisivos (sin porcentajes matemáticos arbitrarios).

### 2. Formulario Guiado de Hechos
- Ubicación cantonal, parroquial y sector.
- Individualización rigurosa de linderos perimétricos (Norte, Sur, Este, Oeste), superficie en $m^2$ y clave catastral.
- Datos registrales (tomo, folio, número, gravámenes, titular de dominio inscrito).
- Posesión fáctica: fecha de ingreso, cómputo automático de años frente al umbral legal de 15 años, actos materiales concretos de señor y dueño (construcciones, cerramientos, servicios básicos EPMAPS/CNEL/agua), publicidad y pacificidad.
- Detección de riesgos de mera tenencia (arriendos, comodato, relaciones de trabajo agrario) e interrupciones.
- Verificación de presunta imprescriptibilidad (bienes nacionales de uso público, bienes municipales inalienables, tierras comunales, baldíos del Estado).

### 3. Asistente de Investigación en 9 Puntos Obligatorios
Estructura metodológica uniforme:
1. **Resumen breve del problema jurídico.**
2. **Hechos conocidos.**
3. **Hechos que faltan o deben corroborarse.**
4. **Normas verificadas** (artículo, texto y enlace oficial).
5. **Jurisprudencia verificada** (órgano, causa, regla y enlace).
6. **Análisis según el rol procesal seleccionado.**
7. **Argumentos contrarios y riesgos procesales.**
8. **Próximos pasos y diligencias probatorias recomendadas.**
9. **Alcance y fecha de corte de la investigación.**

### 4. Carga y Procesamiento Documental
- Admite formatos **PDF, DOCX, TXT e imágenes (PNG, JPG)**.
- **Preservación del original:** Los archivos originales se almacenan intactos en `data/uploads/` sin sobreescritura.
- Extracción de texto automatizada para análisis con conteo de palabras y estado de extracción visible.
- Matriz probatoria interactiva (pruebas documentales, periciales, testimoniales e inspección judicial bajo el Art. 228 del COGEP).
- Cronología de hitos de posesión y cuestionario técnico orientativo para testigos vecinales.

### 5. Generación de Informes y Exportación Profesional
- **Descarga en Microsoft Word (.DOCX nativo):** Generado mediante la biblioteca oficial `docx`, con diseño formal de estudio jurídico, tablas estilizadas, advertencias deontológicas e índice de fuentes.
- **Vista Imprimible / Guardar como PDF:** Plantilla limpia con reglas `@media print` para generar PDF oficial con un clic.
- **Opción de Anonimización de Datos:** Permite enmascarar con un solo clic los nombres de las partes y cédulas por etiquetas como `[PARTE PATROCINADA ANONIMIZADA]` para proteger el secreto profesional antes de compartir el informe.
- **Copia de Seguridad en JSON:** Exportación e importación integral de todos los expedientes para respaldo local.

---

## 🔒 Privacidad y Seguridad

- **Arquitectura Local-First:** Todos los expedientes y archivos se guardan localmente en la máquina del usuario en la carpeta `data/`.
- **Sin Transmisión a Terceros:** No se envían datos ni transcripciones a servidores externos o modelos de lenguaje en la nube sin consentimiento explícito del abogado.
- **Límites Técnicos Transparentes:** El almacenamiento se basa en el sistema de archivos local de la máquina de trabajo; no se prometen medidas de confidencialidad ajenas al control físico del dispositivo del usuario.

---

## 📂 Expedientes de Demostración Incluidos

El sistema incluye 2 expedientes de prueba no confidenciales claramente rotulados:
1. **`EXP-2026-ACT-001`**: `[DEMO-FICTICIO] Prescripción Lote El Sauce (Tumbaco, Quito)`  
   - Rol: **Parte Actora**
   - 18 años de posesión continua con cerramiento y vivienda propia sobre terreno con titular registral disuelto.
2. **`EXP-2026-DEM-002`**: `[DEMO-FICTICIO] Defensa Dominical Hacienda La Aurora (Daule, Guayas)`  
   - Rol: **Parte Demandada**
   - Caso con alegación de mera tenencia (ex guardián agrícola con acta de finiquito laboral previo) y falta de litisconsorcio pasivo con coherederos.

---

## 💻 Instalación y Ejecución Local

### Requisitos Previos
- **Node.js** v18 o superior (probado y certificado en Node.js v24 LTS).
- Sistema Operativo: Windows, macOS o Linux.

### Pasos de Instalación

1. **Abrir la terminal en el directorio del proyecto:**
   ```powershell
   cd "c:\Users\User\OneDrive\Desktop\proyecto 1"
   ```

2. **Verificar las dependencias:**
   ```powershell
   npm install
   ```

3. **Iniciar el servidor local:**
   ```powershell
   npm start
   ```
   O directamente:
   ```powershell
   node server.js
   ```

4. **Acceder a la aplicación:**
   Abra su navegador web en:
   ```
   http://localhost:3000
   ```

---

## 📁 Estructura del Proyecto

```
proyecto 1/
├── package.json               # Configuración del paquete y dependencias de Node.js
├── server.js                  # Servidor Express, motor analítico, API REST y generador DOCX
├── .env.example               # Variables de entorno y ajustes de privacidad
├── README.md                  # Documentación técnica y jurídica completa
├── data/
│   ├── legal_corpus.json      # Normas y jurisprudencia ecuatoriana verificada con URLs oficiales
│   ├── cases/                 # Expedientes guardados localmente en formato JSON
│   │   ├── exp-2026-act-001.json
│   │   └── exp-2026-dem-002.json
│   └── uploads/               # Archivos originales subidos por el abogado (PDF, DOCX, TXT)
└── public/
    ├── index.html             # Interfaz web responsiva en español
    ├── css/
    │   └── styles.css         # Estilos visuales de estudio jurídico profesional
    └── js/
        ├── app.js             # Coordinador de eventos y navegación
        ├── caseModule.js      # Formulario del caso, guardado automático y CRUD
        ├── analysisModule.js  # Motor de análisis por rol y estructura en 9 puntos
        ├── searchModule.js    # Búsqueda legal ecuatoriana y comprobación de portales
        ├── docModule.js       # Extracción de texto, pruebas, cronología y cuestionario
        └── exportModule.js    # Previsualización, anonimización y descarga DOCX
```

---

## 📋 Criterios de Aceptación Verificados

1. ✅ **Creación de expedientes y selección de rol:** Implementado para Parte Actora, Parte Demandada y Análisis Neutral.
2. ✅ **Formulario de hechos completos:** Campos para linderos, superficie, registro de la propiedad, cómputo de 15 años, actos de señor y dueño, naturaleza del inmueble y advertencias de imprescriptibilidad.
3. ✅ **Análisis diferenciado según rol:** Matrices procesales adaptadas y teoría del caso para actora o excepciones para demandada.
4. ✅ **Exactitud jurídica:** Citas con órgano, fecha, regla aplicable, fuente oficial y enlace directo.
5. ✅ **Sin invención de fallos:** Todas las normas y sentencias provienen del ordenamiento ecuatoriano verificado.
6. ✅ **Tolerancia a fallos:** Estados vacíos, avisos de falta de conexión y verificación de disponibilidad remota de portales oficiales.
7. ✅ **Revisión previa:** Cronología interactiva, matriz probatoria y cuestionario antes de exportar.
8. ✅ **Exportación profesional:** Generación de informe editable en Word (.DOCX) nativo e impresión PDF con fecha de corte y anonimización de nombres.
9. ✅ **Límites visibles:** Banner deontológico permanente que aclara que el software no reemplaza el criterio del abogado.
10. ✅ **Documentación exhaustiva:** README con especificaciones completas de fuentes, arquitectura y despliegue local.
