USE transforma_db;

SET @avatar_column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'avatar'
);

SET @avatar_sql = IF(
  @avatar_column_exists = 0,
  'ALTER TABLE users ADD COLUMN avatar MEDIUMTEXT DEFAULT NULL AFTER `function`',
  'SELECT 1'
);

PREPARE avatar_stmt FROM @avatar_sql;
EXECUTE avatar_stmt;
DEALLOCATE PREPARE avatar_stmt;
