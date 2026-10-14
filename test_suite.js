// ==============================================================================
// LexDominio Ecuador - Suite Completa de Pruebas Automatizadas de Integración
// ==============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:3000';

// Helper for HTTP requests
function request(method, pathUrl, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const reqHeaders = { ...headers };
    let reqBody = null;

    if (Buffer.isBuffer(body)) {
      reqBody = body;
      reqHeaders['Content-Length'] = body.length;
    } else if (body && typeof body === 'object' && !headers['Content-Type']?.includes('multipart')) {
      reqBody = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(reqBody);
    } else if (body && typeof body === 'string') {
      reqBody = body;
      reqHeaders['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        const text = rawBuffer.toString('utf-8');
        let json = null;
        try { json = JSON.parse(text); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          text,
          json,
          buffer: rawBuffer
        });
      });
    });

    req.on('error', reject);
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

// Multipart form-data helper without external deps
function uploadFile(pathUrl, fieldName, filename, fileContent, mimeType = 'text/plain') {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
      'utf-8'
    );
    const content = Buffer.isBuffer(fileContent) ? fileContent : Buffer.from(fileContent, 'utf-8');
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');

    const bodyBuffer = Buffer.concat([header, content, footer]);

    request('POST', pathUrl, bodyBuffer, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': bodyBuffer.length
    }).then(resolve).catch(reject);
  });
}

