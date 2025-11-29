// routes/naiveBayes.js
const express = require("express");
const { nbClassifier } = require("../utils/naiveBayes");
const { translateText, detectLanguage } = require("../utils/translate");
const router = express.Router();

router.post("/train", async (req, res) => {
  try {
    console.log("🎓 Starting Naive Bayes training...");
    await nbClassifier.train();
    res.json({
      success: true,
      message: "Naive Bayes classifier trained successfully",
      stats: nbClassifier.getStats()
    });
  } catch (err) {
    console.error("❌ Training error:", err);
    res.status(500).json({ success: false, error: "Failed to train classifier", message: err.message });
  }
});

router.post("/classify-intent", async (req, res) => {
  try {
    let { text, lang = "auto" } = req.body;
    if (!text) {
      return res.status(400).json({
        error: "Text is required",
        usage: { text: "I have fever and cough", lang: "auto" }
      });
    }
    if (lang === "auto") lang = await detectLanguage(text);
    const englishText = lang !== "en" ? await translateText(text, "en", lang) : text;
    if (!nbClassifier.trained) {
      return res.json({ success: false, message: "Classifier not trained. Please train first.", trainEndpoint: "/api/nb/train" });
    }
    const intentResult = nbClassifier.classifyIntent(englishText);
    const allClassifications = nbClassifier.getClassifications(englishText).filter(c => !c.label.includes('disease'));
    res.json({
      success: true,
      query: { original: text, english: englishText, language: lang },
      intent: intentResult.intent,
      confidence: (intentResult.confidence * 100).toFixed(2) + "%",
      allPredictions: allClassifications,
      timestamp: intentResult.timestamp
    });
  } catch (err) {
    console.error("❌ Intent classification error:", err);
    res.status(500).json({ success: false, error: "Classification failed", message: err.message });
  }
});

router.post("/classify-disease", async (req, res) => {
  try {
    let { symptoms, lang = "auto" } = req.body;
    if (!symptoms) {
      return res.status(400).json({
        error: "Symptoms are required",
        usage: { symptoms: "fever, cough, headache", lang: "auto" }
      });
    }
    const symptomText = Array.isArray(symptoms) ? symptoms.join(" ") : symptoms;
    if (lang === "auto") lang = await detectLanguage(symptomText);
    const englishSymptoms = lang !== "en" ? await translateText(symptomText, "en", lang) : symptomText;
    if (!nbClassifier.trained) {
      return res.json({ success: false, message: "Classifier not trained. Please train first.", trainEndpoint: "/api/nb/train" });
    }
    const diseaseResult = nbClassifier.classifyDisease(englishSymptoms);
    const allPredictions = nbClassifier.getClassifications(englishSymptoms).filter(c => !c.label.includes('intent'));
    let confidenceLevel;
    const conf = Number(diseaseResult.confidence || 0);
    if (conf > 0.8) confidenceLevel = "High";
    else if (conf > 0.6) confidenceLevel = "Medium";
    else confidenceLevel = "Low";
    const disclaimer = "⚠️ This is an AI prediction for informational purposes only. Please consult a qualified healthcare professional for accurate diagnosis.";
    res.json({
      success: true,
      symptoms: { original: symptomText, english: englishSymptoms, language: lang },
      prediction: { disease: diseaseResult.disease, confidence: (conf * 100).toFixed(2) + "%", confidenceLevel, allPossibilities: allPredictions },
      recommendation: generateRecommendation(diseaseResult.disease, confidenceLevel),
      disclaimer,
      timestamp: diseaseResult.timestamp
    });
  } catch (err) {
    console.error("❌ Disease classification error:", err);
    res.status(500).json({ success: false, error: "Classification failed", message: err.message });
  }
});

router.post("/analyze", async (req, res) => {
  try {
    let { text, lang = "auto" } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    if (lang === "auto") lang = await detectLanguage(text);
    const englishText = lang !== "en" ? await translateText(text, "en", lang) : text;
    const allClassifications = nbClassifier.getClassifications(englishText);
    const intents = allClassifications.filter(c => !c.label.includes('_') || !c.label.startsWith('disease'));
    const diseases = allClassifications.filter(c => c.label.includes('_') || c.label.startsWith('disease'));
    const intentResult = nbClassifier.classifyIntent(englishText);
    const diseaseResult = nbClassifier.classifyDisease(englishText);
    res.json({
      success: true,
      query: { original: text, english: englishText, language: lang },
      analysis: {
        intent: intentResult ? { primary: intentResult.intent, confidence: (intentResult.confidence * 100).toFixed(2) + "%", alternatives: intents.slice(0, 3) } : null,
        disease: diseaseResult ? { primary: diseaseResult.disease, confidence: (diseaseResult.confidence * 100).toFixed(2) + "%", alternatives: diseases.slice(0, 3) } : null
      },
      recommendation: generateCombinedRecommendation(intentResult, diseaseResult)
    });
  } catch (err) {
    console.error("❌ Analysis error:", err);
    res.status(500).json({ success: false, error: "Analysis failed", message: err.message });
  }
});

