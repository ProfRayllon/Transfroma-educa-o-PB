// 16 Gerências Regionais de Educação da Paraíba (dados oficiais)
const gresPB = [
  {
    gre: '1ª GRE',
    sede: 'João Pessoa',
    total: 2184,
    municipios: ['João Pessoa'],
  },
  {
    gre: '2ª GRE',
    sede: 'Guarabira',
    total: 1162,
    municipios: [
      'Alagoinha', 'Arara', 'Araruna', 'Araçagi', 'Areia', 'Bananeiras',
      'Belém', 'Borborema', 'Cacimba de Dentro', 'Caiçara', 'Casserengue',
      'Cuitegi', 'Dona Inês', 'Duas Estradas', 'Guarabira', 'Lagoa de Dentro',
      'Logradouro', 'Mulungu', 'Pilões', 'Pilõezinhos', 'Pirpirituba', 'Riachão',
      'Serra da Raiz', 'Serraria', 'Sertãozinho', 'Solânea', 'Tacima',
    ],
  },
  {
    gre: '3ª GRE',
    sede: 'Campina Grande',
    total: 2032,
    municipios: [
      'Alagoa Grande', 'Alagoa Nova', 'Algodão de Jandaíra', 'Areial',
      'Boa Vista', 'Campina Grande', 'Esperança', 'Itatuba', 'Lagoa Seca',
      'Livramento', 'Massaranduba', 'Matinhas', 'Montadas', 'Olivedos',
      'Pocinhos', 'Puxinanã', 'Remígio', 'Serra Redonda', 'Soledade',
      'São Sebastião de Lagoa de Roça',
    ],
  },
  {
    gre: '4ª GRE',
    sede: 'Cuité',
    total: 448,
    municipios: [
      'Baraúna', 'Barra de Santa Rosa', 'Cubati', 'Cuité', 'Damião',
      'Frei Martinho', 'Nova Floresta', 'Nova Palmeira', 'Pedra Lavrada',
      'Picuí', 'Sossêgo', 'São Vicente do Seridó',
    ],
  },
  {
    gre: '5ª GRE',
    sede: 'Monteiro',
    total: 530,
    municipios: [
      'Amparo', 'Camalaú', 'Caraúbas', 'Congo', 'Coxixola', 'Gurjão',
      'Monteiro', 'Ouro Velho', 'Parari', 'Prata', 'Santo André', 'Serra Branca',
      'Sumé', 'São José dos Cordeiros', 'São João do Cariri', 'São João do Tigre',
      'São Sebastião do Umbuzeiro', 'Zabelê',
    ],
  },
  {
    gre: '6ª GRE',
    sede: 'Patos',
    total: 940,
    municipios: [
      'Areia de Baraúnas', 'Assunção', 'Cacimba de Areia', 'Cacimbas',
      'Catingueira', 'Desterro', 'Emas', 'Juazerinho', 'Junco do Seridó',
      'Malta', 'Maturéia', "Mãe d'Água", 'Passagem', 'Patos', 'Quixabá',
      'Salgadinho', 'Santa Luzia', 'Santa Teresinha', 'São José de Espinharas',
      'São José do Bonfim', 'São José do Sabugi', 'São Mamede', 'Taperoá',
      'Teixeira', 'Tenório', 'Várzea',
    ],
  },
  {
    gre: '7ª GRE',
    sede: 'Itaporanga',
    total: 674,
    municipios: [
      'Aguiar', 'Boa Ventura', 'Conceição', 'Coremas', 'Curral Velho',
      'Diamante', 'Ibiara', 'Igaracy', 'Itaporanga', 'Nova Olinda',
      "Olho d'Água", 'Pedra Branca', 'Piancó', 'Santa Inês',
      'Santana de Mangueira', 'Santana dos Garrotes', 'Serra Grande',
      'São José de Caiana',
    ],
  },
  {
    gre: '8ª GRE',
    sede: 'Católé do Rocha',
    total: 353,
    municipios: [
      'Belém do Brejo do Cruz', 'Bom Sucesso', 'Brejo do Cruz', 'Brejo dos Santos',
      'Católé do Rocha', 'Jericó', 'Lagoa', 'Mato Grosso', 'Riacho dos Cavalos',
      'São Bento', 'São José do Brejo do Cruz',
    ],
  },
  {
    gre: '9ª GRE',
    sede: 'Cajazeiras',
    total: 763,
    municipios: [
      'Bernardino Batista', 'Bom Jesus', 'Bonito de Santa Fé', 'Cachoeira dos Índios',
      'Cajazeiras', 'Carrapateira', 'Joca Claudino', 'Monte Horebe', 'Poço Dantas',
      'Poço de José de Moura', 'Santa Helena', 'São José de Piranhas',
      'São João do Rio do Peixe', 'Triunfo', 'Uiraúna',
    ],
  },
  {
    gre: '10ª GRE',
    sede: 'Sousa',
    total: 666,
    municipios: [
      'Aparecida', 'Lastro', 'Marizópolis', 'Nazarezinho', 'Santa Cruz',
      'Sousa', 'São Francisco', 'São José da Lagoa Tapada', 'Vieirópolis',
    ],
  },
  {
    gre: '11ª GRE',
    sede: 'Princesa Isabel',
    total: 341,
    municipios: [
      'Imaculada', 'Juru', 'Manaíra', 'Princesa Isabel', 'São José de Princesa',
      'Tavares', 'Água Branca',
    ],
  },
  {
    gre: '12ª GRE',
    sede: 'Itabaiana',
    total: 618,
    municipios: [
      'Caldas Brandão', 'Gurinhém', 'Ingá', 'Itabaiana', 'Juarez Távora',
      'Juripiranga', 'Mogeiro', 'Pedras de Fogo', 'Pilar', 'Riachão do Bacamarte',
      'Salgado de São Félix', 'São José dos Ramos', 'São Miguel de Taipu',
    ],
  },
  {
    gre: '13ª GRE',
    sede: 'Pombal',
    total: 372,
    municipios: [
      'Cajazeirinhas', 'Condado', 'Paulista', 'Pombal', 'São Bentinho',
      'São Domingos', 'Vista Serrana',
    ],
  },
  {
    gre: '14ª GRE',
    sede: 'Mamanguape',
    total: 668,
    municipios: [
      'Baía da Traição', 'Capim', 'Cuité de Mamanguape', 'Curral de Cima',
      'Itapororoca', 'Jacaraú', 'Mamanguape', 'Marcação', 'Mataraca',
      'Pedro Régis', 'Rio Tinto',
    ],
  },
  {
    gre: '15ª GRE',
    sede: 'Queimadas',
    total: 494,
    municipios: [
      'Alcantil', 'Aroeiras', 'Barra de Santana', 'Barra de São Miguel',
      'Boqueirão', 'Cabaceiras', 'Caturité', 'Fagundes', 'Gado Bravo',
      'Natuba', 'Queimadas', 'Riacho de Santo Antônio', 'Santa Cecília',
      'São Domingos do Cariri', 'Umbuzeiro',
    ],
  },
  {
    gre: '16ª GRE',
    sede: 'Santa Rita',
    total: 1200,
    municipios: [
      'Alhandra', 'Bayeux', 'Caaporã', 'Cabedelo', 'Conde',
      'Cruz do Espírito Santo', 'Lucena', 'Mari', 'Pitimbu', 'Riachão do Poço',
      'Santa Rita', 'Sapé', 'Sobrado',
    ],
  },
]

export default gresPB
