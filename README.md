# ☕ Laboratório de Cafeteria

Diário técnico de extrações e calibração de cafés especiais. Aplicação **100 % local** (HTML + CSS + JS puros, sem servidor, sem build, sem rede): roda no navegador do computador ou instalada no smartphone como um app (PWA).

## O que faz

- **Diário de extrações**: grão, método (V60, Origami, Hario V60 Suiren, Kalita, Timemore Crystal Eye B75, Melitta, Chemex, Clever, AeroPress, Prensa Francesa, Coador de pano, Espresso, Moka, Cold brew), moedor e cliques exatos, dose, água/bebida, razão, temperatura, tempo de contato, TDS (opcional), perfil sensorial (acidez, doçura, amargor, corpo, final), sinais de xícara e nota.
- **Diagnóstico automático** de sub/sobre-extração a partir dos sinais, dos sliders sensoriais, do tempo de contato em relação à faixa do método e do rendimento de extração (EY) quando há TDS.
- **Recomendação da próxima extração**: ajuste de moagem em cliques do seu moedor (com bissecção quando a extração anterior estava do lado oposto), temperatura como alavanca fina, razão água/café para intensidade e regras específicas para lotes fermentados e para espresso.
- **Ponto de partida para grãos novos**: combina torra, processo, terroir e perfil sensorial para sugerir cliques, razão, temperatura e tempo alvo antes da primeira extração. A receita inicial parte sempre de **10 g** de café (espresso: 18 g); extrações já registradas não mudam.
- **Dois jeitos de começar**: *pelo grão* (escolha o café e receba a receita) ou *pelo método* (grade de métodos com ícones; ao tocar num método, o app lista os cafés do seu estoque que mais combinam com ele e explica o porquê: terroir, torra, acidez/corpo/doçura, notas, processo, dias de torra e o que você já registrou naquele método). O app lembra o modo que você usou por último.
- **Dose, água e razão ligadas**: ao mudar a dose na extração, a água é recalculada mantendo a razão; o plano de despejos, a referência sugerida e a faixa de tempo acompanham a nova dose (nos filtrados, leito maior drena mais devagar: a faixa escala com a dose).
- **Equipamentos** (Mais → Equipamentos): métodos e moedores num lugar só. Crie métodos personalizados (nome, ícone, tipo base, dose, faixas de razão/temperatura/tempo, moagem, vazão e plano de despejos editável); o motor trata cada um como o método base escolhido. Métodos nativos que você não usa podem ser ocultados. Métodos personalizados sincronizam entre os aparelhos.
- **Curvas de sabor**: evolução das notas por grão × método, radar sensorial (última × melhor extração), tabela de tentativas e status de calibração (“calibrado em N tentativas”).
- **Biblioteca nativa**: 15 terroirs brasileiros (Cerrado Mineiro, Sul de Minas, Mantiqueira, Matas de Minas, Chapada de Minas, Alta e Média Mogiana, Montanhas do ES, Conilon Capixaba, Chapada Diamantina, Planalto e Oeste da Bahia, Norte Pioneiro do Paraná, Caparaó, Matas de Rondônia), 7 processos de pós-colheita, 5 intensidades de torra (com Agtron e descanso), 14 métodos com parâmetros (incluindo Origami Dripper, Hario V60 Suiren e Timemore Crystal Eye B75), e a tabela de indicações método × perfil.
- **Moedores**: escala de cliques/sub-cliques, direção (menor = fino), referência por método; modelos prontos (Timemore, 1Zpresso, Comandante, Hario, Baratza Encore, Fellow Ode, DF64/Mignon).
- **Receitas de despejo** por método (bloom, cada ataque com tempo e água acumulada, drenagem), escaladas para a dose e a razão da extração. No registro você anota o que realmente fez em cada despejo.
- **Catálogo dos cafés comprados** já cadastrado em Grãos na primeira abertura: Maeda Coffee (Kit Inicial e Kit Exóticos), Encantos do Café (Kit Degustação: Agrado, Desejo, Raro, Sensação), Net Cafés (Caparaó: Caramelo & Chocolate, Frutas Amarelas, Frutas Vermelhas) e Colheita Café (Pra Beber de Balde, Halls de Cereja, Blend da Copa, Castanhas & Caramelo). Os moedores **Starseeker E55 Pro**, **Kingrinder K2**, **1Zpresso JX-Pro** e **Tramontina by Breville Express** (escala 1–60) também vêm pré-cadastrados com referências de cliques por método.
- **Timer guiado de preparo**: contagem regressiva por etapa, anel de progresso, balança-alvo subindo na vazão ideal de cada método (ex.: 6 g/s na V60), aviso sonoro e vibração 3-2-1, tela sempre ligada, botão para adiantar a etapa e marcação do fim da drenagem. Ao concluir, o tempo total e os horários reais de cada despejo vão para o registro da extração.
- **Leitura de rótulos pela câmera**: no cadastro de grão, fotografe o pacote. Com uma chave da API da Anthropic ou do Google Gemini (Mais → Backup e ajustes, escolha o provedor), a IA lê a foto e preenche produtor, região, variedade, processo, torra, altitude, data da torra, pontuação e notas, mapeados para o banco nativo. Sem chave, um OCR local (Tesseract.js, baixado na primeira vez) faz uma leitura mais simples. A chave fica só no aparelho e não entra no backup. O SDK oficial da Anthropic está empacotado em `vendor/`.
- **Pingo, o mascote**: uma xícara com olhos, braços e vapor animado que aparece no início, na cafeína, nas extrações, no timer e no latte art. A expressão muda com o nível de cafeína, a hora do dia, a nota da extração e a pontuação do treino.
- **Início com ações rápidas**: repetir a última receita (com ou sem timer), estoque, cafeína e latte art em cartões.
- **Estoque de grãos**: informe o peso do pacote e quantos pacotes comprou (botão **＋1 pacote** na página do grão para repor). O app desconta a dose de cada extração, mostra quantas doses restam e avisa quando um café está acabando. Ao zerar, o café é marcado como **sem estoque** e some das telas de extração; adicionar um pacote desmarca. A marcação também pode ser feita à mão.
- **Lista de grãos ordenável**: quantidade restante (padrão, menor primeiro), nome (A–Z) ou torrefação (agrupada). Cafés sem estoque e arquivados ficam no fim.
- **Moedor padrão** (Mais → Equipamentos; de fábrica, o Starseeker E55 Pro): usado nas extrações por grão e por método e nos pontos de partida.
- **Treino de latte art**: segure o celular como o cabo da jarra e balance o punho. O acelerômetro vira uma onda que você compara com o padrão-alvo descendo na tela (rosetta completa, balanço constante, 3/5/7 balanços, aleatório), com metrônomo, ritmo, largura e velocidade ajustáveis. Ao final, pontua ritmo, constância, uniformidade e sincronia e desenha a rosetta que seu movimento formaria. Sem sensor, dá para treinar com o dedo na tela.
- **Cafeína e sono**: diário de cafeína com lançamentos rápidos (cafeteria, energético, chá, chimarrão…) e registro automático das extrações que você bebeu. Um modelo farmacocinético de um compartimento, ajustado por peso, idade, sensibilidade, fumo, anticoncepcional e gestação, projeta a curva no corpo, a quantidade na hora de dormir e o último horário seguro para um café. Estimativa educativa, não é orientação médica.
- **Sincronização entre aparelhos**: celular, tablet e notebook compartilham os mesmos dados por um Gist secreto da sua conta do GitHub. O arquivo é criptografado no aparelho (AES-GCM 256, chave derivada da sua senha com PBKDF2) antes de sair, então o GitHub só guarda texto cifrado. A mescla é por registro: novidades dos dois lados somam, a edição mais recente vence e exclusões não voltam. Configure em Mais → Backup e ajustes → Sincronização, com o mesmo token e a mesma senha em cada aparelho.
- **Foto de cada café**: no cadastro do grão, tire ou escolha uma foto (ela é comprimida para ~30 KB). A foto enviada para a leitura do rótulo por IA/OCR é guardada automaticamente quando o café ainda não tem foto. Aparece na lista de grãos, no detalhe (toque para ampliar) e na escolha por método, e sincroniza junto com o grão.
- **Avaliação com ajuste fino**: acidez, doçura, amargor, corpo e finalização em passos de 0,5; botões − / + ao lado de cada controle (arrastar continua funcionando), inclusive na nota 0–10.
- **Backup** em JSON (exportar/importar/copiar).

