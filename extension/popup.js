const leadsBody = document.getElementById('leadsBody');
const leadCount = document.getElementById('leadCount');
const emptyState = document.getElementById('emptyState');
const tableWrap = document.getElementById('tableWrap');
const status = document.getElementById('status');
const syncBtn = document.getElementById('syncBtn');
const exportBtn = document.getElementById('exportBtn');

function showStatus(msg, isError = false) {
  status.textContent = msg;
  status.className = `status${isError ? ' error' : ''}`;
  status.classList.remove('hidden');
  setTimeout(() => status.classList.add('hidden'), 4000);
}

async function loadLeads() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_LEADS' }, (res) => {
      const leads = res?.leads || [];
      renderLeads(leads);
      resolve(leads);
    });
  });
}

function renderLeads(leads) {
  leadCount.textContent = `${leads.length} lead${leads.length !== 1 ? 's' : ''}`;

  if (leads.length === 0) {
    emptyState.classList.remove('hidden');
    tableWrap.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  tableWrap.classList.remove('hidden');

  leadsBody.innerHTML = leads
    .map(
      (lead, i) => `
    <tr>
      <td>
        <div class="company" title="${esc(lead.tagline || lead.description)}">${esc(lead.companyName)}</div>
        <div class="topics">${(lead.topics || []).slice(0, 2).map(t => '<span class="topic">' + esc(t) + '</span>').join('')}</div>
      </td>
      <td>
        <div class="contact-cell">
          <span class="contact-text${lead.xHandle ? ' has-value' : ''}">${lead.xHandle ? '@' + esc(lead.xHandle) : '—'}</span>
          ${
            lead.xHandle
              ? `<button class="btn-copy" onclick="copyText(this, '${esc(lead.xHandle)}')" title="Copy X handle">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </button>`
              : ''
          }
        </div>
      </td>
      <td>
        <div class="contact-cell">
          <span class="contact-text${lead.email ? ' has-value' : ''}">${lead.email ? esc(lead.email) : '—'}</span>
          ${
            lead.email
              ? `<button class="btn-copy" onclick="copyText(this, '${esc(lead.email)}')" title="Copy email">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </button>`
              : ''
          }
        </div>
      </td>
      <td>
        <span class="votes">${lead.votesCount || 0}</span>
      </td>
      <td>
        <button class="btn-delete" onclick="deleteLead(${i})" title="Delete lead">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </td>
    </tr>
  `
    )
    .join('');
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.copyText = function (btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1500);
  });
};

window.deleteLead = function (index) {
  chrome.runtime.sendMessage({ type: 'DELETE_LEAD', index }, () => {
    loadLeads();
  });
};

// Sync from GitHub
syncBtn.addEventListener('click', async () => {
  syncBtn.disabled = true;
  syncBtn.innerHTML = '<div class="spinner"></div> Syncing...';
  showStatus('Pulling leads from GitHub...');

  chrome.runtime.sendMessage({ type: 'SYNC_FROM_GITHUB' }, (res) => {
    syncBtn.disabled = false;
    syncBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
      </svg>
      Sync`;

    if (res?.error) {
      showStatus(`Error: ${res.error}`, true);
    } else if (res?.added > 0) {
      showStatus(`Synced ${res.added} new leads (total: ${res.total})`);
      loadLeads();
    } else {
      showStatus('No new leads found');
    }
  });
});

// Export CSV
exportBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'EXPORT_CSV' }, (res) => {
    if (!res?.csv) {
      showStatus('No leads to export', true);
      return;
    }
    const blob = new Blob([res.csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('CSV downloaded');
  });
});

// Init
loadLeads();
