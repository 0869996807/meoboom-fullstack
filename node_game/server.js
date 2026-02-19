const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const PHP_API_BASE = process.env.PHP_API_BASE || "";

app.get("/config.js", (req, res) => {
  res.type("application/javascript");
  res.send(`window.__CONFIG__ = ${JSON.stringify({ PHP_API_BASE })};`);
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => console.log("Web running on port", PORT));
