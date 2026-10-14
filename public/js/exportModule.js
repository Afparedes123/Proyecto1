// ==========================================================================
// LexDominio Ecuador - Módulo de Informes y Exportación (exportModule.js)
// ==========================================================================

const ExportModule = (() => {

  async function refreshPreview() {
    const c = CaseModule.getActiveCase();
    if (!c) return;

    const anonymize = document.getElementById('exportAnonymizeToggle')?.checked || false;
    const includeDeontology = document.getElementById('exportIncludeDeontology')?.checked !== false;

    try {
      const res = await fetch(`/api/cases/${c.id}/analysis?anonymize=${anonymize}`);
      const data = await res.json();
      if (data.success) {
        renderReportPreview(c, data.analysis, anonymize, includeDeontology);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function renderReportPreview(c, a, anonymize, includeDeontology) {
    const container = document.getElementById('reportPreviewContainer');
    if (!container) return;

    const clientDisplay = anonymize ? '[PARTE PATROCINADA ANONIMIZADA]' : (c.client || 'No especificado');
    const cedulaDisplay = anonymize ? '[CÉDULA PROTEGIDA]' : (c.clientCedula || 'No registrada');
    const ownerDisplay = anonymize ? '[TITULAR REGISTRAL ANONIMIZADO]' : (c.registry?.registeredOwner || 'No identificado');

    container.innerHTML = `
      <!-- Formal Document Header -->
      <div style="border-bottom:2px solid #1a365d; padding-bottom:16px; margin-bottom:24px; text-align:center;">
        <div style="font-size:0.8rem; text-transform:uppercase; letter-spacing:0.1em; color:#718096; font-weight:700;">
          República del Ecuador • Función Judicial • Ejercicio Profesional
        </div>
        <h1 style="font-size:1.45rem; font-weight:800; color:#1a365d; margin-top:6px; font-family:var(--font-serif);">
          INFORME TÉCNICO DE ANÁLISIS JURÍDICO Y MATRIZ PROBATORIA
        </h1>
        <h2 style="font-size:1.05rem; font-weight:600; color:#2b6cb0; margin-top:2px;">
          Prescripción Adquisitiva Extraordinaria de Dominio (Art. 2410 C.C.)
        </h2>
        <div style="font-size:0.75rem; color:#718096; margin-top:6px;">
          Código de Expediente: <strong>${c.code}</strong> | Fecha de Generación: ${new Date().toLocaleDateString('es-EC')} | Fecha de Corte de Análisis: ${a.cutoffDate}
        </div>
      </div>

      ${includeDeontology ? `
        <div style="background-color:#fffbeb; border:1px solid #fef3c7; border-left:4px solid #d97706; padding:12px 16px; border-radius:4px; margin-bottom:20px; font-size:0.8rem; color:#92400e; line-height:1.4;">
          <strong>ADVERTENCIA DEONTOLÓGICA Y ALCANCE:</strong> Este informe es una herramienta técnica de investigación y preparación jurídica basada exclusivamente en el ordenamiento jurídico de la República del Ecuador. No sustituye el criterio, revisión y patrocinio del abogado, no garantiza un resultado judicial y no constituye asesoría jurídica definitiva.
        </div>
      ` : ''}

      <!-- Case Fact Sheet Table -->
      <div style="margin-bottom:24px;">
        <h3 style="font-size:0.96rem; font-weight:700; color:#1a365d; margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
          1. Ficha del Expediente y Datos Registrales
        </h3>
        <table class="table" style="font-size:0.82rem;">
          <tbody>
            <tr>
              <td style="width:25%; font-weight:700;">Cliente / Patrocinado:</td>
              <td style="width:25%;">${clientDisplay} (C.I: ${cedulaDisplay})</td>
              <td style="width:25%; font-weight:700;">Rol del Análisis:</td>
              <td style="width:25%; font-weight:700; color:#1e40af;">${c.role.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="font-weight:700;">Ubicación Política:</td>
              <td>${a.locationDesc}</td>
              <td style="font-weight:700;">Superficie / Cabida:</td>
              <td>${c.location?.surface || 'Pendiente de peritaje'}</td>
            </tr>
            <tr>
              <td style="font-weight:700;">Clave Catastral:</td>
              <td>${c.location?.cadastralKey || 'No registrada'}</td>
              <td style="font-weight:700;">Titular Registral:</td>
              <td>${ownerDisplay}</td>
            </tr>
            <tr>
              <td style="font-weight:700;">Fecha Inicio Posesión:</td>
              <td>${c.possession?.startDate || 'No precisada'}</td>
              <td style="font-weight:700;">Tiempo Computado:</td>
              <td>${a.yearsPossession !== null ? `${a.yearsPossession} años (Exigido: 15 años)` : 'No calculable'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Linderos -->
      <div style="margin-bottom:24px;">
        <h3 style="font-size:0.96rem; font-weight:700; color:#1a365d; margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
          2. Individualización Perimétrica del Inmueble (Art. 142 num. 4 COGEP)
        </h3>
        <table class="table" style="font-size:0.8rem;">
          <tbody>
            <tr>
              <td style="width:25%; font-weight:700;">Norte:</td><td>${c.location?.boundaries?.north || 'Por delimitar pericialmente'}</td>
              <td style="width:25%; font-weight:700;">Sur:</td><td>${c.location?.boundaries?.south || 'Por delimitar pericialmente'}</td>
            </tr>
            <tr>
              <td style="font-weight:700;">Este:</td><td>${c.location?.boundaries?.east || 'Por delimitar pericialmente'}</td>
              <td style="font-weight:700;">Oeste:</td><td>${c.location?.boundaries?.west || 'Por delimitar pericialmente'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 9-Part Research Summary -->
      <div style="margin-bottom:24px;">
        <h3 style="font-size:0.96rem; font-weight:700; color:#1a365d; margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
          3. Dictamen Estructurado de Investigación Jurídica (9 Puntos)
        </h3>
        
        <div style="margin-bottom:12px;">
          <strong>3.1 Resumen del Problema:</strong> ${a.researchAssistant.punto1_resumenProblema}
        </div>
        <div style="margin-bottom:12px;">
          <strong>3.2 Hechos Conocidos:</strong>
          <ul style="padding-left:18px; margin-top:4px;">
            ${a.researchAssistant.punto2_hechosConocidos.map(h => `<li>${h}</li>`).join('')}
          </ul>
        </div>
        <div style="margin-bottom:12px;">
          <strong style="color:#b91c1c;">3.3 Hechos Faltantes por Corroborar:</strong>
          <ul style="padding-left:18px; margin-top:4px; color:#b91c1c;">
            ${a.researchAssistant.punto3_hechosFaltantes.map(h => `<li>${h}</li>`).join('')}
          </ul>
        </div>
        <div style="margin-bottom:12px;">
          <strong>3.4 Análisis Estratégico para el Rol (${c.role.toUpperCase()}):</strong>
          <p style="margin-top:4px;">${a.researchAssistant.punto6_analisisRol}</p>
        </div>
        <div style="margin-bottom:12px;">
          <strong style="color:#b91c1c;">3.5 Argumentos Contrarios y Riesgos:</strong>
          <ul style="padding-left:18px; margin-top:4px;">
            ${a.researchAssistant.punto7_argumentosContrariosYRiesgos.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
        <div style="margin-bottom:12px;">
          <strong>3.6 Próximos Pasos y Diligencias:</strong>
          <ol style="padding-left:18px; margin-top:4px;">
            ${a.researchAssistant.punto8_proximosPasosYDocumentos.map(p => `<li>${p}</li>`).join('')}
          </ol>
        </div>
      </div>

      <!-- Verified Sources Index -->
      <div style="margin-bottom:24px;">
        <h3 style="font-size:0.96rem; font-weight:700; color:#1a365d; margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
          4. Índice de Fuentes Jurídicas Ecuatorianas Verificadas
        </h3>
        <table class="table" style="font-size:0.76rem;">
          <thead>
            <tr>
              <th>Norma / Resolución</th>
              <th>Órgano / Fuente Primaria</th>
              <th>Regla o Criterio Aplicado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${a.verifiedNorms.map(n => `
              <tr>
                <td><strong>${n.official_name} - ${n.article_or_cause}</strong></td>
                <td>${n.official_source}</td>
                <td>${n.relevant_text.substring(0, 140)}...</td>
                <td><span class="badge badge-verified">VERIFICADO</span></td>
              </tr>
            `).join('')}
            ${a.verifiedJurisprudence.map(j => `
              <tr>
                <td><strong>${j.official_name} (${j.article_or_cause})</strong></td>
                <td>${j.organ}</td>
                <td>${j.relevant_text.substring(0, 140)}...</td>
                <td><span class="badge badge-verified">VERIFICADO</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Formal Footer -->
      <div style="border-top:1px solid #e2e8f0; padding-top:14px; font-size:0.75rem; color:#718096; text-align:center;">
        Generado por LexDominio Ecuador • Registro de Fuentes Primarias con Fecha de Corte: ${a.cutoffDate} • Documento de Trabajo Confidencial
      </div>
    `;
  }

  async function downloadDocx() {
    const c = CaseModule.getActiveCase();
    if (!c) {
      App.showToast('Seleccione un expediente para exportar', 'danger');
      return;
    }

    const anonymize = document.getElementById('exportAnonymizeToggle')?.checked || false;
    App.showToast('Generando documento Word nativo (.DOCX)...');

    try {
      const res = await fetch(`/api/cases/${c.id}/export/docx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymize })
      });

      if (!res.ok) {
        throw new Error('Error al generar archivo Word');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Informe_LexDominio_${c.code}_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      App.showToast('Documento Word descargado exitosamente');
    } catch (e) {
      console.error(e);
      App.showToast('Error al descargar documento DOCX', 'danger');
    }
  }

  function printReport() {
    window.print();
  }

  async function downloadBackup() {
    try {
      window.location.href = '/api/backup';
      App.showToast('Descargando copia de seguridad JSON...');
    } catch (e) {
      console.error(e);
      App.showToast('Error al generar respaldo', 'danger');
    }
  }

  async function restoreBackup(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.cases || !Array.isArray(data.cases)) {
        App.showToast('El archivo de respaldo no tiene un formato válido', 'danger');
        return;
      }

      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        App.showToast(result.message);
        await CaseModule.loadCases();
      } else {
        App.showToast(result.message || 'Error al restaurar', 'danger');
      }
    } catch (e) {
      console.error(e);
      App.showToast('Error al procesar archivo de restauración', 'danger');
    }
  }

  return {
    refreshPreview,
    downloadDocx,
    printReport,
    downloadBackup,
    restoreBackup
  };
})();
