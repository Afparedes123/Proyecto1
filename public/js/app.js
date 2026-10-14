// ==========================================================================
// LexDominio Ecuador - Controlador Principal de la Aplicación (app.js)
// ==========================================================================

const App = (() => {
  let currentView = 'cases';

  function init() {
    setupNavigation();
    setupModals();
    setupFormEvents();
    setupAnalysisEvents();
    setupSearchEvents();
    setupDocEvents();
    setupExportEvents();

    // Initial Load
    CaseModule.loadCases();
    SearchModule.initSearch();
  }

  // --- View Routing ---
  function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link[data-view]');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = link.getAttribute('data-view');
        switchView(targetView);
      });
    });

    // Form sub-tabs
    const tabBtns = document.querySelectorAll('.tab-btn[data-form-tab]');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const targetTab = btn.getAttribute('data-form-tab');
        document.querySelectorAll('.form-tab-content').forEach(tab => {
          tab.style.display = 'none';
        });
        const targetContent = document.getElementById(targetTab);
        if (targetContent) targetContent.style.display = 'block';
      });
    });

    // Top action buttons
    document.getElementById('btnNewCaseModal')?.addEventListener('click', () => {
      openModal('modalNewCase');
    });

    document.getElementById('btnQuickNewCase')?.addEventListener('click', () => {
      openModal('modalNewCase');
    });

    document.getElementById('caseSearchInput')?.addEventListener('input', (e) => {
      CaseModule.renderCasesTable(e.target.value);
    });

    document.getElementById('btnToggleHelp')?.addEventListener('click', () => {
      alert(`GUÍA DE PRESCRIPCIÓN EXTRAORDINARIA ADQUISITIVA DE DOMINIO (ECUADOR):
1. Presupuestos Canónicos (Sentencia CNJ Res. 076-2012):
   • Posesión material con ánimo de señor y dueño (Art. 715 C.C.).
   • Tiempo legal de 15 años ininterrumpidos (Art. 2411 C.C.).
   • Cosa en el comercio humano (no pública ni municipal, Art. 2398 C.C.).
   • Legítimo contradictor (titular registral inscrito o herederos, Art. 143 COGEP).

2. Cuidado Deontológico:
   • La mera tenencia no prescribe (Art. 734 C.C.).
   • Los bienes de uso público son imprescriptibles (Art. 417 COOTAD).`);
    });
  }

  function switchView(viewName) {
    currentView = viewName;

    // Update nav links
    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
      if (link.getAttribute('data-view') === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update panels
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.style.display = 'none';
    });
    const activePanel = document.getElementById(`view-${viewName}`);
    if (activePanel) activePanel.style.display = 'block';

    // Update Topbar Title & Description
    const titles = {
      cases: { title: 'Gestión de Expedientes', desc: 'Cree o seleccione un expediente para analizar los presupuestos de prescripción adquisitiva.' },
      form: { title: 'Ficha del Caso y Formulario Guiado', desc: 'Recopile y verifique hechos concretos, linderos, antecedentes registrales y actos de posesión.' },
      analysis: { title: 'Análisis Jurídico Especializado por Rol', desc: 'Matriz procesal, obstáculos, teoría del caso y dictamen en 9 puntos basado en fuentes ecuatorianas.' },
      search: { title: 'Búsqueda Jurídica Ecuatoriana', desc: 'Consulte normas y precedentes verificados de la Corte Nacional, Corte Constitucional y Registro Oficial.' },
      docs: { title: 'Documentos y Matriz Probatoria', desc: 'Cargue expedientes, extraiga texto y organice medios de prueba, cronología y cuestionario testimonial.' },
      export: { title: 'Informes y Exportación Profesional', desc: 'Genere informes editables en Word (.DOCX) o vista imprimible con índice de fuentes y anonimización.' },
      privacy: { title: 'Privacidad, Seguridad y Respaldo', desc: 'Arquitectura local-first segura, sin transmisión externa no autorizada y respaldo en JSON.' }
    };

    if (titles[viewName]) {
      document.getElementById('topbarViewTitle').textContent = titles[viewName].title;
      document.getElementById('topbarViewDesc').textContent = titles[viewName].desc;
    }

    // Trigger on-view lifecycle
    if (viewName === 'analysis') {
      AnalysisModule.runAnalysis();
    } else if (viewName === 'docs') {
      DocModule.renderCaseDocsAndEvidence();
    } else if (viewName === 'export') {
      ExportModule.refreshPreview();
    }
  }

  // --- Modal Helpers ---
  function setupModals() {
    // Close modal buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        closeModal(modalId);
      });
    });

    // Close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal(overlay.id);
        }
      });
    });

    // Submit New Case
    document.getElementById('btnSubmitNewCase')?.addEventListener('click', () => {
      const title = document.getElementById('newCaseTitle')?.value;
      if (!title || !title.trim()) {
        alert('Por favor ingrese el título del expediente');
        return;
      }

      const role = document.getElementById('newCaseRole')?.value || 'actora';
      const code = document.getElementById('newCaseCode')?.value || `EXP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      const client = document.getElementById('newCaseClient')?.value || '';
      const canton = document.getElementById('newCaseCanton')?.value || '';

      CaseModule.createCase({
        title,
        role,
        code,
        client,
        location: { canton, province: '', parroquia: '', sector: '', cadastralKey: '', surface: '', boundaries: {} }
      });

      closeModal('modalNewCase');
    });

    // Submit Manual Entry
    document.getElementById('btnSubmitManualEntry')?.addEventListener('click', () => {
      const official_name = document.getElementById('manualOfficialName')?.value;
      const article_or_cause = document.getElementById('manualArticleOrCause')?.value;
      const relevant_text = document.getElementById('manualRelevantText')?.value;

      if (!official_name || !article_or_cause || !relevant_text) {
        alert('Complete los campos obligatorios: Nombre oficial, Artículo/Causa y Texto pertinente.');
        return;
      }

      SearchModule.submitManualEntry({
        category: document.getElementById('manualCategory')?.value,
        organ: document.getElementById('manualOrgan')?.value,
        official_name,
        article_or_cause,
        relevant_text,
        official_source: document.getElementById('manualOfficialSource')?.value,
        official_url: document.getElementById('manualOfficialUrl')?.value
      });
    });

    // Open Manual Entry
    document.getElementById('btnOpenManualEntryModal')?.addEventListener('click', () => {
      openModal('modalManualEntry');
    });

    // Add Evidence Modal
    document.getElementById('btnAddEvidenceModal')?.addEventListener('click', () => {
      openModal('modalAddEvidence');
    });

    document.getElementById('btnSubmitAddEvidence')?.addEventListener('click', () => {
      const name = document.getElementById('evidenceNameInput')?.value;
      if (!name || !name.trim()) {
        alert('Ingrese el nombre del medio de prueba');
        return;
      }
      DocModule.addEvidence({
        type: document.getElementById('evidenceTypeInput')?.value,
        status: document.getElementById('evidenceStatusInput')?.value,
        name: name.trim(),
        description: document.getElementById('evidenceDescInput')?.value || ''
      });
    });

    // Add Chronology Modal
    document.getElementById('btnAddChronologyModal')?.addEventListener('click', () => {
      openModal('modalAddChronology');
    });

    document.getElementById('btnSubmitAddChronology')?.addEventListener('click', () => {
      const date = document.getElementById('chronoDateInput')?.value;
      const event = document.getElementById('chronoEventInput')?.value;
      if (!date || !event) {
        alert('Ingrese la fecha y el acontecimiento');
        return;
      }
      DocModule.addChronologyMilestone(date, event.trim());
    });
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
  }

  // --- Form Events ---
  function setupFormEvents() {
    const formFields = document.querySelectorAll('#view-form input, #view-form select, #view-form textarea');
    formFields.forEach(field => {
      field.addEventListener('input', () => {
        CaseModule.queueAutoSave();
      });
      field.addEventListener('change', () => {
        CaseModule.queueAutoSave();
      });
    });

    document.getElementById('btnSaveCaseExplicit')?.addEventListener('click', () => {
      CaseModule.saveActiveCase(true);
    });

    document.getElementById('caseRoleInput')?.addEventListener('change', (e) => {
      const c = CaseModule.getActiveCase();
      if (c) {
        c.role = e.target.value;
        CaseModule.saveActiveCase(false);
      }
    });
  }

  // --- Analysis Events ---
  function setupAnalysisEvents() {
    document.querySelectorAll('.role-switch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const role = btn.getAttribute('data-role');
        const roleSelect = document.getElementById('caseRoleInput');
        if (roleSelect) roleSelect.value = role;
        AnalysisModule.runAnalysis(role);
      });
    });

    document.getElementById('btnRefreshAnalysis')?.addEventListener('click', () => {
      AnalysisModule.runAnalysis();
    });
  }

  // --- Search Events ---
  function setupSearchEvents() {
    const qInput = document.getElementById('legalSearchQuery');
    const catSelect = document.getElementById('legalSearchCategory');

    qInput?.addEventListener('input', () => {
      SearchModule.performSearch();
    });

    catSelect?.addEventListener('change', () => {
      SearchModule.performSearch();
    });

    document.querySelectorAll('.search-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const term = chip.getAttribute('data-term');
        SearchModule.performSearch(term);
      });
    });

    document.getElementById('btnCheckPortalsHealth')?.addEventListener('click', () => {
      SearchModule.checkPortalsHealth();
    });
  }

  // --- Doc Events ---
  function setupDocEvents() {
    const fileInput = document.getElementById('fileDocInput');
    const triggerBtn = document.getElementById('btnTriggerUpload');

    triggerBtn?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        DocModule.uploadDocument(e.target.files[0]);
        e.target.value = '';
      }
    });

    document.getElementById('btnAddWitnessQuestion')?.addEventListener('click', () => {
      DocModule.addWitnessQuestion();
    });
  }

  // --- Export Events ---
  function setupExportEvents() {
    document.getElementById('exportAnonymizeToggle')?.addEventListener('change', () => {
      ExportModule.refreshPreview();
    });

    document.getElementById('exportIncludeDeontology')?.addEventListener('change', () => {
      ExportModule.refreshPreview();
    });

    document.getElementById('btnDownloadDocx')?.addEventListener('click', () => {
      ExportModule.downloadDocx();
    });

    document.getElementById('btnPrintReport')?.addEventListener('click', () => {
      ExportModule.printReport();
    });

    document.getElementById('btnDownloadBackup')?.addEventListener('click', () => {
      ExportModule.downloadBackup();
    });

    document.getElementById('btnRestoreBackup')?.addEventListener('click', () => {
      const fileInput = document.getElementById('restoreFileInput');
      if (fileInput?.files && fileInput.files.length > 0) {
        ExportModule.restoreBackup(fileInput.files[0]);
        fileInput.value = '';
      } else {
        alert('Seleccione un archivo JSON de respaldo');
      }
    });
  }

  // --- Toast Messages ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type === 'danger') {
      toast.style.borderLeftColor = '#ef4444';
    } else if (type === 'success') {
      toast.style.borderLeftColor = '#10b981';
    }

    toast.innerHTML = `<span>ℹ️</span> <div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  return {
    init,
    switchView,
    openModal,
    closeModal,
    showToast
  };
})();

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