## Como rodar

### No computador
Abra `index.html` no navegador (duplo clique). Quase tudo funciona a partir de `file://`; a leitura de rótulos por IA exige servir a pasta por HTTP(S), como descrito abaixo.

### No smartphone, “como um app”
Para instalar (ícone na tela inicial, tela cheia, offline), o navegador exige que a pasta seja servida por HTTP(S). Duas opções:

**A) GitHub Pages (recomendado)** — publique este repositório em *Settings → Pages → Deploy from branch*, abra a URL no celular e use “Instalar aplicativo” (Chrome/Android) ou *Compartilhar → Adicionar à Tela de Início* (Safari/iPhone). Depois disso o app funciona offline.

**B) Servidor local na mesma rede Wi-Fi** — na pasta do projeto:

```bash
python3 -m http.server 8080
# ou: npx serve .
```

No celular acesse `http://IP-DO-COMPUTADOR:8080` e adicione à tela inicial. (Sem HTTPS o service worker não registra em alguns navegadores, mas o app funciona normalmente.)

### Dados de exemplo
Em **Mais → Backup e ajustes → Carregar exemplo** você vê o motor funcionando com uma sequência real de calibração (V60 e espresso).

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Casca da aplicação e navegação |
| `styles.css` | Estilos, tema claro/escuro, layout mobile-first |
| `data.js` | Banco nativo: terroirs, processos, torras, métodos, sinais, moedores-modelo |
| `icones.js` | Ícones de traço dos métodos de preparo |
| `engine.js` | Motor: ponto de partida, diagnóstico, recomendação, status de calibração |
| `app.js` | Interface, rotas, formulários, gráficos SVG, backup, PWA |
| `timer.js` | Timer guiado de preparo |
| `rotulo.js` | Leitura de rótulos (Claude, Gemini ou OCR local) |
| `cafeina.js` | Diário de cafeína e modelo farmacocinético |
| `latte.js` | Treino de latte art com acelerômetro |
| `sync.js` | Sincronização criptografada via GitHub Gist |
| `mascote.js` | Pingo, o mascote (SVG animado) |
| `vendor/anthropic-sdk.mjs` | SDK oficial da Anthropic (0.128.0) empacotado para navegador |
| `manifest.webmanifest`, `sw.js`, `icons/` | Instalação como app e cache offline |

