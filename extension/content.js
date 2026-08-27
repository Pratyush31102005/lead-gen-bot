// Runs on producthunt.com/posts/* pages — injects floating save button
(function () {
  const xPatterns = /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?$/;
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const junkDomains = ['example.com', 'sentry.io', 'vercel.com', 'github.io', 'images', 'schema.org', 'w3.org', 'googleapis.com', 'gstatic.com', 'facebook.com', 'twitter.com', 'x.com'];

  function scrape() {
    // Company name
    const companyName = document.querySelector('h1')?.textContent?.trim() ||
      document.title.split(' - ')[0].trim();

    // Description
    const description =
      document.querySelector('meta[name="description"]')?.content ||
      '';

    // X handle
    let xHandle = null;
    for (const el of document.querySelectorAll('a[href]')) {
      const href = el.getAttribute('href') || '';
      const m = href.match(xPatterns);
      if (m && m[1].length > 1) { xHandle = m[1]; break; }
    }

    // Email
    let email = null;
    for (const el of document.querySelectorAll('a[href^="mailto:"]')) {
      const e = (el.getAttribute('href') || '').replace('mailto:', '').split('?')[0].trim();
      if (emailPattern.test(e)) { email = e; break; }
    }

    // Website URL
    let websiteUrl = null;
    for (const el of document.querySelectorAll('a[href]')) {
      const href = el.getAttribute('href') || '';
      if (
        href.startsWith('http') &&
        !href.includes('producthunt.com') &&
        !href.includes('twitter.com') &&
        !href.includes('x.com') &&
        !href.includes('facebook.com') &&
        !href.includes('linkedin.com')
      ) {
        websiteUrl = href;
        break;
      }
    }

    return {
      companyName: companyName || 'Unknown',
      description: description.substring(0, 200),
      tagline: '',
      xHandle,
      email,
      websiteUrl: websiteUrl || window.location.href,
      sourceUrl: window.location.href,
      votesCount: 0,
      topics: [],
      scrapedAt: new Date().toISOString(),
    };
  }

  function injectButton() {
    if (document.getElementById('leadgen-save-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'leadgen-save-btn';
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      Save Lead
    `;
    btn.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      background: #22c55e; color: #000; border: none; border-radius: 12px;
      padding: 12px 20px; font-size: 14px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 20px rgba(34,197,94,0.3);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      transition: all 0.2s;
    `;
    btn.onmouseenter = () => { btn.style.transform = 'scale(1.05)'; };
    btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };

    btn.onclick = async () => {
      const lead = scrape();
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        Saved!
      `;
      btn.style.background = '#166534';
      btn.style.color = '#22c55e';

      chrome.runtime.sendMessage({ type: 'SAVE_LEAD', lead }, () => {
        chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
      });

      setTimeout(() => {
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Save Lead
        `;
        btn.style.background = '#22c55e';
        btn.style.color = '#000';
      }, 2000);
    };

    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton);
  } else {
    injectButton();
  }
})();
