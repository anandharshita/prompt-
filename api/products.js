const { CloudDB } = require("./db");

module.exports = async function handler(req, res) {
  // CORS support
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
    // 1. GET ALL PRODUCTS
    if (req.method === "GET") {
      const products = await CloudDB.getProducts();
      const categories = await CloudDB.getCategories();
      return res.status(200).json({ products, categories, success: true });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const operator = body._operator || { username: "admin", role: "admin" };

    // 2. POST (ADD NEW PRODUCT OR BULK CATALOG SYNC)
    if (req.method === "POST") {
      if (body.catalog && Array.isArray(body.catalog)) {
        await CloudDB.setProducts(body.catalog);
        if (body.categories && Array.isArray(body.categories)) {
          await CloudDB.setCategories(body.categories);
        }
        return res.status(200).json({ success: true, count: body.catalog.length });
      }

      const { product } = body;
      if (!product || !product.model) {
        return res.status(400).json({ error: "Product payload with valid model is required." });
      }

      const products = await CloudDB.getProducts();
      if (!product.id) {
        product.id = product.model.toLowerCase().replace(/[^a-z0-9_-]/g, "-") + "-" + Date.now();
      }

      // Check if duplicate ID exists
      const existingIdx = products.findIndex((p) => p.id === product.id || p.model.toLowerCase() === product.model.toLowerCase());
      if (existingIdx !== -1) {
        return res.status(409).json({ error: `Product model ${product.model} already exists.` });
      }

      products.unshift(product);
      await CloudDB.setProducts(products);

      // Audit Log
      await CloudDB.addHistoryEntry({
        userId: operator.id || "admin",
        username: operator.username || "admin",
        role: operator.role || "admin",
        action: "PRODUCT_ADD",
        targetId: product.id,
        targetModel: product.model,
        summary: `Added new product ${product.model} (${product.name || ""})`,
        newState: product,
        previousState: null
      });

      return res.status(201).json({ success: true, product });
    }

    // 3. PUT (UPDATE PRODUCT)
    if (req.method === "PUT") {
      const { product } = body;
      if (!product || !product.id) {
        return res.status(400).json({ error: "Product payload with valid ID is required." });
      }

      const products = await CloudDB.getProducts();
      const idx = products.findIndex((p) => p.id === product.id);
      if (idx === -1) {
        return res.status(404).json({ error: `Product with ID ${product.id} not found.` });
      }

      const previousState = JSON.parse(JSON.stringify(products[idx]));
      products[idx] = { ...previousState, ...product, updatedAt: new Date().toISOString() };
      await CloudDB.setProducts(products);

      // Compute visual changes summary
      const changedKeys = [];
      Object.keys(product).forEach((k) => {
        if (JSON.stringify(previousState[k]) !== JSON.stringify(product[k])) {
          changedKeys.push(k);
        }
      });

      // Audit Log
      await CloudDB.addHistoryEntry({
        userId: operator.id || "admin",
        username: operator.username || "admin",
        role: operator.role || "admin",
        action: "PRODUCT_EDIT",
        targetId: product.id,
        targetModel: product.model,
        summary: `Updated ${product.model}: modified ${changedKeys.slice(0, 5).join(", ")}${changedKeys.length > 5 ? ` and ${changedKeys.length - 5} more fields` : ""}`,
        changedKeys,
        previousState,
        newState: products[idx]
      });

      return res.status(200).json({ success: true, product: products[idx] });
    }

    // 4. DELETE PRODUCT
    if (req.method === "DELETE") {
      const id = req.query.id || body.id;
      if (!id) {
        return res.status(400).json({ error: "Product ID is required for deletion." });
      }

      const products = await CloudDB.getProducts();
      const idx = products.findIndex((p) => p.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: `Product with ID ${id} not found.` });
      }

      const previousState = products[idx];
      products.splice(idx, 1);
      await CloudDB.setProducts(products);

      // Audit Log
      await CloudDB.addHistoryEntry({
        userId: operator.id || "admin",
        username: operator.username || "admin",
        role: operator.role || "admin",
        action: "PRODUCT_DELETE",
        targetId: id,
        targetModel: previousState.model,
        summary: `Deleted product ${previousState.model} (${previousState.name || ""})`,
        previousState,
        newState: null
      });

      return res.status(200).json({ success: true, deletedId: id });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error("Products API error:", err);
    return res.status(500).json({ error: "Server error processing product request." });
  }
};
