// Module registry. Loaded before any module file, both on YouTube (page world) and on the options page,
// where it's only used to read each module's name, description and settings.
(() => {
  if (window.YTU) return;
  const modules = [];
  window.YTU = {
    modules,
    /**
     * @param {object} def
     * @param {string} def.id              unique, kebab-case
     * @param {string} def.name
     * @param {string} def.description
     * @param {boolean} [def.enabledByDefault=true]
     * @param {Object<string, object>} [def.settings]  see README for setting types
     * @param {string | ((settings) => string)} [def.css]  stylesheet; boot.js injects it at document_start
     * @param {(ctx) => (void | (() => void))} def.run  start the feature; return a cleanup function
     */
    register(def) {
      if (!def || !def.id || typeof def.run !== 'function') throw new Error('YTU.register: id and run() are required');
      if (modules.some(m => m.id === def.id)) throw new Error(`YTU.register: duplicate module id "${def.id}"`);
      modules.push(def);
    },
  };
})();
