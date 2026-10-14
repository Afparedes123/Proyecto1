// ==========================================================================
// LexDominio Ecuador - Módulo de Documentos y Matriz Probatoria (docModule.js)
// ==========================================================================

const DocModule = (() => {

  function renderCaseDocsAndEvidence() {
    const c = CaseModule.getActiveCase();
    if (!c) return;

    renderDocumentsList(c.documents || []);
    renderEvidenceTable(c.evidence || []);
    renderTimeline(c.chronology || []);
    renderWitnessQuestions(c.witnessQuestions || []);
  }

  // --- Document Upload & Display ---
  async function uploadDocument(file) {
    const activeCase = CaseModule.getActiveCase();
    if (!activeCase) return;

    const formData = new FormData();
    formData.append('document', file);

    App.showToast('Subiendo y extrayendo texto del documento...');

    try {
      const res = await fetch(`/api/cases/${activeCase.id}/documents`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        if (!activeCase.documents) activeCase.documents = [];
        activeCase.documents.push(data.document);
        renderDocumentsList(activeCase.documents);
        App.showToast(`Documento ${file.name} procesado exitosamente`);
      } else {
        App.showToast(data.message || 'Error al procesar documento', 'danger');
      }
    } catch (e) {
      console.error(e);
      App.showToast('Error de red al subir archivo', 'danger');
    }
  }

  function renderDocumentsList(docs) {
    const container = document.getElementById('caseDocumentsList');
    if (!container) return;

    if (!docs || docs.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:16px; font-size:0.8rem; color:var(--text-muted);">
          No se han cargado documentos en este expediente aún.
        </div>
      `;
      return;
    }

    container.innerHTML = docs.map(doc => {
      const sizeKb = (doc.size / 1024).toFixed(1);
      const isTextReady = doc.extractedText && doc.extractedText.length > 0;

      return `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <div style="min-width:0; flex:1;">
            <div style="font-weight:600; font-size:0.84rem; color:var(--primary-900); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              📄 ${doc.originalName}
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
              ${sizeKb} KB • ${doc.extractionStatus} ${isTextReady ? `• <strong>${doc.wordCount} palabras</strong>` : ''}
            </div>
          </div>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            ${isTextReady ? `
              <button class="btn btn-sm btn-outline" onclick="DocModule.viewExtractedText('${doc.id}')">
                Ver Texto
              </button>
            ` : ''}
            <a href="/uploads/${doc.filename}" target="_blank" class="btn btn-sm btn-outline" download="${doc.originalName}">
              Descargar Original
            </a>
            <button class="btn btn-sm btn-danger" onclick="DocModule.deleteDocument('${doc.id}')">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function viewExtractedText(docId) {
    const activeCase = CaseModule.getActiveCase();
    if (!activeCase) return;
    const doc = (activeCase.documents || []).find(d => d.id === docId);
    if (!doc) return;

    const modalTitle = document.getElementById('viewTextTitle');
    const modalMeta = document.getElementById('viewTextMeta');
    const modalContent = document.getElementById('viewTextContent');

    if (modalTitle) modalTitle.textContent = `Texto Extraído: ${doc.originalName}`;
    if (modalMeta) modalMeta.textContent = `Palabras: ${doc.wordCount} | Estado: ${doc.extractionStatus} | Fecha de carga: ${new Date(doc.uploadDate).toLocaleString('es-EC')}`;
    if (modalContent) modalContent.value = doc.extractedText || 'Sin texto extraíble.';

    App.openModal('modalViewText');
  }

  async function deleteDocument(docId) {
    if (!confirm('¿Eliminar este documento del expediente?')) return;
    const activeCase = CaseModule.getActiveCase();
    if (!activeCase) return;

    try {
      const res = await fetch(`/api/cases/${activeCase.id}/documents/${docId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        activeCase.documents = (activeCase.documents || []).filter(d => d.id !== docId);
        renderDocumentsList(activeCase.documents);
        App.showToast('Documento eliminado');
      }
    } catch (e) {
      console.error(e);
      App.showToast('Error al eliminar documento', 'danger');
    }
  }

  // --- Evidence Table ---
  function renderEvidenceTable(evidenceList) {
    const tbody = document.getElementById('evidenceTableBody');
    if (!tbody) return;

    if (!evidenceList || evidenceList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:16px; color:var(--text-muted);">No hay medios probatorios registrados.</td></tr>`;
      return;
    }

    tbody.innerHTML = evidenceList.map((ev, idx) => {
      let badgeClass = 'badge-verified';
      if (ev.status === 'En trámite') badgeClass = 'badge-pending';
      if (ev.status === 'Pendiente de solicitud en demanda') badgeClass = 'badge-user';
      if (ev.status === 'No obtenida') badgeClass = 'badge-unreachable';

      return `
        <tr>
          <td><span class="badge badge-outline" style="border:1px solid #cbd5e1;">${ev.type}</span></td>
          <td>
            <strong>${ev.name}</strong>
            <div style="font-size:0.75rem; color:#475569; margin-top:2px;">${ev.description || ''}</div>
          </td>
          <td><span class="badge ${badgeClass}">${ev.status}</span></td>
          <td style="text-align:right;">
            <button class="btn btn-sm btn-danger" onclick="DocModule.deleteEvidence(${idx})">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function addEvidence(newItem) {
    const activeCase = CaseModule.getActiveCase();
    if (!activeCase) return;
    if (!activeCase.evidence) activeCase.evidence = [];

    activeCase.evidence.push({
      id: `ev-${Date.now()}`,
      ...newItem,
      date: new Date().toISOString().split('T')[0]
    });

    CaseModule.saveActiveCase(false);
    renderEvidenceTable(activeCase.evidence);
    App.closeModal('modalAddEvidence');
    App.showToast('Medio de prueba agregado');
  }

  function deleteEvidence(idx) {
    const activeCase = CaseModule.getActiveCase();
    if (!activeCase || !activeCase.evidence) return;
    activeCase.evidence.splice(idx, 1);
    CaseModule.saveActiveCase(false);
    renderEvidenceTable(activeCase.evidence);
    App.showToast('Prueba eliminada');
  }

  // --- Timeline ---
  function renderTimeline(chronology) {
    const container = document.getElementById('caseTimelineContainer');
    if (!container) return;

    if (!chronology || chronology.length === 0) {
      container.innerHTML = `
        <div style="color:var(--text-muted); font-size:0.8rem; padding:12px 0;">
          No hay hitos cronológicos registrados en la posesión.
        </div>
      `;
      return;
    }

    // Sort by date ascending
    const sorted = [...chronology].sort((a, b) => new Date(a.date) - new Date(b.date));

    container.innerHTML = sorted.map((item, idx) => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div class="timeline-date">${item.date}</div>
          <button class="btn btn-sm btn-outline" style="padding:2px 6px; font-size:0.7rem;" onclick="DocModule.deleteChronology(${idx})">Eliminar</button>
        </div>
        <div class="timeline-text">${item.event}</div>
      </div>
    `).join('');
  }

  function addChronologyMilestone(date, event) {
    const activeCase = CaseModule.getActiveCase();
    if (!activeCase) return;
    if (!activeCase.chronology) activeCase.chronology = [];

    activeCase.chronology.push({ date, event });
    CaseModule.saveActiveCase(false);
    renderTimeline(activeCase.chronology);
    App.closeModal('modalAddChronology');
    App.showToast('Hito cronológico guardado');
  }

  function deleteChronology(idx) {
    const activeCase = CaseModule.getActiveCase();
    if (!activeCase || !activeCase.chronology) return;
    activeCase.chronology.splice(idx, 1);
    CaseModule.saveActiveCase(false);
    renderTimeline(activeCase.chronology);
    App.showToast('Hito eliminado');
  }

  // --- Witness Questions ---
  function renderWitnessQuestions(questions) {
    const container = document.getElementById('witnessQuestionsList');
    if (!container) return;

    if (!questions || questions.length === 0) {
      container.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted);">No hay preguntas configuradas para testigos.</div>`;
      return;
    }

    container.innerHTML = questions.map((q, idx) => `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <div style="font-size:0.84rem; color:var(--primary-900);">
          <strong>${idx + 1}.</strong> ${q}
        </div>
        <button class="btn btn-sm btn-danger" onclick="DocModule.deleteWitnessQuestion(${idx})">🗑️</button>
      </div>
    `).join('');
  }

  function addWitnessQuestion() {
    const text = prompt('Ingrese la nueva pregunta técnica para el testigo:');
    if (!text || !text.trim()) return;

    const activeCase = CaseModule.getActiveCase();
    if (!activeCase) return;
    if (!activeCase.witnessQuestions) activeCase.witnessQuestions = [];

    activeCase.witnessQuestions.push(text.trim());
    CaseModule.saveActiveCase(false);
    renderWitnessQuestions(activeCase.witnessQuestions);
    App.showToast('Pregunta testimonial agregada');
  }

  function deleteWitnessQuestion(idx) {
    const activeCase = CaseModule.getActiveCase();
    if (!activeCase || !activeCase.witnessQuestions) return;
    activeCase.witnessQuestions.splice(idx, 1);
    CaseModule.saveActiveCase(false);
    renderWitnessQuestions(activeCase.witnessQuestions);
    App.showToast('Pregunta eliminada');
  }

  return {
    renderCaseDocsAndEvidence,
    uploadDocument,
    viewExtractedText,
    deleteDocument,
    addEvidence,
    deleteEvidence,
    addChronologyMilestone,
    deleteChronology,
    addWitnessQuestion,
    deleteWitnessQuestion
  };
})();
