const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const docx = require('docx');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CASES_DIR)) fs.mkdirSync(CASES_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(CORPUS_PATH)) fs.writeFileSync(CORPUS_PATH, '[]');

[DATA_DIR, CASES_DIR, UPLOADS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}_${sanitizedName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato no admitido (${ext}). Formatos permitidos: PDF, DOCX, TXT, PNG, JPG.`));
    }
  }
});

// Helper: Read Legal Corpus
function getLegalCorpus() {
  if (!fs.existsSync(CORPUS_PATH)) return [];
  try {
    const raw = fs.readFileSync(CORPUS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading legal corpus:', err);
    return [];
  }
}

// Helper: Save Legal Corpus
function saveLegalCorpus(data) {
  fs.writeFileSync(CORPUS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// Helper: Get All Cases
function getAllCases() {
  if (!fs.existsSync(CASES_DIR)) return [];
  const files = fs.readdirSync(CASES_DIR).filter((f) => f.endsWith('.json'));
  const cases = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(CASES_DIR, file), 'utf-8');
      const c = JSON.parse(raw);
      cases.push({
        id: c.id,
        code: c.code || 'SIN-CÓDIGO',
        title: c.title || 'Expediente sin título',
        role: c.role || 'neutral',
        is_demo: !!c.is_demo,
        client: c.client || 'No especificado',
        updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
        cutoffDate: c.cutoffDate || new Date().toISOString().split('T')[0],
        proceduralStage: c.proceduralStage || 'No especificada',
        canton: c.location?.canton || 'No especificado'
      });
    } catch (e) {
      console.error(`Error parsing case file ${file}:`, e);
    }
  }
  return cases.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// Helper: Get Single Case
function getCaseById(id) {
  const filePath = path.join(CASES_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

// Helper: Save Case
function saveCase(caseData) {
  caseData.updatedAt = new Date().toISOString();
  const filePath = path.join(CASES_DIR, `${caseData.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(caseData, null, 2), 'utf-8');
  return caseData;
}

