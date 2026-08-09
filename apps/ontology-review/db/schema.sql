CREATE TABLE IF NOT EXISTS ontology_review_answers (
  reviewer_id TEXT NOT NULL,
  question_set_version TEXT NOT NULL,
  question_id TEXT NOT NULL,
  answer TEXT NOT NULL CHECK (answer IN ('yes', 'no', 'not-sure')),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (reviewer_id, question_set_version, question_id)
);
