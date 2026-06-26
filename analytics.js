// funyo analytics — GA4, loaded ONLY after the visitor consents on the home page.
// Consent lives in localStorage('funyo_consent') and is shared across funyo.online,
// so a single "Accept" enables per-game pageview tracking on every game too.
(function () {
  var GA_ID = 'G-FCZMM2CQLW';
  var loaded = false;
  window.funyoLoadGA = function () {
    if (loaded) return;
    loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
  };
  try {
    if (localStorage.getItem('funyo_consent') === 'granted') window.funyoLoadGA();
  } catch (e) {}
})();
