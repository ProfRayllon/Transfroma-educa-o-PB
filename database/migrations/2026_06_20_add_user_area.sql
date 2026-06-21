USE transforma_db;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'area'
);

SET @statement := IF(
  @column_exists = 0,
  'ALTER TABLE users ADD COLUMN area VARCHAR(150) DEFAULT NULL AFTER `function`',
  'SELECT "users.area already exists"'
);

PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
