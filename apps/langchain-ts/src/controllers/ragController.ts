import { Request, Response } from "express";
import * as ragService from "../services/ragService";

export const ask = async (req: Request, res: Response) => {
  try {
    const { question, chatHistory } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const result = await ragService.askQuestion(question, chatHistory);
    res.json(result);
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

export const summarize = async (req: Request, res: Response) => {
  try {
    const { text, instructions } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const output = await ragService.summarizeText(text, instructions);
    res.json({
      output,
      model: "gpt-4o-mini",
      provider: "openai",
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error in summarize controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const semanticSearch = async (req: Request, res: Response) => {
  try {
    const { query, type, limit, offset, filters } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const data = await ragService.performSemanticSearch(query, type, limit, offset, filters);
    res.json(data);
  } catch (error) {
    console.error("Error in semanticSearch controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
