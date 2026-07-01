// Komyo Games analytics — GA4, loaded ONLY after the visitor consents on the home page.
// Consent lives in localStorage('gamekit_consent') and is shared across komyo.online,
// so a single "Accept" enables per-game pageview tracking on every game too.
(function () {
  var GA_ID = 'G-S4JQPYNDNM';
  var loaded = false;
  // Inside a Discord Activity everything is served from <app>.discordsays.com and external hosts must go
  // through the /.proxy/<prefix> mappings. Load gtag via /.proxy/gtm and point its hit transport at
  // /.proxy/ga (gtag's own transport_url knob) so event/click counts land. (Storage doesn't persist in an
  // Activity, so the client_id / unique-user count is unreliable — we only care about aggregate events.)
  var IN_ACTIVITY = false;
  try { IN_ACTIVITY = /(^|\.)discordsays\.com$/i.test(location.hostname); } catch (e) {}
  window.gamekitLoadGA = function () {
    if (loaded) return;
    loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = (IN_ACTIVITY ? '/.proxy/gtm' : 'https://www.googletagmanager.com') + '/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, IN_ACTIVITY ? { transport_url: location.origin + '/.proxy/ga' } : {});
    pingAudioState();
  };

  // Aggregate, ANONYMOUS product-usage events. No-op unless the visitor consented (gtag only
  // exists after Accept) — the exact same gate as pageviews, so nothing fires on decline or
  // headless. Send event counts only, never per-user data (keeps the no-accounts / device-only
  // ethos). Any caller anywhere (kit, catalogue) uses window.gamekitTrack(name, params).
  window.gamekitTrack = function (name, params) {
    try {
      if (!name || typeof window.gtag !== 'function') return;
      if (localStorage.getItem('gamekit_consent') !== 'granted') return;
      window.gtag('event', name, params || {});
    } catch (e) {}
  };

  // One coarse snapshot of audio prefs per tab-session — so we can see, in aggregate, how many
  // players keep sound / music on vs. off (informs whether music should default to opt-in).
  function pingAudioState() {
    try {
      if (sessionStorage.getItem('gamekit_audio_pinged')) return;
      var sfxOn = localStorage.getItem('gamekit_sfx_muted') !== '1';
      var musOn = localStorage.getItem('gamekit_music_muted') !== '1';
      window.gamekitTrack('audio_state', { sfx: sfxOn ? 'on' : 'off', music: musOn ? 'on' : 'off' });
      sessionStorage.setItem('gamekit_audio_pinged', '1');
    } catch (e) {}
  }

  try {
    if (localStorage.getItem('gamekit_consent') === 'granted') window.gamekitLoadGA();
  } catch (e) {}
})();
