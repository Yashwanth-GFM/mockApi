import express from "express";
import cors from "cors";

import listingRoutes from "./routes/listingRoutes.js";
import saveSearchRoutes from "./routes/saveSearch.js";
const app = express();
app.use(cors());
app.use(express.json());
// If behind proxy/load balancer (important for real IP)

app.get("/api", (req, res) => {
  res.send("Hello, World!");
});

app.use("/api", listingRoutes);
app.use("/api", saveSearchRoutes);

const PORT = 8002;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
