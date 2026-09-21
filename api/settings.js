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
    if (req.method === "GET") {
      const settings = await CloudDB.getSettings();
      return res.status(200).json(settings);
    }

    if (req.method === "PUT" || req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const { settings, _operator } = body;
      const operator = _operator || { username: "admin", role: "admin" };

      if (!settings || typeof settings !== "object") {
        return res.status(400).json({ error: "Settings object is required." });
      }

      const previousState = await CloudDB.getSettings();
      const updatedSettings = { ...previousState, ...settings, updatedAt: new Date().toISOString() };
      await CloudDB.setSettings(updatedSettings);

      await CloudDB.addHistoryEntry({
        userId: operator.id || "admin",
        username: operator.username || "admin",
        role: operator.role || "admin",
        action: "SETTINGS_UPDATE",
        summary: `Updated site settings (${Object.keys(settings).join(", ")})`,
        previousState,
        newState: updatedSettings
      });

      return res.status(200).json({ success: true, settings: updatedSettings });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error("Settings API error:", err);
    return res.status(500).json({ error: "Server error processing settings." });
  }
};
