// ==========================================================================
// LexDominio Ecuador - Módulo de Gestión de Expedientes (caseModule.js)
// ==========================================================================

const CaseModule = (() => {
  let cases = [];
  let activeCase = null;
  let autoSaveTimer = null;

  async function loadCases() {
    try {
      const res = await fetch('/api/cases');
      const data = await res.json();
      if (data.success) {
        cases = data.cases;
        renderCasesTable();
        // If no active case selected, set the first one
        if (!activeCase && cases.length > 0) {
          await selectCase(cases[0].id);
        }
      }
    } catch (err) {
      console.error('Error al cargar casos:', err);
      App.showToast('Error al conectar con la base local de casos', 'danger');
    }
  }

  function renderCasesTable(filterTerm = '') {
    const tbody = document.getElementById('casesTableBody');
    if (!tbody) return;

    let filtered = cases;
    if (filterTerm.trim()) {
      const term = filterTerm.toLowerCase();
      filtered = cases.filter(c => 
        (c.code || '').toLowerCase().includes(term) ||
        (c.title || '').toLowerCase().includes(term) ||
        (c.client || '').toLowerCase().includes(term) ||
        (c.canton || '').toLowerCase().includes(term)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">No se encontraron expedientes con el criterio de búsqueda.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(c => {
      const isSelected = activeCase && activeCase.id === c.id;
      let roleClass = 'role-neutral';
      let roleLabel = 'Neutral';
      if (c.role === 'actora') { roleClass = 'role-actora'; roleLabel = 'Parte Actora'; }
      else if (c.role === 'demandada') { roleClass = 'role-demandada'; roleLabel = 'Parte Demandada'; }

      const demoTag = c.is_demo ? `<span class="badge badge-user" style="font-size:0.65rem; margin-left:6px;">FICTICIO / DEMO</span>` : '';

      return `
        <tr style="${isSelected ? 'background-color:#eff6ff;' : ''}">
          <td><strong>${c.code}</strong></td>
          <td>
            <strong>${c.title}</strong> ${demoTag}
          </td>
          <td><span class="active-case-role ${roleClass}">${roleLabel}</span></td>
          <td>${c.client || '<span style="color:#94a3b8;">No especificado</span>'}</td>
          <td>${c.canton || '<span style="color:#94a3b8;">No especificado</span>'}</td>
          <td><span style="font-size:0.75rem; color:#475569;">${c.proceduralStage}</span></td>
          <td style="font-size:0.75rem; color:#64748b;">${new Date(c.updatedAt).toLocaleDateString('es-EC')}</td>
          <td style="text-align:right;">
            <button class="btn btn-sm ${isSelected ? 'btn-gold' : 'btn-primary'}" onclick="CaseModule.selectCase('${c.id}')">
              ${isSelected ? '✓ Seleccionado' : 'Abrir'}
            </button>
            <button class="btn btn-sm btn-outline" title="Duplicar" onclick="CaseModule.duplicateCase('${c.id}')">📋</button>
            <button class="btn btn-sm btn-danger" title="Eliminar" onclick="CaseModule.deleteCase('${c.id}')">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function selectCase(id) {
    try {
      const res = await fetch(`/api/cases/${id}`);
      const data = await res.json();
      if (data.success) {
        activeCase = data.case;
        updateSidebarWidget();
        populateCaseForm();
        renderCasesTable();
        // Update dependent modules
        if (typeof DocModule !== 'undefined') DocModule.renderCaseDocsAndEvidence();
        if (typeof AnalysisModule !== 'undefined') AnalysisModule.runAnalysis();
        if (typeof ExportModule !== 'undefined') ExportModule.refreshPreview();
        App.showToast(`Expediente ${activeCase.code} cargado exitosamente`);
      }
    } catch (e) {
      console.error(e);
      App.showToast('Error al seleccionar expediente', 'danger');
    }
  }

  function updateSidebarWidget() {
    const codeElem = document.getElementById('activeCaseCodeDisplay');
    const roleElem = document.getElementById('activeCaseRoleBadge');
    if (!codeElem || !activeCase) return;

    codeElem.textContent = activeCase.code;
    roleElem.className = 'active-case-role';
    if (activeCase.role === 'actora') {
      roleElem.classList.add('role-actora');
      roleElem.textContent = 'Parte Actora';
    } else if (activeCase.role === 'demandada') {
      roleElem.classList.add('role-demandada');
      roleElem.textContent = 'Parte Demandada';
    } else {
      roleElem.classList.add('role-neutral');
      roleElem.textContent = 'Análisis Neutral';
    }

    const badge = document.getElementById('formCaseCodeBadge');
    if (badge) badge.textContent = `${activeCase.code} - ${activeCase.title}`;
  }

  function populateCaseForm() {
    if (!activeCase) return;
    const c = activeCase;

    // Tab 1
    setValue('caseRoleInput', c.role || 'actora');
    setValue('caseCodeInput', c.code || '');
    setValue('caseTitleInput', c.title || '');
    setValue('caseCutoffDateInput', c.cutoffDate || new Date().toISOString().split('T')[0]);
    setValue('caseClientInput', c.client || '');
    setValue('caseClientCedulaInput', c.clientCedula || '');
    setValue('caseProceduralStageInput', c.proceduralStage || 'Pre-procesal (Preparación de demanda)');
    setValue('caseCourtInput', c.court || '');
    setValue('caseCauseNumberInput', c.causeNumber || '');

    // Tab 2
    setValue('locProvinceInput', c.location?.province || '');
    setValue('locCantonInput', c.location?.canton || '');
    setValue('locParroquiaInput', c.location?.parroquia || '');
    setValue('locSectorInput', c.location?.sector || '');
    setValue('locCadastralKeyInput', c.location?.cadastralKey || '');
    setValue('locSurfaceInput', c.location?.surface || '');
    setValue('linderoNorthInput', c.location?.boundaries?.north || '');
    setValue('linderoSouthInput', c.location?.boundaries?.south || '');
    setValue('linderoEastInput', c.location?.boundaries?.east || '');
    setValue('linderoWestInput', c.location?.boundaries?.west || '');

    // Tab 3
    setValue('regOfficeInput', c.registry?.registryOffice || '');
    setValue('regOwnerInput', c.registry?.registeredOwner || '');
    setValue('regNumberInput', c.registry?.inscriptionNumber || '');
    setValue('regTomeInput', c.registry?.tome || '');
    setValue('regFolioInput', c.registry?.folio || '');
    setValue('regDateInput', c.registry?.inscriptionDate || '');
    setValue('regEncumbrancesInput', c.registry?.encumbrances || '');
    setValue('regBackgroundInput', c.registry?.backgroundDomain || '');

    // Tab 4
    setValue('possStartDateInput', c.possession?.startDate || '');
    setValue('possEntryInput', c.possession?.entryMethod || '');
    setValue('possActsInput', c.possession?.actsOfOwner || '');
    setValue('possContinuityInput', c.possession?.continuity || '');
    setValue('possPublicityInput', c.possession?.publicity || '');
    setValue('possPeacefulInput', c.possession?.peaceful || '');
    setValue('possRecogInput', c.possession?.recognitionOfForeignDomain || '');
    setValue('possInterrInput', c.possession?.interruptionsOrLawsuits || '');

    // Tab 5
    setValue('partyStatusInput', c.opposingParty?.status || '');
    setValue('partyCoOwnersInput', c.opposingParty?.coOwners || '');
    setValue('partyThirdPartiesInput', c.opposingParty?.thirdParties || '');

    // Tab 6
    setChecked('checkIsPublic', !!c.propertyNature?.isPublic);
    setChecked('checkIsMunicipal', !!c.propertyNature?.isMunicipal);
    setChecked('checkIsCommunal', !!c.propertyNature?.isCommunal);
    setChecked('checkIsProtectedArea', !!c.propertyNature?.isProtectedArea);
    setValue('natureObservationsInput', c.propertyNature?.observations || '');
  }

  function collectFormData() {
    if (!activeCase) return null;

    return {
      role: getValue('caseRoleInput'),
      code: getValue('caseCodeInput'),
      title: getValue('caseTitleInput'),
      cutoffDate: getValue('caseCutoffDateInput'),
      client: getValue('caseClientInput'),
      clientCedula: getValue('caseClientCedulaInput'),
      proceduralStage: getValue('caseProceduralStageInput'),
      court: getValue('caseCourtInput'),
      causeNumber: getValue('caseCauseNumberInput'),
      location: {
        province: getValue('locProvinceInput'),
        canton: getValue('locCantonInput'),
        parroquia: getValue('locParroquiaInput'),
        sector: getValue('locSectorInput'),
        cadastralKey: getValue('locCadastralKeyInput'),
        surface: getValue('locSurfaceInput'),
        boundaries: {
          north: getValue('linderoNorthInput'),
          south: getValue('linderoSouthInput'),
          east: getValue('linderoEastInput'),
          west: getValue('linderoWestInput')
        }
      },
      registry: {
        registryOffice: getValue('regOfficeInput'),
        registeredOwner: getValue('regOwnerInput'),
        inscriptionNumber: getValue('regNumberInput'),
        tome: getValue('regTomeInput'),
        folio: getValue('regFolioInput'),
        inscriptionDate: getValue('regDateInput'),
        encumbrances: getValue('regEncumbrancesInput'),
        backgroundDomain: getValue('regBackgroundInput')
      },
      possession: {
        startDate: getValue('possStartDateInput'),
        entryMethod: getValue('possEntryInput'),
        actsOfOwner: getValue('possActsInput'),
        continuity: getValue('possContinuityInput'),
        publicity: getValue('possPublicityInput'),
        peaceful: getValue('possPeacefulInput'),
        recognitionOfForeignDomain: getValue('possRecogInput'),
        interruptionsOrLawsuits: getValue('possInterrInput')
      },
      opposingParty: {
        status: getValue('partyStatusInput'),
        coOwners: getValue('partyCoOwnersInput'),
        thirdParties: getValue('partyThirdPartiesInput')
      },
      propertyNature: {
        isPublic: getChecked('checkIsPublic'),
        isMunicipal: getChecked('checkIsMunicipal'),
        isCommunal: getChecked('checkIsCommunal'),
        isProtectedArea: getChecked('checkIsProtectedArea'),
        observations: getValue('natureObservationsInput')
      }
    };
  }

  async function saveActiveCase(showToastNotice = true) {
    if (!activeCase) return;
    const patch = collectFormData();
    if (!patch) return;

    try {
      const res = await fetch(`/api/cases/${activeCase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const data = await res.json();
      if (data.success) {
        activeCase = data.case;
        updateSidebarWidget();
        // Update in cases array
        const idx = cases.findIndex(x => x.id === activeCase.id);
        if (idx !== -1) {
          cases[idx].code = activeCase.code;
          cases[idx].title = activeCase.title;
          cases[idx].role = activeCase.role;
          cases[idx].client = activeCase.client;
          cases[idx].canton = activeCase.location?.canton;
          cases[idx].updatedAt = activeCase.updatedAt;
        }
        renderCasesTable();

        const statusElem = document.getElementById('autoSaveStatus');
        if (statusElem) {
          statusElem.textContent = 'Guardado ' + new Date().toLocaleTimeString('es-EC');
          statusElem.style.color = '#15803d';
        }

        if (showToastNotice) {
          App.showToast('Cambios guardados en el expediente');
        }
      }
    } catch (err) {
      console.error(err);
      App.showToast('Error al guardar expediente', 'danger');
    }
  }

  function queueAutoSave() {
    const statusElem = document.getElementById('autoSaveStatus');
    if (statusElem) {
      statusElem.textContent = 'Modificaciones pendientes...';
      statusElem.style.color = '#b45309';
    }
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      saveActiveCase(false);
    }, 1200);
  }

  async function createCase(data) {
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        cases.unshift(result.case);
        renderCasesTable();
        await selectCase(result.case.id);
        App.switchView('form');
        App.showToast(`Expediente ${result.case.code} creado exitosamente`);
      }
    } catch (err) {
      console.error(err);
      App.showToast('Error al crear expediente', 'danger');
    }
  }

  async function deleteCase(id) {
    if (!confirm('¿Está seguro de eliminar este expediente? Esta acción no se puede deshacer.')) return;
    try {
      const res = await fetch(`/api/cases/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        cases = cases.filter(c => c.id !== id);
        renderCasesTable();
        if (activeCase && activeCase.id === id) {
          activeCase = null;
          if (cases.length > 0) selectCase(cases[0].id);
        }
        App.showToast('Expediente eliminado');
      }
    } catch (e) {
      console.error(e);
      App.showToast('Error al eliminar', 'danger');
    }
  }

  async function duplicateCase(id) {
    const src = cases.find(c => c.id === id);
    if (!src) return;
    try {
      const fullRes = await fetch(`/api/cases/${id}`);
      const fullData = await fullRes.json();
      if (fullData.success) {
        const copy = JSON.parse(JSON.stringify(fullData.case));
        copy.code = `${copy.code}-COPIA`;
        copy.title = `[COPIA] ${copy.title}`;
        copy.is_demo = false;
        await createCase(copy);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Helpers
  function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }
  function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }
  function setChecked(id, bool) {
    const el = document.getElementById(id);
    if (el) el.checked = bool;
  }
  function getChecked(id) {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  }

  return {
    loadCases,
    selectCase,
    saveActiveCase,
    queueAutoSave,
    createCase,
    deleteCase,
    duplicateCase,
    getActiveCase: () => activeCase,
    getCases: () => cases,
    renderCasesTable
  };
})();
