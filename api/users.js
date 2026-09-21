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
    const users = await CloudDB.getUsers();

    // 1. GET ALL USERS (Super Admin)
    if (req.method === "GET") {
      const safeUsers = users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        createdAt: u.createdAt,
        active: u.active !== false
      }));
      return res.status(200).json({ users: safeUsers, success: true });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const operator = body._operator || { username: "superadmin", role: "superadmin" };

    // Verify operator has superadmin rights
    if (operator.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied. Only Super Administrator can manage users." });
    }

    // 2. CREATE NEW USER
    if (req.method === "POST") {
      const { username, password, displayName, role } = body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
      }

      const existing = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
      if (existing) {
        return res.status(409).json({ error: `Username "${username}" already exists.` });
      }

      const newUser = {
        id: "usr_" + Date.now(),
        username: username.trim(),
        passwordHash: password.trim(),
        displayName: (displayName || username).trim(),
        role: role === "superadmin" ? "superadmin" : "admin",
        createdAt: new Date().toISOString(),
        active: true
      };

      users.push(newUser);
      await CloudDB.setUsers(users);

      await CloudDB.addHistoryEntry({
        userId: operator.id || "superadmin",
        username: operator.username || "superadmin",
        role: "superadmin",
        action: "USER_CREATE",
        summary: `Super Admin created new user "${newUser.username}" with role [${newUser.role}].`
      });

      return res.status(201).json({
        success: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          displayName: newUser.displayName,
          role: newUser.role,
          createdAt: newUser.createdAt,
          active: newUser.active
        }
      });
    }

    // 3. UPDATE USER / RESET PASSWORD
    if (req.method === "PUT") {
      const { id, password, displayName, role, active } = body;
      const idx = users.findIndex((u) => u.id === id || u.username === id);
      if (idx === -1) {
        return res.status(404).json({ error: "User not found." });
      }

      if (password) users[idx].passwordHash = password.trim();
      if (displayName) users[idx].displayName = displayName.trim();
      if (role && users[idx].username !== "superadmin") users[idx].role = role;
      if (active !== undefined && users[idx].username !== "superadmin") users[idx].active = Boolean(active);

      await CloudDB.setUsers(users);

      await CloudDB.addHistoryEntry({
        userId: operator.id || "superadmin",
        username: operator.username || "superadmin",
        role: "superadmin",
        action: "USER_UPDATE",
        summary: `Super Admin updated user settings / credentials for "${users[idx].username}".`
      });

      return res.status(200).json({
        success: true,
        user: {
          id: users[idx].id,
          username: users[idx].username,
          displayName: users[idx].displayName,
          role: users[idx].role,
          active: users[idx].active
        }
      });
    }

    // 4. DELETE USER
    if (req.method === "DELETE") {
      const id = req.query.id || body.id;
      const idx = users.findIndex((u) => u.id === id || u.username === id);
      if (idx === -1) {
        return res.status(404).json({ error: "User not found." });
      }

      if (users[idx].username === "superadmin") {
        return res.status(403).json({ error: "Master Super Admin account cannot be deleted." });
      }

      const deletedUsername = users[idx].username;
      users.splice(idx, 1);
      await CloudDB.setUsers(users);

      await CloudDB.addHistoryEntry({
        userId: operator.id || "superadmin",
        username: operator.username || "superadmin",
        role: "superadmin",
        action: "USER_DELETE",
        summary: `Super Admin deleted user "${deletedUsername}".`
      });

      return res.status(200).json({ success: true, deletedUsername });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error("Users API error:", err);
    return res.status(500).json({ error: "Server error managing users." });
  }
};
