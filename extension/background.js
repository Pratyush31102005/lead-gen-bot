// Service worker — handles storage and messaging
const GITHUB_REPO = 'Pratyush31102005/lead-gen-bot';
const GITHUB_FILE = 'leads.json';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SAVE_LEAD') {
    saveLead(msg.lead).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'GET_LEADS') {
    getLeads().then((leads) => sendResponse({ leads }));
    return true;
  }

  if (msg.type === 'DELETE_LEAD') {
    deleteLead(msg.index).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'UPDATE_BADGE') {
    updateBadge();
    return false;
  }

  if (msg.type === 'IMPORT_FROM_GITHUB') {
    importFromGitHub().then((count) => sendResponse({ count }));
    return true;
  }

  if (msg.type === 'EXPORT_CSV') {
    exportCSV().then((csv) => sendResponse({ csv }));
    return true;
  }
});

async function saveLead(lead) {
  const { leads = [] } = await chrome.storage.local.get('leads');

  // Deduplicate by sourceUrl
  const exists = leads.find((l) => l.sourceUrl === lead.sourceUrl);
  if (!exists) {
    leads.unshift(lead);
    await chrome.storage.local.set({ leads });
  }
}

async function getLeads() {
  const { leads = [] } = await chrome.storage.local.get('leads');
  return leads;
}

async function deleteLead(index) {
  const { leads = [] } = await chrome.storage.local.get('leads');
  leads.splice(index, 1);
  await chrome.storage.local.set({ leads });
  updateBadge();
}

async function updateBadge() {
  const { leads = [] } = await chrome.storage.local.get('leads');
  chrome.action.setBadgeText({ text: leads.length > 0 ? String(leads.length) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
}

async function importFromGitHub() {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`);
    if (!res.ok) return 0;
    const data = await res.json();
    const content = atob(data.content);
    const remoteLeads = JSON.parse(content);

    const { leads = [] } = await chrome.storage.local.get('leads');
    const existingUrls = new Set(leads.map((l) => l.sourceUrl));

    let added = 0;
    for (const lead of remoteLeads) {
      if (!existingUrls.has(lead.sourceUrl)) {
        leads.unshift(lead);
        added++;
      }
    }

    if (added > 0) {
      await chrome.storage.local.set({ leads });
      updateBadge();
    }
    return added;
  } catch {
    return 0;
  }
}

async function exportCSV() {
  const { leads = [] } = await chrome.storage.local.get('leads');
  if (leads.length === 0) return '';

  const headers = ['Company', 'Description', 'X Handle', 'Email', 'Website', 'Source URL', 'Scraped At'];
  const rows = leads.map((l) => [
    l.companyName,
    l.description,
    l.xHandle || '',
    l.email || '',
    l.websiteUrl,
    l.sourceUrl,
    l.scrapedAt,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return csvContent;
}

// Update badge on startup
updateBadge();
