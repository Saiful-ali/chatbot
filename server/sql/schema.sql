-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- FAQ: multilingual Q&A (for chat)
CREATE TABLE IF NOT EXISTS faq (
  id SERIAL PRIMARY KEY,
  lang VARCHAR(5) NOT NULL DEFAULT 'en',           -- 'en' | 'hi' | 'or'
  question TEXT NOT NULL,
  answer   TEXT NOT NULL,
  tags     TEXT DEFAULT '',
  tsv      tsvector
);

-- Build tsvector (basic: english for en; simple for others)
-- You can adjust per-language configuration
CREATE OR REPLACE FUNCTION faq_tsv_update() RETURNS trigger AS $$
BEGIN
  IF NEW.lang = 'en' THEN
    NEW.tsv := to_tsvector('english', unaccent(coalesce(NEW.question,'') || ' ' || coalesce(NEW.answer,'') || ' ' || coalesce(NEW.tags,'')));
  ELSE
    NEW.tsv := to_tsvector('simple',  unaccent(coalesce(NEW.question,'') || ' ' || coalesce(NEW.answer,'') || ' ' || coalesce(NEW.tags,'')));
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_faq_tsv ON faq;
CREATE TRIGGER trg_faq_tsv
BEFORE INSERT OR UPDATE ON faq
FOR EACH ROW EXECUTE FUNCTION faq_tsv_update();

CREATE INDEX IF NOT EXISTS idx_faq_lang ON faq(lang);
CREATE INDEX IF NOT EXISTS idx_faq_tsv  ON faq USING GIN(tsv);
CREATE INDEX IF NOT EXISTS idx_faq_q_trgm ON faq USING GIN (question gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_faq_tags_trgm ON faq USING GIN (tags gin_trgm_ops);

-- Vaccination schedule
CREATE TABLE IF NOT EXISTS vaccines (
  id SERIAL PRIMARY KEY,
  lang VARCHAR(5) NOT NULL DEFAULT 'en',
  disease TEXT NOT NULL,
  vaccine TEXT NOT NULL,
  age_group TEXT NOT NULL,     -- e.g., "0-6 months", "Adults"
  schedule TEXT NOT NULL,      -- e.g., "Birth, 6 weeks, 10 weeks"
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_vacc_lang ON vaccines(lang);

-- Outbreak alerts
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  disease TEXT NOT NULL,
  district TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  message TEXT NOT NULL,
  starts_at TIMESTAMP NULL,
  ends_at   TIMESTAMP NULL,
  source TEXT
);
CREATE INDEX IF NOT EXISTS idx_alert_time ON alerts (starts_at, ends_at);

-- Sample data (delete/adjust later)
INSERT INTO faq (lang, question, answer, tags) VALUES
('en','what is dengue prevention','Use mosquito nets, remove standing water, wear long sleeves.', 'dengue, prevention, mosquito'),
('en','covid symptoms','Fever, cough, fatigue; seek medical care if severe.', 'covid, symptoms'),
('hi','टीकाकरण अनुसूची क्या है','जन्म से लेकर किशोरावस्था तक निर्धारित समय पर टीके लगाए जाते हैं।','टीका, शेड्यूल'),
('or','ମଶା ବନ୍ଦୋବସ୍ଥା କିପରି','ପାଣି ଜମି ନ ରଖନ୍ତୁ, ମଶାଦାନୀ ବ୍ୟବହାର କରନ୍ତୁ।','ମଶା, ଡେଙ୍ଗୁ');

INSERT INTO vaccines (lang, disease, vaccine, age_group, schedule, notes) VALUES
('en','Measles','MR','9-12 months','Single dose','As per national schedule'),
('en','Polio','OPV','Birth-5 years','At birth, 6, 10, 14 weeks + boosters',''),
('hi','खसरा','MR','9-12 माह','एक डोज','राष्ट्रीय शेड्यूल'),
('or','ପୋଲିଓ','OPV','ଜନ୍ମ-5 ବର୍ଷ','ଜନ୍ମ, 6, 10, 14 ସପ୍ତାହ + ବୁଷ୍ଟର','');

INSERT INTO alerts (disease, district, severity, message, starts_at, ends_at, source) VALUES
('Dengue','Cuttack','high','Increase in cases. Remove stagnant water.','2025-10-01','2025-10-31','District Health Office');
-- ===============================================================
--  MULTILINGUAL SEARCH EXTENSION (ENHANCEMENT FOR EXISTING TABLES)
-- ===============================================================

-- Enable helpful PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1️⃣ Add columns for text search if they don’t exist
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS tsv tsvector;
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS tags text DEFAULT '';

ALTER TABLE health_entries ADD COLUMN IF NOT EXISTS tsv tsvector;
ALTER TABLE health_entries ADD COLUMN IF NOT EXISTS tags text DEFAULT '';

ALTER TABLE health_alerts ADD COLUMN IF NOT EXISTS tsv tsvector;

-- 2️⃣ Functions + Triggers to auto-update tsvector
CREATE OR REPLACE FUNCTION faqs_tsv_update() RETURNS trigger AS $$
BEGIN
  IF NEW.language = 'en' THEN
    NEW.tsv := to_tsvector('english', unaccent(coalesce(NEW.question,'') || ' ' || coalesce(NEW.answer,'') || ' ' || coalesce(NEW.tags,'')));
  ELSE
    NEW.tsv := to_tsvector('simple', unaccent(coalesce(NEW.question,'') || ' ' || coalesce(NEW.answer,'') || ' ' || coalesce(NEW.tags,'')));
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_faqs_tsv ON faqs;
CREATE TRIGGER trg_faqs_tsv
BEFORE INSERT OR UPDATE ON faqs
FOR EACH ROW EXECUTE FUNCTION faqs_tsv_update();

CREATE OR REPLACE FUNCTION health_entries_tsv_update() RETURNS trigger AS $$
BEGIN
  IF NEW.title IS NOT NULL OR NEW.content IS NOT NULL THEN
    NEW.tsv := to_tsvector('simple', unaccent(coalesce(NEW.title,'') || ' ' || coalesce(NEW.content,'') || ' ' || coalesce(NEW.tags,'')));
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_health_entries_tsv ON health_entries;
CREATE TRIGGER trg_health_entries_tsv
BEFORE INSERT OR UPDATE ON health_entries
FOR EACH ROW EXECUTE FUNCTION health_entries_tsv_update();

CREATE OR REPLACE FUNCTION health_alerts_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.tsv := to_tsvector('english', unaccent(coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,'')));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_health_alerts_tsv ON health_alerts;
CREATE TRIGGER trg_health_alerts_tsv
BEFORE INSERT OR UPDATE ON health_alerts
FOR EACH ROW EXECUTE FUNCTION health_alerts_tsv_update();

-- 3️⃣ Indexes for speed
CREATE INDEX IF NOT EXISTS idx_faqs_tsv ON faqs USING GIN (tsv);
CREATE INDEX IF NOT EXISTS idx_faqs_q_trgm ON faqs USING GIN (question gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_faqs_a_trgm ON faqs USING GIN (answer gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_health_entries_tsv ON health_entries USING GIN (tsv);
CREATE INDEX IF NOT EXISTS idx_health_entries_title_trgm ON health_entries USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_alerts_tsv ON health_alerts USING GIN (tsv);
CREATE INDEX IF NOT EXISTS idx_alerts_title_trgm ON health_alerts USING GIN (title gin_trgm_ops);

-- 4️⃣ Refresh existing data
UPDATE faqs SET question = question;
UPDATE health_entries SET title = title;
UPDATE health_alerts SET title = title;