// Test Runner
async function runTests() {
  console.log('======================================================================');
  console.log('  INICIANDO SUITE DE PRUEBAS AUTOMATIZADAS: LEXDOMINIO ECUADOR 🇪🇨');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`  [PASÓ] ${testName}`);
      passed++;
    } else {
      console.error(`  [FALLÓ] ${testName} -> ${detail}`);
      failed++;
    }
  }

  let testCaseId = null;

  try {
    // 1. Static Web Serving
    console.log('1. Verificando Entrega de Interfaz Web y Recursos Estáticos...');
    const indexRes = await request('GET', '/');
    assert(indexRes.statusCode === 200, 'Carga de index.html', `HTTP ${indexRes.statusCode}`);
    assert(indexRes.text.includes('LexDominio') && indexRes.text.includes('Prescripción'), 'Contenido HTML de LexDominio Ecuador');

    const cssRes = await request('GET', '/css/styles.css');
    assert(cssRes.statusCode === 200 && cssRes.text.includes('--primary-900'), 'Carga de hoja de estilos styles.css');

    const jsRes = await request('GET', '/js/app.js');
    assert(jsRes.statusCode === 200 && jsRes.text.includes('App'), 'Carga del coordinador JavaScript app.js');

    // 2. Demo Cases Verification
    console.log('\n2. Verificando Expedientes de Demostración Ficticios...');
    const listRes = await request('GET', '/api/cases');
    assert(listRes.statusCode === 200 && listRes.json.success === true, 'Listado de expedientes (/api/cases)');
    const demoCases = listRes.json.cases.filter(c => c.is_demo);
    assert(demoCases.length >= 2, 'Existencia de 2 expedientes demo identificados como ficticios');
    assert(demoCases.some(c => c.role === 'actora'), 'Demo existente para Parte Actora');
    assert(demoCases.some(c => c.role === 'demandada'), 'Demo existente para Parte Demandada');

    // 3. Create New Case
    console.log('\n3. Creando Nuevo Expediente de Prueba...');
    const createRes = await request('POST', '/api/cases', {
      title: 'Caso de Prueba Automatizada - Lote Pifo',
      code: 'EXP-TEST-001',
      role: 'actora',
      client: 'Luis Alberto Santillán',
      clientCedula: '1709876543',
      location: {
        province: 'Pichincha',
        canton: 'Quito',
        parroquia: 'Pifo',
        sector: 'Sector El Belén',
        cadastralKey: '1701100234',
        surface: '1200.00 m²',
        boundaries: { north: 'Calle pública', south: 'Quebrada', east: 'Lote 4', west: 'Lote 2' }
      },
      registry: {
        registryOffice: 'Quito',
        registeredOwner: 'Inversiones Agrícolas S.A.',
        inscriptionNumber: '9845'
      },
      possession: {
        startDate: '2005-01-01',
        entryMethod: 'Posesión directa pacífica',
        actsOfOwner: 'Construcción de vivienda de bloque y cerramiento',
        continuity: 'Posesión continua e ininterrumpida',
        publicity: 'Pública y notoria'
      }
    });

    assert(createRes.statusCode === 201 && createRes.json.success === true, 'Creación de expediente EXP-TEST-001');
    testCaseId = createRes.json.case.id;

    // 4. Update Case Data
    console.log('\n4. Actualizando Expediente...');
    const updateRes = await request('PUT', `/api/cases/${testCaseId}`, {
      client: 'Luis Alberto Santillán Gomez'
    });
    assert(updateRes.statusCode === 200 && updateRes.json.case.client === 'Luis Alberto Santillán Gomez', 'Actualización de datos del expediente');

    // 5. Legal Analysis Engine - Role: ACTORA
    console.log('\n5. Probando Motor de Análisis Legal para PARTE ACTORA...');
    const anaActRes = await request('GET', `/api/cases/${testCaseId}/analysis`);
    assert(anaActRes.statusCode === 200, 'Consulta de análisis para Parte Actora');
    const aAct = anaActRes.json.analysis;
    assert(aAct.has15Years === true && aAct.yearsPossession > 15, `Cálculo de posesión (${aAct.yearsPossession} años >= 15 años cumplidos)`);
    assert(aAct.roleMatrix.length === 4, 'Matriz de 4 presupuestos canónicos para Parte Actora');
    assert(!!aAct.theoryOfTheCase.faktica && !!aAct.theoryOfTheCase.probatoria && !!aAct.theoryOfTheCase.juridica, 'Estructura de Teoría del Caso (Fáctica, Probatoria y Jurídica)');
    assert(aAct.researchAssistant.punto1_resumenProblema.length > 20, 'Asistente de Investigación: Punto 1 (Resumen)');
    assert(aAct.researchAssistant.punto4_normasVerificadas.length >= 4, 'Asistente: Punto 4 (Normas verificadas de Ecuador)');
    assert(aAct.researchAssistant.punto5_jurisprudenciaVerificada.length >= 1, 'Asistente: Punto 5 (Jurisprudencia CNJ verificada)');

    // 6. Legal Analysis Engine - Role: DEMANDADA
    console.log('\n6. Probando Motor de Análisis Legal para PARTE DEMANDADA...');
    await request('PUT', `/api/cases/${testCaseId}`, { role: 'demandada' });
    const anaDemRes = await request('GET', `/api/cases/${testCaseId}/analysis`);
    const aDem = anaDemRes.json.analysis;
    assert(aDem.role === 'demandada', 'Cambio dinámico a rol Parte Demandada');
    assert(aDem.defensesAndExceptions.some(d => d.nombre.includes('Mera Tenencia')), 'Generación de Excepción Sustancial de Mera Tenencia (Art. 730 C.C.)');
    assert(aDem.defensesAndExceptions.some(d => d.nombre.includes('Litisconsorcio')), 'Generación de Excepción Procesal de Litisconsorcio / Legítimo Contradictor (Art. 153 COGEP)');
    assert(aDem.defensesAndExceptions.some(d => d.nombre.includes('Interrupción')), 'Generación de Excepción de Interrupción Civil (Art. 2403 C.C.)');

    // 7. Legal Analysis Engine - Role: NEUTRAL
    console.log('\n7. Probando Motor de Análisis Legal para ANÁLISIS NEUTRAL...');
    await request('PUT', `/api/cases/${testCaseId}`, { role: 'neutral' });
    const anaNeuRes = await request('GET', `/api/cases/${testCaseId}/analysis`);
    const aNeu = anaNeuRes.json.analysis;
    assert(aNeu.role === 'neutral', 'Cambio a rol Neutral');
    assert(aNeu.neutralEvaluation.puntosFuertesActora.length > 0, 'Puntos fuertes de la actora evaluados');
    assert(aNeu.neutralEvaluation.puntosFuertesDemandada.length > 0, 'Puntos fuertes de la demandada evaluados');
    assert(aNeu.neutralEvaluation.hechosDirimentes.length > 0, 'Hechos dirimentes decisivos identificados');

    // 8. Legal Corpus Search
    console.log('\n8. Probando Búsqueda Jurídica Ecuatoriana y Filtros...');
    const search2410 = await request('GET', '/api/legal-corpus/search?q=2410');
    assert(search2410.json.results.some(r => r.article_or_cause.includes('2410')), 'Búsqueda por número de artículo "2410"');

    const searchTenencia = await request('GET', '/api/legal-corpus/search?q=mera+tenencia');
    assert(searchTenencia.json.results.some(r => r.relevant_text.toLowerCase().includes('mera tenencia')), 'Búsqueda por concepto "mera tenencia"');

    const searchCNJ = await request('GET', '/api/legal-corpus/search?category=jurisprudencia');
    assert(searchCNJ.json.results.length >= 4, 'Filtro por categoría jurisprudencia (Fallos CNJ y CC)');

    // Verify all results have verification metadata
    const allVerified = search2410.json.results.every(r => 
      !!r.official_source && !!r.official_url && !!r.verification_date && !!r.verification_status
    );
    assert(allVerified, 'Todas las citas jurídicas contienen metadatos oficiales y fecha de verificación');

    // 9. Manual Legal Entry
    console.log('\n9. Probando Registro Manual de Cita por el Usuario...');
    const manualRes = await request('POST', '/api/legal-corpus/manual', {
      official_name: 'Sentencia de Casación Sala Civil CNJ',
      article_or_cause: 'Resolución No. 999-2026',
      organ: 'Corte Nacional de Justicia',
      relevant_text: 'Criterio específico sobre delimitación pericial y linderos aportado por el abogado.',
      official_source: 'Gaceta Judicial 2026',
      official_url: 'https://www.cortenacional.gob.ec/'
    });
    assert(manualRes.statusCode === 201, 'Registro exitoso de norma/sentencia manual');
    assert(manualRes.json.item.verification_status === 'aportado por el usuario, pendiente de verificación', 'Etiquetado automático deontológico como "aportado por el usuario, pendiente de verificación"');

    // 10. Document Upload & Text Extraction
    console.log('\n10. Probando Carga Documental y Extracción de Texto...');
    const testDocContent = `REPUBLICA DEL ECUADOR\nCERTIFICADO DE GRAVAMENES\nEl predio ubicado en Pifo con clave catastral 1701100234 no tiene gravamenes vigentes segun libro registral.`;
    const docUploadRes = await uploadFile(
      `/api/cases/${testCaseId}/documents`,
      'document',
      'certificado_test.txt',
      testDocContent,
      'text/plain'
    );
    assert(docUploadRes.statusCode === 200 && docUploadRes.json && docUploadRes.json.success === true, 'Subida de archivo documental', docUploadRes.text);
    if (docUploadRes.json?.document) {
      assert(docUploadRes.json.document.extractedText.includes('CERTIFICADO DE GRAVAMENES'), 'Extracción correcta de texto (UTF-8)');
      assert(docUploadRes.json.document.wordCount > 10, `Recuento de palabras calculado (${docUploadRes.json.document.wordCount} palabras)`);

      // Verify original file exists in disk
      const uploadFilePath = path.join(__dirname, 'data', 'uploads', docUploadRes.json.document.filename);
      assert(fs.existsSync(uploadFilePath), 'Preservación intacta del archivo original en disco (data/uploads/)');

      // Delete document
      const delDocRes = await request('DELETE', `/api/cases/${testCaseId}/documents/${docUploadRes.json.document.id}`);
      assert(delDocRes.statusCode === 200, 'Eliminación segura de documento del expediente');
    }

    // 11. Native DOCX Generation
    console.log('\n11. Probando Generación de Informe en Microsoft Word (.DOCX)...');
    const docxRes = await request('POST', `/api/cases/${testCaseId}/export/docx`, { anonymize: false });
    assert(docxRes.statusCode === 200, 'Generación de archivo DOCX (HTTP 200)');
    assert(docxRes.headers['content-type'].includes('officedocument.wordprocessingml.document'), 'Cabecera MIME oficial de Word OpenXML');
    assert(docxRes.buffer.length > 8000, `Tamaño del binario DOCX válido (${docxRes.buffer.length} bytes)`);

    // Test with anonymization
    const docxAnonRes = await request('POST', `/api/cases/${testCaseId}/export/docx`, { anonymize: true });
    assert(docxAnonRes.statusCode === 200 && docxAnonRes.buffer.length > 8000, 'Generación de archivo DOCX con modo Anonimización activo');

    // 12. Official Portals Healthcheck
    console.log('\n12. Probando Healthcheck de Portales Oficiales...');
    const healthRes = await request('GET', '/api/official-portals/status');
    assert(healthRes.statusCode === 200 && healthRes.json.success === true, 'Consulta de estado de servidores oficiales');
    assert(healthRes.json.portals.length >= 4, 'Verificación de al menos 4 portales oficiales de Ecuador');
    const cnjPortal = healthRes.json.portals.find(p => p.name.includes('Corte Nacional'));
    assert(cnjPortal && cnjPortal.available === true, 'Disponibilidad confirmada de la Corte Nacional de Justicia');

    // 13. Backup & Restore
    console.log('\n13. Probando Copia de Seguridad y Restauración JSON...');
    const backupRes = await request('GET', '/api/backup');
    assert(backupRes.statusCode === 200 && backupRes.json.cases.length > 0, 'Descarga de respaldo JSON de expedientes');
    const restoreRes = await request('POST', '/api/restore', backupRes.json);
    assert(restoreRes.statusCode === 200 && restoreRes.json.success === true, 'Restauración integral desde respaldo');

    // 14. Headless Chrome Browser Render Test
    console.log('\n14. Ejecutando Renderizado en Navegador Real (Google Chrome Headless)...');
    try {
      const chromeOutput = execSync(
        `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --headless=new --disable-gpu --dump-dom http://localhost:3000/`,
        { encoding: 'utf-8', timeout: 15000 }
      );
      assert(chromeOutput.includes('LexDominio') && chromeOutput.includes('EXP-2026-ACT-001'), 'Carga y renderizado completo del DOM en Chrome');
      assert(chromeOutput.includes('sidebarActiveCase'), 'Widget del expediente activo renderizado en el navegador');
      assert(chromeOutput.includes('casesTable'), 'Tabla de expedientes renderizada con éxito');
    } catch (chromeErr) {
      assert(false, 'Renderizado en Google Chrome Headless', chromeErr.message);
    }

    // 15. Cleanup Test Case
    if (testCaseId) {
      console.log('\n15. Limpieza de Datos Temporales de Prueba...');
      const delCaseRes = await request('DELETE', `/api/cases/${testCaseId}`);
      assert(delCaseRes.statusCode === 200, 'Eliminación del expediente temporal EXP-TEST-001');
    }

  } catch (err) {
    console.error('Error inesperado durante la ejecución:', err);
    failed++;
  }

  console.log('\n======================================================================');
  console.log(`  RESUMEN FINAL DE PRUEBAS: ${passed} PASARON, ${failed} FALLARON`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
