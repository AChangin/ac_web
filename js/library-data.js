/**
 * AC Library — global asset library for the editor.
 *
 * Shared components live in library/shared/.
 * Project-specific components live in content/projects/{slug}/library/.
 *
 * Usage:
 *   ACLibrary.loadAllComponents(projectSlug?).then(function(comps) { ... });
 *   ACLibrary.loadAllAnimations().then(function(anims) { ... });
 *   ACLibrary.loadAllEffects().then(function(efx) { ... });
 *   ACLibrary.createElement(def); // returns new element with unique id
 *   ACLibrary.createAnimationInstance(def); // returns new animation instance
 *   ACLibrary.createEffectInstance(def); // returns new effect instance
 */

(function () {
  'use strict';

  var SHARED_BASE = 'library/shared/';
  var SHARED_COMPONENTS_DIR = SHARED_BASE + 'components/';
  var SHARED_ANIMATIONS_DIR = SHARED_BASE + 'animations/';
  var SHARED_EFFECTS_DIR    = SHARED_BASE + 'effects/';
  var PROJECT_BASE = 'content/projects/';

  function genId() {
    return 'el_' + Math.random().toString(36).slice(2, 10);
  }

  // ── Generic loader ──────────────────────────────────────────

  function loadCategory(dir, indexIds) {
    if (!indexIds || !indexIds.length) return Promise.resolve([]);
    var promises = indexIds.map(function (id) {
      return fetch(dir + id + '.json')
        .then(function (r) {
          if (!r.ok) throw new Error('Not found (HTTP ' + r.status + ')');
          return r.json();
        })
        .catch(function (err) {
          console.warn('[ACLibrary] Skipping "' + id + '": ' + err.message);
          return null;
        });
    });
    return Promise.all(promises).then(function (results) {
      return results.filter(Boolean);
    });
  }

  function loadIndex(url) {
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load index (HTTP ' + r.status + ')');
        return r.json();
      });
  }

  function projectLibDir(slug) {
    return PROJECT_BASE + slug + '/library/';
  }

  // ── Public API ─────────────────────────────────────────────────

  var ACLibrary = {

    // ── Index ──────────────────────────────────────────────────

    loadSharedIndex: function () {
      return loadIndex(SHARED_BASE + 'index.json');
    },

    loadProjectIndex: function (slug) {
      if (!slug) return Promise.resolve({ components: [], animations: [], effects: [] });
      return loadIndex(projectLibDir(slug) + 'index.json')
        .catch(function () { return { components: [], animations: [], effects: [] }; });
    },

    // ── Components ─────────────────────────────────────────────

    loadSharedComponents: function () {
      return ACLibrary.loadSharedIndex().then(function (idx) {
        return loadCategory(SHARED_COMPONENTS_DIR, idx.components || []);
      });
    },

    loadProjectComponents: function (slug) {
      if (!slug) return Promise.resolve([]);
      return ACLibrary.loadProjectIndex(slug).then(function (idx) {
        return loadCategory(projectLibDir(slug) + 'components/', idx.components || []);
      });
    },

    loadAllComponents: function (slug) {
      return Promise.all([
        ACLibrary.loadSharedComponents(),
        ACLibrary.loadProjectComponents(slug)
      ]).then(function (r) {
        return r[0].concat(r[1]);
      });
    },

    // ── Single component loaders ───────────────────────────────

    loadComponent: function (id, slug) {
      // Try project first, then shared
      var tryShared = function () {
        return fetch(SHARED_COMPONENTS_DIR + id + '.json')
          .then(function (r) {
            if (!r.ok) throw new Error('Component "' + id + '" not found');
            return r.json();
          });
      };
      if (slug) {
        return fetch(projectLibDir(slug) + 'components/' + id + '.json')
          .then(function (r) {
            if (!r.ok) throw new Error('Not in project');
            return r.json();
          })
          .catch(tryShared);
      }
      return tryShared();
    },

    // ── Animations (shared only) ───────────────────────────────

    loadAllAnimations: function () {
      return ACLibrary.loadSharedIndex().then(function (idx) {
        return loadCategory(SHARED_ANIMATIONS_DIR, idx.animations || []);
      });
    },

    // ── Effects (shared only) ──────────────────────────────────

    loadAllEffects: function () {
      return ACLibrary.loadSharedIndex().then(function (idx) {
        return loadCategory(SHARED_EFFECTS_DIR, idx.effects || []);
      });
    },

    // ── Factory methods ────────────────────────────────────────

    createElement: function (componentDef) {
      var defaults = componentDef.defaults || {};
      var el = JSON.parse(JSON.stringify(defaults));
      el.id = genId();
      return el;
    },

    createAnimationInstance: function (animDef) {
      return JSON.parse(JSON.stringify(animDef.defaults || {}));
    },

    createEffectInstance: function (effectDef) {
      var def = effectDef.defaults || {};
      if (effectDef.type === 'parallax') {
        return { parallax: def.speed || 0.2 };
      } else if (effectDef.type === 'float') {
        return { float: true, floatAmount: def.amount || 20 };
      }
      return {};
    },

    // ── Save helpers (used by server API, not called directly) ──

    getSavePath: function (id, slug) {
      if (slug) return projectLibDir(slug) + 'components/' + id + '.json';
      return SHARED_COMPONENTS_DIR + id + '.json';
    },

    getIndexPath: function (slug) {
      if (slug) return projectLibDir(slug) + 'index.json';
      return SHARED_BASE + 'index.json';
    }
  };

  window.ACLibrary = ACLibrary;
})();
