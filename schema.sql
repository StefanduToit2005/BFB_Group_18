-- MediLink database schema (MySQL 8).
-- Loaded by the tests and by seed.py. Do not add CREATE DATABASE or USE here,
-- because the connection already chooses the database from DB_NAME.

-- Drop children first, then parents, so foreign keys do not block the drops.
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS medical_history;
DROP TABLE IF EXISTS requests;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS staff_users;

-- Staff who log in: the administrator and the neurologist.
CREATE TABLE staff_users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin', 'neurologist') NOT NULL,
    full_name     VARCHAR(100) NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_staff_username UNIQUE (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per patient. patient_no (for example ML-1001) is the key used everywhere.
CREATE TABLE patients (
    patient_no    VARCHAR(10)  NOT NULL PRIMARY KEY,
    id_type       ENUM('SA ID', 'Passport') NOT NULL,
    id_number     VARCHAR(30)  NOT NULL,
    country       VARCHAR(60)  NOT NULL,
    date_of_birth DATE         NOT NULL,
    first_name    VARCHAR(60)  NOT NULL,
    surname       VARCHAR(60)  NOT NULL,
    email         VARCHAR(120) NOT NULL,
    phone         VARCHAR(20)  NOT NULL,
    address       VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    digitised     BOOLEAN      NOT NULL DEFAULT 0,
    consent_at    DATETIME     NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_patients_identity UNIQUE (id_type, id_number, country),
    INDEX idx_patients_name (surname, first_name),
    INDEX idx_patients_email (email),
    INDEX idx_patients_digitised (digitised)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Patient messages and requests. created_by is empty when the patient sent it.
CREATE TABLE requests (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    patient_no   VARCHAR(10)  NOT NULL,
    channel      ENUM('Patient portal', 'Email', 'Phone', 'In person') NOT NULL,
    category     VARCHAR(60)  NOT NULL,
    subject      VARCHAR(150) NOT NULL,
    body         TEXT         NOT NULL,
    urgency      ENUM('urgent', 'soon', 'routine') NOT NULL DEFAULT 'routine',
    status       ENUM('new', 'forwarded', 'completed') NOT NULL DEFAULT 'new',
    admin_note   TEXT         NULL,
    response     TEXT         NULL,
    completed_at DATETIME     NULL,
    created_by   INT          NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_requests_patient FOREIGN KEY (patient_no)
        REFERENCES patients (patient_no) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_requests_staff FOREIGN KEY (created_by)
        REFERENCES staff_users (id) ON DELETE SET NULL,
    INDEX idx_requests_status_urgency (status, urgency),
    INDEX idx_requests_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Scanned paper files. The file itself lives in uploads/, the table keeps the path.
CREATE TABLE documents (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    patient_no  VARCHAR(10)  NOT NULL,
    file_name   VARCHAR(255) NOT NULL,
    stored_path VARCHAR(255) NOT NULL,
    mime_type   VARCHAR(100) NOT NULL,
    size_bytes  INT UNSIGNED NOT NULL,
    doc_type    VARCHAR(60)  NOT NULL DEFAULT 'Other',
    note        TEXT         NULL,
    uploaded_by INT          NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_documents_size CHECK (size_bytes > 0),
    CONSTRAINT fk_documents_patient FOREIGN KEY (patient_no)
        REFERENCES patients (patient_no) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_documents_staff FOREIGN KEY (uploaded_by)
        REFERENCES staff_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Notes on a patient's clinical history, shown on the patient file page.
CREATE TABLE medical_history (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    patient_no VARCHAR(10) NOT NULL,
    event_date DATE        NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    note       TEXT        NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_patient FOREIGN KEY (patient_no)
        REFERENCES patients (patient_no) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_history_patient_date (patient_no, event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;