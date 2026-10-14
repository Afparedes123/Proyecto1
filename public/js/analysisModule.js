// ==========================================================================
// LexDominio Ecuador - Módulo de Análisis Jurídico Especializado (analysisModule.js)
// ==========================================================================

const AnalysisModule = (() => {
  let currentAnalysis = null;

  async function runAnalysis(overrideRole = null) {
    const activeCase = CaseModule.getActiveCase();
    if (!activeCase) return;

    if (overrideRole) {
      activeCase.role = overrideRole;
      CaseModule.saveActiveCase(false);
    }

    try {
      const res = await fetch(`/api/cases/${activeCase.id}/analysis`);
      const data = await res.json();
      if (data.success) {
        currentAnalysis = data.analysis;
        renderAnalysisView();
      }
    } catch (e) {
      console.error('Error al ejecutar análisis:', e);
      App.showToast('Error al procesar el análisis jurídico', 'danger');
    }
  }

  function renderAnalysisView() {
    if (!currentAnalysis) return;
    const a = currentAnalysis;

    // Role Indicator
    const roleIndicator = document.getElementById('analysisRoleIndicator');
    if (roleIndicator) {
      if (a.role === 'actora') {
        roleIndicator.textContent = 'Parte Actora (Demandante de Prescripción)';
        roleIndicator.style.color = '#1d4ed8';
      } else if (a.role === 'demandada') {
        roleIndicator.textContent = 'Parte Demandada (Titular / Opositor al Despojo)';
        roleIndicator.style.color = '#b91c1c';
      } else {
        roleIndicator.textContent = 'Análisis Neutral y Auditoría Integral de Riesgos';
        roleIndicator.style.color = '#334155';
      }
    }

    // Render Obstacles
    renderObstacles(a.detectedObstacles);

    // Render Role Matrix
    renderMatrix(a);

    // Render Theory of the Case or Defenses
    renderTheoryOrDefenses(a);

    // Render 9-Part Research Assistant
    renderResearchAssistant(a.researchAssistant);
  }

  function renderObstacles(obstacles) {
    const container = document.getElementById('analysisObstaclesContainer');
    const badge = document.getElementById('obstacleCountBadge');
    if (!container) return;

    if (!obstacles || obstacles.length === 0) {
      container.innerHTML = `
        <div style="background-color:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:16px; color:#166534; font-size:0.84rem;">
          ✓ <strong>No se detectaron impedimentos jurídicos absolutos inmediatos</strong> en la información suministrada. Sin embargo, se requiere comprobación en inspección judicial y prueba documental oficial de antecedentes.
        </div>
      `;
      if (badge) {
        badge.textContent = '0 Alertas Críticas';
        badge.className = 'badge badge-verified';
      }
      return;
    }

    if (badge) {
      badge.textContent = `${obstacles.length} Alerta(s) Detectada(s)`;
      badge.className = 'badge badge-unreachable';
    }

    container.innerHTML = obstacles.map(obs => {
      const isCritical = obs.severity.includes('ALTA') || obs.severity.includes('DIRIMENTE');
      const cardClass = isCritical ? 'obstacle-danger' : 'obstacle-warning';
      return `
        <div class="obstacle-card ${cardClass}">
          <div style="font-size:1.2rem;">${isCritical ? '🛑' : '⚠️'}</div>
          <div>
            <div class="obstacle-title">${obs.title}</div>
            <div class="obstacle-desc">${obs.detail}</div>
            <div style="margin-top:6px; font-size:0.75rem; color:var(--text-muted);">
              <strong>Severidad procesal:</strong> ${obs.severity}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderMatrix(a) {
    const thead = document.getElementById('analysisMatrixThead');
    const tbody = document.getElementById('analysisMatrixTbody');
    const title = document.getElementById('matrixTitle');
    if (!thead || !tbody) return;

    if (a.role === 'actora') {
      if (title) title.textContent = 'Matriz de Elementos Jurídicos Sustanciales (Parte Actora)';
      thead.innerHTML = `
        <tr>
          <th style="width:22%;">Presupuesto Canónico</th>
          <th style="width:22%;">Hecho Alegado</th>
          <th style="width:18%;">Prueba Disponible</th>
          <th style="width:18%;">Prueba Faltante</th>
          <th style="width:10%;">Nivel de Riesgo</th>
          <th style="width:10%;">Base Legal EC</th>
        </tr>
      `;
      tbody.innerHTML = a.roleMatrix.map(m => `
        <tr>
          <td><strong>${m.elemento}</strong></td>
          <td>${m.hechoAlegado}</td>
          <td><span style="color:#15803d; font-size:0.8rem;">${m.pruebaDisponible}</span></td>
          <td><span style="color:#b91c1c; font-size:0.8rem;">${m.pruebaFaltante}</span></td>
          <td><span class="badge ${m.riesgo.includes('Bajo') ? 'badge-verified' : 'badge-unreachable'}">${m.riesgo}</span></td>
          <td><span style="font-size:0.75rem; font-weight:600; color:#1e40af;">${m.fuenteVerificada}</span></td>
        </tr>
      `).join('');
    } else if (a.role === 'demandada') {
      if (title) title.textContent = 'Matriz de Objeciones y Excepciones Procesales (Parte Demandada)';
      thead.innerHTML = `
        <tr>
          <th style="width:20%;">Elemento en Discusión</th>
          <th style="width:20%;">Versión de la Actora</th>
          <th style="width:20%;">Posible Objeción Fáctica</th>
          <th style="width:20%;">Hecho que Debe Verificarse</th>
          <th style="width:20%;">Prueba Útil y Fuente Legal</th>
        </tr>
      `;
      tbody.innerHTML = a.roleMatrix.map(m => `
        <tr>
          <td><strong>${m.elemento}</strong></td>
          <td>${m.hechoAlegado}</td>
          <td><span style="color:#b45309; font-weight:600;">${m.posibleObjecion}</span></td>
          <td>${m.hechoVerificar}</td>
          <td>
            <div style="font-size:0.78rem;"><strong>Prueba:</strong> ${m.pruebaUtil}</div>
            <div style="font-size:0.74rem; color:#1e40af; margin-top:4px;"><strong>Base:</strong> ${m.fuenteVerificada}</div>
          </td>
        </tr>
      `).join('');
    } else {
      // Neutral
      if (title) title.textContent = 'Matriz Comparativa de Elementos en Litigio (Análisis Neutral)';
      thead.innerHTML = `
        <tr>
          <th>Punto Controversial</th>
          <th>Tesis Actora</th>
          <th>Tesis Demandada</th>
          <th>Hecho Decisivo Dirimente</th>
        </tr>
      `;
      tbody.innerHTML = `
        <tr>
          <td><strong>Posesión vs Mera Tenencia</strong></td>
          <td>Acredita actos materiales visibles y contratación de servicios básicos a su nombre.</td>
          <td>Invoca ingreso subordinado por contrato de arrendamiento, comodato o relación laboral.</td>
          <td>Existencia de documentos firmados donde conste reconocimiento de dominio ajeno (Art. 730 C.C.).</td>
        </tr>
        <tr>
          <td><strong>Cómputo Ininterrumpido de 15 Años</strong></td>
          <td>Computa el tiempo desde la fecha de ocupación inicial sin reclamos formales.</td>
          <td>Cuestiona la fecha fáctica de inicio y alega requerimientos notariales o citación previa.</td>
          <td>Fecha comprobable con documentos públicos de las primeras instalaciones o impuestos.</td>
        </tr>
        <tr>
          <td><strong>Delimitación e Individualización</strong></td>
          <td>Presenta plano topográfico de área singularizada.</td>
          <td>Alega superposición con fajas de servidumbre o falta de coincidencia con linderos matrices.</td>
          <td>Inspección judicial asistida de perito judicial imparcial (Art. 228 COGEP).</td>
        </tr>
      `;
    }
  }

  function renderTheoryOrDefenses(a) {
    const container = document.getElementById('analysisTheoryContainer');
    const title = document.getElementById('theoryCardTitle');
    if (!container) return;

    if (a.role === 'actora') {
      if (title) title.textContent = 'Estructura de la Teoría del Caso (Parte Actora)';
      const t = a.theoryOfTheCase;
      container.innerHTML = `
        <div class="theory-box">
          <div class="theory-title">Teoría Fáctica</div>
          <div class="theory-body">${t.faktica}</div>
        </div>
        <div class="theory-box" style="border-left-color:var(--accent-gold);">
          <div class="theory-title" style="color:var(--accent-gold);">Teoría Probatoria</div>
          <div class="theory-body">${t.probatoria}</div>
        </div>
        <div class="theory-box" style="border-left-color:var(--success-green);">
          <div class="theory-title" style="color:var(--success-green);">Teoría Jurídica (Normativa Ecuatoriana)</div>
          <div class="theory-body">${t.juridica}</div>
        </div>
      `;
    } else if (a.role === 'demandada') {
      if (title) title.textContent = 'Estrategia de Excepciones y Defensas Procesales (Parte Demandada)';
      container.innerHTML = (a.defensesAndExceptions || []).map(def => `
        <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:14px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <h4 style="font-size:0.92rem; font-weight:700; color:var(--primary-900);">${def.nombre}</h4>
            <span class="badge ${def.tipo.includes('Fondo') ? 'badge-user' : 'badge-pending'}">${def.tipo}</span>
          </div>
          <p style="font-size:0.83rem; color:var(--primary-700); margin-bottom:6px;">
            <strong>Fundamento Fáctico:</strong> ${def.fundamentoFactico}
          </p>
          <p style="font-size:0.83rem; color:#1e40af; margin-bottom:6px;">
            <strong>Fundamento Jurídico Ecuatoriano:</strong> ${def.fundamentoJuridico}
          </p>
          <p style="font-size:0.8rem; color:#15803d;">
            <strong>Prueba Clave para Sustentar la Excepción:</strong> ${def.pruebaRecomendada}
          </p>
        </div>
      `).join('');
    } else {
      // Neutral
      if (title) title.textContent = 'Evaluación Cualitativa Ponderada de Riesgos (Sin Porcentajes Arbitrarios)';
      const n = a.neutralEvaluation;
      container.innerHTML = `
        <div class="grid-2" style="margin-bottom:16px;">
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:14px;">
            <h4 style="font-size:0.88rem; font-weight:700; color:#166534; margin-bottom:8px;">Puntos Fuertes de la Parte Actora</h4>
            <ul style="padding-left:18px; font-size:0.82rem; color:#14532d;">
              ${(n.puntosFuertesActora || []).map(p => `<li>${p}</li>`).join('')}
            </ul>
          </div>
          <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:14px;">
            <h4 style="font-size:0.88rem; font-weight:700; color:#991b1b; margin-bottom:8px;">Puntos Débiles de la Parte Actora</h4>
            <ul style="padding-left:18px; font-size:0.82rem; color:#7f1d1d;">
              ${(n.puntosDebilesActora || []).map(p => `<li>${p}</li>`).join('')}
            </ul>
          </div>
        </div>
        <div class="grid-2" style="margin-bottom:16px;">
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:14px;">
            <h4 style="font-size:0.88rem; font-weight:700; color:#166534; margin-bottom:8px;">Puntos Fuertes de la Parte Demandada</h4>
            <ul style="padding-left:18px; font-size:0.82rem; color:#14532d;">
              ${(n.puntosFuertesDemandada || []).map(p => `<li>${p}</li>`).join('')}
            </ul>
          </div>
          <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:14px;">
            <h4 style="font-size:0.88rem; font-weight:700; color:#991b1b; margin-bottom:8px;">Puntos Débiles de la Parte Demandada</h4>
            <ul style="padding-left:18px; font-size:0.82rem; color:#7f1d1d;">
              ${(n.puntosDebilesDemandada || []).map(p => `<li>${p}</li>`).join('')}
            </ul>
          </div>
        </div>
        <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:6px; padding:14px;">
          <h4 style="font-size:0.88rem; font-weight:700; color:#b45309; margin-bottom:8px;">Hechos Dirimentes Decisivos</h4>
          <ul style="padding-left:18px; font-size:0.82rem; color:#78350f;">
            ${(n.hechosDirimentes || []).map(h => `<li>${h}</li>`).join('')}
          </ul>
        </div>
      `;
    }
  }

  function renderResearchAssistant(ra) {
    const container = document.getElementById('analysisResearchContainer');
    if (!container || !ra) return;

    container.innerHTML = `
      <!-- Punto 1 -->
      <div class="research-section">
        <div class="research-heading"><span class="step-num">1</span> Resumen Breve del Problema Jurídico</div>
        <div class="research-body">${ra.punto1_resumenProblema}</div>
      </div>

      <!-- Punto 2 -->
      <div class="research-section">
        <div class="research-heading"><span class="step-num">2</span> Hechos Conocidos y Circunstancias Relevantes</div>
        <div class="research-body">
          <ul style="padding-left:18px;">
            ${ra.punto2_hechosConocidos.map(h => `<li>${h}</li>`).join('')}
          </ul>
        </div>
      </div>

      <!-- Punto 3 -->
      <div class="research-section">
        <div class="research-heading"><span class="step-num">3</span> Hechos que Faltan o Deben Corroborarse</div>
        <div class="research-body">
          <ul style="padding-left:18px; color:#b91c1c;">
            ${ra.punto3_hechosFaltantes.map(h => `<li>${h}</li>`).join('')}
          </ul>
        </div>
      </div>

      <!-- Punto 4 -->
      <div class="research-section">
        <div class="research-heading"><span class="step-num">4</span> Normas Jurídicas Ecuatorianas Verificadas</div>
        <div class="research-body">
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${ra.punto4_normasVerificadas.map(n => `
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 14px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <strong>${n.articulo}</strong>
                  <span class="badge badge-verified">${n.estadoVerificacion}</span>
                </div>
                <div style="font-size:0.78rem; color:#475569; margin-top:4px;">${n.textoPertinente}</div>
                <div style="font-size:0.72rem; color:var(--text-muted); margin-top:4px;">
                  Fuente: ${n.fuenteOficial} | <a href="${n.enlace}" target="_blank" style="color:var(--legal-blue);">Enlace oficial</a>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Punto 5 -->
      <div class="research-section">
        <div class="research-heading"><span class="step-num">5</span> Jurisprudencia Ecuatoriana Verificada</div>
        <div class="research-body">
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${ra.punto5_jurisprudenciaVerificada.map(j => `
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 14px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <strong>${j.identificacion}</strong>
                  <span class="badge badge-verified">${j.estadoVerificacion}</span>
                </div>
                <div style="font-size:0.78rem; color:#475569; margin-top:4px;"><strong>Criterio:</strong> ${j.criterioPertinente}</div>
                <div style="font-size:0.72rem; color:var(--text-muted); margin-top:4px;">
                  Órgano: ${j.organo} (Fecha: ${j.fecha}) | <a href="${j.enlace}" target="_blank" style="color:var(--legal-blue);">Repositorio Oficial</a>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Punto 6 -->
      <div class="research-section">
        <div class="research-heading"><span class="step-num">6</span> Análisis Especializado para el Rol Seleccionado</div>
        <div class="research-body">${ra.punto6_analisisRol}</div>
      </div>

      <!-- Punto 7 -->
      <div class="research-section">
        <div class="research-heading"><span class="step-num">7</span> Argumentos Contrarios Previsibles y Riesgos Procesales</div>
        <div class="research-body">
          <ul style="padding-left:18px;">
            ${ra.punto7_argumentosContrariosYRiesgos.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
      </div>

      <!-- Punto 8 -->
      <div class="research-section">
        <div class="research-heading"><span class="step-num">8</span> Próximos Pasos y Diligencias Probatorias por Desarrollar</div>
        <div class="research-body">
          <ol style="padding-left:18px;">
            ${ra.punto8_proximosPasosYDocumentos.map(p => `<li>${p}</li>`).join('')}
          </ol>
        </div>
      </div>

      <!-- Punto 9 -->
      <div class="research-section" style="border-bottom:none; margin-bottom:0; padding-bottom:0;">
        <div class="research-heading"><span class="step-num">9</span> Alcance y Fecha de Corte de la Investigación</div>
        <div class="research-body" style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">
          ${ra.punto9_alcanceYFechaCorte}
        </div>
      </div>
    `;
  }

  return {
    runAnalysis,
    getCurrentAnalysis: () => currentAnalysis
  };
})();
