// Runs on producthunt.com/posts/* pages
(function () {
  const xPatterns = /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?$/;
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const junkDomains = ['example.com', 'sentry.io', 'vercel.com', 'github.io', 'images', 'schema.org', 'w3.org', 'googleapis.com', 'gstatic.com', 'facebook.com', 'twitter.com', 'x.com'];

  function extractEmails(html) {
    const raw = html.match(emailPattern) || [];
    return [...new Set(raw)].filter((e) => {
      const domain = e.split('@')[1]?.toLowerCase() || '';
      return !junkDomains.some((d) => domain.includes(d));
    });
  }

  function extractXHandle($) {
    // 1. Meta tags
    for (const attr of ['twitter:site', 'twitter:creator']) {
      const content = $(`meta[name="${attr}"]`).attr('content');
      if (content) {
        const m = content.match(/@?([a-zA-Z0-9_]+)/);
        if (m && m[1].length > 1) return m[1];
      }
    }

    // 2. Links on the page
    for (const el of $('a[href]').toArray()) {
      const href = $(el).attr('href') || '';
      const m = href.match(xPatterns);
      if (m && m[1].length > 1) return m[1];
    }

    // 3. Raw HTML scan
    const htmlMatch = document.documentElement.innerHTML.match(xPatterns);
    if (htmlMatch && htmlMatch[1].length > 1) return htmlMatch[1];

    return null;
  }

  function extractEmail($) {
    // 1. mailto links
    for (const el of $('a[href^="mailto:"]').toArray()) {
      const href = $(el).attr('href') || '';
      const email = href.replace('mailto:', '').split('?')[0].trim();
      if (emailPattern.test(email)) return email;
    }

    // 2. Meta tags
    for (const attr of ['og:email', 'contact', 'email']) {
      const content = $(`meta[name="${attr}"], meta[property="${attr}"]`).attr('content');
      if (content && emailPattern.test(content)) {
        const m = content.match(emailPattern);
        if (m) return m[0];
      }
    }

    // 3. Raw HTML scan
    const html = document.documentElement.innerHTML;
    const emails = extractEmails(html);
    return emails[0] || null;
  }

  function extractWebsiteUrl($) {
    // PH pages have an external website link
    for (const el of $('a[href]').toArray()) {
      const href = $(el).attr('href') || '';
      if (
        href.startsWith('http') &&
        !href.includes('producthunt.com') &&
        !href.includes('twitter.com') &&
        !href.includes('x.com') &&
        !href.includes('facebook.com') &&
        !href.includes('linkedin.com') &&
        !href.includes('instagram.com')
      ) {
        return href;
      }
    }
    return null;
  }

  function scrape() {
    const $ = (selector) => {
      const els = document.querySelectorAll(selector);
      return {
        attr: (name) => els[0]?.getAttribute(name) || undefined,
        toArray: () => Array.from(els),
      };
    };

    const companyName = document.querySelector('h1')?.textContent?.trim() ||
      document.querySelector('[class*="title"]')?.textContent?.trim() ||
      document.title.split(' - ')[0].trim();

    const description =
      document.querySelector('meta[name="description"]')?.content ||
      document.querySelector('[class*="description"]')?.textContent?.trim() ||
      '';

    const xHandle = extractXHandle({
      ...$,
      find: (sel) => ({ attr: (n) => document.querySelector(sel)?.getAttribute(n) }),
    });

    const email = extractEmail($);
    const websiteUrl = extractWebsiteUrl($);

    return {
      companyName: companyName || 'Unknown',
      description: description.substring(0, 200),
      xHandle,
      email,
      websiteUrl: websiteUrl || window.location.href,
      sourceUrl: window.location.href,
      scrapedAt: new Date().toISOString(),
    };
  }

  // Inject floating save button
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
    btn.onmouseenter = () => { btn.style.transform = 'scale(1.05)'; btn.style.boxShadow = '0 6px 24px rgba(34,197,94,0.4)'; };
    btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 4px 20px rgba(34,197,94,0.3)'; };

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

      // Send to background script
      chrome.runtime.sendMessage({ type: 'SAVE_LEAD', lead }, () => {
        // Update badge
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

  // Wait for page to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton);
  } else {
    injectButton();
  }
})();
