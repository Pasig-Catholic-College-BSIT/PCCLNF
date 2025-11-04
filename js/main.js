function navigateTo(targetUrl) {
  if (!targetUrl) return;
  window.location.href = targetUrl;
}

document.addEventListener('DOMContentLoaded', () => {
  const tapArea = document.getElementById('tap-area');
  if (tapArea) {
    tapArea.addEventListener('click', () => {
      console.log('Tap area clicked — navigating to lnf/next-page.html');
      navigateTo('pages/selectRole.html');
    });
  }
});