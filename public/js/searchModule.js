// ==========================================================================
// LexDominio Ecuador - Módulo de Búsqueda Jurídica Ecuatoriana (searchModule.js)
// ==========================================================================

const SearchModule = (() => {
  let searchResults = [];

  async function initSearch() {
    await performSearch();
    await checkPortalsHealth();
  }

  async function performSearch(overrideQuery = null) {
    const queryInput = document.getElementById('legalSearchQuery');
    const categorySelect = document.getElementById('legalSearchCategory');
    const q = overrideQuery !== null ? overrideQuery : (queryInput ? queryInput.value : '');
    const category = categorySelect ? categorySelect.value : 'all';

    if (overrideQuery !== null && queryInput) {
      queryInput.value = overrideQuery;
    }

    try {
      const url = `/api/legal-corpus/search?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        searchResults = data.results;
        renderSearchResults();
      }
    } catch (e) {
      console.error(e);
      App.showToast('Error al consultar el corpus jurídico', 'danger');
    }
  }

  function renderSearchResults() {
    const container = document.getElementById('legalSearchResultsContainer');
    const counter = document.getElementById('searchResultsCount');
    if (!container) return;

    if (counter) {
      counter.textContent = `Se encontraron ${searchResults.length} normas y sentencias ecuatorianas`;
    }

    if (searchResults.length === 0) {
      container.innerHTML = `
        <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:32px; text-align:center; color:var(--text-muted);">
          No se encontraron coincidencias exactas para los términos consultados.<br>
          <button class="btn btn-outline btn-sm" style="margin-top:12px;" onclick="SearchModule.performSearch('')">
            Ver todas las normas y jurisprudencia
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = searchResults.map(item => {
      let badgeClass = 'badge-verified';
      if (item.verification_status.includes('pendiente')) badgeClass = 'badge-pending';
      if (item.verification_status.includes('usuario')) badgeClass = 'badge-user';
      if (item.verification_status.includes('sin acceso')) badgeClass = 'badge-unreachable';

      return `
        <div class="card" style="margin-bottom:0;">
          <div class="card-header" style="padding:12px 18px; background-color:#f8fafc;">
            <div>
              <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">
                ${item.organ} • ${item.type}
              </div>
              <h3 style="font-size:0.98rem; font-weight:700; color:var(--primary-900); margin-top:2px;">
                ${item.official_name} - ${item.article_or_cause}
              </h3>
            </div>
            <span class="badge ${badgeClass}">${item.verification_status.toUpperCase()}</span>
          </div>
          <div class="card-body" style="padding:16px 18px;">
            <div style="font-size:0.86rem; color:var(--primary-800); line-height:1.55; margin-bottom:10px; background:#ffffff; border-left:3px solid var(--legal-blue); padding-left:12px;">
              "${item.relevant_text}"
            </div>
            
            <div style="font-size:0.78rem; color:#475569; margin-bottom:8px;">
              <strong>Pertinencia en Prescripción Extraordinaria:</strong> ${item.pertinence}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; font-size:0.72rem; color:var(--text-muted); border-top:1px solid #f1f5f9; padding-top:8px;">
              <div>
                <strong>Fuente Oficial:</strong> ${item.official_source} | <strong>Fecha Verificación:</strong> ${item.verification_date}
              </div>
              <div>
                ${item.official_url ? `<a href="${item.official_url}" target="_blank" rel="noopener noreferrer" style="color:var(--legal-blue); font-weight:600; text-decoration:none;">🔗 Abrir Fuente Oficial Primaria &rarr;</a>` : 'Sin URL directa'}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async function checkPortalsHealth() {
    const container = document.getElementById('officialPortalsList');
    if (!container) return;

    container.innerHTML = `<div style="grid-column:span 2; font-size:0.8rem; color:var(--text-muted);">Comprobando disponibilidad de servidores oficiales...</div>`;

    try {
      const res = await fetch('/api/official-portals/status');
      const data = await res.json();
      if (data.success) {
        renderPortals(data.portals);
      }
    } catch (e) {
      console.error(e);
      container.innerHTML = `<div style="grid-column:span 2; font-size:0.8rem; color:#b91c1c;">No se pudo verificar el estado en línea de los portales.</div>`;
    }
  }

  function renderPortals(portals) {
    const container = document.getElementById('officialPortalsList');
    if (!container) return;

    container.innerHTML = portals.map(p => {
      const isOk = p.available;
      const statusBadge = isOk 
        ? `<span class="badge badge-verified">EN LÍNEA (${p.latencyMs}ms)</span>`
        : `<span class="badge badge-unreachable">NO DISPONIBLE</span>`;

      return `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px 14px; display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
              <strong style="font-size:0.86rem; color:var(--primary-900);">${p.name}</strong>
              ${statusBadge}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${p.notes}</div>
          </div>
          <div>
            <a href="${p.url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline" style="width:100%; justify-content:center;">
              Abrir Buscador Oficial &rarr;
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  async function submitManualEntry(formData) {
    try {
      const res = await fetch('/api/legal-corpus/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        App.showToast('Norma o fallo agregado exitosamente');
        App.closeModal('modalManualEntry');
        await performSearch();
      } else {
        App.showToast(data.message || 'Error al guardar aporte', 'danger');
      }
    } catch (e) {
      console.error(e);
      App.showToast('Error de red al guardar aporte manual', 'danger');
    }
  }

  return {
    initSearch,
    performSearch,
    checkPortalsHealth,
    submitManualEntry
  };
})();
