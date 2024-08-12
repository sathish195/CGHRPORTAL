const express = require("express");
const employee= require("../routes/emp_routes/emp");
const organisation= require("../routes/org_routes/org");
module.exports = (app) => {
  // Middleware setup
  app.use(express.json()); // Ensure proper middleware for JSON parsing

  // Route handlers
  app.get("/", async (req, res) => {
    return res.status(200).send("Hello, Welcome to CRM Home 🚀");
  });

  // API routes
  app.use("/emp", employee);
  app.use("/org", organisation);
};