router.get("/stats", (req, res) => {
  try {
    const stats = nbClassifier.getStats();
    res.json({
      success: true,
      statistics: stats,
      endpoints: {
        train: "POST /api/nb/train",
        classifyIntent: "POST /api/nb/classify-intent",
        classifyDisease: "POST /api/nb/classify-disease",
        analyze: "POST /api/nb/analyze"
      }
    });
  } catch (err) {
    console.error("❌ NB stats error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/retrain", async (req, res) => {
  try {
    const { trainingData } = req.body;
    if (!trainingData || !Array.isArray(trainingData)) {
      return res.status(400).json({
        error: "Training data array is required",
        format: [
          { text: "fever and cough", label: "symptom_check", type: "intent" },
          { text: "high fever headache", label: "dengue", type: "disease" }
        ]
      });
    }
    await nbClassifier.retrain(trainingData);
    res.json({ success: true, message: "Classifier retrained with new data", newDataPoints: trainingData.length });
  } catch (err) {
    console.error("❌ Retrain error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper functions (same as earlier, kept local)
function generateRecommendation(disease, confidenceLevel) {
  // ... (same recommendation map as you had)
  const recommendations = {
    dengue: {
      high: "High probability of dengue. Seek medical attention immediately. Get blood test (NS1 antigen, platelet count). Stay hydrated and rest.",
      medium: "Possible dengue infection. Monitor symptoms closely. If fever persists >3 days or symptoms worsen, consult doctor.",
      low: "Low probability but watch for symptoms: high fever, severe headache, pain behind eyes, joint/muscle pain, rash."
    },
    malaria: {
      high: "High probability of malaria. Immediate medical attention required. Blood smear test needed. Start antimalarial treatment.",
      medium: "Possible malaria. Get tested if fever with chills/sweating persists. Common in mosquito-prone areas.",
      low: "Low probability. Monitor for periodic fever cycles, chills, and sweating."
    },
    covid: {
      high: "High probability of COVID-19. Self-isolate immediately. Get RT-PCR test. Monitor oxygen levels. Seek medical help if breathing difficulty.",
      medium: "Possible COVID-19. Get tested, wear mask, isolate from others. Monitor symptoms.",
      low: "Low probability. Practice precautions: mask, distancing, hygiene."
    },
    tuberculosis: {
      high: "High probability of TB. Urgent medical consultation needed. Sputum test and X-ray required. Start treatment immediately.",
      medium: "Possible TB. If cough >2 weeks with blood, get tested. TB is curable with proper treatment.",
      low: "Low probability. Watch for persistent cough, night sweats, weight loss."
    },
    typhoid: {
      high: "High probability of typhoid. Medical attention required. Blood culture test needed. Start antibiotics.",
      medium: "Possible typhoid. Monitor fever pattern. Get Widal test if fever persists >5 days.",
      low: "Low probability. Watch for prolonged fever, stomach pain, weakness."
    },
    cholera: {
      high: "High probability of cholera. EMERGENCY! Immediate hospitalization for rehydration. Life-threatening dehydration risk.",
      medium: "Possible cholera. Seek medical help. ORS (oral rehydration solution) urgently needed.",
      low: "Low probability. If severe diarrhea develops, seek immediate medical help."
    },
    flu: {
      high: "High probability of influenza. Rest, fluids, over-the-counter fever reducers. Seek doctor if symptoms worsen.",
      medium: "Possible flu. Rest, stay hydrated. Monitor temperature. Usually resolves in 7-10 days.",
      low: "Low probability. May be common cold. Rest and fluids recommended."
    },
    common_cold: {
      high: "Likely common cold. Rest, fluids, symptom relief medicines. Usually resolves in 7-10 days.",
      medium: "Possible cold. Monitor symptoms. If fever persists >3 days, consult doctor.",
      low: "May not be cold. Monitor other symptoms."
    }
  };
  return recommendations[disease]?.[confidenceLevel.toLowerCase()] || "Consult a healthcare professional for proper diagnosis and treatment.";
}

function generateCombinedRecommendation(intentResult, diseaseResult) {
  if (!intentResult || !diseaseResult) return "Please provide more information for accurate analysis.";
  const { intent } = intentResult;
  const disease = diseaseResult.disease;
  const confidence = Number(diseaseResult.confidence || 0);
  if (intent === 'emergency') return "🚨 EMERGENCY: Call emergency services (108/112) immediately or visit nearest hospital.";
  if (intent === 'symptom_check' || intent === 'diagnosis') {
    if (confidence > 0.7) return `Based on symptoms, possible ${disease}. ${generateRecommendation(disease, 'high')}`;
    return `Symptoms suggest possible ${disease}, but confidence is low. Consult doctor for accurate diagnosis.`;
  }
  if (intent === 'prevention') return `For ${disease} prevention: Use preventive measures, maintain hygiene, avoid risk factors.`;
  if (intent === 'treatment') return `For ${disease} treatment: Consult healthcare professional. Do not self-medicate.`;
  return "Consult a healthcare professional for personalized advice.";
}

module.exports = router;
