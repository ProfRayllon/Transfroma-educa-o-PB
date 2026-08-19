USE transforma_db;

-- Descricao do conteudo, escrita pelo professor produtor e separada do campo
-- "objetivo" -- e o texto que o TI usa ao publicar o material no AVA.
ALTER TABLE materials
  ADD COLUMN description TEXT DEFAULT NULL AFTER objective;
