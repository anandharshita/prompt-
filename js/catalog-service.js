/**
 * ==============================================================================
 * PROMPT DASHBOARD — CATALOG & COMPARISON SERVICE
 * ==============================================================================
 * Logic for filtering, multi-attribute matching, dynamic specs, and deep links.
 * ==============================================================================
 */

const PromptCatalog = (function() {
  'use strict';

  function filterProducts(products, filters, category = "ALL", searchQuery = "") {
    if (!Array.isArray(products)) return [];

    return products.filter(p => {
      // 1. Category Filter
      if (category !== "ALL") {
        if (p.category !== category) return false;
      }

      // 2. Global Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const searchPool = [
          p.model,
          p.name,
          p.tagline,
          p.category,
          p.displayType,
          p.powerSupply,
          p.accuracy,
          ...(Array.isArray(p.applications) ? p.applications : []),
          ...(Array.isArray(p.mounting) ? p.mounting : []),
          ...(Array.isArray(p.protocols) ? p.protocols : []),
          ...(Array.isArray(p.primaryComm) ? p.primaryComm : []),
          ...(p.customSpecs ? Object.entries(p.customSpecs).flat() : [])
        ].join(' ').toLowerCase();

        if (!searchPool.includes(q)) return false;
      }

      // 3. Faceted Technical Filters
      for (const [key, selectedSet] of Object.entries(filters)) {
        if (!selectedSet || selectedSet.size === 0) continue;

        let val = p[key];
        let matches = false;

        if (Array.isArray(val)) {
          matches = val.some(item => selectedSet.has(item));
        } else if (typeof val === 'string') {
          matches = selectedSet.has(val);
        } else if (typeof val === 'boolean') {
          matches = selectedSet.has(val ? "Yes" : "No");
        }

        if (!matches) return false;
      }

      return true;
    });
  }

  function sortProducts(products, sortBy = "model-asc") {
    const list = products.slice();
    switch (sortBy) {
      case "model-asc":
        return list.sort((a, b) => (a.model || "").localeCompare(b.model || ""));
      case "model-desc":
        return list.sort((a, b) => (b.model || "").localeCompare(a.model || ""));
      case "name-asc":
        return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      case "category":
        return list.sort((a, b) => (a.category || "").localeCompare(b.category || ""));
      default:
        return list;
    }
  }

  return {
    filterProducts,
    sortProducts
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PromptCatalog;
}