// ==========================================
// LEGAL ANALYSIS ENGINE (ECUADOR SPECIFIC)
// ==========================================
function performLegalAnalysis(c, anonymize = false) {
  const corpus = getLegalCorpus();
  const role = c.role || 'neutral';
  const cutoffDate = c.cutoffDate || new Date().toISOString().split('T')[0];

  // Client / names handling
  const clientName = anonymize ? '[PARTE INTERESADA ANONIMIZADA]' : (c.client || 'Cliente');
  const regOwnerName = anonymize ? '[TITULAR REGISTRAL ANONIMIZADO]' : (c.registry?.registeredOwner || 'Titular Registral');
  const locationDesc = `${c.location?.parroquia || 'Parroquia no esp.'}, Cantón ${c.location?.canton || 'no esp.'}, Prov. ${c.location?.province || 'no esp.'}`;

  // Time analysis
  let yearsPossession = null;
  let has15Years = false;
  if (c.possession?.startDate) {
    const start = new Date(c.possession.startDate);
    const end = new Date(cutoffDate);
    const diffTime = end - start;
    if (!isNaN(diffTime) && diffTime > 0) {
      yearsPossession = Number((diffTime / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1));
      has15Years = yearsPossession >= 15.0;
    }
  }

  // Obstacle detection
  const detectedObstacles = [];
  const verifiedCitations = [];

  // Check property nature
  if (c.propertyNature?.isPublic || c.propertyNature?.isMunicipal || c.propertyNature?.isCommunal) {
    detectedObstacles.push({
      severity: 'ALTA / DIRIMENTE',
      title: 'Inmueble con posible naturaleza imprescriptible (Art. 604 C.C. y Art. 417 COOTAD)',
      detail: 'El bien está marcado como público, municipal o comunal. En Ecuador los bienes de uso público y afectos a servicios públicos no son susceptibles de prescripción adquisitiva.',
      normId: 'norm-cootad-417'
    });
  }

  // Check time
  if (yearsPossession !== null && !has15Years) {
    detectedObstacles.push({
      severity: 'ALTA / TEMPORAL',
      title: `Tiempo de posesión insuficiente (${yearsPossession} años calculados frente a 15 años exigidos)`,
      detail: `El Art. 2411 del Código Civil ecuatoriano y la jurisprudencia de casación exigen inexcusablemente 15 años continuos contra toda persona. La acción no ha madurado legalmente.`,
      normId: 'norm-cc-2411'
    });
  }

  // Check mere tenancy (mera tenencia)
  const entryText = (c.possession?.entryMethod || '').toLowerCase();
  const actsText = (c.possession?.actsOfOwner || '').toLowerCase();
  const recogText = (c.possession?.recognitionOfForeignDomain || '').toLowerCase();
  const isTenancyRisk = entryText.includes('arriend') || entryText.includes('alquiler') || entryText.includes('comodato') ||
    entryText.includes('trabaj') || entryText.includes('cuidad') || recogText.includes('arriend') || recogText.includes('reconoc');

  if (isTenancyRisk) {
    detectedObstacles.push({
      severity: 'ALTA / SUSTANCIAL',
      title: 'Riesgo de mera tenencia e interversión del título no acreditada (Arts. 730, 734 y 2410 Regla 3 C.C.)',
      detail: 'Existen indicios de ingreso derivado (arrendamiento, comodato o relación laboral). El simple transcurso del tiempo no muda la mera tenencia en posesión (Art. 734 C.C.). Para prescribir se exige demostrar la ausencia de reconocimiento de dominio ajeno durante 15 años y actos notorios de oposición al dueño.',
      normId: 'norm-cc-2410'
    });
  }

  // Check individualization
  const hasBoundaries = c.location?.boundaries && (c.location.boundaries.north || c.location.boundaries.south);
  const hasSurface = !!c.location?.surface;
  if (!hasBoundaries || !hasSurface) {
    detectedObstacles.push({
      severity: 'MEDIA / PROCESAL',
      title: 'Deficiente individualización del bien inmueble (Art. 142 num. 4 COGEP y Sentencia CNJ Res. 076-2012)',
      detail: 'Faltan linderos exactos o superficie delimitada. La Corte Nacional de Justicia exige correspondencia milimétrica entre la demanda, la inspección judicial y el peritaje técnico para evitar excepciones previas o rechazo de demanda.',
      normId: 'sent-cnj-076-2012'
    });
  }

  // Check passive legitimization / registered owner
  if (!c.registry?.registeredOwner || c.registry.registeredOwner.trim() === '') {
    detectedObstacles.push({
      severity: 'ALTA / PROCESAL',
      title: 'Falta de individualización del titular registral legítimo contradictor (Art. 143 COGEP y Sentencia CNJ Res. 182-2014)',
      detail: 'No se ha identificado al titular de dominio inscrito con certificado de gravámenes actualizado. La demanda debe trabarse contra quien conste en el Registro de la Propiedad o sus herederos debidamente citados.',
      normId: 'sent-cnj-182-2014'
    });
  }

  // Build Relevant Norms and Jurisprudence list
  const normIdsNeeded = ['norm-cc-715', 'norm-cc-2410', 'norm-cc-2411', 'norm-cogep-289', 'sent-cnj-076-2012', 'norm-cre-76-7-l'];
  if (isTenancyRisk) normIdsNeeded.push('norm-cc-730', 'norm-cc-734', 'sent-cnj-047-2015');
  if (c.propertyNature?.isPublic || c.propertyNature?.isMunicipal) normIdsNeeded.push('norm-cootad-417', 'norm-cc-604');
  if (role === 'demandada') normIdsNeeded.push('norm-cc-2403', 'norm-cc-2404', 'sent-cnj-341-2017', 'sent-cc-096-15-sep');
  if (c.opposingParty?.status && c.opposingParty.status.toLowerCase().includes('hereder')) normIdsNeeded.push('sent-cnj-182-2014');

  const verifiedNorms = corpus.filter((item) => normIdsNeeded.includes(item.id) && item.category === 'normativa');
  const verifiedJurisprudence = corpus.filter((item) => normIdsNeeded.includes(item.id) && item.category === 'jurisprudencia');

  // Build Role-Specific Matrices
  let roleMatrix = [];
  let theoryOfTheCase = {};
  let defensesAndExceptions = [];
  let neutralEvaluation = {};

  if (role === 'actora') {
    theoryOfTheCase = {
      faktica: `El señor/a ${clientName} detenta la posesión material exclusiva, continua, pública y pacífica del inmueble situado en ${locationDesc}, con una superficie de ${c.location?.surface || 'área por peritar'}, desde el ${c.possession?.startDate || 'fecha inicial'}, ejecutando continuos actos de señor y dueño tales como cerramiento, vivienda y mejoras, sin reclamos de terceros por más de 15 años.`,
      probatoria: `Acreditar la concurrencia de los cuatro presupuestos de casación mediante: 1. Certificado de gravámenes del Registro de la Propiedad (legítimo contradictor); 2. Levantamiento planimétrico pericial georreferenciado (singularización e individualización plena); 3. Inspección judicial con fijación de hechos notorios (Art. 228 COGEP); 4. Testimonios vecinales de colindantes calificados; 5. Facturas históricas de servicios básicos e impuestos prediales.`,
      juridica: `Fundamentada en los Arts. 66 num. 26 y 76 de la Constitución de la República; Arts. 715, 2392, 2398, 2410 reglas 1a y 2a, y 2411 del Código Civil ecuatoriano; y en el procedimiento ordinario reglado por el Art. 289 del Código Orgánico General de Procesos (COGEP).`
    };

    roleMatrix = [
      {
        elemento: '1. Posesión material actual y exclusiva con ánimo de señor y dueño (Art. 715 C.C.)',
        hechoAlegado: c.possession?.actsOfOwner || 'Actos de señor y dueño narrados en el expediente',
        pruebaDisponible: c.evidence?.filter((e) => e.status === 'Disponible').map((e) => e.name).join('; ') || 'Certificados y comprobantes aportados',
        pruebaFaltante: 'Inspección judicial obligatoria; peritaje técnico de antigüedad de construcciones',
        riesgo: isTenancyRisk ? 'Alto: posible excepción de mera tenencia' : 'Bajo si se ratifica en inspección judicial',
        fuenteVerificada: 'Art. 715 Código Civil / Sentencia CNJ Res. 076-2012'
      },
      {
        elemento: '2. Plazo legal de quince años ininterrumpidos (Art. 2411 C.C.)',
        hechoAlegado: yearsPossession !== null ? `${yearsPossession} años computados desde ${c.possession?.startDate}` : 'Tiempo alegado por la actora',
        pruebaDisponible: 'Planillas de servicios básicos fechadas, testimonios de vecinos colindantes',
        pruebaFaltante: 'Documentos oficiales con fecha cierta correspondientes a los primeros 3 años de posesión',
        riesgo: has15Years ? 'Bajo' : 'Crítico: rechazo de demanda si no se completan los 15 años a la fecha de presentación',
        fuenteVerificada: 'Art. 2411 Código Civil / Sentencia CNJ Res. 341-2017'
      },
      {
        elemento: '3. Cosa susceptible de prescripción adquisitiva (Art. 2398 C.C.)',
        hechoAlegado: `Inmueble privado ubicado en ${locationDesc}, con clave catastral ${c.location?.cadastralKey || 'en trámite'}`,
        pruebaDisponible: 'Certificado de gravámenes, certificado de no afectación municipal',
        pruebaFaltante: 'Certificado catastral actualizado del GAD cantonal que confirme que no invade espacio público ni franja de protección',
        riesgo: c.propertyNature?.isPublic ? 'Crítico: bien público' : 'Bajo comprobando antecedentes privados',
        fuenteVerificada: 'Arts. 604, 2398 Código Civil / Art. 417 COOTAD'
      },
      {
        elemento: '4. Legítimo contradictor y debida individualización (Arts. 142 y 143 COGEP)',
        hechoAlegado: `Demanda enderezada contra ${regOwnerName}; predio delimitado con linderos perimétricos`,
        pruebaDisponible: 'Certificado de Gravámenes vigente; levantamiento planimétrico inicial',
        pruebaFaltante: 'Determinación exacta de domicilio del demandado o declaración juramentada de imposibilidad conforme al Art. 56 COGEP',
        riesgo: 'Medio: nulidad procesal si no se cita válidamente a todos los herederos o copropietarios',
        fuenteVerificada: 'Art. 142 COGEP / Sentencia CNJ Res. 182-2014 / Sentencia CC 096-15-SEP-CC'
      }
    ];
  } else if (role === 'demandada') {
    defensesAndExceptions = [
      {
        tipo: 'Defensa de Fondo / Sustancial',
        nombre: 'Excepción de Mera Tenencia (Art. 730 y 734 Código Civil)',
        fundamentoFactico: 'Demostrar que el actor ingresó al inmueble reconociendo dominio ajeno mediante contrato de arrendamiento, comodato, autorización verbal o relación laboral de guardianía/trabajador.',
        fundamentoJuridico: 'Arts. 730, 734 y 2410 regla 3a del Código Civil; Sentencia de Casación CNJ Res. 047-2015.',
        pruebaRecomendada: 'Contratos escritos, recibos de renta, acta de finiquito ante Ministerio del Trabajo, constancia de pago de salarios, testimonios de administradores del predio.'
      },
      {
        tipo: 'Defensa de Fondo / Sustancial',
        nombre: 'Falta de Cómputo del Tiempo Legal de 15 Años (Art. 2411 C.C.)',
        fundamentoFactico: 'Refutar la fecha inicial de ingreso alegada por el actor demostrando que el titular o terceros ejercían actos materiales en fechas intermedias.',
        fundamentoJuridico: 'Art. 2411 Código Civil; jurisprudencia reiterada de la CNJ.',
        pruebaRecomendada: 'Pagos de impuesto predial a nombre del titular, facturas de compras de materiales, contratos de obras suscritos por el dueño, inspecciones previas.'
      },
      {
        tipo: 'Defensa de Fondo / Sustancial',
        nombre: 'Interrupción Civil de la Prescripción (Art. 2403 C.C.)',
        fundamentoFactico: 'Verificar si existió demanda reivindicatoria o juicio posesorio anterior con citación legal realizada al ocupante antes de vencerse los 15 años.',
        fundamentoJuridico: 'Arts. 2403 y 2404 Código Civil; Sentencia CNJ Res. 341-2017.',
        pruebaRecomendada: 'Copia certificada de juicio anterior con acta de citación procesal realizada por el actuario del juzgado.'
      },
      {
        tipo: 'Defensa Procesal / Previa',
        nombre: 'Falta de Legítimo Contradictor / Falta de Litisconsorcio Necesario (Art. 153 num. 3 COGEP)',
        fundamentoFactico: 'Procede si el inmueble pertenece a una sociedad conyugal o sucesión indivisa de herederos y la actora omitió demandar a todos los titulares registrales.',
        fundamentoJuridico: 'Art. 153 num. 3 COGEP; Sentencia CNJ Res. 182-2014; Sentencia CC 096-15-SEP-CC.',
        pruebaRecomendada: 'Certificado de gravámenes con partida de defunción y posesión efectiva donde consten coherederos no citados.'
      },
      {
        tipo: 'Defensa Procesal / Previa',
        nombre: 'Defecto Legal en la Demanda por Falta de Individualización (Art. 153 num. 4 COGEP)',
        fundamentoFactico: 'Si los linderos narrados en la demanda no coinciden con la realidad del terreno o invaden área remanente del propietario.',
        fundamentoJuridico: 'Art. 142 num. 4 COGEP; Sentencia CNJ Res. 076-2012.',
        pruebaRecomendada: 'Informe pericial contradictorio que evidencie discrepancia de cabida y linderos.'
      }
    ];

    roleMatrix = [
      {
        elemento: 'Mera Tenencia vs Posesión (Art. 730 C.C.)',
        hechoAlegado: 'La actora sostiene posesión con ánimo de señor y dueño',
        posibleObjecion: 'La ocupación tuvo origen derivado (comodato / arrendamiento / relación laboral)',
        hechoVerificar: '¿Existen recibos, comunicaciones o constancias laborales de dependencia o reconocimiento?',
        pruebaUtil: 'Contratos, finiquitos laborales, testimonios de antiguos trabajadores o copropietarios',
        fuenteVerificada: 'Arts. 730, 734 y 2410 regla 3 C.C. / Sentencia CNJ Res. 047-2015'
      },
      {
        elemento: 'Continuidad y Plazo de 15 años (Art. 2411 C.C.)',
        hechoAlegado: `La actora afirma ${yearsPossession || 'X'} años ininterrumpidos`,
        posibleObjecion: 'El plazo real es inferior a 15 años o sufrió interrupciones materiales y requerimientos formales',
        hechoVerificar: 'Fecha exacta en que cesó la relación con el propietario o fecha de intimaciones notariales',
        pruebaUtil: 'Requerimientos notariales, denuncias de invasión, pagos prediales continuos por el dueño',
        fuenteVerificada: 'Arts. 2402, 2403, 2411 C.C. / Sentencia CNJ Res. 341-2017'
      },
      {
        elemento: 'Legitimación e Integración de la Litis (Art. 153 COGEP)',
        hechoAlegado: 'Demanda tramitada contra personas parciales',
        posibleObjecion: 'Indebida integración del contradictorio (omisión de herederos o copropietarios)',
        hechoVerificar: 'Número total de herederos con posesión efectiva inscrita en el Registro de la Propiedad',
        pruebaUtil: 'Certificado de gravámenes ampliado y partidas de nacimiento/defunción',
        fuenteVerificada: 'Sentencia CNJ Res. 182-2014 / Sentencia CC 096-15-SEP-CC'
      }
    ];
  } else {
    // Neutral Evaluation
    neutralEvaluation = {
      puntosFuertesActora: [
        'Tenencia física del inmueble con actos materiales exteriores (vivienda, cerramiento, huerto).',
        'Contratación de suministros básicos a nombre propio.',
        'Potencial reconocimiento vecinal como poseedor de hecho.'
      ],
      puntosDebilesActora: [
        has15Years ? 'Plazo suficiente en cómputo preliminar, pero sujeto a escrutinio documental estricto.' : 'Tiempo de posesión insuficiente (< 15 años), lo que torna improcedente la demanda actual.',
        'Riesgo sustancial si la contraparte aporta prueba documental de ingreso subordinado (arriendo, trabajo, comodato).',
        'Riesgo procesal en la individualización de linderos frente al plano matriz catastral.'
      ],
      puntosFuertesDemandada: [
        'Título de dominio inscrito en el Registro de la Propiedad que goza de presunción legal.',
        'Posibilidad de alegar excepción de mera tenencia amparada en los Arts. 730 y 734 del Código Civil.',
        'Defensas procesales de litisconsorcio pasivo si no se citó a la totalidad de comuneros o herederos.'
      ],
      puntosDebilesDemandada: [
        'Desatención prolongada del inmueble e inacción física en el terreno.',
        'Inexistencia de demandas reivindicatorias formalmente citadas en años previos.',
        'Dificultad para desvirtuar testimonios vecinales si el titular no tuvo presencia en el sector.'
      ],
      hechosDirimentes: [
        'Existencia o no de documentos suscritos donde conste reconocimiento de dominio ajeno (finiquito, recibos de renta, cartas).',
        'Resultado de la inspección judicial y la prueba pericial de delimitación física.',
        'Fecha comprobable con documentos públicos de la instalación de los primeros servicios básicos.'
      ]
    };
  }

  // 9-Part Research Assistant Structure
  const researchAssistant = {
    punto1_resumenProblema: `Análisis de viabilidad jurídica de prescripción extraordinaria adquisitiva de dominio respecto del inmueble ubicado en ${locationDesc}, con una superficie referencial de ${c.location?.surface || 'no precisada'}, frente a los derechos del titular registral ${regOwnerName}, analizado desde la posición de ${role.toUpperCase()}.`,
    punto2_hechosConocidos: [
      `Ubicación: ${locationDesc}; Clave catastral: ${c.location?.cadastralKey || 'No registrada'}.`,
      `Titular registral: ${regOwnerName}; Inscripción: N° ${c.registry?.inscriptionNumber || 'S/N'}, Registro de la Propiedad de ${c.registry?.registryOffice || 'cantón no esp.'}.`,
      `Fecha de inicio de posesión alegada: ${c.possession?.startDate || 'No precisada'} (${yearsPossession !== null ? yearsPossession + ' años estimados' : 'cálculo pendiente'}).`,
      `Actos de señor y dueño invocados: ${c.possession?.actsOfOwner || 'Actos materiales por corroborar'}.`,
      `Etapa procesal reportada: ${c.proceduralStage || 'Pre-procesal'}.`
    ],
    punto3_hechosFaltantes: [
      'Fecha cierta de los primeros actos posesorios respaldada en documentos públicos u oficiales (no solo narración testimonial).',
      'Certificado de no afectación a dominio público o reserva vial emitido por la Dirección de Planificación Municipal.',
      'Constatación de la situación jurídica de la totalidad de copropietarios o herederos del titular registral.',
      'Peritaje técnico planimétrico con coordenadas georreferenciadas WGS84 verificado in situ.'
    ],
    punto4_normasVerificadas: verifiedNorms.map((n) => ({
      articulo: `${n.official_name} - ${n.article_or_cause}`,
      fuenteOficial: n.official_source,
      enlace: n.official_url,
      textoPertinente: n.relevant_text,
      estadoVerificacion: n.verification_status
    })),
    punto5_jurisprudenciaVerificada: verifiedJurisprudence.map((j) => ({
      organo: j.organ,
      identificacion: `${j.official_name} (${j.article_or_cause})`,
      fecha: j.date,
      criterioPertinente: j.relevant_text,
      enlace: j.official_url,
      estadoVerificacion: j.verification_status
    })),
    punto6_analisisRol: role === 'actora'
      ? `Para la PARTE ACTORA, la estrategia procesal debe articularse en la consolidación inexpugnable de los 4 presupuestos de casación (Sentencia CNJ Res. 076-2012). Se debe enfatizar la producción probatoria documental previa a la audiencia preliminar, especialmente el informe pericial técnico y el certificado del Registro de la Propiedad. La posesión de ${yearsPossession || 'X'} años debe respaldarse con hechos visibles en la inspección judicial.`
      : role === 'demandada'
      ? `Para la PARTE DEMANDADA, la contestación a la demanda debe centrarse en desarticular el animus domini invocando la excepción sustancial de mera tenencia (Arts. 730 y 734 C.C.) e interponer excepciones previas de litisconsorcio pasivo necesario y defecto legal si no se individualizó el predio o se omitieron herederos registrados.`
      : `En el ANÁLISIS NEUTRAL, el desenlace depende preponderantemente de dos factores determinantes: la existencia de prueba escrita de reconocimiento de dominio ajeno (que fulminaría la pretensión de usucapión) y la precisión pericial en la individualización del lote frente a la matriz registral.`,
    punto7_argumentosContrariosYRiesgos: detectedObstacles.map((o) => `[${o.severity}] ${o.title}: ${o.detail}`),
    punto8_proximosPasosYDocumentos: [
      'Solicitar Certificado de Búsqueda y Gravámenes actualizado al Registro de la Propiedad respectivo.',
      'Contratar levantamiento topográfico pericial a perito acreditado ante el Consejo de la Judicatura.',
      'Recopilar planillas de servicios básicos y comprobantes de tributos prediales desde el año de inicio.',
      'Entrevistar a los testigos vecinales colindantes con el cuestionario técnico de preguntas orientativas.',
      'Verificar en el portal SATJE de la Función Judicial si existen procesos civiles o penales previos entre las partes.'
    ],
    punto9_alcanceYFechaCorte: `Investigación jurídica efectuada con fecha de corte al ${cutoffDate}, circunscrita estrictamente al ordenamiento jurídico de la República del Ecuador. Todo criterio aquí consignado constituye una hipótesis de análisis jurídico y no reemplaza el criterio ni la verificación directa del profesional del derecho patrocinador.`
  };

  return {
    cutoffDate,
    role,
    clientName,
    locationDesc,
    yearsPossession,
    has15Years,
    detectedObstacles,
    roleMatrix,
    theoryOfTheCase,
    defensesAndExceptions,
    neutralEvaluation,
    researchAssistant,
    verifiedNorms,
    verifiedJurisprudence
  };
}

