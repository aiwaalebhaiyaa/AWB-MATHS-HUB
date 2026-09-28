CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(80) NOT NULL,

  sbu_id VARCHAR(30),

  email VARCHAR(255) UNIQUE NOT NULL,

  password_hash TEXT NOT NULL,

  role VARCHAR(20) NOT NULL DEFAULT 'student'
    CHECK (role IN ('student','admin')),

  xp INTEGER NOT NULL DEFAULT 0,

  streak INTEGER NOT NULL DEFAULT 0,

  last_active_date DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add SBU ID to an already-existing users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS sbu_id VARCHAR(30);

-- Every SBU ID must be unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_sbu_id
ON users(sbu_id)
WHERE sbu_id IS NOT NULL;


CREATE TABLE IF NOT EXISTS topic_progress (
  id BIGSERIAL PRIMARY KEY,

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  module_id VARCHAR(10) NOT NULL,

  topic_index INTEGER NOT NULL,

  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, module_id, topic_index)
);


CREATE TABLE IF NOT EXISTS mistakes (
  id BIGSERIAL PRIMARY KEY,

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  source VARCHAR(30) NOT NULL DEFAULT 'PRACTICE',

  module_id VARCHAR(10),

  question TEXT NOT NULL,

  selected_answer TEXT,

  correct_answer TEXT NOT NULL,

  explanation TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS attempts (
  id BIGSERIAL PRIMARY KEY,

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  mode VARCHAR(20) NOT NULL,

  module_id VARCHAR(10),

  score INTEGER NOT NULL,

  total INTEGER NOT NULL,

  duration_seconds INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS questions (
  id BIGSERIAL PRIMARY KEY,

  module_id VARCHAR(10) NOT NULL,

  topic_index INTEGER,

  mode VARCHAR(20) NOT NULL DEFAULT 'PRACTICE',

  question TEXT NOT NULL,

  options JSONB,

  correct_answer TEXT NOT NULL,

  explanation TEXT,

  source_label VARCHAR(100) DEFAULT 'Syllabus-structured',

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS formulas (
  id BIGSERIAL PRIMARY KEY,

  module_id VARCHAR(10) NOT NULL,

  topic_index INTEGER,

  title VARCHAR(200) NOT NULL,

  formula TEXT NOT NULL,

  explanation TEXT,

  source_label VARCHAR(100) DEFAULT 'Syllabus-structured',

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_topic_progress_user
ON topic_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_mistakes_user
ON mistakes(user_id);

CREATE INDEX IF NOT EXISTS idx_attempts_user
ON attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_questions_module
ON questions(module_id);

CREATE INDEX IF NOT EXISTS idx_formulas_module
ON formulas(module_id);