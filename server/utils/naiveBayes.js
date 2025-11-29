// utils/naiveBayes.js
const natural = require("natural");
const { pool } = require("../db");
const fs = require("fs");
const path = require("path");

class HealthNaiveBayesClassifier {
  constructor() {
    this.intentClassifier = new natural.BayesClassifier();
    this.diseaseClassifier = new natural.BayesClassifier();
    this.trained = false;

    // ✔ FIXED — proper intent list
    this.intents = [
      "symptom_check",
      "prevention",
      "treatment",
      "vaccine_info",
      "emergency",
      "general_info",
      "diagnosis"
    ];

    // ✔ FIXED — proper disease list
    this.diseases = [
      "dengue",
      "malaria",
      "covid",
      "tuberculosis",
      "typhoid",
      "cholera",
      "flu",
      "common_cold"
    ];

    this.intentModelPath = path.join(__dirname, "../models/nb_intent_model.json");
    this.diseaseModelPath = path.join(__dirname, "../models/nb_disease_model.json");
  }

  async loadTrainingData() {
    try {
      const faqData = await pool.query(`
        SELECT question, answer, tags
        FROM faqs
        WHERE language = 'en'
      `);

      const healthData = await pool.query(`
        SELECT title, content, tags
        FROM health_entries
      `);

      return { faqs: faqData.rows, healthEntries: healthData.rows };
    } catch (err) {
      console.error("❌ Error loading training data:", err);
      return { faqs: [], healthEntries: [] };
    }
  }
    /**
   * Return all intent + disease probabilities
   */
  getClassifications(text) {
    if (!this.trained || !text) return [];

    const q = text.toLowerCase();
    let results = [];

    // Intent classifier results
    try {
      const intentResults = this.intentClassifier.getClassifications(q);
      intentResults.forEach(c => {
        results.push({
          label: c.label,
          value: c.value,
          type: "intent"
        });
      });
    } catch (err) {
      console.warn("⚠️ Error getting intent classifications:", err.message);
    }

    // Disease classifier results
    try {
      const diseaseResults = this.diseaseClassifier.getClassifications(q);
      diseaseResults.forEach(c => {
        results.push({
          label: c.label,
          value: c.value,
          type: "disease"
        });
      });
    } catch (err) {
      console.warn("⚠️ Error getting disease classifications:", err.message);
    }

    // Sort by highest probability
    return results.sort((a, b) => b.value - a.value);
  }


  // --------------------------------------------------
  // MAIN TRAIN FUNCTION
  // --------------------------------------------------
  async train() {
    console.log("🎓 Training Naive Bayes classifiers...");

    // ------------------------------
    // 1) Hard-coded intent training
    // ------------------------------
    const intentTrainingData = [
      { text: "I have fever and cough", intent: "symptom_check" },
      { text: "symptoms of dengue", intent: "symptom_check" },
      { text: "signs of malaria", intent: "symptom_check" },
      { text: "I feel sick", intent: "symptom_check" },

      { text: "how to prevent dengue", intent: "prevention" },
      { text: "how to avoid malaria", intent: "prevention" },

      { text: "treatment for fever", intent: "treatment" },
      { text: "medicine for dengue", intent: "treatment" },

      { text: "when should I get vaccine", intent: "vaccine_info" },
      { text: "vaccination schedule", intent: "vaccine_info" },

      { text: "emergency help", intent: "emergency" },
      { text: "urgent medical attention", intent: "emergency" },

      { text: "what is dengue", intent: "general_info" },
      { text: "tell me about malaria", intent: "general_info" },

      { text: "do I have dengue", intent: "diagnosis" },
      { text: "is this malaria", intent: "diagnosis" }
    ];

    // ------------------------------
    // 2) Hard-coded disease training
    // ------------------------------
    const diseaseTrainingData = [
      { text: "high fever headache rash dengue", disease: "dengue" },
      { text: "joint pain behind eyes dengue", disease: "dengue" },

      { text: "fever chills shivering malaria", disease: "malaria" },

      { text: "loss of smell cough covid", disease: "covid" },

      { text: "persistent cough blood sputum tuberculosis", disease: "tuberculosis" },

      { text: "prolonged fever typhoid salmonella", disease: "typhoid" },

      { text: "severe diarrhea dehydration cholera", disease: "cholera" },

      { text: "cough sore throat flu", disease: "flu" },
      { text: "runny nose sneezing cold", disease: "common_cold" }
    ];

    // ------------------------------
    // 3) Load DB data ONCE
    // ------------------------------
    const dbData = await this.loadTrainingData();
    console.log(
      `📦 Training uses: ${intentTrainingData.length} intents, ` +
      `${diseaseTrainingData.length} diseases, ${dbData.faqs.length} FAQs, ` +
      `${dbData.healthEntries.length} health entries`
    );

    // ------------------------------
    // 4) Train intent classifier
    // ------------------------------
    intentTrainingData.forEach(({ text, intent }) => {
      this.intentClassifier.addDocument(text.toLowerCase(), intent);
    });

    // Add FAQ questions if tags define intent
    dbData.faqs.forEach(faq => {
      const intent = this.extractIntentFromTags(faq.tags || "");
      if (intent) {
        this.intentClassifier.addDocument(faq.question.toLowerCase(), intent);
      }
    });

    // ------------------------------
    // 5) Train disease classifier
    // ------------------------------
    diseaseTrainingData.forEach(({ text, disease }) => {
      this.diseaseClassifier.addDocument(text.toLowerCase(), disease);
    });

    // Add health entries if tags define disease
    dbData.healthEntries.forEach(entry => {
      const disease = this.extractDiseaseFromTags(entry.tags || "");
      if (disease) {
        const text = `${entry.title} ${entry.content}`.toLowerCase();
        this.diseaseClassifier.addDocument(text.substring(0, 600), disease);
      }
    });

    // ------------------------------
    // 6) Final training
    // ------------------------------
    this.intentClassifier.train();
    this.diseaseClassifier.train();
    this.trained = true;

    await this.saveModels();
    console.log("✅ Naive Bayes classifier trained & saved");
  }

