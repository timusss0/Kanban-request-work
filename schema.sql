-- Run once against your MySQL database
CREATE TABLE IF NOT EXISTS tickets (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(150) NOT NULL,
  description   TEXT NULL,
  priority      ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  status        ENUM('todo', 'progress', 'done') NOT NULL DEFAULT 'todo',
  requested_by  VARCHAR(60) NOT NULL DEFAULT 'Boss',
  deadline      DATE NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  done_at       TIMESTAMP NULL,
  INDEX idx_status (status)
);
