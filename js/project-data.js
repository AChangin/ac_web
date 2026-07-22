/**
 * AC Project Data — unified project data loading module.
 *
 * All project metadata lives in content/projects/{slug}/project.json.
 * The project registry lives in content/projects/index.json.
 *
 * Usage:
 *   ACProjectData.loadAllProjects().then(function(projects) { ... });
 *   ACProjectData.loadProject('dusk-dawn').then(function(project) { ... });
 */

(function () {
  'use strict';

  var BASE = 'content/projects/';

  // ── Month parser ──────────────────────────────────────────────
  var MONTH_MAP = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
  };

  /**
   * Parse a date string like "2026 JUL" into { year, month }.
   * Returns null if the format is unrecognised.
   */
  function parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    var parts = dateStr.trim().split(/\s+/);
    if (parts.length < 2) return null;
    var year = parseInt(parts[0], 10);
    var month = MONTH_MAP[parts[1].toUpperCase()];
    if (isNaN(year) || !month) return null;
    return { year: year, month: month };
  }

  /**
   * Sort an array of project objects by date descending (newest first).
   * Projects without a parseable date are pushed to the end.
   * Does NOT mutate the original array.
   */
  function sortByDate(projects) {
    return projects.slice().sort(function (a, b) {
      var da = parseDate(a.date);
      var db = parseDate(b.date);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      if (da.year !== db.year) return db.year - da.year;
      return db.month - da.month;
    });
  }

  // ── Public API ─────────────────────────────────────────────────

  var ACProjectData = {
    parseDate: parseDate,
    sortByDate: sortByDate,

    /**
     * Load the project index (list of slugs).
     * Returns: Promise<string[]> — array of slug strings.
     */
    loadIndex: function () {
      return fetch(BASE + 'index.json')
        .then(function (r) {
          if (!r.ok) throw new Error('Failed to load project index (HTTP ' + r.status + ')');
          return r.json();
        })
        .then(function (data) {
          return data.projects || [];
        });
    },

    /**
     * Load a single project's metadata.
     * Returns: Promise<Object> — the project.json content.
     */
    loadProject: function (slug) {
      return fetch(BASE + slug + '/project.json')
        .then(function (r) {
          if (!r.ok) throw new Error('Failed to load project "' + slug + '" (HTTP ' + r.status + ')');
          return r.json();
        });
    },

    /**
     * Load a single project's narrative scenes.
     * Returns: Promise<Object> — the scenes.json content.
     */
    loadScenes: function (slug) {
      return fetch(BASE + slug + '/scenes.json')
        .then(function (r) {
          if (!r.ok) throw new Error('Failed to load scenes for "' + slug + '" (HTTP ' + r.status + ')');
          return r.json();
        });
    },

    /**
     * Load all projects: reads index.json, then fetches every project.json.
     * Projects are returned in index.json order by default.
     * Individual fetch failures are caught and logged; failed projects are omitted.
     * Returns: Promise<Object[]> — array of project metadata objects.
     */
    loadAllProjects: function () {
      return ACProjectData.loadIndex().then(function (slugs) {
        var promises = slugs.map(function (slug, idx) {
          return ACProjectData.loadProject(slug)
            .then(function (data) {
              // Ensure slug is set on the data object
              data.slug = data.slug || slug;
              return data;
            })
            .catch(function (err) {
              console.warn('[ACProjectData] Skipping "' + slug + '": ' + err.message);
              return null;
            });
        });
        return Promise.all(promises).then(function (results) {
          return results.filter(Boolean);
        });
      });
    }
  };

  // Expose globally
  window.ACProjectData = ACProjectData;
})();
