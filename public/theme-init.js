(function() {
  try {
    var stored = localStorage.getItem('hallenfussball_theme');
    if (stored) {
      var config = JSON.parse(stored);
      var c = config.colors;
      var root = document.documentElement.style;
      if (c.primary) root.setProperty('--theme-primary', c.primary);
      if (c.secondary) root.setProperty('--theme-secondary', c.secondary);
      if (c.textOnPrimary) root.setProperty('--theme-on-primary', c.textOnPrimary);
      if (c.textOnSecondary) root.setProperty('--theme-on-secondary', c.textOnSecondary);
    }
  } catch(e) {
    // Fail silently - defaults will be used
  }
})();