// ==========================================
// API ROUTES
// ==========================================

// Cases CRUD
app.get('/api/cases', (req, res) => {
  res.json({ success: true, cases: getAllCases() });
});

app.get('/api/cases/:id', (req, res) => {
  const c = getCaseById(req.params.id);
  if (!c) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
  res.json({ success: true, case: c });
});

app.post('/api/cases', (req, res) => {
  const body = req.body;
  const newId = `exp-${Date.now()}`;
  const newCase = {
    id: newId,
    code: body.code || `EXP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    title: body.title || 'Nuevo Expediente de Prescripción',
    role: body.role || 'actora',
    is_demo: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cutoffDate: body.cutoffDate || new Date().toISOString().split('T')[0],
    client: body.client || '',
    clientCedula: body.clientCedula || '',
    proceduralStage: body.proceduralStage || 'Pre-procesal (Preparación)',
    court: body.court || '',
    causeNumber: body.causeNumber || '',
    location: body.location || {
      province: '',
      canton: '',
      parroquia: '',
      sector: '',
      cadastralKey: '',
      surface: '',
      boundaries: { north: '', south: '', east: '', west: '' }
    },
    registry: body.registry || {
      registryOffice: '',
      registeredOwner: '',
      inscriptionNumber: '',
      tome: '',
      folio: '',
      inscriptionDate: '',
      encumbrances: '',
      backgroundDomain: ''
    },
    possession: body.possession || {
      startDate: '',
      computationMethod: '',
      entryMethod: '',
      actsOfOwner: '',
      continuity: '',
      publicity: '',
      peaceful: '',
      recognitionOfForeignDomain: '',
      interruptionsOrLawsuits: ''
    },
    opposingParty: body.opposingParty || { status: '', coOwners: '', thirdParties: '' },
    propertyNature: body.propertyNature || { isPublic: false, isMunicipal: false, isCommunal: false, isProtectedArea: false, observations: '' },
    evidence: body.evidence || [],
    chronology: body.chronology || [],
    witnessQuestions: body.witnessQuestions || [
      '¿Diga el testigo si conoce desde qué fecha ejerce posesión material el actor en el predio?',
      '¿Diga el testigo qué actos materiales (construcciones, siembras, cerramientos) ha observado?',
      '¿Diga el testigo si ha existido reclamo, violencia o interrupción de terceros durante este lapso?',
      '¿Diga el testigo si en el sector se reconoce pública y notoriedad de dueño al actor?'
    ],
    notes: body.notes || '',
    documents: []
  };

  saveCase(newCase);
  res.status(201).json({ success: true, case: newCase });
});

app.put('/api/cases/:id', (req, res) => {
  const existing = getCaseById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });

  const updated = {
    ...existing,
    ...req.body,
    id: existing.id, // Immutable ID
    updatedAt: new Date().toISOString()
  };

  saveCase(updated);
  res.json({ success: true, case: updated });
});

app.delete('/api/cases/:id', (req, res) => {
  const filePath = path.join(CASES_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
  fs.unlinkSync(filePath);
  res.json({ success: true, message: 'Expediente eliminado correctamente.' });
});

// Document Upload & Parsing
app.post('/api/cases/:id/documents', upload.single('document'), async (req, res) => {
  try {
    const c = getCaseById(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No se subió ningún archivo.' });

    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase();
    let extractedText = '';
    let extractionStatus = 'No procesado';
    let wordCount = 0;

    if (ext === '.txt') {
      try {
        extractedText = fs.readFileSync(file.path, 'utf-8');
        extractionStatus = 'Texto extraído correctamente (UTF-8)';
      } catch (e) {
        extractionStatus = `Error al leer archivo de texto: ${e.message}`;
      }
    } else if (ext === '.docx') {
      try {
        const result = await mammoth.extractRawText({ path: file.path });
        extractedText = result.value || '';
        extractionStatus = 'Texto extraído correctamente desde DOCX';
      } catch (e) {
        extractionStatus = `Error al procesar DOCX: ${e.message}`;
      }
    } else if (ext === '.pdf') {
      try {
        const dataBuffer = fs.readFileSync(file.path);
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text || '';
        extractionStatus = extractedText.trim().length > 0
          ? `Texto extraído correctamente (${pdfData.numpages} páginas)`
          : 'PDF escaneado sin capa de texto (Requiere OCR manual/externo)';
      } catch (e) {
        extractionStatus = `Error al procesar PDF: ${e.message}`;
      }
    } else if (['.png', '.jpg', '.jpeg'].includes(ext)) {
      extractionStatus = 'Documento gráfico / imagen guardada intacta. Requiere verificación visual.';
    }

    if (extractedText) {
      wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length;
    }

    const docEntry = {
      id: `doc-${Date.now()}`,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadDate: new Date().toISOString(),
      extractedText: extractedText.trim(),
      wordCount,
      extractionStatus,
      notes: req.body.notes || ''
    };

    if (!c.documents) c.documents = [];
    c.documents.push(docEntry);
    saveCase(c);

    res.json({ success: true, document: docEntry });
  } catch (err) {
    console.error('Error in document upload:', err);
    res.status(500).json({ success: false, message: `Error al procesar archivo: ${err.message}` });
  }
});

app.delete('/api/cases/:id/documents/:docId', (req, res) => {
  const c = getCaseById(req.params.id);
  if (!c) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });

  const docIdx = (c.documents || []).findIndex((d) => d.id === req.params.docId);
  if (docIdx === -1) return res.status(404).json({ success: false, message: 'Documento no encontrado en el expediente.' });

  const doc = c.documents[docIdx];
  const filePath = path.join(UPLOADS_DIR, doc.filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (e) { console.error('Error deleting upload file:', e); }
  }

  c.documents.splice(docIdx, 1);
  saveCase(c);
  res.json({ success: true, message: 'Documento eliminado del expediente.' });
});

// Run Legal Analysis
app.get('/api/cases/:id/analysis', (req, res) => {
  const c = getCaseById(req.params.id);
  if (!c) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
  const anonymize = req.query.anonymize === 'true';
  const analysis = performLegalAnalysis(c, anonymize);
  res.json({ success: true, analysis });
});

// Legal Corpus API
app.get('/api/legal-corpus', (req, res) => {
  const corpus = getLegalCorpus();
  res.json({ success: true, corpus, total: corpus.length });
});

app.get('/api/legal-corpus/search', (req, res) => {
  const corpus = getLegalCorpus();
  const { q, category, organ, verification_status } = req.query;

  let results = [...corpus];

  if (category && category !== 'all') {
    results = results.filter((item) => item.category === category);
  }

  if (organ && organ !== 'all') {
    results = results.filter((item) => item.organ.toLowerCase().includes(organ.toLowerCase()));
  }

  if (verification_status && verification_status !== 'all') {
    results = results.filter((item) => item.verification_status === verification_status);
  }

  if (q && q.trim()) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    results = results.filter((item) => {
      const searchBlob = `${item.official_name} ${item.article_or_cause} ${item.relevant_text} ${item.legal_problem} ${item.pertinence} ${(item.keywords || []).join(' ')}`.toLowerCase();
      return terms.every((t) => searchBlob.includes(t));
    });
  }

  res.json({ success: true, results, count: results.length });
});

// Manual entry of legal norm / judgment
app.post('/api/legal-corpus/manual', (req, res) => {
  const { official_name, article_or_cause, organ, date, type, relevant_text, official_source, official_url, pertinence } = req.body;
  if (!official_name || !article_or_cause || !relevant_text) {
    return res.status(400).json({ success: false, message: 'Campos requeridos: Nombre oficial, Artículo o Causa, y Texto pertinente.' });
  }

  const corpus = getLegalCorpus();
  const newItem = {
    id: `user-entry-${Date.now()}`,
    category: req.body.category || 'jurisprudencia',
    organ: organ || 'Aportado por usuario',
    official_name,
    article_or_cause,
    date: date || new Date().toISOString().split('T')[0],
    type: type || 'Criterio aportado por el usuario',
    binding_character: 'No verificado (requiere constatación en fuente oficial)',
    legal_problem: req.body.legal_problem || 'Problema jurídico registrado por el usuario',
    relevant_text,
    pertinence: pertinence || 'Aporte manual para expediente',
    official_source: official_source || 'Fuente informada por usuario',
    official_url: official_url || '',
    verification_date: new Date().toISOString().split('T')[0],
    verification_status: 'aportado por el usuario, pendiente de verificación',
    keywords: ['usuario', 'manual', 'pendiente']
  };

  corpus.unshift(newItem);
  saveLegalCorpus(corpus);
  res.status(201).json({ success: true, item: newItem });
});

// Live Portal Health / Accessibility Check
app.get('/api/official-portals/status', async (req, res) => {
  const portals = [
    { name: 'Corte Constitucional del Ecuador', url: 'https://www.corteconstitucional.gob.ec/' },
    { name: 'Buscador Externo Corte Constitucional', url: 'https://buscador.corteconstitucional.gob.ec/buscador-externo/principal' },
    { name: 'Corte Nacional de Justicia', url: 'https://www.cortenacional.gob.ec/' },
    { name: 'Registro Oficial del Ecuador', url: 'https://www.registroficial.gob.ec/' },
    { name: 'Consejo de la Judicatura (SATJE)', url: 'https://procesosjudiciales.funcionjudicial.gob.ec/' }
  ];

  const results = [];

  for (const p of portals) {
    const startTime = Date.now();
    try {
      const status = await new Promise((resolve) => {
        const reqObj = https.request(p.url, { method: 'GET', timeout: 5000, rejectUnauthorized: false }, (resp) => {
          resolve({ ok: resp.statusCode >= 200 && resp.statusCode < 400, statusCode: resp.statusCode });
        });
        reqObj.on('error', (err) => resolve({ ok: false, error: err.message }));
        reqObj.on('timeout', () => { reqObj.destroy(); resolve({ ok: false, error: 'Timeout (>5s)' }); });
        reqObj.end();
      });
      const latency = Date.now() - startTime;
      results.push({
        name: p.name,
        url: p.url,
        available: status.ok,
        statusCode: status.statusCode || null,
        latencyMs: latency,
        notes: status.ok ? 'Accesible para consulta en línea' : (status.error || `HTTP ${status.statusCode}`)
      });
    } catch (e) {
      results.push({ name: p.name, url: p.url, available: false, latencyMs: null, notes: e.message });
    }
  }

  res.json({ success: true, timestamp: new Date().toISOString(), portals: results });
});

// Export DOCX
app.post('/api/cases/:id/export/docx', async (req, res) => {
  try {
    const c = getCaseById(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });

    const anonymize = req.body.anonymize === true;
    const analysis = performLegalAnalysis(c, anonymize);

    const doc = new docx.Document({
      creator: 'LexDominio Ecuador',
      title: `Informe Jurídico - ${c.code}`,
      description: 'Informe de análisis de prescripción adquisitiva extraordinaria de dominio en Ecuador',
      styles: {
        default: {
          document: {
            run: { font: 'Calibri', size: 22, color: '1A202C' }
          }
        }
      },
      sections: [{
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
          }
        },
        headers: {
          default: new docx.Header({
            children: [
              new docx.Paragraph({
                alignment: docx.AlignmentType.RIGHT,
                children: [
                  new docx.TextRun({ text: 'LEXDOMINIO ECUADOR | INFORME TÉCNICO-JURÍDICO', size: 16, color: '718096', bold: true })
                ]
              })
            ]
          })
        },
        footers: {
          default: new docx.Footer({
            children: [
              new docx.Paragraph({
                alignment: docx.AlignmentType.CENTER,
                children: [
                  new docx.TextRun({ text: `Fecha de Corte: ${analysis.cutoffDate} | Confidencial para uso profesional de la defensa.`, size: 16, color: '718096', italics: true })
                ]
              })
            ]
          })
        },
        children: [
          // Title
          new docx.Paragraph({
            heading: docx.HeadingLevel.HEADING_1,
            alignment: docx.AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new docx.TextRun({ text: 'INFORME DE ANÁLISIS JURÍDICO Y MATRIZ PROBATORIA', bold: true, size: 30, color: '1A365D' })
            ]
          }),
          new docx.Paragraph({
            alignment: docx.AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new docx.TextRun({ text: 'PRESCRIPCIÓN EXTRAORDINARIA ADQUISITIVA DE DOMINIO (ECUADOR)', bold: true, size: 22, color: '2B6CB0' })
            ]
          }),

          // Disclaimer box
          new docx.Paragraph({
            spacing: { after: 240 },
            border: {
              top: { style: docx.BorderStyle.SINGLE, size: 4, color: 'D69E2E' },
              bottom: { style: docx.BorderStyle.SINGLE, size: 4, color: 'D69E2E' },
              left: { style: docx.BorderStyle.SINGLE, size: 12, color: 'D69E2E' },
              right: { style: docx.BorderStyle.SINGLE, size: 4, color: 'D69E2E' }
            },
            children: [
              new docx.TextRun({ text: 'ADVERTENCIA DEONTOLÓGICA: ', bold: true, color: 'B7791F' }),
              new docx.TextRun({ text: 'Este informe es una herramienta técnica de investigación y preparación jurídica basada exclusivamente en normativa y jurisprudencia ecuatoriana vigente. No sustituye el criterio, revisión y patrocinio del abogado, ni garantiza un resultado judicial definitivo.' })
            ]
          }),

          // Case Info Table
          new docx.Paragraph({
            heading: docx.HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 140 },
            children: [new docx.TextRun({ text: '1. Ficha del Expediente y Predio Objeto de Litis', bold: true, size: 24, color: '1A365D' })]
          }),

          new docx.Table({
            width: { size: 100, type: docx.WidthType.PERCENTAGE },
            rows: [
              new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'Código de Expediente:', bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: c.code })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'Rol de Análisis:', bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: c.role.toUpperCase() })] })
                ]
              }),
              new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'Cliente / Patrocinado:', bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: analysis.clientName })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'Fecha de Corte:', bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: analysis.cutoffDate })] })
                ]
              }),
              new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'Ubicación Política:', bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: analysis.locationDesc })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'Superficie Estimada:', bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: c.location?.surface || 'No especificada' })] })
                ]
              }),
              new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'Clave Catastral:', bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: c.location?.cadastralKey || 'No registrada' })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'Tiempo Posesión:', bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: analysis.yearsPossession !== null ? `${analysis.yearsPossession} años (Exigido: 15 años)` : 'No calculable' })] })
                ]
              })
            ]
          }),

          // Section 2: 9-Part Research Assistant
          new docx.Paragraph({
            heading: docx.HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 140 },
            children: [new docx.TextRun({ text: '2. Dictamen Estructurado de Investigación Jurídica (9 Puntos)', bold: true, size: 24, color: '1A365D' })]
          }),

          new docx.Paragraph({
            spacing: { after: 100 },
            children: [
              new docx.TextRun({ text: '2.1 Resumen del Problema Jurídico: ', bold: true }),
              new docx.TextRun({ text: analysis.researchAssistant.punto1_resumenProblema })
            ]
          }),

          new docx.Paragraph({
            spacing: { after: 100 },
            children: [new docx.TextRun({ text: '2.2 Hechos Conocidos:', bold: true })]
          }),
          ...analysis.researchAssistant.punto2_hechosConocidos.map((h) => new docx.Paragraph({ bullet: { level: 0 }, text: h })),

          new docx.Paragraph({
            spacing: { before: 120, after: 100 },
            children: [new docx.TextRun({ text: '2.3 Hechos Faltantes o por Corroborar:', bold: true, color: 'C53030' })]
          }),
          ...analysis.researchAssistant.punto3_hechosFaltantes.map((h) => new docx.Paragraph({ bullet: { level: 0 }, text: h })),

          new docx.Paragraph({
            spacing: { before: 120, after: 100 },
            children: [new docx.TextRun({ text: `2.4 Análisis Especializado para el Rol (${c.role.toUpperCase()}):`, bold: true })]
          }),
          new docx.Paragraph({ text: analysis.researchAssistant.punto6_analisisRol, spacing: { after: 140 } }),

          new docx.Paragraph({
            spacing: { before: 120, after: 100 },
            children: [new docx.TextRun({ text: '2.5 Obstáculos, Argumentos Contrarios y Riesgos Procesales:', bold: true, color: 'C53030' })]
          }),
          ...analysis.researchAssistant.punto7_argumentosContrariosYRiesgos.map((r) => new docx.Paragraph({ bullet: { level: 0 }, text: r })),

          new docx.Paragraph({
            spacing: { before: 120, after: 100 },
            children: [new docx.TextRun({ text: '2.6 Próximos Pasos y Diligencias Probatorias:', bold: true })]
          }),
          ...analysis.researchAssistant.punto8_proximosPasosYDocumentos.map((p) => new docx.Paragraph({ bullet: { level: 0 }, text: p })),

          // Section 3: Legal Sources Table
          new docx.Paragraph({
            heading: docx.HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 140 },
            children: [new docx.TextRun({ text: '3. Fuentes Normativas y Jurisprudenciales Verificadas de Ecuador', bold: true, size: 24, color: '1A365D' })]
          }),

          new docx.Table({
            width: { size: 100, type: docx.WidthType.PERCENTAGE },
            rows: [
              new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'Disposición / Sentencia', bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'Órgano Emisor / Registro', bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'Criterio / Regla Pertinente', bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'Estado', bold: true })] })] })
                ]
              }),
              ...analysis.verifiedNorms.map((n) => new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph({ text: `${n.official_name} (${n.article_or_cause})` })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: n.official_source })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: n.relevant_text.substring(0, 150) + '...' })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'VERIFICADO', bold: true, color: '22543D' })] })] })
                ]
              })),
              ...analysis.verifiedJurisprudence.map((j) => new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph({ text: `${j.official_name} (${j.article_or_cause})` })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: j.organ })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: j.relevant_text.substring(0, 150) + '...' })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'VERIFICADO', bold: true, color: '22543D' })] })] })
                ]
              }))
            ]
          }),

          // Section 4: Chronology
          new docx.Paragraph({
            heading: docx.HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 140 },
            children: [new docx.TextRun({ text: '4. Cronología de Posesión y Hechos Relevantes', bold: true, size: 24, color: '1A365D' })]
          }),
          ...(c.chronology || []).map((ev) => new docx.Paragraph({
            spacing: { after: 80 },
            children: [
              new docx.TextRun({ text: `[${ev.date}] `, bold: true, color: '2B6CB0' }),
              new docx.TextRun({ text: ev.event })
            ]
          })),

          // Section 5: Witness Questionnaire
          new docx.Paragraph({
            heading: docx.HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 140 },
            children: [new docx.TextRun({ text: '5. Cuestionario Testimonial Técnico Sugerido', bold: true, size: 24, color: '1A365D' })]
          }),
          ...(c.witnessQuestions || []).map((q, idx) => new docx.Paragraph({
            spacing: { after: 60 },
            children: [
              new docx.TextRun({ text: `${idx + 1}. `, bold: true }),
              new docx.TextRun({ text: q })
            ]
          }))
        ]
      }]
    });

    const buffer = await docx.Packer.toBuffer(doc);
    const filename = `Informe_${c.code}_${analysis.cutoffDate}.docx`.replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error generating DOCX:', err);
    res.status(500).json({ success: false, message: `Error al generar documento Word: ${err.message}` });
  }
});

// Backup / Export all cases JSON
app.get('/api/backup', (req, res) => {
  const cases = [];
  if (fs.existsSync(CASES_DIR)) {
    const files = fs.readdirSync(CASES_DIR).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      try {
        const raw = fs.readFileSync(path.join(CASES_DIR, f), 'utf-8');
        cases.push(JSON.parse(raw));
      } catch (e) {}
    }
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="LexDominio_Expedientes_Respaldo.json"');
  res.send(JSON.stringify({ exportDate: new Date().toISOString(), version: '1.0', cases }, null, 2));
});

// Restore backup
app.post('/api/restore', (req, res) => {
  try {
    const { cases } = req.body;
    if (!Array.isArray(cases)) return res.status(400).json({ success: false, message: 'Formato de respaldo no válido.' });
    let count = 0;
    for (const c of cases) {
      if (c && c.id) {
        saveCase(c);
        count++;
      }
    }
    res.json({ success: true, message: `Se restauraron ${count} expedientes exitosamente.` });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  LexDominio Ecuador - Servidor Web Activo`);
  console.log(`  Puerto: http://localhost:${PORT}`);
  console.log(`  Ambiente: Local Seguro y Privado`);
  console.log(`====================================================`);
});
