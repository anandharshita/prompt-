const { CloudDB } = require("./db");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // 1. GET ALL CHANGE HISTORY
    if (req.method === "GET") {
      const history = await CloudDB.getHistory();
      return res.status(200).json({ history, success: true });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    // 2. UNDO / ROLLBACK A CHANGE EVENT (SUPER ADMIN ONLY)
    if (req.method === "POST" && body.action === "undo") {
      const { historyId, operator } = body;
      if (!historyId) {
        return res.status(400).json({ error: "historyId is required for rollback." });
      }

      if (operator && operator.role !== "superadmin") {
        return res.status(403).json({ error: "Only Super Administrator has authority to execute rollbacks." });
      }

      const history = await CloudDB.getHistory();
      const targetEntry = history.find((h) => h.id === historyId);
      if (!targetEntry) {
        return res.status(404).json({ error: "Audit history record not found." });
      }

      const products = await CloudDB.getProducts();
      let rollbackSummary = "";

      // CASE A: Undo an Edit -> Restore previous state
      if (targetEntry.action === "PRODUCT_EDIT") {
        if (!targetEntry.previousState) {
          return res.status(400).json({ error: "No previous state recorded for this edit." });
        }
        const idx = products.findIndex((p) => p.id === targetEntry.targetId);
        if (idx !== -1) {
          products[idx] = targetEntry.previousState;
        } else {
          products.unshift(targetEntry.previousState);
        }
        await CloudDB.setProducts(products);
        rollbackSummary = `Reverted edits on ${targetEntry.targetModel || targetEntry.targetId} back to previous state.`;
      }

      // CASE B: Undo a Delete -> Restore the deleted item
      else if (targetEntry.action === "PRODUCT_DELETE") {
        if (!targetEntry.previousState) {
          return res.status(400).json({ error: "No backup data available for deleted item." });
        }
        const exists = products.some((p) => p.id === targetEntry.previousState.id);
        if (!exists) {
          products.unshift(targetEntry.previousState);
          await CloudDB.setProducts(products);
        }
        rollbackSummary = `Restored deleted product ${targetEntry.targetModel || targetEntry.previousState.model} back to catalog.`;
      }

      // CASE C: Undo an Add -> Delete the added item
      else if (targetEntry.action === "PRODUCT_ADD") {
        const idx = products.findIndex((p) => p.id === targetEntry.targetId);
        if (idx !== -1) {
          products.splice(idx, 1);
          await CloudDB.setProducts(products);
        }
        rollbackSummary = `Removed newly added product ${targetEntry.targetModel || targetEntry.targetId} as part of undo.`;
      }

      // CASE D: Undo Settings
      else if (targetEntry.action === "SETTINGS_UPDATE") {
        if (targetEntry.previousState) {
          await CloudDB.setSettings(targetEntry.previousState);
          rollbackSummary = "Reverted site settings to prior configuration.";
        }
      }

      // Record Rollback event in audit log
      const rollbackEntry = await CloudDB.addHistoryEntry({
        userId: operator.id || "superadmin_ho",
        username: operator.username || "superadmin_ho",
        role: "superadmin",
        action: "ROLLBACK",
        targetId: targetEntry.targetId,
        targetModel: targetEntry.targetModel,
        summary: `Super Admin executed ROLLBACK on event [${targetEntry.action}]: ${rollbackSummary}`,
        revertedEventId: targetEntry.id
      });

      return res.status(200).json({
        success: true,
        message: rollbackSummary,
        rollbackEntry,
        updatedProducts: products
      });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error("History API error:", err);
    return res.status(500).json({ error: "Server error handling history." });
  }
};
