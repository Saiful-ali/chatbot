// routes/chat.js
const express = require("express");
const { pool } = require("../db");
const { translateText, detectLanguage, translateBatch } = require("../utils/translate"); // translateText(text, toLang, fromLang='auto')
const { nbClassifier } = require("../utils/naiveBayes");
const router = express.Router();

/**
 * Helper: search FAQ with multilingual queries
 */
async function searchFAQ(query, userLang = "en") {
  try {
    // Translate query variants to improve match (to en/hi/or)
    const englishQuery = userLang !== "en" ? await translateText(query, "en", userLang) : query;
    const hindiQuery = userLang !== "hi" ? await translateText(query, "hi", userLang) : query;
    const odiaQuery = userLang !== "or" ? await translateText(query, "or", userLang) : query;

    const result = await pool.query(
      `
      SELECT answer, language, question,
             GREATEST(
               similarity(LOWER(question), LOWER($1)),
               similarity(LOWER(question), LOWER($2)),
               similarity(LOWER(question), LOWER($3))
             ) as score
      FROM faqs
      WHERE 
        (tsv @@ plainto_tsquery('simple', $1))
        OR (tsv @@ plainto_tsquery('simple', $2))
        OR (tsv @@ plainto_tsquery('simple', $3))
        OR question % $1
        OR question % $2
        OR question % $3
        OR answer % $1
      ORDER BY score DESC
      LIMIT 1
      `,
      [englishQuery, hindiQuery, odiaQuery]
    );

    if (result.rows.length > 0) {
      const faq = result.rows[0];
      if (faq.language !== userLang) {
        const translatedAnswer = await translateText(faq.answer, userLang, faq.language);
        return { answer: translatedAnswer, source: "faq", originalLang: faq.language, confidence: Number(faq.score) || 0 };
      }
      return { answer: faq.answer, source: "faq", originalLang: faq.language, confidence: Number(faq.score) || 0 };
    }
    return null;
  } catch (err) {
    console.error("❌ searchFAQ error:", err);
    return null;
  }
}

/**
 * Helper: search health entries
 */
// Robust searchHealthEntries with websearch_to_tsquery + rank + fallbacks
async function searchHealthEntries(query, userLang = "en") {
  try {
    // use already-translated english query when possible (caller will pass englishQuery)
    const englishQuery = userLang !== "en" ? await translateText(query, "en", userLang) : query;
    const q = englishQuery.trim();

    // 1) Primary: use websearch_to_tsquery + ts_rank_cd for a stable numeric rank
    const primarySql = `
      SELECT he.id, he.title, he.content, he.risk_level, hc.name AS category,
             ts_rank_cd(he.tsv, websearch_to_tsquery('english', $1)) AS rank_score,
             GREATEST(
               COALESCE(similarity(LOWER(he.title), LOWER($1)), 0),
               COALESCE(similarity(LOWER(he.content), LOWER($1)), 0)
             ) AS trigram_score,
             (he.tsv @@ websearch_to_tsquery('english', $1)) AS tsv_match
      FROM health_entries he
      JOIN health_categories hc ON hc.id = he.category_id
      WHERE he.tsv @@ websearch_to_tsquery('english', $1)
         OR he.title % $1
         OR he.content % $1
      ORDER BY rank_score DESC, trigram_score DESC
      LIMIT 1
    `;
    const primaryRes = await pool.query(primarySql, [q]);

    if (primaryRes.rows.length > 0) {
      const r = primaryRes.rows[0];
      console.log("searchHealthEntries: primary match:", { id: r.id, title: r.title, rank_score: r.rank_score, trigram_score: r.trigram_score, tsv_match: r.tsv_match });
      const translatedContent = await translateText(r.content, userLang, "en");
      const translatedTitle = await translateText(r.title, userLang, "en");
      // normalize confidence to a 0..1-like value using rank_score where possible
      const confidence = r.rank_score ? Math.min(1, Number(r.rank_score)) : (r.trigram_score ? Number(r.trigram_score) : (r.tsv_match ? 0.5 : 0));
      return {
        answer: `${translatedTitle}\n\n${translatedContent}`,
        source: "health_entry",
        originalLang: "en",
        category: r.category,
        riskLevel: r.risk_level,
        confidence
      };
    }

    // 2) Fallback A: trigram similarity across title + content
    try {
      const trigSql = `
        SELECT id, title, content, risk_level,
               GREATEST(similarity(LOWER(title), LOWER($1)), similarity(LOWER(content), LOWER($1))) AS score
        FROM health_entries
        ORDER BY GREATEST(similarity(LOWER(title), LOWER($1)), similarity(LOWER(content), LOWER($1))) DESC
        LIMIT 3
      `;
      const trigRes = await pool.query(trigSql, [q]);
      if (trigRes.rows.length > 0) {
        const best = trigRes.rows[0];
        if (Number(best.score) > 0.10) {
          console.log("searchHealthEntries: trigram fallback best:", { id: best.id, title: best.title, score: best.score });
          const translatedContent = await translateText(best.content, userLang, "en");
          const translatedTitle = await translateText(best.title, userLang, "en");
          return {
            answer: `${translatedTitle}\n\n${translatedContent}`,
            source: "health_entry",
            originalLang: "en",
            category: null,
            riskLevel: best.risk_level,
            confidence: Number(best.score)
          };
        } else {
          console.log("searchHealthEntries: trigram fallback found but low score:", best.score);
        }
      }
    } catch (trigErr) {
      console.warn("searchHealthEntries: trigram fallback error:", trigErr.message || trigErr);
    }

    // 3) Fallback B: substring ILIKE search
    const ilikeSql = `
      SELECT he.id, he.title, he.content, he.risk_level, hc.name as category,
        CASE
          WHEN lower(he.title) LIKE lower($1) THEN 3
          WHEN lower(he.title) LIKE lower($2) THEN 2
          WHEN lower(he.content) LIKE lower($2) THEN 1
          ELSE 0
        END as rank_score
      FROM health_entries he
      JOIN health_categories hc ON hc.id = he.category_id
      WHERE lower(he.title) LIKE lower($2) OR lower(he.content) LIKE lower($2)
      ORDER BY rank_score DESC
      LIMIT 1
    `;
    const containsPhrase = `%${q}%`;
    const ilikeRes = await pool.query(ilikeSql, [containsPhrase, containsPhrase]);
    if (ilikeRes.rows.length > 0) {
      const r = ilikeRes.rows[0];
      console.log("searchHealthEntries: ilike fallback:", { id: r.id, title: r.title, rank: r.rank_score });
      const translatedContent = await translateText(r.content, userLang, "en");
      const translatedTitle = await translateText(r.title, userLang, "en");
      return {
        answer: `${translatedTitle}\n\n${translatedContent}`,
        source: "health_entry",
        originalLang: "en",
        category: r.category,
        riskLevel: r.risk_level,
        confidence: 0.15
      };
    }

    console.log("searchHealthEntries: no match for query:", q);
    return null;
  } catch (err) {
    console.error("❌ searchHealthEntries error:", err);
    return null;
  }
}