## Como o motor decide

0. **Qual café para qual método.** Na escolha pelo método, cada grão recebe uma pontuação de aptidão: indicação do terroir para o método, torra (claras brilham em filtros cônicos; médias e escuras em espresso, moka e prensa), perfil (acidez alta favorece o cônico, corpo alto a prensa e o espresso), famílias de notas, processo (fermentados vão bem em imersão), dias desde a torra e o histórico real naquele método. Grãos sem estoque vão para o fim.
1. **Perfil esperado do grão.** Para cada grão, o app calcula o que ele deveria entregar na xícara (acidez, doçura, amargor, corpo e finalização, de 1 a 5). O cálculo usa a região, o processo, a torra, as notas cadastradas e o método: uma torra clara tem amargor esperado baixo, filtros de papel reduzem o corpo, espresso aumenta. Os controles de paladar do registro começam nesse perfil, então só conta como desvio o que você mover.
2. **Leitura da avaliação.** O diagnóstico compara o que você sentiu com esse perfil. Acidez 4 é ótima num lavado da Mantiqueira e sinal de sub-extração num natural do Cerrado. Acidez acima do esperado com pouca doçura aponta sub-extração; amargor acima do esperado para a torra aponta sobre-extração; corpo fora do esperado aponta força (razão). Notas de cereal/vegetal, tostado numa torra clara ou fermentado fora do perfil também entram. Somam-se os sinais marcados, o tempo em relação à faixa do método e o EY quando há TDS.
3. **Alavancas por método e torra.** Em filtrados, a moagem é a alavanca principal; a temperatura entra conforme a torra (torras claras aceitam mais calor, escuras pedem menos). Em imersão, o tempo de contato vem primeiro. No espresso, moagem para o tempo e razão (volume da bebida) quando o tempo já está no limite. O tamanho de cada ajuste acompanha o tamanho do desvio e usa os µm por clique do moedor.
4. **Ajuste de perfil.** Com a extração no ponto, o app ainda compara o sabor com o grão: doçura abaixo do potencial pede um pouco mais de extração; acidez mais viva que o perfil pede mais corpo; acidez apagada num grão frutado pede uma xícara mais limpa (razão maior).
5. **Histórico.** O app compara a extração com a anterior: se uma única mudança piorou a nota e pode ter causado o problema, sugere voltar; se melhorou, sugere seguir; se você mudou várias coisas ao mesmo tempo, avisa. A moagem usa bissecção quando a xícara passa de um lado para o outro.
6. **Uma coisa de cada vez.** No máximo duas mudanças por recomendação; o resto aparece como alternativa. Cada ação vem com o porquê. Nota igual ou acima do alvo (padrão 8) com extração no ponto marca a receita como calibrada.