  // ----------------------------------------------------------
  // CLASSIFICATION FUNCTIONS
  // ----------------------------------------------------------
  classifyIntent(text) {
    if (!this.trained) return null;
    const label = this.intentClassifier.classify(text.toLowerCase());
    const classes = this.intentClassifier.getClassifications(text.toLowerCase());
    const confidence = classes.find(c => c.label === label)?.value || 0;
    return { intent: label, confidence };
  }

  classifyDisease(text) {
    if (!this.trained) return null;
    const label = this.diseaseClassifier.classify(text.toLowerCase());
    const classes = this.diseaseClassifier.getClassifications(text.toLowerCase());
    const confidence = classes.find(c => c.label === label)?.value || 0;
    return { disease: label, confidence };
  }

  // ----------------------------------------------------------
  // TAG MAPPING HELPERS
  // ----------------------------------------------------------
  extractIntentFromTags(tags) {
    if (!tags) return null;
    const t = tags.toLowerCase();
    if (t.includes("symptom")) return "symptom_check";
    if (t.includes("prevent")) return "prevention";
    if (t.includes("treat")) return "treatment";
    if (t.includes("vaccine")) return "vaccine_info";
    return "general_info";
  }

  extractDiseaseFromTags(tags) {
    if (!tags) return null;
    const t = tags.toLowerCase();
    return this.diseases.find(d => t.includes(d)) || null;
  }

  // ----------------------------------------------------------
  // SAVE & LOAD MODELS
  // ----------------------------------------------------------
  async saveModels() {
    try {
      const folder = path.dirname(this.intentModelPath);
      if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

      fs.writeFileSync(this.intentModelPath, JSON.stringify(this.intentClassifier));
      fs.writeFileSync(this.diseaseModelPath, JSON.stringify(this.diseaseClassifier));

      console.log("💾 Models saved");
    } catch (err) {
      console.error("❌ Error saving model:", err);
    }
  }

  async loadModels() {
    try {
      if (fs.existsSync(this.intentModelPath)) {
        this.intentClassifier = natural.BayesClassifier.restore(
          JSON.parse(fs.readFileSync(this.intentModelPath, "utf8"))
        );
      }

      if (fs.existsSync(this.diseaseModelPath)) {
        this.diseaseClassifier = natural.BayesClassifier.restore(
          JSON.parse(fs.readFileSync(this.diseaseModelPath, "utf8"))
        );
      }

      this.trained = true;
      console.log("📂 Models loaded");
      return true;
    } catch (err) {
      console.error("❌ Failed to load model:", err);
      return false;
    }
  }

  getStats() {
    return {
      trained: this.trained,
      intents: this.intents.length,
      diseases: this.diseases.length,
      intentModelExists: fs.existsSync(this.intentModelPath),
      diseaseModelExists: fs.existsSync(this.diseaseModelPath)
    };
  }
}

const nbClassifier = new HealthNaiveBayesClassifier();
module.exports = { nbClassifier, HealthNaiveBayesClassifier };
