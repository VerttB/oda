import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import * as ragController from "./controllers/ragController";

dotenv.config({ path: "../../.env" });

const app = express();
const port = process.env.LANGCHAIN_PORT || 8002;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/question", ragController.ask);
app.post("/ingest", ragController.ingest);

app.listen(port, () => {
  console.log(`LangChain TS service running on port ${port}`);
});
