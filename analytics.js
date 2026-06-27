// komyo analytics — GA4, loaded ONLY after the visitor consents on the home page.
// Consent lives in localStorage('gamekit_consent') and is shared across komyo.online,
// so a single "Accept" enables per-game pageview tracking on every game too.
(function () {
  var GA_ID = 'G-S4JQPYNDNM';
  var loaded = false;
  window.gamekitLoadGA = function () {
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
    if (localStorage.getItem('gamekit_consent') === 'granted') window.gamekitLoadGA();
  } catch (e) {}
})();
