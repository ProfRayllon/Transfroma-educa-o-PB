USE transforma_db;

SET @course_supervisor_id_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'courses'
    AND COLUMN_NAME = 'supervisor_id'
);

SET @course_supervisor_id_sql = IF(
  @course_supervisor_id_exists = 0,
  'ALTER TABLE courses ADD COLUMN supervisor_id INT DEFAULT NULL AFTER total_sessions',
  'SELECT 1'
);

PREPARE course_supervisor_id_stmt FROM @course_supervisor_id_sql;
EXECUTE course_supervisor_id_stmt;
DEALLOCATE PREPARE course_supervisor_id_stmt;

SET @course_coordinator_id_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'courses'
    AND COLUMN_NAME = 'coordinator_id'
);

SET @course_coordinator_id_sql = IF(
  @course_coordinator_id_exists = 0,
  'ALTER TABLE courses ADD COLUMN coordinator_id INT DEFAULT NULL AFTER supervisor_name',
  'SELECT 1'
);

PREPARE course_coordinator_id_stmt FROM @course_coordinator_id_sql;
EXECUTE course_coordinator_id_stmt;
DEALLOCATE PREPARE course_coordinator_id_stmt;
