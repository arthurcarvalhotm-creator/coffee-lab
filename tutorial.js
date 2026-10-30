/* =====================================================================
 * Laboratório de Cafeteria — Boas-Vindas e Tutorial de Primeiro Uso
 * Apresentação calorosa e bem-humorada conduzida pelo mascote Pingo,
 * com micro-mockups visuais das principais funcionalidades e navegação
 * passo a passo.
 * ===================================================================== */
(function () {
  'use strict';
  const lab = window.CafeLab;

  // Helper resiliente para renderizar o card com o Pingo, com fallback à prova de falhas
  function cardPingo(humor, texto, opts) {
    opts = opts || {};
    const P = window.Mascote || window.Pingo;
    if (P && typeof P.card === 'function') {
      return P.card(humor, texto, opts);
    }
    return `
      <div class="pingo-card ${opts.compacto ? 'compacto' : ''}">
        <div class="pingo-fig" style="font-size:2.4rem;line-height:1;display:flex;align-items:center;justify-content:center">☕</div>
        <div class="pingo-fala">${opts.titulo ? `<strong>${opts.titulo}</strong><br>` : ''}${texto}</div>
      </div>
    `;
  }

  const ETAPAS = [
    {
      id: 'diario',
      titulo: 'Diário para registro das extrações',
      caminho: 'Menu inferior > 📓 Diário (ou Início > Diário)',
      humor: 'feliz',
      texto: 'Chega de tentar lembrar de cabeça por que aquele café de sábado ficou incrível! Aqui você anota a moagem, temperatura, tempo e notas sensoriais para repetir a xícara perfeita sempre que quiser.',
      mockup: `
        <div class="tut-card-mock">
          <div class="row between" style="margin-bottom:6px">
            <span class="badge ok">★ Extração calibrada</span>
            <small class="muted">Hoje · 08:30</small>
          </div>
          <div style="font-weight:700;font-size:1.02rem">V60 · Maeda Doce Cacau</div>
          <div class="text-2" style="font-size:.85rem;margin:3px 0 6px">16 g pó → 240 g água · 2m 28s · 93 °C</div>
          <div class="row between" style="align-items:center">
            <span style="color:var(--ico-acc);font-size:.95rem">★★★★★ (nota 9)</span>
            <span class="badge accent">Caramelo & Mel</span>
          </div>
        </div>
      `
    },
    {
      id: 'extracao-modos',
      titulo: 'Extração por grão ou por método',
      caminho: 'Menu inferior > botão central (+) Extrair',
      humor: 'pensativo',
      texto: 'Bateu aquela dúvida na bancada? Você pode começar escolhendo o grão do dia (e ver as sugestões ideais para ele) ou ir direto pela cafeteira que você quer usar hoje. A decisão é sua, a precisão é nossa!',
      mockup: `
        <div class="tut-card-mock" style="padding:10px">
          <div class="tut-tabs-mock">
            <div class="tut-tab-btn on">☕ Por grão (escolha o café)</div>
            <div class="tut-tab-btn">⚡ Por método (escolha a cafeteira)</div>
          </div>
          <div class="row" style="justify-content:center;gap:6px;margin-top:10px">
            <span class="chip on sm">V60</span>
            <span class="chip sm">Espresso</span>
            <span class="chip sm">Prensa</span>
            <span class="chip sm">Aeropress</span>
          </div>
        </div>
      `
    },
    {
      id: 'indicacoes-metodos',
      titulo: 'Indicações de métodos de acordo com o grão',
      caminho: 'Grãos > Toque em um café > Métodos recomendados',
      humor: 'surpreso',
      texto: 'Nem todo grão se comporta igual! Nosso motor analisa a torra, a variedade e o processo pós-colheita para indicar onde cada café se destaca de verdade. Sem desperdiçar grão especial!',
      mockup: `
        <div class="tut-card-mock">
          <div style="font-weight:700">Encantos · DESEJO (Fermentado)</div>
          <small class="muted">Mantiqueira de Minas · Torra Média-Clara</small>
          <div style="margin-top:8px;font-size:.82rem;font-weight:600;color:var(--text-2)">Métodos onde este café mais brilha:</div>
          <div class="row" style="gap:6px;margin-top:4px">
            <span class="badge ok">★ V60 (destaque)</span>
            <span class="badge ok">★ Aeropress</span>
            <span class="badge">Prensa francesa</span>
          </div>
        </div>
      `
    },
    {
      id: 'diagnostico',
      titulo: 'Avaliação, diagnóstico e recomendação de ajustes',
      caminho: 'Diário > Abrir extração > Diagnóstico e Calibração',
      humor: 'orgulhoso',
      texto: 'Ficou amargo demais? Travou no filtro? Ou ficou aguado e ácido? Dê sua nota e seus sinais na xícara: eu analiso a extração e calculo exatamente quantos cliques mexer no moedor para a próxima vez!',
      mockup: `
        <div class="tut-card-mock" style="border-left:4px solid var(--sobre)">
          <div class="row between">
            <span class="badge sobre">⚠️ Sobre-extraído (amargo / seco)</span>
            <small class="muted">Tempo: 3m 45s</small>
          </div>
          <div style="margin-top:6px;font-size:.85rem;color:var(--text)">
            💡 <strong>Diagnóstico do Pingo:</strong> O fluxo ficou lento e puxou amargor. Sugestão: <em>engrosse 1 a 2 cliques</em> no moedor ou reduza a água para 91 °C.
          </div>
        </div>
      `
    },
    {
      id: 'ia-rotulo',
      titulo: 'Registro de novos grãos com leitura de rótulo via IA',
      caminho: 'Grãos > (+) Novo grão > 📷 Ler rótulo com IA',
      humor: 'radiante',
      texto: 'Preguiça de digitar a ficha técnica inteira do pacote? Basta apontar a câmera do celular para o rótulo! A inteligência artificial lê produtor, região, variedade, torra e notas sensoriais num instante.',
      mockup: `
        <div class="tut-card-mock" style="text-align:center">
          <div class="badge accent" style="margin-bottom:8px;padding:5px 10px;font-size:.84rem">📷 Leitura Automática de Rótulo</div>
          <div class="row between" style="background:var(--surface-2);border-radius:10px;padding:8px 10px;text-align:left;font-size:.82rem">
            <div><strong>Produtor:</strong> Sítio Vista Linda<br><strong>Região:</strong> Caparaó (1.280m)</div>
            <div style="text-align:right"><strong>Processo:</strong> Honey<br><strong>Torra:</strong> Média-Clara</div>
          </div>
        </div>
      `
    },
    {
      id: 'biblioteca',
      titulo: 'Biblioteca nativa: terroirs, processos e torras',
      caminho: 'Mais > 📚 Biblioteca > (Regiões, Processos, Torras, Métodos)',
      humor: 'pensativo',
      texto: 'Uma verdadeira enciclopédia barista no seu bolso! Aprenda como a altitude, as montanhas brasileiras e os processos fermentativos transformam o aroma e o sabor que você sente na xícara.',
      mockup: `
        <div class="tut-card-mock" style="text-align:center">
          <div class="row" style="gap:6px;justify-content:center">
            <span class="badge" style="background:var(--accent-soft);color:var(--accent);padding:5px 9px;font-size:.82rem">🏔️ Caparaó & Mantiqueira</span>
            <span class="badge" style="background:var(--misto-soft);color:var(--misto);padding:5px 9px;font-size:.82rem">🍯 Honey & Anaeróbico</span>
            <span class="badge" style="background:var(--sobre-soft);color:var(--sobre);padding:5px 9px;font-size:.82rem">🔥 Perfis de Torra</span>
          </div>
          <div style="font-size:.8rem;color:var(--text-2);margin-top:8px">
            Dezenas de referências técnicas brasileiras de bancada e botânica cafeeira
          </div>
        </div>
      `
    }
  ];

  /* ---------------- Modal de Boas-Vindas ---------------- */
  function abrirBoasVindas(forcar) {
    const s = lab.state();
    const ocultar = !!s.config.ocultarBoasVindas;
    if (ocultar && !forcar) return;

    const html = `
      <div class="sheet-head">
        <h2>Laboratório de Cafeteria</h2>
        <button class="btn sm ghost" data-close aria-label="Fechar">✕</button>
      </div>
      <div class="tut-welcome-body">
        ${cardPingo('radiante', `<strong>E aí, barista em potencial!</strong><br>Eu sou o <strong>Pingo</strong>, sua xícara-parceira de bancada.<br><br>Seja você alguém que ainda toma café com 3 colheres de açúcar ou um purista que já conta cliques de moagem em mícrons, este é o seu laboratório para dominar o café perfeito!`, { size: 96 })}
      </div>
      <div style="margin: 16px 0 12px">
        <label class="tut-checkbox-lbl">
          <input type="checkbox" id="tutNaoExibir" ${ocultar ? 'checked' : ''}>
          <span>Não exibir esta apresentação ao abrir o app</span>
        </label>
      </div>
      <div class="sheet-foot" style="flex-direction:column;gap:8px">
        <button class="btn primary block" id="tutBtnTour" type="button" style="padding:12px;font-size:1rem">Fazer tour pelo app 🚀</button>
        <button class="btn ghost block" id="tutBtnSolo" type="button" style="padding:10px">Explorar sozinho ☕</button>
      </div>
    `;

    lab.modal(html, (sheet) => {
      const chkNaoExibir = sheet.querySelector('#tutNaoExibir');
      const btnTour = sheet.querySelector('#tutBtnTour');
      const btnSolo = sheet.querySelector('#tutBtnSolo');

      btnTour.onclick = () => {
        s.config.ocultarBoasVindas = !!chkNaoExibir.checked;
        lab.save();
        abrirTutorial(0);
      };

      btnSolo.onclick = () => {
        s.config.ocultarBoasVindas = !!chkNaoExibir.checked;
        lab.save();
        lab.closeModal();
        lab.toast('Tudo bem! Quando quiser fazer o tour, é só ir em Mais > Tutorial de Primeiro Uso. Bom café!');
      };
    });
  }

  /* ---------------- Modal Sequencial do Tutorial (Passos 1 a 6) ---------------- */
  function abrirTutorial(etapaIdx) {
    const s = lab.state();
    let idx = Math.max(0, Math.min(ETAPAS.length - 1, etapaIdx || 0));

    function renderPasso(i) {
      idx = i;
      const etapa = ETAPAS[idx];
      const isUltimo = idx === ETAPAS.length - 1;
      const isPrimeiro = idx === 0;

      const html = `
        <div class="sheet-head">
          <div class="tut-step-badge">Tutorial · ${idx + 1} de ${ETAPAS.length}</div>
          <button class="btn sm ghost" id="tutFecharBtn" aria-label="Fechar">✕</button>
        </div>

        <div class="tut-progress-bar">
          <div class="tut-progress-fill" style="width:${((idx + 1) / ETAPAS.length) * 100}%"></div>
        </div>

        <div class="tut-step-content">
          <div class="tut-breadcrumb">
            <span class="tut-bc-ico">📍</span>
            <span>${etapa.caminho}</span>
          </div>

          <h3 class="tut-title">${etapa.titulo}</h3>

          <div class="tut-mockup-wrapper">
            ${etapa.mockup}
          </div>

          <div class="tut-pingo-box" style="margin-top:12px">
            ${cardPingo(etapa.humor, etapa.texto, { size: 76, compacto: true })}
          </div>
        </div>

        <div class="tut-dots">
          ${ETAPAS.map((_, dIdx) => `<button type="button" class="tut-dot ${dIdx === idx ? 'on' : ''}" data-goto="${dIdx}" aria-label="Ir para etapa ${dIdx + 1}"></button>`).join('')}
        </div>

        <div class="sheet-foot tut-actions">
          <button class="btn ghost sm" id="tutPularBtn" type="button">Pular</button>
          <div style="display:flex;gap:8px;margin-left:auto">
            <button class="btn sm" id="tutVoltarBtn" type="button" ${isPrimeiro ? 'disabled' : ''}>← Voltar</button>
            <button class="btn sm primary" id="tutAvancarBtn" type="button">${isUltimo ? 'Bora extrair café! 🎉' : 'Próximo →'}</button>
          </div>
        </div>
      `;

      lab.modal(html, (sheet) => {
        const btnFechar = sheet.querySelector('#tutFecharBtn');
        const btnPular = sheet.querySelector('#tutPularBtn');
        const btnVoltar = sheet.querySelector('#tutVoltarBtn');
        const btnAvancar = sheet.querySelector('#tutAvancarBtn');

        btnFechar.onclick = () => {
          lab.closeModal();
        };

        btnPular.onclick = () => {
          s.config.ocultarBoasVindas = true;
          lab.save();
          lab.closeModal();
          lab.toast('Tour pausado. Você pode rever a qualquer momento em Mais > Tutorial de Primeiro Uso.');
        };

        btnVoltar.onclick = () => {
          if (idx > 0) renderPasso(idx - 1);
        };

        btnAvancar.onclick = () => {
          if (isUltimo) {
            s.config.ocultarBoasVindas = true;
            lab.save();
            lab.closeModal();
            lab.toast('🎉 Parabéns! Você completou o tour. Bons cafés e ótimas extrações!');
          } else {
            renderPasso(idx + 1);
          }
        };

        sheet.querySelectorAll('.tut-dot').forEach((dot) => {
          dot.onclick = () => {
            const dest = parseInt(dot.dataset.goto, 10);
            if (!isNaN(dest) && dest !== idx) renderPasso(dest);
          };
        });
      });
    }

    renderPasso(idx);
  }

  /* ---------------- Hooks de Integração ---------------- */
  // 1. Abertura automática ao carregar o app (se não tiver desmarcado e estiver na tela inicial)
  lab.hooks.boot.push(() => {
    const s = lab.state();
    const h = location.hash.replace(/^#\/?/, '') || 'inicio';
    if (!s.config.ocultarBoasVindas && (h === 'inicio' || !h)) {
      setTimeout(() => {
        abrirBoasVindas(false);
      }, 350);
    }
  });

  // 2. Atalho permanente no menu Mais (#/mais)
  lab.hooks.mais.push(() => `
    <div class="item" onclick="(window.CafeTutorial && window.CafeTutorial.abrirTutorial) ? window.CafeTutorial.abrirTutorial(0) : (location.hash='#/tutorial')">
      <div class="ico">🎓</div>
      <div>
        <div class="t">Tutorial de primeiro uso</div>
        <div class="s">Reveja o tour pelas principais funções com o Pingo</div>
      </div>
      <div>›</div>
    </div>
  `);

  // 3. Atalho na tela de Backup e Ajustes (#/ajustes)
  lab.hooks.ajustes.push((el) => {
    if (!el) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginTop = '12px';
    card.innerHTML = `
      <h3>Guia e boas-vindas</h3>
      <p class="text-2">Reveja a apresentação das principais funcionalidades do app com o mascote Pingo.</p>
      <button class="btn" id="btnReverTutorial" type="button">🎓 Rever apresentação e tutorial</button>
    `;
    el.appendChild(card);
    card.querySelector('#btnReverTutorial').onclick = () => abrirBoasVindas(true);
  });

  // 4. Rotas diretas por URL hash (#/tutorial e #/boas-vindas)
  lab.routes.tutorial = (view, r) => {
    lab.routes.inicio(view, r);
    const etapa = parseInt((r.q && r.q.etapa) || 0, 10);
    setTimeout(() => abrirTutorial(etapa), 50);
  };
  lab.routes['boas-vindas'] = (view, r) => {
    lab.routes.inicio(view, r);
    setTimeout(() => abrirBoasVindas(true), 50);
  };

  window.CafeTutorial = {
    abrirBoasVindas,
    abrirTutorial,
    ETAPAS
  };
})();
