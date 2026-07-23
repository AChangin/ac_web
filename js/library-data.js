/**
 * AC Library — global asset library for the editor.
 *
 * Library definitions live in library/.
 * All projects share the same library.
 *
 * Usage:
 *   ACLibrary.loadAllComponents().then(function(comps) { ... });
 *   ACLibrary.loadAllAnimations().then(function(anims) { ... });
 *   ACLibrary.loadAllEffects().then(function(efx) { ... });
 *   ACLibrary.createElement(def); // returns new element with unique id
 *   ACLibrary.createAnimationInstance(def); // returns new animation instance
 *   ACLibrary.createEffectInstance(def); // returns new effect instance
 */

(function () {
  'use strict';

  var BASE = 'library/';
  var COMPONENTS_DIR = BASE + 'components/';
  var ANIMATIONS_DIR = BASE + 'animations/';
  var EFFECTS_DIR    = BASE + 'effects/';

  function genId() {
    return 'el_' + Math.random().toString(36).slice(2, 10);
  }

  // ── Generic loader ──────────────────────────────────────────

  function loadCategory(dir) {
    return ACLibrary.loadIndex().then(function (index) {
      var ids = [];
      if (dir === COMPONENTS_DIR) ids = index.components || [];
      else if (dir === ANIMATIONS_DIR) ids = index.animations || [];
      else if (dir === EFFECTS_DIR) ids = index.effects || [];
      var promises = ids.map(function (id) {
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
    });
  }

  // ── Public API ─────────────────────────────────────────────────

  var ACLibrary = {

    loadIndex: function () {
      return fetch(BASE + 'index.json')
        .then(function (r) {
          if (!r.ok) throw new Error('Failed to load library index (HTTP ' + r.status + ')');
          return r.json();
        });
    },

    // Components
    loadComponent: function (id) {
      return fetch(COMPONENTS_DIR + id + '.json')
        .then(function (r) {
          if (!r.ok) throw new Error('Component "' + id + '" not found');
          return r.json();
        });
    },
    loadAllComponents: function () { return loadCategory(COMPONENTS_DIR); },

    // Animations
    loadAnimation: function (id) {
      return fetch(ANIMATIONS_DIR + id + '.json')
        .then(function (r) {
          if (!r.ok) throw new Error('Animation "' + id + '" not found');
          return r.json();
        });
    },
    loadAllAnimations: function () { return loadCategory(ANIMATIONS_DIR); },

    // Effects
    loadEffect: function (id) {
      return fetch(EFFECTS_DIR + id + '.json')
        .then(function (r) {
          if (!r.ok) throw new Error('Effect "' + id + '" not found');
          return r.json();
        });
    },
    loadAllEffects: function () { return loadCategory(EFFECTS_DIR); },

    // Factory: create element from component definition
    createElement: function (componentDef) {
      var defaults = componentDef.defaults || {};
      var el = JSON.parse(JSON.stringify(defaults));
      el.id = genId();
      return el;
    },

    // Factory: create animation instance from animation definition
    createAnimationInstance: function (animDef) {
      return JSON.parse(JSON.stringify(animDef.defaults || {}));
    },

    // Factory: create effect instance from effect definition
    // Returns { type, defaults } for the element
    createEffectInstance: function (effectDef) {
      var def = effectDef.defaults || {};
      if (effectDef.type === 'parallax') {
        return { parallax: def.speed || 0.2 };
      } else if (effectDef.type === 'float') {
        return { float: true, floatAmount: def.amount || 20 };
      }
      return {};
    }
  };

  window.ACLibrary = ACLibrary;
})();
