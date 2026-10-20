
import express from "express";
import cors from "cors";
import { config } from "./config/config.js";
import paymentRoutes from "./routes.js";

const app = express();

app.disable("x-powered-by");

app.use(cors({
  origin: config.frontendUrl
}));

app.use(express.json({ limit: "20kb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    service: "Castiel Pay",
    status: "running",
    environment: config.environment
  });
});

app.use("/api", paymentRoutes);

app.use((err, _req, res, _next) => {
  console.error("Server error:", err.message);
  res.status(500).json({
    error: "An internal server error occurred."
  });
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Castiel Pay API listening on port ${config.port}`);
  console.log(`Environment: ${config.environment}`);
});