Registros de extração podem ser editados depois de salvos (botão **Editar registro** na extração): o diagnóstico, a recomendação e a cafeína ligada são recalculados.

Todos os valores da biblioteca são referências de bancada, não regras absolutas; o histórico real sempre prevalece.

## Leitura de rótulos: Claude ou Gemini

Em **Mais → Backup e ajustes → Leitura de rótulos por IA**, escolha o provedor e cole a chave:

- **Gemini**: crie a chave em [aistudio.google.com](https://aistudio.google.com) → *Get API key*. Há cota gratuita; no plano gratuito o Google pode usar o conteúdo enviado para melhorar os modelos. No modo **Automático** (padrão), **toda tentativa começa sempre pelo modelo mais recente** disponível para a sua chave (`gemini-4-hydrogen` e depois `gemini-3.8-flash`), descobre lançamentos pela API, desce automaticamente para versões anteriores/mais leves (`gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3-flash-preview`) em caso de sobrecarga ou cota, e recorre ao OCR local se todos os modelos falharem. Quem tiver conta paga também pode escolher `gemini-4-argon` manualmente. Use **Testar chave e atualizar modelos** nos ajustes após colar a chave.
- **Claude**: crie a chave em [console.anthropic.com](https://console.anthropic.com) → *API Keys*. Cobrado por uso.

As chaves ficam só no aparelho. Como o app roda inteiro no navegador, qualquer pessoa com acesso ao seu celular desbloqueado poderia ver a chave; use uma chave própria para este app e com limite de gastos.

## Publicar no GitHub Pages

1. No GitHub, abra o repositório → **Settings → Pages**.
2. Em *Build and deployment*, escolha **Deploy from a branch**, selecione a branch (por exemplo `main`, depois de fazer o merge) e a pasta **/ (root)**. Salve.
3. Em um ou dois minutos o endereço `https://<seu-usuario>.github.io/<repositório>/` fica no ar. Abra no celular e use *Instalar aplicativo* (Android) ou *Compartilhar → Adicionar à Tela de Início* (iPhone).

Para mudar algo você mesmo: edite o arquivo no GitHub (ícone de lápis) e faça *Commit*. O Pages publica a nova versão em um ou dois minutos.

### Atualizações no celular

O app busca os arquivos na rede primeiro e só usa o cache offline quando está sem internet. Ao abrir com internet, uma versão nova é instalada e a tela recarrega sozinha. A versão instalada aparece em **Mais → Backup e ajustes → Versão do app**, junto com o botão **Forçar atualização**, que limpa o cache sem apagar seus dados.

Ao publicar mudanças, troque o valor de `VERSAO` no início do `sw.js` (por exemplo `2026-09-24.1`). É isso que avisa os aparelhos que há uma versão nova.