/**
 * Helper: search active alerts
 */
async function searchAlerts(query, userLang = "en") {
  try {
    const englishQuery = userLang !== "en" ? await translateText(query, "en", userLang) : query;

    const result = await pool.query(
      `
      SELECT id, title, description, priority, alert_type,
             similarity(LOWER(title), LOWER($1)) as score
      FROM health_alerts
      WHERE 
        is_active = true
        AND (expires_at IS NULL OR expires_at >= NOW())
        AND (
          tsv @@ plainto_tsquery('english', $1)
          OR title % $1
          OR description % $1
        )
      ORDER BY score DESC, priority DESC
      LIMIT 1
      `,
      [englishQuery]
    );

    if (result.rows.length > 0) {
      const alert = result.rows[0];
      const translatedTitle = await translateText(alert.title, userLang, "en");
      const translatedDesc = await translateText(alert.description, userLang, "en");
      return {
        answer: `🚨 ${translatedTitle}\n\n${translatedDesc}\n\nPriority: ${alert.priority?.toUpperCase()}`,
        source: "alert",
        originalLang: "en",
        priority: alert.priority,
        confidence: Number(alert.score) || 0
      };
    }
    return null;
  } catch (err) {
    console.error("❌ searchAlerts error:", err);
    return null;
  }
}

/**
 * Run all searches in parallel and pick best candidate by score/confidence
 */
async function runAllSearches(query, userLang) {
  const searches = await Promise.allSettled([
    searchFAQ(query, userLang),
    searchHealthEntries(query, userLang),
    searchAlerts(query, userLang)
  ]);

  // Map results to normalized shape
  const normalized = searches.map((s, idx) => {
    if (s.status === "rejected" || !s.value) return null;
    const v = s.value;
    const score = (typeof v.confidence === "number") ? v.confidence : (typeof v.score === "number" ? v.score : 0);
    return {
      answer: v.answer,
      source: v.source || (idx === 0 ? "faq" : idx === 1 ? "health_entry" : "alert"),
      score: Number(score) || 0,
      originalLang: v.originalLang || userLang,
      category: v.category || null,
      riskLevel: v.riskLevel || null,
      priority: v.priority || null,
      raw: v
    };
  }).filter(Boolean);

  // Debug logging (will show candidates and scores)
  console.log("🔎 Search candidates:", normalized.map(n => ({ source: n.source, score: n.score })));

  if (!normalized.length) return null;

  // Choose highest score
  normalized.sort((a, b) => b.score - a.score);
  return normalized[0];
}

/**
 * POST /api/chat - Multilingual Chatbot with optional Naive Bayes
 */
