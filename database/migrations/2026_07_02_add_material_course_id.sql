USE transforma_db;

ALTER TABLE materials
  ADD COLUMN course_id INT DEFAULT NULL AFTER course;

UPDATE materials m
JOIN courses c ON c.name = m.course
SET m.course_id = c.id
WHERE m.course_id IS NULL;

CREATE INDEX idx_materials_course_id ON materials(course_id);
