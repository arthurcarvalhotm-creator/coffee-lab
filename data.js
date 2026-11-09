/* =====================================================================
 * Laboratório de Cafeteria — Banco de dados nativo
 * Terroirs brasileiros, processos, torras e métodos com parâmetros de
 * partida. Valores são referências de bancada (não regras absolutas):
 * o motor de recomendação parte deles e ajusta com o histórico real.
 * ===================================================================== */
window.CAFE_DB = (function () {
  'use strict';

  /* ---------- Regiões produtoras (terroir) ---------- */
  const regioes = [
    {
      id: 'cerrado-mineiro', nome: 'Cerrado Mineiro', uf: 'MG',
      altitude: [800, 1300], clima: 'Estações bem definidas: chuva no verão, inverno seco e ensolarado (colheita e secagem em clima seco). Primeira Denominação de Origem de café do Brasil.',
      perfil: 'Corpo cheio, doçura alta, acidez média a média-baixa. Chocolate, caramelo, nozes, frutas amarelas maduras.',
      notas: ['chocolate', 'caramelo', 'nozes', 'frutas amarelas', 'mel'],
      acidez: 2, corpo: 4, docura: 4, // escala 1–5
      variedades: ['Mundo Novo', 'Catuaí', 'Topázio', 'Bourbon Amarelo', 'Arara'],
      processos: ['natural', 'cereja-descascado', 'honey', 'anaerobico'],
      metodos: ['espresso', 'prensa-francesa', 'v60', 'coador-pano', 'moka'],
      dica: 'Naturais do Cerrado brilham em espresso e prensa. Em V60, um ponto de moagem mais grosso que o padrão preserva a doçura e evita adstringência.'
    },
    {
      id: 'sul-de-minas', nome: 'Sul de Minas', uf: 'MG',
      altitude: [850, 1400], clima: 'Temperaturas amenas (18–22 °C), relevo ondulado, chuvas bem distribuídas. Maior região produtora do país.',
      perfil: 'Equilíbrio e versatilidade: corpo médio, doçura de caramelo, acidez cítrica moderada, chocolate ao leite e frutas amarelas.',
      notas: ['caramelo', 'chocolate ao leite', 'laranja', 'frutas amarelas', 'castanhas'],
      acidez: 3, corpo: 3, docura: 4,
      variedades: ['Catuaí', 'Mundo Novo', 'Bourbon', 'Acaiá', 'Icatu', 'Catucaí'],
      processos: ['natural', 'cereja-descascado', 'lavado', 'honey'],
      metodos: ['v60', 'kalita', 'melitta', 'espresso', 'aeropress', 'prensa-francesa'],
      dica: 'Café "coringa": funciona em quase todo método. Boa base para calibrar um moedor novo, pois responde de forma previsível a mudanças de moagem.'
    },
    {
      id: 'mantiqueira', nome: 'Mantiqueira de Minas', uf: 'MG',
      altitude: [900, 1500], clima: 'Montanhoso, noites frias, maturação lenta. Indicação de Procedência; berço de muitos campeões do Cup of Excellence.',
      perfil: 'Acidez brilhante e complexa, doçura intensa, corpo sedoso. Frutas vermelhas, pêssego, florais, caramelo.',
      notas: ['frutas vermelhas', 'pêssego', 'floral', 'caramelo', 'cítrico'],
      acidez: 4, corpo: 3, docura: 4,
      variedades: ['Bourbon Amarelo', 'Catuaí', 'Mundo Novo', 'Catucaí', 'Arara'],
      processos: ['natural', 'cereja-descascado', 'lavado', 'anaerobico', 'honey'],
      metodos: ['v60', 'origami', 'suiren', 'kalita', 'chemex', 'aeropress', 'clever'],
      dica: 'Prefira filtrados com água mais quente (94–96 °C) em torras claras para abrir a acidez frutada. Espresso pede razão mais longa (1:2,3+).'
    },
    {
      id: 'matas-de-minas', nome: 'Matas de Minas', uf: 'MG',
      altitude: [600, 1200], clima: 'Zona da Mata: quente e úmido, relevo acidentado, lavouras familiares em montanha. Secagem exige cuidado (umidade).',
      perfil: 'Doçura marcante, corpo médio, acidez cítrica/málica, frutas amarelas e maçã, chocolate.',
      notas: ['frutas amarelas', 'maçã', 'chocolate', 'rapadura', 'cítrico'],
      acidez: 3, corpo: 3, docura: 4,
      variedades: ['Catuaí', 'Catucaí', 'Mundo Novo', 'Bourbon'],
      processos: ['natural', 'cereja-descascado', 'lavado'],
      metodos: ['v60', 'melitta', 'coador-pano', 'kalita', 'espresso'],
      dica: 'Naturais com boa secagem trazem rapadura e frutas. Se aparecer nota de fermentado excessivo, baixe 1–2 °C e alongue ligeiramente a razão.'
    },
    {
      id: 'chapada-de-minas', nome: 'Chapada de Minas', uf: 'MG',
      altitude: [800, 1100], clima: 'Vale do Jequitinhonha e Mucuri, planaltos, clima quente com estação seca definida; irrigação frequente.',
      perfil: 'Corpo médio a cheio, chocolate, cítrico leve, doçura de cana.',
      notas: ['chocolate', 'cana', 'cítrico leve', 'amêndoa'],
      acidez: 2, corpo: 4, docura: 3,
      variedades: ['Catuaí', 'Mundo Novo', 'Topázio'],
      processos: ['natural', 'cereja-descascado'],
      metodos: ['espresso', 'prensa-francesa', 'moka', 'melitta'],
      dica: 'Perfil de base para espresso e bebidas com leite. Em filtrados, razão 1:15 sustenta o corpo.'
    },
    {
      id: 'alta-mogiana', nome: 'Alta Mogiana', uf: 'SP',
      altitude: [900, 1100], clima: 'Nordeste paulista (Franca, Pedregulho, Altinópolis). Terra roxa, estações bem definidas; Indicação de Procedência.',
      perfil: 'Corpo denso e cremoso, doçura alta, acidez cítrica média. Chocolate amargo, caramelo, castanhas, laranja.',
      notas: ['chocolate amargo', 'caramelo', 'castanhas', 'laranja', 'baunilha'],
      acidez: 3, corpo: 4, docura: 4,
      variedades: ['Mundo Novo', 'Catuaí', 'Bourbon', 'Obatã', 'Icatu'],
      processos: ['natural', 'cereja-descascado', 'honey', 'anaerobico'],
      metodos: ['espresso', 'v60', 'prensa-francesa', 'aeropress', 'moka'],
      dica: 'Referência clássica de espresso brasileiro: 1:2 em 26–30 s. Em V60, moa um passo mais grosso para não pesar a xícara.'
    },
    {
      id: 'media-mogiana', nome: 'Média Mogiana', uf: 'SP',
      altitude: [700, 1000], clima: 'Entre Campinas e Ribeirão Preto (Espírito Santo do Pinhal, Mococa). Mais quente que a Alta Mogiana.',
      perfil: 'Suave e doce, corpo médio, acidez baixa-média. Nozes, chocolate ao leite, caramelo.',
      notas: ['nozes', 'chocolate ao leite', 'caramelo', 'cereal doce'],
      acidez: 2, corpo: 3, docura: 4,
      variedades: ['Catuaí', 'Mundo Novo', 'Obatã'],
      processos: ['natural', 'cereja-descascado'],
      metodos: ['melitta', 'coador-pano', 'prensa-francesa', 'espresso', 'moka'],
      dica: 'Perfil de café "do dia a dia" muito estável. Bom para começar a usar temperatura mais baixa (90–92 °C) sem perder doçura.'
    },
    {
      id: 'montanhas-es', nome: 'Montanhas do Espírito Santo', uf: 'ES',
      altitude: [700, 1300], clima: 'Serra capixaba (Venda Nova, Afonso Cláudio, Castelo). Frio e úmido; lavouras de montanha, colheita manual. Arábica.',
      perfil: 'Acidez cítrica/málica viva, corpo médio, florais, frutas amarelas e tropicais, doçura de mel.',
      notas: ['floral', 'mel', 'frutas tropicais', 'maçã verde', 'cítrico'],
      acidez: 4, corpo: 3, docura: 3,
      variedades: ['Catuaí', 'Catucaí', 'Bourbon', 'Arara', 'Acauã'],
      processos: ['lavado', 'cereja-descascado', 'natural', 'anaerobico'],
      metodos: ['v60', 'chemex', 'kalita', 'aeropress', 'clever'],
      dica: 'Lavados capixabas pedem V60/Chemex com água 94–96 °C. Se ficar ácido demais, feche um pouco a moagem antes de mexer na temperatura.'
    },
    {
      id: 'conilon-capixaba', nome: 'Conilon Capixaba (Canephora)', uf: 'ES',
      altitude: [0, 500], clima: 'Litoral e baixadas do ES, quente. Maior produtor de canephora (conilon) do país; conilons finos em ascensão.',
      perfil: 'Corpo pesado, amargor estruturado, baixa acidez. Chocolate amargo, amendoim, cereal, madeira; conilons finos trazem cacau e frutas secas.',
      notas: ['chocolate amargo', 'amendoim', 'cereal', 'cacau', 'frutas secas'],
      acidez: 1, corpo: 5, docura: 2,
      variedades: ['Conilon (Vitória, Diamante, Jequitibá, Centenária)'],
      processos: ['natural', 'cereja-descascado', 'lavado', 'anaerobico'],
      metodos: ['espresso', 'moka', 'cold-brew', 'prensa-francesa'],
      dica: 'Extrai com facilidade: moa mais grosso que arábica no mesmo método e use temperatura 2–3 °C menor. Em espresso, razão 1:1,8–1:2 e blends 10–30 %.'
    },
    {
      id: 'chapada-diamantina', nome: 'Chapada Diamantina', uf: 'BA',
      altitude: [1000, 1300], clima: 'Planalto baiano (Piatã, Mucugê, Ibicoara). Clima ameno, noites frias, maturação lenta.',
      perfil: 'Acidez cítrica viva e elegante, doçura alta, corpo médio. Frutas amarelas, florais, caramelo, chocolate branco.',
      notas: ['frutas amarelas', 'floral', 'caramelo', 'chocolate branco', 'limão siciliano'],
      acidez: 4, corpo: 3, docura: 4,
      variedades: ['Catuaí', 'Catucaí', 'Bourbon', 'Topázio', 'Arara'],
      processos: ['natural', 'cereja-descascado', 'lavado', 'anaerobico', 'honey'],
      metodos: ['v60', 'kalita', 'chemex', 'aeropress', 'espresso'],
      dica: 'Um dos terroirs mais frutados do país. Torras claras: 95–96 °C e razão 1:16. Anaeróbicos: baixe para 92 °C.'
    },
    {
      id: 'planalto-bahia', nome: 'Planalto da Bahia (Vitória da Conquista)', uf: 'BA',
      altitude: [700, 1100], clima: 'Sudoeste baiano, planalto com clima semiárido a subúmido; muitos cafés sombreados.',
      perfil: 'Corpo médio-alto, chocolate, nozes, doçura de cana, acidez baixa.',
      notas: ['chocolate', 'nozes', 'cana', 'cereal'],
      acidez: 2, corpo: 4, docura: 3,
      variedades: ['Catuaí', 'Mundo Novo', 'Catucaí'],
      processos: ['natural', 'cereja-descascado'],
      metodos: ['espresso', 'prensa-francesa', 'melitta', 'moka'],
      dica: 'Ótimo para espresso encorpado e prensa francesa 1:13.'
    },
    {
      id: 'oeste-bahia', nome: 'Oeste da Bahia (Cerrado Baiano)', uf: 'BA',
      altitude: [700, 1000], clima: 'Barreiras/Luís Eduardo Magalhães. Cerrado irrigado (pivô central), altíssima uniformidade de maturação e secagem.',
      perfil: 'Limpo e uniforme, corpo médio-alto, doçura, chocolate, caramelo, acidez baixa-média.',
      notas: ['chocolate', 'caramelo', 'amêndoa', 'frutas amarelas'],
      acidez: 2, corpo: 4, docura: 4,
      variedades: ['Catuaí', 'Mundo Novo', 'Arara', 'Topázio'],
      processos: ['natural', 'cereja-descascado', 'honey'],
      metodos: ['espresso', 'v60', 'prensa-francesa', 'cold-brew'],
      dica: 'Uniformidade facilita a calibração: costuma convergir em 2–3 extrações.'
    },
    {
      id: 'norte-pioneiro-pr', nome: 'Norte Pioneiro do Paraná', uf: 'PR',
      altitude: [400, 1000], clima: 'Divisa com SP; terra roxa, risco de geada, clima subtropical. Indicação de Procedência.',
      perfil: 'Doçura elevada, corpo médio-alto, acidez baixa a média. Chocolate, caramelo, amendoim, frutas secas.',
      notas: ['chocolate', 'caramelo', 'amendoim', 'frutas secas', 'melado'],
      acidez: 2, corpo: 4, docura: 4,
      variedades: ['Catuaí', 'IPR 100/103', 'Mundo Novo', 'Bourbon'],
      processos: ['natural', 'cereja-descascado', 'lavado'],
      metodos: ['espresso', 'prensa-francesa', 'melitta', 'coador-pano', 'moka'],
      dica: 'Naturais paranaenses com corpo de melado: moagem um passo mais grossa em imersão para evitar excesso de corpo/adstringência.'
    },
    {
      id: 'caparao', nome: 'Caparaó', uf: 'MG/ES',
      altitude: [900, 1500], clima: 'Encostas do Pico da Bandeira, divisa MG/ES. Clima de montanha, altitude alta, produção familiar; Indicação de Procedência.',
      perfil: 'Complexidade e acidez brilhante, doçura intensa, corpo médio-cremoso. Frutas vermelhas, uva, florais, caramelo.',
      notas: ['frutas vermelhas', 'uva', 'floral', 'caramelo', 'cacau'],
      acidez: 4, corpo: 3, docura: 4,
      variedades: ['Catuaí', 'Catucaí', 'Bourbon Amarelo', 'Arara', 'Paraíso'],
      processos: ['natural', 'anaerobico', 'cereja-descascado', 'honey', 'lavado'],
      metodos: ['v60', 'origami', 'suiren', 'kalita', 'aeropress', 'chemex', 'clever'],
      dica: 'Muitos lotes fermentados: comece em 92 °C e 1:16; se faltar doçura, feche moagem em vez de subir temperatura.'
    },
    {
      id: 'rondonia', nome: 'Matas de Rondônia (Robusta Amazônico)', uf: 'RO',
      altitude: [150, 400], clima: 'Amazônia (Cacoal, Alta Floresta). Quente e úmido; primeira IP de canephora do mundo (híbridos conilon × robusta).',
      perfil: 'Corpo cheio, doçura surpreendente para canephora, baixa acidez. Cacau, especiarias, caramelo, frutas secas, madeira nobre.',
      notas: ['cacau', 'especiarias', 'caramelo', 'frutas secas', 'madeira nobre'],
      acidez: 1, corpo: 5, docura: 3,
      variedades: ['Robustas Amazônicos (clones BRS)'],
      processos: ['natural', 'cereja-descascado', 'anaerobico', 'lavado'],
      metodos: ['espresso', 'cold-brew', 'moka', 'prensa-francesa'],
      dica: 'Como toda canephora: moagem mais grossa, temperatura 88–91 °C, razões curtas. Em cold brew entrega chocolate intenso.'
    },
    {
      id: 'campo-das-vertentes', nome: 'Campo das Vertentes', uf: 'MG',
      altitude: [900, 1200], clima: 'Região central de Minas (São João del-Rei, Santo Antônio do Amparo, Campo Belo). Planalto com clima ameno, colheita tardia e maturação lenta.',
      perfil: 'Doçura marcante, corpo médio a cheio, acidez cítrica média. Chocolate, caramelo, frutas amarelas; lotes especiais trazem florais e laranja.',
      notas: ['chocolate', 'caramelo', 'frutas amarelas', 'laranja', 'floral'],
      acidez: 3, corpo: 4, docura: 4,
      variedades: ['Catuaí', 'Mundo Novo', 'Bourbon Amarelo', 'Geisha', 'Arara'],
      processos: ['natural', 'cereja-descascado', 'anaerobico', 'lavado'],
      metodos: ['v60', 'kalita', 'espresso', 'aeropress', 'clever'],
      dica: 'Região em ascensão nos cafés especiais. Geishas e lotes fermentados daqui pedem torra clara, água 92–94 °C e razão 1:16–1:17.'
    },
    {
      id: 'outra', nome: 'Outra região / não informada', uf: '—',
      altitude: [600, 1400], clima: '—',
      perfil: 'Perfil médio brasileiro: corpo médio-alto, doçura, acidez moderada.',
      notas: ['chocolate', 'caramelo', 'frutas amarelas'],
      acidez: 3, corpo: 3, docura: 3,
      variedades: [], processos: ['natural', 'cereja-descascado', 'lavado'],
      metodos: ['v60', 'espresso', 'prensa-francesa'],
      dica: 'Preencha o perfil sensorial do grão manualmente para melhorar as sugestões.'
    }
  ];

  /* ---------- Processos de pós-colheita / secagem ---------- */
  const processos = [
    {
      id: 'natural', nome: 'Natural (secagem em terreiro / cereja inteira)',
      descricao: 'Fruto seco inteiro; a polpa fermenta e transfere açúcares. O mais tradicional no Brasil.',
      sensorial: 'Corpo alto, doçura, frutas maduras, notas vínicas; menos clareza.',
      ajuste: { tempC: -1, ratio: +0.5, moagem: +0.5 },
      dica: 'Tende a extrair rápido e a ficar pesado/adstringente se sobre-extraído. Prefira 1 °C a menos e moagem levemente mais grossa.'
    },
    {
      id: 'cereja-descascado', nome: 'Cereja Descascado (CD / pulped natural)',
      descricao: 'Casca removida mecanicamente, secagem com parte da mucilagem. Método brasileiro por excelência.',
      sensorial: 'Equilíbrio entre doçura e clareza, corpo médio, acidez limpa.',
      ajuste: { tempC: 0, ratio: 0, moagem: 0 },
      dica: 'Comportamento previsível: use como referência "neutra" de calibração.'
    },
    {
      id: 'honey', nome: 'Honey (yellow / red / black)',
      descricao: 'Variação do CD com mais mucilagem retida e secagem mais lenta (black = mais mucilagem e sombra).',
      sensorial: 'Doçura de mel/rapadura, corpo xaroposo, acidez macia.',
      ajuste: { tempC: -0.5, ratio: +0.5, moagem: +0.25 },
      dica: 'Honeys escuros (red/black) se comportam como naturais; yellow como CD.'
    },
    {
      id: 'lavado', nome: 'Lavado (via úmida / desmucilado)',
      descricao: 'Mucilagem removida por fermentação em água ou mecanicamente antes da secagem.',
      sensorial: 'Máxima clareza e acidez, corpo mais leve, florais e cítricos.',
      ajuste: { tempC: +1, ratio: +0.5, moagem: -0.25 },
      dica: 'Costuma tolerar água mais quente e moagem um pouco mais fina para extrair doçura.'
    },
    {
      id: 'anaerobico', nome: 'Fermentação anaeróbica / maceração carbônica',
      descricao: 'Fermentação controlada em tanques sem oxigênio (com ou sem CO₂ injetado), antes da secagem natural ou CD.',
      sensorial: 'Intenso: frutas tropicais, vinho, canela, notas boozy; corpo cremoso.',
      ajuste: { tempC: -2, ratio: +1, moagem: +0.5 },
      dica: 'Extrai muito fácil. Razão mais longa (1:16–1:17) e 90–92 °C evitam sabor de álcool/vinagre. Se ficar “fermentado demais”, não é sub-extração.'
    },
    {
      id: 'fermentacao-induzida', nome: 'Fermentação induzida (leveduras / co-fermentação)',
      descricao: 'Inoculação de leveduras ou adição de frutas/especiarias durante a fermentação.',
      sensorial: 'Aromas exóticos e pronunciados, doçura, corpo alto.',
      ajuste: { tempC: -2, ratio: +1, moagem: +0.5 },
      dica: 'Mesma lógica dos anaeróbicos: extrações mais suaves para não saturar os aromas.'
    },
    {
      id: 'descafeinado', nome: 'Descafeinado (Swiss Water / EA cana / CO₂)',
      descricao: 'Remoção da cafeína antes da torra. Estrutura celular mais frágil, torra mais rápida.',
      sensorial: 'Corpo médio, doçura, menos acidez; risco de nota amadeirada.',
      ajuste: { tempC: -2, ratio: 0, moagem: +1 },
      dica: 'Extrai muito rápido: moa claramente mais grosso e use 2–3 °C a menos.'
    }
  ];

  /* ---------- Intensidade de torra ---------- */
  const torras = [
    {
      id: 'clara', nome: 'Clara', agtron: '70–85', cor: 'Canela clara, sem óleo, grãos densos.',
      sensorial: 'Máxima acidez e florais; doçura depende de extrair bem. Risco de azedo/vegetal se sub-extraído.',
      base: { filtroTempC: 95, espressoTempC: 94.5, ratioFiltro: 16.5, ratioEspresso: 2.4, moagem: -0.5 },
      descansoDias: { filtrado: [7, 21], espresso: [14, 30] },
      dica: 'Puxe tudo para “mais extração”: água quente (94–97 °C), moagem mais fina, razão longa. Espresso: pré-infusão longa e 1:2,3–1:3.'
    },
    {
      id: 'media-clara', nome: 'Média-clara', agtron: '60–70', cor: 'Marrom claro, superfície seca.',
      sensorial: 'Acidez viva, doçura clara, corpo médio. Faixa preferida para filtrados especiais.',
      base: { filtroTempC: 94, espressoTempC: 93.5, ratioFiltro: 16, ratioEspresso: 2.2, moagem: -0.25 },
      descansoDias: { filtrado: [5, 18], espresso: [10, 25] },
      dica: 'Ponto de partida clássico: 93–95 °C, 1:16 em V60.'
    },
    {
      id: 'media', nome: 'Média', agtron: '50–60', cor: 'Marrom médio, ainda seco ou com brilho discreto.',
      sensorial: 'Equilíbrio: caramelo, chocolate, acidez moderada, corpo cheio.',
      base: { filtroTempC: 92, espressoTempC: 92.5, ratioFiltro: 15.5, ratioEspresso: 2.0, moagem: 0 },
      descansoDias: { filtrado: [4, 15], espresso: [7, 21] },
      dica: 'Versátil: 91–93 °C. Espresso 1:2 em 25–30 s.'
    },
    {
      id: 'media-escura', nome: 'Média-escura', agtron: '40–50', cor: 'Marrom escuro, início de óleo na superfície.',
      sensorial: 'Chocolate amargo, caramelo tostado, corpo pesado, acidez baixa.',
      base: { filtroTempC: 90, espressoTempC: 91, ratioFiltro: 15, ratioEspresso: 1.9, moagem: +0.5 },
      descansoDias: { filtrado: [3, 12], espresso: [5, 18] },
      dica: 'Grãos porosos extraem rápido: 88–91 °C, moagem mais grossa, contato mais curto.'
    },
    {
      id: 'escura', nome: 'Escura', agtron: '< 40', cor: 'Quase preto, oleoso.',
      sensorial: 'Torrado, defumado, amargor dominante; pouca origem.',
      base: { filtroTempC: 88, espressoTempC: 90, ratioFiltro: 14.5, ratioEspresso: 1.7, moagem: +1 },
      descansoDias: { filtrado: [2, 10], espresso: [3, 14] },
      dica: 'Evite sobre-extração: 85–89 °C, moagem grossa, tempo curto. Prensa francesa e moka aceitam bem.'
    }
  ];

  /* ---------- Métodos de preparo ----------
   * grind: descritor 1 (extrafina) … 7 (extragrossa) — usado para mapear
   * para cliques do moedor. microns: faixa de referência. ratio: gramas
   * de água por grama de café (espresso: bebida/dose). Dose de partida:
   * 10 g (espresso 16 g). tempoS dos filtrados vale para 10 g; o motor
   * escala a faixa conforme a dose (faixaTempo). base = método cujo
   * comportamento este herda no motor (diagnóstico, referências de moedor). */
  const metodos = [
    {
      id: 'espresso', nome: 'Espresso', tipo: 'pressão', icone: '☕', fluxo: 2,
      ratio: { min: 1.6, max: 3.0, padrao: 2.0 }, dosePadrao: 16,
      tempC: { min: 88, max: 96, padrao: 93 }, tempoS: { min: 24, max: 34, padrao: 28 },
      grind: 1, microns: [200, 350], grindDesc: 'Fina (açúcar refinado)',
      sensibilidade: 'Alta: 1 clique fino costuma mudar 3–6 s no tempo de extração.',
      receita: 'Dose 16 g → bebida 32–36 g em 25–30 s. Pré-infusão 3–8 s. Ajuste moagem para tempo; razão para intensidade/corpo.'
    },
    {
      id: 'moka', nome: 'Moka (cafeteira italiana)', tipo: 'pressão', icone: '🫖', fluxo: 3,
      ratio: { min: 8, max: 11, padrao: 9.5 }, dosePadrao: 10,
      tempC: { min: 85, max: 95, padrao: 90 }, tempoS: { min: 60, max: 150, padrao: 100 },
      grind: 2, microns: [350, 500], grindDesc: 'Fina-média (sal fino)',
      sensibilidade: 'Média: moagem fina demais entope e amarga; grossa demais fica aguada.',
      receita: 'Água pré-aquecida na caldeira até a válvula, café nivelado sem compactar, fogo baixo. Retire do fogo ao ouvir o borbulhar.'
    },
    {
      id: 'v60', nome: 'Hario V60', tipo: 'filtrado', icone: '🔻', fluxo: 6,
      ratio: { min: 14, max: 18, padrao: 16 }, dosePadrao: 10,
      tempC: { min: 88, max: 97, padrao: 93 }, tempoS: { min: 130, max: 185, padrao: 155 },
      grind: 3, microns: [600, 800], grindDesc: 'Média-fina (areia grossa)',
      sensibilidade: 'Média-alta: 2–3 cliques (moedor manual) mudam ~15–20 s de drenagem.',
      receita: '10 g / 160 g. Bloom 30 g por ~40 s e 3 despejos até 160 g. Com dose pequena o leito é baixo: se drenar antes da faixa, afine um ajuste.'
    },
    {
      id: 'origami', nome: 'Origami Dripper', curto: 'Origami', tipo: 'filtrado', icone: '🔻', fluxo: 6.5, base: 'v60',
      ratio: { min: 14, max: 18, padrao: 16 }, dosePadrao: 10,
      tempC: { min: 88, max: 96, padrao: 93 }, tempoS: { min: 120, max: 175, padrao: 145 },
      grind: 3, microns: [550, 750], grindDesc: 'Média-fina (um toque mais fina que V60 no papel cônico)',
      sensibilidade: 'Alta no filtro cônico (20 caneluras criam amplo fluxo de ar e drenagem rápida) e média no filtro Wave (fundo plano encosta nas dobras e reduz o bypass).',
      receita: '10 g / 160 g. Com filtro cônico, moa ~1 ajuste mais fino que na V60 e despeje mais próximo do centro para destacar florais e acidez; com filtro Kalita Wave, use moagem média para ganhar corpo e doçura.'
    },
    {
      id: 'suiren', nome: 'Hario V60 Suiren', curto: 'Hario Suiren', tipo: 'filtrado', icone: '🪷', fluxo: 7, base: 'v60',
      ratio: { min: 14.5, max: 18, padrao: 16 }, dosePadrao: 10,
      tempC: { min: 90, max: 98, padrao: 94.5 }, tempoS: { min: 115, max: 170, padrao: 140 },
      grind: 3, microns: [500, 700], grindDesc: 'Média-fina (1–2 ajustes mais fina que V60)',
      sensibilidade: 'Alta: as 12 pétalas sem parede sólida eliminam qualquer bloqueio de ar (fluxo muito livre) e dissipam calor no terço final da extração.',
      receita: '10 g / 160 g. Comece com água 1–1,5 °C mais quente e moagem levemente mais fina que na V60 tradicional: o início quente extrai acidez e doçura, e o resfriamento natural pelas aletas abertas no final evita amargor e adstringência.'
    },
    {
      id: 'kalita', nome: 'Kalita Wave', tipo: 'filtrado', icone: '〰️', fluxo: 5,
      ratio: { min: 14, max: 17, padrao: 15.5 }, dosePadrao: 10,
      tempC: { min: 88, max: 96, padrao: 93 }, tempoS: { min: 140, max: 190, padrao: 160 },
      grind: 4, microns: [700, 900], grindDesc: 'Média (areia)',
      sensibilidade: 'Média: fundo plano perdoa variações de despejo; o ajuste vem mais da moagem.',
      receita: '10 g / 155 g. Bloom 30 g, depois pulsos de ~30 g mantendo o nível constante.'
    },
    {
      id: 'b75', nome: 'Timemore Crystal Eye B75', curto: 'Crystal Eye B75', tipo: 'filtrado', icone: '', fluxo: 5, base: 'kalita',
      ratio: { min: 14, max: 17, padrao: 16 }, dosePadrao: 10,
      tempC: { min: 88, max: 96, padrao: 93 }, tempoS: { min: 135, max: 185, padrao: 160 },
      grind: 4, microns: [650, 850], grindDesc: 'Média (entre V60 e Kalita)',
      sensibilidade: 'Média: fundo plano (flat bottom) com saída controlada perdoa variações de despejo; o ajuste fino vem da moagem. Sem referência própria no moedor, parte da referência da Kalita.',
      receita: '10 g / 160 g. Bloom 30 g por ~35 s, 3 pulsos até 160 g. O fundo plano mantém o leito nivelado: se drenar rápido, afine um ajuste.'
    },
    {
      id: 'melitta', nome: 'Melitta (1x2 / 1x4 / 102)', tipo: 'filtrado', icone: '🧺', fluxo: 4,
      ratio: { min: 14, max: 17, padrao: 15.5 }, dosePadrao: 10,
      tempC: { min: 88, max: 95, padrao: 92 }, tempoS: { min: 135, max: 195, padrao: 165 },
      grind: 4, microns: [700, 950], grindDesc: 'Média (areia)',
      sensibilidade: 'Média-baixa: fluxo restrito pelo orifício único; moagem fina demais alaga o filtro.',
      receita: '10 g / 155 g. Bloom 30 g, depois despejos contínuos e suaves.'
    },
    {
      id: 'chemex', nome: 'Chemex', tipo: 'filtrado', icone: '⏳', fluxo: 7,
      ratio: { min: 14, max: 17, padrao: 16 }, dosePadrao: 10,
      tempC: { min: 90, max: 97, padrao: 94 }, tempoS: { min: 135, max: 195, padrao: 160 },
      grind: 5, microns: [800, 1000], grindDesc: 'Média-grossa',
      sensibilidade: 'Média: filtro espesso; ajustes de 3–4 cliques por vez em moedores manuais. Com 10 g o leito fica raso: moa um pouco mais fino que o habitual.',
      receita: '10 g / 160 g. Bloom 25 g por ~40 s, despejos em espiral até 160 g.'
    },
    {
      id: 'clever', nome: 'Clever Dripper (imersão + filtro)', tipo: 'imersão', icone: '🪣', fluxo: 10,
      ratio: { min: 14, max: 17, padrao: 15.5 }, dosePadrao: 10,
      tempC: { min: 88, max: 96, padrao: 93 }, tempoS: { min: 180, max: 300, padrao: 240 },
      grind: 4, microns: [700, 900], grindDesc: 'Média',
      sensibilidade: 'Baixa: tempo é controlado por você; moagem afeta mais corpo do que tempo.',
      receita: '10 g / 155 g. Água antes do café, mexa, tampe, 2:30–3:30, drene sobre a xícara (~1 min).'
    },
    {
      id: 'aeropress', nome: 'AeroPress', tipo: 'imersão', icone: '🧪', fluxo: 10,
      ratio: { min: 11, max: 17, padrao: 14 }, dosePadrao: 10,
      tempC: { min: 80, max: 95, padrao: 90 }, tempoS: { min: 75, max: 180, padrao: 120 },
      grind: 3, microns: [500, 750], grindDesc: 'Média-fina',
      sensibilidade: 'Média: pressão compensa moagem; tempo de imersão e temperatura são alavancas fortes.',
      receita: '10 g / 140 g, invertido ou padrão. Mexa 10 s, 1:30 de imersão, pressione em 30 s.'
    },
    {
      id: 'prensa-francesa', nome: 'Prensa Francesa', tipo: 'imersão', icone: '🫙', fluxo: 12,
      ratio: { min: 12, max: 16, padrao: 14 }, dosePadrao: 10,
      tempC: { min: 88, max: 95, padrao: 92 }, tempoS: { min: 240, max: 480, padrao: 300 },
      grind: 6, microns: [900, 1200], grindDesc: 'Grossa (sal grosso)',
      sensibilidade: 'Baixa para tempo, alta para sedimento/adstringência: moa mais grosso se ficar lamacenta.',
      receita: '10 g / 140 g. 4 min, quebre a crosta, retire a espuma, aguarde mais 4–5 min e pressione só até a superfície.'
    },
    {
      id: 'coador-pano', nome: 'Coador de pano', tipo: 'filtrado', icone: '🧦', fluxo: 5,
      ratio: { min: 13, max: 16, padrao: 14.5 }, dosePadrao: 10,
      tempC: { min: 86, max: 93, padrao: 90 }, tempoS: { min: 105, max: 165, padrao: 130 },
      grind: 4, microns: [700, 900], grindDesc: 'Média',
      sensibilidade: 'Baixa-média: o pano passa mais óleos; corpo alto mesmo com moagem média.',
      receita: '10 g / 145 g. Escalde o pano, bloom 25 g/30 s, despejos contínuos. Enxágue o pano sem sabão e guarde úmido na geladeira.'
    },
    {
      id: 'cold-brew', nome: 'Cold brew', tipo: 'imersão', icone: '🧊', fluxo: 20,
      ratio: { min: 6, max: 12, padrao: 9 }, dosePadrao: 10,
      tempC: { min: 4, max: 25, padrao: 20 }, tempoS: { min: 28800, max: 72000, padrao: 50400 },
      grind: 6, microns: [900, 1200], grindDesc: 'Grossa',
      sensibilidade: 'Muito baixa: ajuste principalmente tempo (12–20 h) e razão.',
      receita: '10 g / 90 g de concentrado (multiplique para lotes maiores). 14–18 h em temperatura ambiente ou 18–24 h na geladeira. Filtre e dilua 1:1.'
    }
  ];

  /* Descritores de moagem para mapear cliques */
  const grindEscala = [
    { n: 1, nome: 'Fina', ex: 'espresso' },
    { n: 2, nome: 'Fina-média', ex: 'moka' },
    { n: 3, nome: 'Média-fina', ex: 'V60 / AeroPress' },
    { n: 4, nome: 'Média', ex: 'Kalita / Melitta / pano' },
    { n: 5, nome: 'Média-grossa', ex: 'Chemex' },
    { n: 6, nome: 'Grossa', ex: 'Prensa / cold brew' },
    { n: 7, nome: 'Extra-grossa', ex: 'cupping / cold brew longo' }
  ];

  /* Moedores populares como modelos de escala (o usuário pode editar) */
  const moedoresModelo = [
    { nome: 'Timemore C2 / C3', tipo: 'manual', min: 0, max: 36, passo: 1, refs: { espresso: 7, moka: 12, aeropress: 16, suiren: 18, origami: 18, v60: 19, kalita: 21, melitta: 21, 'coador-pano': 21, clever: 21, chemex: 24, 'prensa-francesa': 28, 'cold-brew': 30 } },
    { nome: 'Comandante C40', tipo: 'manual', min: 0, max: 50, passo: 1, refs: { espresso: 8, moka: 14, aeropress: 18, suiren: 22, origami: 23, v60: 24, kalita: 26, melitta: 26, 'coador-pano': 26, clever: 26, chemex: 30, 'prensa-francesa': 35, 'cold-brew': 38 } },
    { nome: 'Hario Skerton / Mini Slim', tipo: 'manual', min: 0, max: 20, passo: 1, refs: { espresso: 2, moka: 5, aeropress: 7, suiren: 8, origami: 9, v60: 9, kalita: 10, melitta: 10, 'coador-pano': 10, clever: 10, chemex: 12, 'prensa-francesa': 15, 'cold-brew': 17 } },
    { nome: 'Baratza Encore', tipo: 'elétrico', min: 1, max: 40, passo: 1, refs: { espresso: 4, moka: 8, aeropress: 12, suiren: 14, origami: 14, v60: 15, kalita: 17, melitta: 17, 'coador-pano': 17, clever: 17, chemex: 22, 'prensa-francesa': 28, 'cold-brew': 32 } },
    { nome: 'Fellow Ode Gen 2', tipo: 'elétrico', min: 1, max: 11, passo: 0.33, refs: { moka: 1.5, aeropress: 2.5, suiren: 3.66, origami: 3.66, v60: 4, kalita: 4.5, melitta: 4.5, 'coador-pano': 4.5, clever: 5, chemex: 6, 'prensa-francesa': 8, 'cold-brew': 9 } },
    { nome: 'DF64 / Eureka Mignon (escala genérica 0–50)', tipo: 'elétrico', min: 0, max: 50, passo: 0.5, refs: { espresso: 6.5, moka: 14, aeropress: 22, suiren: 26, origami: 27, v60: 28, kalita: 30, melitta: 30, 'coador-pano': 30, clever: 30, chemex: 34, 'prensa-francesa': 40, 'cold-brew': 44 } },
    { id: 'kingrinder-k2', nome: 'Kingrinder K2', tipo: 'manual', min: 0, max: 160, passo: 1, direcao: 'menor=fino', umPorClique: 18,
      obs: '40 cliques por volta, 18 µm por clique. Conte os cliques a partir do zero (mós encostadas). Referências calibradas pelo uso real: espresso (16 g) 28–42, coados 60–120.',
      refs: { espresso: 35, moka: 55, aeropress: 70, suiren: 76, origami: 78, v60: 80, kalita: 90, melitta: 95, 'coador-pano': 90, clever: 90, chemex: 105, 'prensa-francesa': 130, 'cold-brew': 140 } },
    { id: 'starseeker-e55-pro', nome: 'Starseeker E55 Pro', tipo: 'elétrico', min: 0, max: 220, passo: 1, direcao: 'menor=fino', umPorClique: 10,
      obs: 'Ajuste stepless: registre a marcação do anel (100 por volta, ~10 µm de abertura cada). Zero = mós encostadas. Referências calibradas pelo uso real: espresso (16 g) 28–44, coados em torno de 120.',
      refs: { espresso: 35, moka: 65, aeropress: 100, suiren: 115, origami: 117, v60: 120, kalita: 128, melitta: 130, 'coador-pano': 128, clever: 128, chemex: 140, 'prensa-francesa': 170, 'cold-brew': 180 } },
    { id: '1zpresso-jx-pro', nome: '1Zpresso JX-Pro', tipo: 'manual', min: 0, max: 200, passo: 1, direcao: 'menor=fino', umPorClique: 12.5,
      obs: '40 cliques por volta, 12,5 µm por clique. Registre em cliques totais a partir do zero (2 voltas e 10 cliques = 90). Referências calibradas pelo uso real: espresso (16 g) 55–75, coados 110–150.',
      refs: { espresso: 62, moka: 90, aeropress: 105, suiren: 115, origami: 117, v60: 120, kalita: 130, melitta: 135, 'coador-pano': 130, clever: 130, chemex: 145, 'prensa-francesa': 165, 'cold-brew': 175 } },
    { id: 'tramontina-breville-express', nome: 'Tramontina by Breville Express', tipo: 'elétrico', min: 1, max: 60, passo: 1, direcao: 'menor=fino', passoAjuste: 2,
      obs: 'Escala de 1 a 60 (menor = mais fino). Faixas do fabricante calibradas para 16 g: espresso 3–10 (ideal 6), moka 13–20, cônicos V60/Koar 21–30, Melitta/elétrica 25–35, Chemex/Clever 35–45, prensa 46–55, cold brew 56–60.',
      refs: { espresso: 6, moka: 16, aeropress: 22, suiren: 23, origami: 24, v60: 25, kalita: 28, melitta: 30, 'coador-pano': 30, clever: 40, chemex: 40, 'prensa-francesa': 50, 'cold-brew': 58 } },
    { nome: 'Genérico (0–40)', tipo: 'manual', min: 0, max: 40, passo: 1, refs: { espresso: 5, moka: 10, aeropress: 15, suiren: 17, origami: 17, v60: 18, kalita: 20, melitta: 20, 'coador-pano': 20, clever: 20, chemex: 24, 'prensa-francesa': 30, 'cold-brew': 34 } }
  ];

  /* Descritores sensoriais (chips) */
  const descritores = ['chocolate', 'caramelo', 'nozes', 'castanhas', 'amendoim', 'frutas amarelas', 'frutas vermelhas', 'frutas tropicais', 'cítrico', 'laranja', 'limão', 'maçã', 'uva', 'pêssego', 'floral', 'mel', 'rapadura', 'melado', 'cana', 'baunilha', 'cacau', 'especiarias', 'vinho', 'fermentado', 'cereal', 'amadeirado', 'defumado', 'tostado', 'chá preto', 'ervas'];

  /* Defeitos/sinais de xícara usados pelo motor */
  const sinais = [
    { id: 'azedo', nome: 'Azedo / ácido agressivo', tipo: 'sub', peso: 1.0, dica: 'Acidez ácida e curta, tipo vinagre ou limão verde.' },
    { id: 'salgado', nome: 'Salgado', tipo: 'sub', peso: 0.8, dica: 'Sensação salina na ponta da língua — sinal clássico de sub-extração.' },
    { id: 'aguado', nome: 'Aguado / oco / fino', tipo: 'sub', peso: 0.6, dica: 'Falta de corpo e de doçura; final curto.' },
    { id: 'vegetal', nome: 'Vegetal / capim / amendoim cru', tipo: 'sub', peso: 0.7, dica: 'Comum em torra clara sub-extraída.' },
    { id: 'final-curto', nome: 'Final curto / some rápido', tipo: 'sub', peso: 0.5, dica: 'Doçura não se sustenta após engolir.' },
    { id: 'amargo', nome: 'Amargo excessivo', tipo: 'sobre', peso: 1.0, dica: 'Amargor que domina e atrapalha a doçura.' },
    { id: 'adstringente', nome: 'Adstringente / seco / travando', tipo: 'sobre', peso: 1.0, dica: 'Boca seca, sensação de caqui verde — sobre-extração ou finos em excesso.' },
    { id: 'queimado', nome: 'Queimado / cinzas / tostado demais', tipo: 'sobre', peso: 0.7, dica: 'Pode ser torra ou água quente demais.' },
    { id: 'final-longo-aspero', nome: 'Final longo e áspero', tipo: 'sobre', peso: 0.6, dica: 'Persistência amarga na garganta.' },
    { id: 'lamacento', nome: 'Lamacento / borra / finos', tipo: 'sobre', peso: 0.5, dica: 'Muito sedimento (imersão) ou filtro entupido — finos em excesso.' },
    { id: 'fraco', nome: 'Fraco / diluído (mas equilibrado)', tipo: 'forca-baixa', peso: 1.0, dica: 'Sabor correto, só falta intensidade → razão.' },
    { id: 'forte', nome: 'Intenso demais / pesado (mas equilibrado)', tipo: 'forca-alta', peso: 1.0, dica: 'Sabor correto, mas sobrecarrega → razão.' },
    { id: 'fermentado', nome: 'Fermentado / álcool / vinagre', tipo: 'processo', peso: 1.0, dica: 'Característica do lote (naturais/anaeróbicos), não de extração. Baixe temperatura e alongue razão.' }
  ];

  /* Tabela de indicações método × perfil (usado na biblioteca e no sugestor) */
  const indicacoesPerfil = [
    { perfil: 'Acidez alta, corpo leve-médio, florais/frutas (Mantiqueira, Chapada Diamantina, Caparaó, Montanhas do ES lavados)', metodos: ['v60', 'suiren', 'origami', 'chemex', 'kalita', 'aeropress'], razao: '1:16 – 1:17', tempC: '94 – 96 °C', torra: 'clara / média-clara' },
    { perfil: 'Equilíbrio, doçura, corpo médio (Sul de Minas, Matas de Minas, CD em geral)', metodos: ['v60', 'origami', 'kalita', 'melitta', 'clever', 'espresso'], razao: '1:15 – 1:16 (espresso 1:2 – 1:2,2)', tempC: '92 – 94 °C', torra: 'média-clara / média' },
    { perfil: 'Corpo cheio, chocolate, acidez baixa (Cerrado, Mogiana, Norte Pioneiro, Planalto BA)', metodos: ['espresso', 'prensa-francesa', 'moka', 'coador-pano', 'melitta'], razao: '1:14 – 1:15 (espresso 1:1,8 – 1:2)', tempC: '90 – 93 °C', torra: 'média / média-escura' },
    { perfil: 'Fermentados intensos (anaeróbico, maceração carbônica, co-fermentação)', metodos: ['v60', 'origami', 'suiren', 'aeropress', 'clever', 'kalita'], razao: '1:16 – 1:17', tempC: '90 – 92 °C', torra: 'clara / média-clara' },
    { perfil: 'Canephora fino (Conilon Capixaba, Robusta Amazônico)', metodos: ['espresso', 'moka', 'cold-brew', 'prensa-francesa'], razao: '1:1,8 – 1:2 (espresso) · 1:12 – 1:14 (imersão)', tempC: '88 – 91 °C', torra: 'média / média-escura' },
    { perfil: 'Torra escura (qualquer origem)', metodos: ['prensa-francesa', 'moka', 'coador-pano', 'cold-brew'], razao: '1:13 – 1:15', tempC: '85 – 89 °C', torra: 'escura' }
  ];

  /* ---------- Receitas de despejo por método ----------
   * etapas: t = segundos a partir do início; agua = fração da água total
   * acumulada ao fim da etapa (0–1); desc = o que fazer. O motor converte
   * para gramas conforme dose × razão da extração. */
  const receitas = {
    v60: { nome: 'V60 – 4 despejos (estilo Tetsu/Hoffmann)', etapas: [
      { t: 0, agua: 0.19, desc: 'Bloom: despeje ~3× a dose em círculos, molhando todo o pó. Gire o dripper suavemente.' },
      { t: 40, agua: 0.50, desc: '2º ataque: espiral do centro para a borda, fluxo constante, até 50 % da água.' },
      { t: 65, agua: 0.75, desc: '3º ataque: até 75 % da água, mantendo o nível no filtro.' },
      { t: 90, agua: 1.00, desc: '4º ataque: complete a água. Gire (swirl) para nivelar o leito.' },
      { t: 140, agua: 1.00, desc: 'Drenagem. Leito plano, sem pó agarrado na parede.' }
    ] },
    origami: { nome: 'Origami – 4 despejos de fluxo controlado', etapas: [
      { t: 0, agua: 0.19, desc: 'Bloom: despeje ~3× a dose do centro para fora, molhando todo o pó.' },
      { t: 35, agua: 0.50, desc: '2º ataque: espiral curta (sem jogar água direto nos 20 vincos da borda) até 50 %.' },
      { t: 65, agua: 0.75, desc: '3º ataque: despejo suave no centro/meio até 75 % da água.' },
      { t: 90, agua: 1.00, desc: '4º ataque: complete a água no centro e dê um leve giro (swirl) para assentar o leito.' },
      { t: 135, agua: 1.00, desc: 'Drenagem. No filtro cônico o escoamento é ágil; no filtro Wave o leito termina plano.' }
    ] },
    suiren: { nome: 'Hario Suiren – bloom + 3 ataques (queda térmica natural)', etapas: [
      { t: 0, agua: 0.20, desc: 'Bloom quente: despeje ~3× a dose em espiral rápida para aquecer o leito e abrir os florais.' },
      { t: 40, agua: 0.55, desc: '2º ataque: espiral contínua e firme até 55 %, mantendo o volume alto para reter calor.' },
      { t: 70, agua: 0.80, desc: '3º ataque: despeje suave no centro até 80 % da água.' },
      { t: 95, agua: 1.00, desc: '4º ataque: complete até 100 %. As 12 pétalas abertas resfriam o final, cortando a adstringência.' },
      { t: 130, agua: 1.00, desc: 'Drenagem livre pelas aletas. Leito limpo e bebida com transparência de chá.' }
    ] },
    kalita: { nome: 'Kalita Wave – pulsos', etapas: [
      { t: 0, agua: 0.18, desc: 'Bloom com ~3× a dose; mexa uma vez.' },
      { t: 30, agua: 0.40, desc: '2º despejo em pulsos curtos no centro, sem tocar a parede do filtro.' },
      { t: 65, agua: 0.60, desc: '3º despejo, mantendo o nível constante (cerca de 1 cm acima do pó).' },
      { t: 95, agua: 0.80, desc: '4º despejo.' },
      { t: 125, agua: 1.00, desc: '5º despejo: complete a água.' },
      { t: 170, agua: 1.00, desc: 'Drenagem.' }
    ] },
    b75: { nome: 'Crystal Eye B75 – bloom + 3 pulsos', etapas: [
      { t: 0, agua: 0.19, desc: 'Bloom com ~3× a dose em espiral lenta; gire o dripper para molhar todo o leito.' },
      { t: 35, agua: 0.50, desc: '2º despejo no centro, em círculos pequenos, sem tocar a parede.' },
      { t: 60, agua: 0.75, desc: '3º despejo, mantendo o nível da água estável acima do leito.' },
      { t: 85, agua: 1.00, desc: '4º despejo: complete. Gire suavemente para nivelar o fundo plano.' },
      { t: 140, agua: 1.00, desc: 'Drenagem. O leito deve terminar reto e uniforme.' }
    ] },
    melitta: { nome: 'Melitta – bloom + despejo contínuo', etapas: [
      { t: 0, agua: 0.20, desc: 'Bloom com ~3× a dose.' },
      { t: 35, agua: 0.60, desc: 'Despejo contínuo e lento em espiral até 60 %.' },
      { t: 75, agua: 1.00, desc: 'Complete a água em despejo suave. Não deixe secar entre despejos.' },
      { t: 175, agua: 1.00, desc: 'Drenagem.' }
    ] },
    'coador-pano': { nome: 'Coador de pano', etapas: [
      { t: 0, agua: 0.20, desc: 'Escalde o pano antes. Bloom com ~2,5× a dose.' },
      { t: 30, agua: 0.60, desc: 'Despejo contínuo em espiral até 60 %.' },
      { t: 65, agua: 1.00, desc: 'Complete a água mantendo o pó submerso.' },
      { t: 130, agua: 1.00, desc: 'Drenagem.' }
    ] },
    chemex: { nome: 'Chemex – 3 ataques', etapas: [
      { t: 0, agua: 0.16, desc: 'Bloom com ~2,5× a dose. Mexa com colher para molhar tudo.' },
      { t: 40, agua: 0.55, desc: '2º ataque em espiral, mantendo o filtro cheio até ~2 cm da borda.' },
      { t: 80, agua: 1.00, desc: '3º ataque: complete a água.' },
      { t: 160, agua: 1.00, desc: 'Drenagem.' }
    ] },
    clever: { nome: 'Clever – imersão', etapas: [
      { t: 0, agua: 1.00, desc: 'Água primeiro, café depois (ou vice-versa). Mexa 3 voltas e tampe.' },
      { t: 120, agua: 1.00, desc: 'Quebre a crosta com 2 voltas suaves; retampe.' },
      { t: 180, agua: 1.00, desc: 'Coloque sobre a xícara/servidor para drenar (~60–90 s).' }
    ] },
    aeropress: { nome: 'AeroPress – padrão', etapas: [
      { t: 0, agua: 1.00, desc: 'Despeje toda a água em 10 s; mexa 3× para frente e para trás.' },
      { t: 90, agua: 1.00, desc: 'Encaixe o êmbolo e pressione devagar (~30 s) até ouvir o ar.' }
    ] },
    'prensa-francesa': { nome: 'Prensa Francesa – método Hoffmann', etapas: [
      { t: 0, agua: 1.00, desc: 'Despeje toda a água de uma vez. Não mexa.' },
      { t: 240, agua: 1.00, desc: 'Quebre a crosta com colher e retire a espuma/pó flutuante.' },
      { t: 480, agua: 1.00, desc: 'Coloque o êmbolo só até a superfície (não pressione até o fundo) e sirva.' }
    ] },
    espresso: { nome: 'Espresso – pré-infusão + extração', etapas: [
      { t: 0, agua: 0.10, desc: 'Pré-infusão: 3–8 s em baixa pressão até as primeiras gotas.' },
      { t: 8, agua: 1.00, desc: 'Extração a 9 bar até o peso alvo na xícara. Cor mel → loiro = fim.' }
    ] },
    moka: { nome: 'Moka', etapas: [
      { t: 0, agua: 1.00, desc: 'Água pré-aquecida até a válvula, pó nivelado sem compactar, fogo baixo.' },
      { t: 100, agua: 1.00, desc: 'Quando o fluxo ficar claro/borbulhar, retire do fogo e resfrie a base.' }
    ] },
    'cold-brew': { nome: 'Cold brew – concentrado', etapas: [
      { t: 0, agua: 1.00, desc: 'Misture toda a água, mexa até molhar todo o pó, tampe.' },
      { t: 50400, agua: 1.00, desc: '14–18 h em temperatura ambiente (ou 18–24 h na geladeira). Filtre e dilua 1:1.' }
    ] }
  };

  /* ---------- Catálogo: cafés comprados pelo usuário ----------
   * Importados automaticamente para "Grãos" na primeira abertura (e ao
   * atualizar o app). Campos marcados "confirmar" vieram incompletos das
   * lojas — ajuste pelo rótulo. */
  const CATALOGO_VERSAO = 2;
  const catalogo = [
    // ---- Maeda Coffee · Kit Inicial ----
    { catalogoId: 'maeda-doce-cacau', nome: 'Maeda · Doce Cacau', torrefacao: 'Maeda Coffee', semEstoque: true, kit: 'Kit Inicial (Maeda)', produtor: 'Poço Fundo – MG', regiao: 'sul-de-minas', variedade: '', processo: 'natural', torra: 'media', especie: 'arabica', pontuacao: '84+', acidez: 2, corpo: 4, docura: 4, notas: ['caramelo', 'chocolate ao leite', 'mel'], link: 'https://www.maedacoffee.com.br/produtos/doce-cacau/', obs: 'Linha Clássicos Maeda. Descrito como versátil para filtrados e prensa francesa.' },
    { catalogoId: 'maeda-sol-do-paraiso', nome: 'Maeda · Sol do Paraíso', torrefacao: 'Maeda Coffee', semEstoque: true, kit: 'Kit Inicial (Maeda)', produtor: 'Sirlei Sanfelice – São Sebastião do Paraíso – MG', regiao: 'sul-de-minas', variedade: '', processo: 'natural', torra: 'media-clara', especie: 'arabica', pontuacao: '85+', acidez: 3, corpo: 3, docura: 4, notas: ['frutas amarelas', 'mel', 'cítrico'], link: 'https://www.maedacoffee.com.br/produtos/sol-do-paraiso/', obs: 'Acidez cítrica com final doce. Processo não informado na loja (confirmar no rótulo).' },
    // ---- Maeda Coffee · Kit Exóticos ----
    { catalogoId: 'maeda-furo', nome: 'Maeda · FŪRO', torrefacao: 'Maeda Coffee', semEstoque: true, kit: 'Kit Exóticos (Maeda)', produtor: '', regiao: 'outra', variedade: '', processo: 'fermentacao-induzida', torra: 'clara', especie: 'arabica', pontuacao: '', acidez: 4, corpo: 3, docura: 4, notas: ['frutas vermelhas', 'floral', 'vinho'], link: 'https://www.maedacoffee.com.br/produtos/', obs: 'Linha Exóticos Maeda (lotes fermentados). Região, produtor, processo exato e notas: confirmar no rótulo.' },
    { catalogoId: 'maeda-hanagasumi', nome: 'Maeda · HANAGASUMI', torrefacao: 'Maeda Coffee', semEstoque: true, kit: 'Kit Exóticos (Maeda)', produtor: '', regiao: 'outra', variedade: '', processo: 'fermentacao-induzida', torra: 'clara', especie: 'arabica', pontuacao: '', acidez: 4, corpo: 3, docura: 4, notas: ['floral', 'frutas tropicais', 'mel'], link: 'https://www.maedacoffee.com.br/produtos/', obs: 'Linha Exóticos Maeda (lotes fermentados). Região, produtor, processo exato e notas: confirmar no rótulo.' },
    { catalogoId: 'maeda-caturra-koji', nome: 'Maeda · Caturra Amarelo (Koji)', torrefacao: 'Maeda Coffee', semEstoque: true, kit: 'Kit Exóticos (Maeda) – confirmar se veio no kit', produtor: 'Felipe Carvalho', regiao: 'alta-mogiana', variedade: 'Caturra Amarelo', processo: 'fermentacao-induzida', torra: 'clara', especie: 'arabica', pontuacao: '88+', acidez: 4, corpo: 3, docura: 4, notas: ['floral', 'frutas vermelhas', 'uva'], link: 'https://www.maedacoffee.com.br/produtos/cafe-caturra-amarelo-c3ozp/', obs: 'Fermentação com Koji. Notas: flores brancas, frutas vermelhas, amora, jabuticaba. Se não veio no seu kit, exclua este grão.' },
    // ---- Encantos do Café · Kit Degustação 4 cafés ----
    { catalogoId: 'encantos-agrado', nome: 'Encantos · AGRADO', torrefacao: 'Encantos do Café (Nova Lima – MG)', semEstoque: true, kit: 'Kit Degustação 4 cafés (Encantos)', produtor: 'Horácio Moura – Fazenda Três Barras', regiao: 'matas-de-minas', variedade: 'Catucaí Amarelo', processo: 'natural', torra: 'media-escura', especie: 'arabica', pontuacao: '', acidez: 2, corpo: 4, docura: 4, notas: ['chocolate ao leite', 'caramelo'], link: 'https://loja.encantosdocafe.com.br/cafe-agrado-250g', obs: 'Xícara confortável e aveludada, corpo cremoso, perfil de “browning”. Boa base para espresso e bebidas com leite.' },
    { catalogoId: 'encantos-desejo', nome: 'Encantos · DESEJO', torrefacao: 'Encantos do Café (Nova Lima – MG)', semEstoque: true, kit: 'Kit Degustação 4 cafés (Encantos)', produtor: 'Fazenda Sertão – Carmo de Minas', regiao: 'mantiqueira', variedade: 'Bourbon Amarelo', processo: 'fermentacao-induzida', torra: 'media-clara', especie: 'arabica', pontuacao: '', acidez: 4, corpo: 3, docura: 4, notas: ['frutas tropicais', 'mel', 'cítrico'], link: 'https://loja.encantosdocafe.com.br/cafe-desejo-250g', obs: 'Fermentação induzida por leveduras. Notas de manga, mel e maracujá; acidez cítrica brilhante, corpo cremoso. Torra: confirmar no rótulo.' },
    { catalogoId: 'encantos-raro', nome: 'Encantos · RARO (Geisha)', torrefacao: 'Encantos do Café (Nova Lima – MG)', semEstoque: true, kit: 'Kit Degustação 4 cafés (Encantos)', produtor: 'Gabriel Lamounier – Fazenda Guariroba', regiao: 'campo-das-vertentes', variedade: 'Geisha', processo: 'anaerobico', torra: 'clara', especie: 'arabica', pontuacao: '90', acidez: 4, corpo: 2, docura: 4, notas: ['laranja', 'mel', 'floral'], link: 'https://loja.encantosdocafe.com.br/cafe-raro-250g', obs: 'Natural fermentado, 90 pts SCA. Delicado: doce de laranja, mel, floral. Trate com cuidado: 92–94 °C, razão 1:16–1:17, não deixe passar de 3:30 no V60.' },
    { catalogoId: 'encantos-sensacao', nome: 'Encantos · Blend SENSAÇÃO', torrefacao: 'Encantos do Café (Nova Lima – MG)', semEstoque: true, kit: 'Kit Degustação 4 cafés (Encantos)', produtor: 'Base: Horácio Moura – Fazenda Três Barras', regiao: 'matas-de-minas', variedade: 'Blend (Catucaí Amarelo e outros)', processo: 'natural', torra: 'media', especie: 'blend', pontuacao: '', acidez: 2, corpo: 4, docura: 5, notas: ['mel', 'rapadura', 'melado'], link: 'https://loja.encantosdocafe.com.br/cafe-blend-sensacao-250g', obs: 'Blend de naturais de regiões diferentes, criado por Samuel Angarani. Corpo cremoso, doçura de rapadura e melaço. Torra: confirmar no rótulo.' },
    // ---- NETCAFÉS (Caparaó) – foto ----
    { catalogoId: 'netcafes-caramelo-chocolate', nome: 'Net Cafés · Caramelo & Chocolate', torrefacao: 'NETCAFÉS (Caparaó)', semEstoque: true, kit: 'Foto – 2 pacotes de 250 g', produtor: 'Família Emerich – Alto Jequitibá – MG', regiao: 'caparao', variedade: 'Catuaí Vermelho', processo: 'natural', torra: 'media', especie: 'arabica', pontuacao: '', altitude: 1200, acidez: 2, corpo: 4, docura: 5, notas: ['caramelo', 'chocolate', 'rapadura'], link: 'https://www.netcafes.com.br/product-page/caf%C3%A9-especial-caramelo-e-chocolate-250g', obs: 'Doçura intensa, corpo alto, equilíbrio caramelo/chocolate. Você tem 2 pacotes: use a mesma receita calibrada no segundo.' },
    { catalogoId: 'netcafes-frutas-amarelas', nome: 'Net Cafés · Frutas Amarelas', torrefacao: 'NETCAFÉS (Caparaó)', semEstoque: true, kit: 'Foto – 250 g', produtor: 'Caparaó – MG (Alto Jequitibá)', regiao: 'caparao', variedade: 'Catucaí 785', processo: 'natural', torra: 'media', especie: 'arabica', pontuacao: '', altitude: 1200, acidez: 4, corpo: 3, docura: 4, notas: ['frutas amarelas', 'frutas tropicais', 'cítrico'], link: 'https://loja.netcafes.com.br/produtos/frutasamarelas/', obs: 'Natural fermentado. Frutas amarelas e maracujá, acidez cítrica brilhante, corpo licoroso. Se aparecer nota de álcool, baixe 1–2 °C.' },
    { catalogoId: 'netcafes-frutas-vermelhas', nome: 'Net Cafés · Frutas Vermelhas', torrefacao: 'NETCAFÉS (Caparaó)', semEstoque: true, kit: 'Foto – 250 g', produtor: 'Caparaó – MG (Alto Jequitibá)', regiao: 'caparao', variedade: 'Catucaí 785', processo: 'natural', torra: 'media', especie: 'arabica', pontuacao: '', altitude: 1200, acidez: 4, corpo: 4, docura: 4, notas: ['frutas vermelhas', 'vinho', 'caramelo'], link: 'https://loja.netcafes.com.br/produtos/frutasvermelhas', obs: 'Natural fermentado. Frutas vermelhas bem maduras, corpo licoroso, doçura intensa.' },
    // ---- Colheita Café (Caparaó) – foto ----
    { catalogoId: 'colheita-pra-beber-de-balde', nome: 'Colheita · Pra Beber de Balde', torrefacao: 'Colheita Café (Caparaó)', semEstoque: true, kit: 'Foto – 250 g', produtor: 'Flávio Protázio – Sítio Família Protázio – Espera Feliz – MG', regiao: 'caparao', variedade: 'Caparaó Amarelo + Catuaí Vermelho', processo: 'cereja-descascado', torra: 'media', especie: 'arabica', pontuacao: '', altitude: 1230, acidez: 3, corpo: 3, docura: 4, notas: ['baunilha', 'rapadura', 'mel', 'castanhas', 'floral', 'especiarias'], link: 'https://colheitacafe.com.br/', obs: 'Safra 2024/25. CD equilibrado, “de beber de balde”: bom para calibrar o moedor num café previsível. Torra: confirmar no rótulo.' },
    { catalogoId: 'colheita-halls-de-cereja', nome: 'Colheita · Halls de Cereja', torrefacao: 'Colheita Café (Caparaó)', semEstoque: true, kit: 'Foto – 250 g', produtor: 'Sítio Morro Preto (confirmar no rótulo)', regiao: 'caparao', variedade: 'MGS Aranãs', processo: 'natural', torra: 'media-clara', especie: 'arabica', pontuacao: '', acidez: 3, corpo: 2, docura: 4, notas: ['frutas vermelhas', 'ervas', 'floral'], link: 'https://colheitacafe.com.br/', obs: 'Variedade rara MGS Aranãs (1985), grãos grandes. Cereja fresca “de bala”, final refrescante e mentolado, corpo suave, acidez média, final limpo. Processo/torra/origem: confirmar no rótulo.' },
    { catalogoId: 'colheita-blend-da-copa', nome: 'Colheita · Blend da Copa', torrefacao: 'Colheita Café (Caparaó)', semEstoque: true, kit: 'Foto – 250 g', produtor: 'Ademir Lacerda – Dores do Rio Preto – ES', regiao: 'caparao', variedade: 'Caparaó Amarelo', processo: 'cereja-descascado', torra: 'media', especie: 'arabica', pontuacao: '87', altitude: 1250, acidez: 3, corpo: 4, docura: 5, notas: ['frutas tropicais', 'frutas amarelas', 'caramelo', 'melado'], link: 'https://colheitacafe.com.br/', obs: 'Maracujá, cajá e caramelo com fundo de doce de leite. Colheita seletiva e via úmida. Torra: confirmar no rótulo.' },
    { catalogoId: 'colheita-castanhas-caramelo', nome: 'Colheita · Castanhas & Caramelo', torrefacao: 'Colheita Café (Caparaó)', semEstoque: true, kit: 'Foto – 250 g', produtor: 'Caparaó (confirmar no rótulo)', regiao: 'caparao', variedade: '', processo: 'natural', torra: 'media', especie: 'arabica', pontuacao: '', acidez: 2, corpo: 4, docura: 4, notas: ['castanhas', 'caramelo', 'chocolate'], link: 'https://colheitacafe.com.br/', obs: 'Sem ficha técnica pública encontrada. Produtor, variedade, processo e torra: confirmar no rótulo.' },
        // ---- Novos cafés importados da base ----
    { catalogoId: 'colheita-moquinha-sedutor', nome: 'Colheita · Moquinha Sedutor', torrefacao: 'Colheita Café (Caparaó)', semEstoque: true, kit: 'Foto – 250 g', produtor: 'Caparaó (confirmar no rótulo)', regiao: 'caparao', variedade: '', processo: 'natural', torra: 'media', especie: 'arabica', pontuacao: '', acidez: 3, corpo: 3, docura: 4, notas: ['caramelo', 'frutas amarelas'], link: 'https://colheitacafe.com.br/', obs: 'Na foto só aparecem as terminações “…INHA / …OR”. Edite o nome e a ficha pelo rótulo.' },
    { catalogoId: 'maeda-koran', nome: 'Maeda - Koran', torrefacao: 'Maeda Coffee', semEstoque: true, kit: 'Foto – 100 g', produtor: '', regiao: 'cerrado-mineiro', variedade: 'Arara', processo: 'anaerobico', torra: 'clara', especie: 'arabica', pontuacao: '90', altitude: 1180, acidez: 2, corpo: 4, docura: 4, notas: ['frutas vermelhas'], link: 'https://www.maedacoffee.com.br/', obs: '' },
    { catalogoId: 'maeda-akane', nome: 'Maeda - AKANE', torrefacao: 'Maeda Coffee', semEstoque: true, kit: 'Foto – 100 g', produtor: 'PAULO HAMASAKI', regiao: 'mantiqueira', variedade: 'CATUCAI 24/137', processo: 'anaerobico', torra: 'media', especie: 'arabica', pontuacao: '89', altitude: 1150, acidez: 4, corpo: 3, docura: 4, notas: ['frutas amarelas', 'laranja', 'rapadura', 'especiarias'], link: 'https://www.maedacoffee.com.br/', obs: 'Notas do rótulo: LARANJA, FRUTAS AMARELAS, RAPADURA, ESPECIARIAS · Finalização: equilibrado, limpo e muito doce. Processo: Fermentação anaeróbica 72h.' },
    { catalogoId: 'netcafes-caramelo-e-mel', nome: 'Net Cafés · Caramelo e Mel', torrefacao: 'NETCAFÉS (Caparaó)', semEstoque: true, kit: 'Foto – 250 g', produtor: '', regiao: 'caparao', variedade: 'Catuaí', processo: 'honey', torra: 'media-clara', especie: 'arabica', pontuacao: '', altitude: 1200, acidez: 4, corpo: 3, docura: 4, notas: ['caramelo', 'mel'], link: 'https://www.netcafes.com.br/', obs: '' },
    { catalogoId: 'colheita-brilho-do-verao', nome: 'Colheita - Brilho do Verão', torrefacao: 'Colheita Café (Caparaó)', semEstoque: true, kit: 'Foto – 250 g', produtor: 'Sítio Vista Linda - Espera Feliz MG', regiao: 'caparao', variedade: 'Catuaí Vermelho', processo: 'honey', torra: 'media-clara', especie: 'arabica', pontuacao: '', altitude: 1300, acidez: 4, corpo: 3, docura: 4, notas: ['nozes', 'pêssego', 'mel', 'melado'], link: 'https://colheitacafe.com.br/', obs: '' },
    { catalogoId: 'colheita-delicado-luminoso', nome: 'Colheita - Delicado & Luminoso', torrefacao: 'Colheita Café (Caparaó)', semEstoque: true, kit: 'Foto – 250 g', produtor: 'Josimar Protázio, Sítio Vista Linda - Espera Feliz, MG', regiao: 'caparao', variedade: 'Caparaó Amarelo', processo: 'honey', torra: 'media-clara', especie: 'arabica', pontuacao: '', altitude: 1280, acidez: 4, corpo: 3, docura: 4, notas: ['chocolate', 'caramelo', 'castanhas', 'cítrico', 'mel', 'rapadura', 'baunilha'], link: 'https://colheitacafe.com.br/', obs: 'Notas do rótulo: Baunilha, Avelã, Mel, Chocolate, Caramelo, Rapadura, Castanhas, Cítrico · Métodos Indicados: Espresso e Filtrados.' },
    { catalogoId: 'colheita-abraco-de-vo', nome: 'Colheita - Abraço de Vó', torrefacao: 'Colheita Café (Caparaó)', semEstoque: true, kit: 'Foto – 250 g', produtor: 'Justino de Jesus - Sítio Mirante das Montanhas, Iúna/ES', regiao: 'caparao', variedade: 'Arara', processo: 'honey', torra: 'media', especie: 'arabica', pontuacao: '', altitude: 1250, acidez: 4, corpo: 3, docura: 4, notas: ['caramelo', 'frutas vermelhas', 'baunilha', 'especiarias'], link: 'https://colheitacafe.com.br/', obs: 'Notas do rótulo: Baunilha, Pera, Cumaru, Alcaçuz, Framboesa, Especiarias, Caramelo · Peso: 250 g. Métodos Indicados: Espresso e Filtrados. Corpo Aveludado | Acidez Média | Complexo | Gostoso igual Abraço de Vó.' },
    { catalogoId: 'colheita-beleza-tropical', nome: 'Colheita - BELEZA TROPICAL', torrefacao: 'Colheita Café (Caparaó)', semEstoque: true, kit: 'Foto – 250 g', produtor: 'Ademir Lacerda - Sítio Forquilha do Rio, Dores do Rio Preto - ES', regiao: 'caparao', variedade: 'Caparaó Amarelo', processo: 'fermentacao-induzida', torra: 'media-clara', especie: 'arabica', pontuacao: '', altitude: 1200, acidez: 4, corpo: 3, docura: 4, notas: ['frutas amarelas', 'frutas vermelhas', 'frutas tropicais', 'limão', 'fermentado'], link: 'https://colheitacafe.com.br/', obs: 'Notas do rótulo: Jaca Madura, Cajá, Manga, Maracujá, Frutas Vermelhas, limão, Licoroso, Fermentado, Exótico, Doideira · Lote 02. Peso líq.: 250 g. Métodos Indicados: Espresso e Filtrados. Torrado artesanalmente em pequenos lotes.' },
    { catalogoId: 'colheita-caramelo-salgado', nome: 'Colheita - Caramelo Salgado', torrefacao: 'Colheita Café (Caparaó)', semEstoque: true, kit: 'Foto – 250 g', produtor: 'Flávio Protázio, Sítio Família Protázio · Espera Feliz, MG', regiao: 'caparao', variedade: 'Catuaí Vermelho', processo: 'natural', torra: 'media-clara', especie: 'arabica', pontuacao: '', altitude: 1300, acidez: 4, corpo: 3, docura: 4, notas: ['caramelo', 'frutas vermelhas', 'mel', 'rapadura', 'especiarias'], link: 'https://colheitacafe.com.br/', obs: 'Notas do rótulo: Caramelo Salgado, Cardamomo, Mineral, Frutas Vermelhas, Amora, Framboesa, Rapadura, Mel · Métodos Indicados: Espresso e Filtrados. Peso Líq: 250 g. Torrado artesanalmente em pequenos lotes.' },
    { catalogoId: 'colheita-morango-acerola', nome: 'Colheita - Morango & Acerola', torrefacao: 'Colheita Café (Caparaó)', semEstoque: true, kit: 'Foto – 250 g', produtor: 'Ademir Lacerda - Sítio Forquilha do Rio, Dores do Rio Preto', regiao: 'caparao', variedade: 'Catuaí Vermelho', processo: 'natural', torra: 'media', especie: 'arabica', pontuacao: '', altitude: 1290, acidez: 4, corpo: 3, docura: 4, notas: ['frutas vermelhas', 'mel', 'fermentado'], link: 'https://colheitacafe.com.br/', obs: 'Notas do rótulo: Morango, Framboesa, Amora, Mel, Acerola, Pitanga, Alcoólico, Licoroso, Vibrante, Acidez Málica, Complexo, Fermentação, Doideira · Peso Líq.: 250 g. Métodos Indicados: Filtrados. Torrado artesanalmente em pequenos lotes.' }
  ];

  const byId = (arr) => Object.fromEntries(arr.map(x => [x.id, x]));

  return {
    regioes, processos, torras, metodos, grindEscala, moedoresModelo, descritores, sinais, indicacoesPerfil, receitas, catalogo, CATALOGO_VERSAO,
    regiao: byId(regioes), processo: byId(processos), torra: byId(torras), metodo: byId(metodos), sinal: byId(sinais)
  };
})();