router.post("/", async (req, res) => {
  try {
    let { message, lang = "auto", useNaiveBayes = true } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "Message is required",
        usage: { message: "Your question here", lang: "auto" }
      });
    }

    message = message.trim();

    if (lang === "auto" || !lang) {
      lang = await detectLanguage(message);
    }

    lang = (lang || "en").slice(0, 2).toLowerCase();
    console.log(`🧠 [Chat Query] "${message}" in [${lang}]`);

    // Translate to English for processing (for NB)
    const englishQuery = lang !== "en" ? await translateText(message, "en", lang) : message;

    // Naive Bayes predictions (optional)
    let intentData = null;
    let diseaseData = null;
    if (useNaiveBayes && nbClassifier && nbClassifier.trained) {
      try {
        intentData = nbClassifier.classifyIntent(englishQuery);
        if (intentData && ['symptom_check', 'diagnosis'].includes(intentData.intent)) {
          diseaseData = nbClassifier.classifyDisease(englishQuery);
        }
        console.log("🎯 NB intent:", intentData?.intent, "disease:", diseaseData?.disease);
      } catch (err) {
        console.warn("⚠️ Naive Bayes classify error:", err.message || err);
      }
    }

    // Run all searches and pick best candidate
    let resultObj = await runAllSearches(message, lang);

    // Minimum sensible score threshold to accept a candidate. Tweak as needed (0.0 = accept anything).
    const MIN_SCORE = 0.12;

    if (!resultObj || resultObj.score < MIN_SCORE) {
      // If no good candidate found, fall back to existing behavior (FAQ -> entries -> alerts -> fallback)
      console.log("ℹ️ No high-confidence search result. Falling back to sequential checks.");
      let seqResult = await searchFAQ(message, lang);
      if (!seqResult) seqResult = await searchHealthEntries(message, lang);
      if (!seqResult) seqResult = await searchAlerts(message, lang);

      if (!seqResult) {
        const fallbackMessages = {
          en: "I'm sorry, I couldn't find specific information about that. Please try rephrasing your question or contact your local health office for assistance.",
          hi: "मुझे खेद है, मुझे इस बारे में विशिष्ट जानकारी नहीं मिली। कृपया अपना प्रश्न दोबारा लिखें या सहायता के लिए अपने स्थानीय स्वास्थ्य कार्यालय से संपर्क करें।",
          or: "ମୁଁ ଦୁଃଖିତ, ମୁଁ ସେ ବିଷୟରେ ନିର୍ଦ୍ଦିଷ୍ଟ ସୂଚନା ପାଇଲି ନାହିଁ। ଦୟାକରି ଆପଣଙ୍କର ପ୍ରଶ୍ନକୁ ପୁନର୍ବାର ଲେଖନ୍ତୁ କିମ୍ବା ସାହାଯ୍ୟ ପାଇଁ ଆପଣଙ୍କର ସ୍ଥାନୀୟ ସ୍ୱାସ୍ଥ୍ୟ କାର୍ଯ୍ୟାଳୟ ସହିତ ଯୋଗାଯୋଗ କରନ୍ତୁ।"
        };
        resultObj = { answer: fallbackMessages[lang] || fallbackMessages.en, source: "fallback", originalLang: lang, score: null };
      } else {
        resultObj = {
          answer: seqResult.answer,
          source: seqResult.source,
          originalLang: seqResult.originalLang,
          score: seqResult.confidence || seqResult.score || null,
          category: seqResult.category || null,
          riskLevel: seqResult.riskLevel || null,
          priority: seqResult.priority || null
        };
      }
    } else {
      // Map normalized resultObj to expected result shape
      resultObj = {
        answer: resultObj.answer,
        source: resultObj.source,
        originalLang: resultObj.originalLang,
        confidence: resultObj.score,
        category: resultObj.category,
        riskLevel: resultObj.riskLevel,
        priority: resultObj.priority
      };
    }

    const aiInsights = {
      intentDetected: intentData?.intent || null,
      intentConfidence: intentData ? (intentData.confidence * 100).toFixed(1) + "%" : null,
      diseasePredict: diseaseData?.disease || null,
      diseaseConfidence: diseaseData ? (diseaseData.confidence * 100).toFixed(1) + "%" : null
    };

    let audioUrl = null;
    if (req.query.audio === "true" || req.body.audio === true) {
      audioUrl = `${process.env.SERVER_PUBLIC_URL || "http://localhost:5000"}/api/tts?text=${encodeURIComponent(resultObj.answer)}&lang=${lang}&stream=true`;
    }

    res.json({
      success: true,
      reply: resultObj.answer,
      language: lang,
      source: resultObj.source,
      originalLanguage: resultObj.originalLang,
      translated: resultObj.originalLang !== lang,
      confidence: resultObj.confidence || resultObj.score || null,
      audio: audioUrl,
      naiveBayes: aiInsights,
      metadata: {
        category: resultObj.category || null,
        riskLevel: resultObj.riskLevel || null,
        priority: resultObj.priority || null
      }
    });

    console.log(`✅ Replied in [${lang}] from [${resultObj.source}] (score=${resultObj.confidence || resultObj.score || "n/a"})`);
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

/**
 * GET /api/chat/languages
 */
router.get("/languages", (req, res) => {
  res.json({
    supported: [
      { code: "en", name: "English", native: "English" },
      { code: "hi", name: "Hindi", native: "हिन्दी" },
      { code: "or", name: "Odia", native: "ଓଡ଼ିଆ" }
    ],
    default: "en",
    autoDetect: true
  });
});

module.exports = router;
