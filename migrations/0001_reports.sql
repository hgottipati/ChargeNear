CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  charger_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('worked', 'failed')),
  reason TEXT,
  reporter TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_charger ON reports (charger_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports (reporter, created_at);
