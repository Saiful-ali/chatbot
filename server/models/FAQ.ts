import mongoose, { Schema, Document } from "mongoose";

export interface IFAQ extends Document {
  question: string;
  answer: string;
  language: string;
  embedding: number[]; // vector embedding for semantic search
  createdAt: Date;
  updatedAt: Date;
}

const FAQSchema = new Schema<IFAQ>(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    language: { type: String, default: "en" },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true }
);

export const FAQ = mongoose.model<IFAQ>("FAQ", FAQSchema);
