import { Request, Response } from "express";
import * as ragService from "../services/ragService";

export const ask = async (req: Request, res: Response) => {
  try {
    const { question, chatHistory } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const answer = await ragService.askQuestion(question, chatHistory);
    res.json({ answer });
  } catch (error) {
    console.error("Error in ask controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const ingest = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    
    if (data.id_dgp || data.nome) {
      const result = await ragService.ingestResearchGroup(data);
      return res.json(result);
    }

    const { content, metadata } = data;
    if (!content) {
      return res.status(400).json({ error: "Content or structured data is required" });
    }

    await ragService.ingestDocument(content, metadata);
    res.json({ success: true });
  } catch (error) {
    console.error("Error in ingest controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
