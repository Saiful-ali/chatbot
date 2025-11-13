-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  preferred_language VARCHAR(5) DEFAULT 'en',
  is_authenticated BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  channel VARCHAR(20) DEFAULT 'whatsapp',
  is_active BOOLEAN DEFAULT true,
  preferred_lang VARCHAR(5) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_phone_number UNIQUE(phone_number)
);

-- FAQs
CREATE TABLE IF NOT EXISTS faqs (
  id SERIAL PRIMARY KEY,
  language VARCHAR(5) DEFAULT 'en',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT DEFAULT '',
  tsv tsvector
);

-- Health categories
CREATE TABLE IF NOT EXISTS health_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT
);

-- Health entries
CREATE TABLE IF NOT EXISTS health_entries (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES health_categories(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  risk_level VARCHAR(20),
  tags TEXT DEFAULT '',
  tsv tsvector,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Health alerts
CREATE TABLE IF NOT EXISTS health_alerts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  alert_type VARCHAR(50) DEFAULT 'outbreak',
  priority VARCHAR(20) DEFAULT 'medium',
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  tsv tsvector,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Government updates
CREATE TABLE IF NOT EXISTS gov_updates (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium',
  lang VARCHAR(5) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Triggers for full-text search
CREATE OR REPLACE FUNCTION faqs_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.tsv := to_tsvector('simple', unaccent(coalesce(NEW.question,'') || ' ' || coalesce(NEW.answer,'') || ' ' || coalesce(NEW.tags,'')));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_faqs_tsv BEFORE INSERT OR UPDATE ON faqs
FOR EACH ROW EXECUTE FUNCTION faqs_tsv_update();

-- Sample data
INSERT INTO faqs (language, question, answer, tags) VALUES
('en', 'What is dengue prevention?', 'Use mosquito nets, remove standing water, wear long sleeves.', 'dengue,prevention,mosquito'),
('en', 'What are COVID symptoms?', 'Fever, cough, fatigue. Seek medical care if severe.', 'covid,symptoms'),
('hi', 'डेंगू से बचाव कैसे करें?', 'मच्छरदानी का उपयोग करें, रुका हुआ पानी हटाएं।', 'डेंगू,रोकथाम'),
('or', 'କୋଭିଡ୍ ଲକ୍ଷଣ କଣ?', 'ଜ୍ଵର, କାଶ, ଥକାପଣ। ଗମ୍ଭୀର ହେଲେ ଡାକ୍ତରଙ୍କୁ ଦେଖାନ୍ତୁ।', 'କୋଭିଡ୍');

INSERT INTO health_categories (name, type, description) VALUES
('Dengue', 'disease', 'Mosquito-borne viral infection'),
('COVID-19', 'disease', 'Respiratory illness caused by coronavirus'),
('Measles Vaccine', 'vaccine', 'Protection against measles');

INSERT INTO health_entries (category_id, title, content, risk_level) VALUES
(1, 'Dengue Prevention', 'Remove standing water, use mosquito nets, wear protective clothing.', 'high'),
(2, 'COVID-19 Symptoms', 'Fever, cough, breathing difficulty. Isolate and test if symptoms appear.', 'medium');

INSERT INTO health_alerts (title, description, alert_type, priority, expires_at) VALUES
('Dengue Outbreak in Cuttack', 'High number of cases reported. Take preventive measures.', 'outbreak', 'high', NOW() + INTERVAL '30 days');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_faqs_tsv ON faqs USING GIN(tsv);
CREATE INDEX IF NOT EXISTS idx_health_entries_tsv ON health_entries USING GIN(tsv);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON user_subscriptions(is_active);