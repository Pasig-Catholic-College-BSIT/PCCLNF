// ---------------------------
// Shared Helpers
// ---------------------------

// throttle helper – limits how often a function can run
function throttle(fn, limit) {
  let waiting = false;
  return function (...args) {
    if (!waiting) {
      fn.apply(this, args);
      waiting = true;
      setTimeout(() => (waiting = false), limit);
    }
  };
}

// fade + navigate animation
function fadeAndNavigate(targetUrl) {
  const body = document.body;
  const overlay = document.querySelector('.overlay');

  if (overlay) {
    body.classList.add('fade-out');
    overlay.style.opacity = '0';
    setTimeout(() => (window.location.href = targetUrl), 500);
  } else {
    // no overlay on page (like next-page.html)
    window.location.href = targetUrl;
  }
}

// ---------------------------
// Page Logic
// ---------------------------

document.addEventListener('DOMContentLoaded', () => {
    
  // index.html → tap anywhere to continue (throttled)
  const tapArea = document.getElementById('tap-area');
  if (tapArea) {
    tapArea.addEventListener(
      'click',
      throttle(() => fadeAndNavigate('/webpages/next-page.html'), 800)
    );
  }

  // next-page.html → delegated clicks on cards
  const container = document.querySelector('.container');
  if (container) {
    container.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;

      const page = card.querySelector('h2').textContent.toLowerCase() + '.html';
      fadeAndNavigate(page);
    });
  }
});
