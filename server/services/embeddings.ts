import { pipeline } from "@xenova/transformers";

let embeddingPipeline: any;

// Initialize Hugging Face embedding model
export async function initEmbeddingPipeline() {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline("feature-extraction", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2");
  }
}

// Get embedding vector for a given text
export async function getEmbedding(text: string): Promise<number[]> {
  if (!embeddingPipeline) await initEmbeddingPipeline();
  
  const output = await embeddingPipeline(text, { pooling: "mean" });
  return output[0] as number[]; // flattened vector
}

// Cosine similarity between two vectors
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (normA * normB);
}
