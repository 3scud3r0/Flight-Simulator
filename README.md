# Flight Simulator — Ilhas de Aurora

**Aurora é o mundo principal.** Um arquipélago fictício original de 12 × 10 km com cinco ilhas, aeródromo costeiro AU-01, Vila da Enseada, Ponte dos Arcos, Farol do Leste e vegetação instanciada. Voo livre e desafio de argolas funcionam com a pilotagem refinada, câmeras, controles por teclado, toque e gamepad. A altura usada pelo avião e pela malha visual vem da mesma função determinística; a pista é nivelada em toda a extensão.

**Jogar:** https://3scud3r0.github.io/Flight-Simulator/?world=aurora (após a publicação da branch). **Localmente:** `python3 -m http.server 8000` e abra `http://localhost:8000/?world=aurora`. A biblioteca Three.js é fornecida pelo workflow de publicação; em desenvolvimento sem `vendor/`, o navegador tenta CDNs.

Rio, Aetheria completa e Aetheria Lite seguem selecionáveis. Seus módulos de mapa ficam em `src/legacy/`, inclusive o renderizador Lite antes embutido no código principal. Os módulos de física, aeronaves, HUD e motor numérico continuam compartilhados.

A opção **Pilotagem refinada** é padrão e usa controle amortecido, resposta conforme a velocidade, rotação na decolagem, efeito de solo, pouso e simulação em subpassos. O modelo experimental de seis graus de liberdade continua opcional. São aproximações lúdicas, sem certificação aeronáutica.

## Verificação

- `npm run check`: sintaxe dos módulos.
- `npm test`: suíte numérica e de integração.
- `npm run proof:aurora`: navegador Chromium com WebGL real, valida carregamento e captura `proof/aurora-real.png`. Requer Playwright 1.55, Chromium e Three.js local em `vendor/` ou acesso ao CDN. O script abre e encerra seu próprio servidor local.
- `npm run test:browser`: fluxo completo de Aurora, Rio e Aetheria no navegador, com capturas em `proof/`; o workflow de CI prepara bibliotecas e modelos CC0.

**Limite visual:** Aurora usa geometria e materiais procedurais e ainda requer arte, áudio, animação, otimização de GPU e validação em dispositivos variados para alcançar padrão de produção triplo A. A imagem em `proof/aurora-real.png` é uma captura da implementação, não uma imagem conceitual.

---


**Simulador de voo 3D para navegador.** O Rio de Janeiro pode utilizar DEM verdadeiro + imagens orbitais quando o serviço responde; sem esses dados, há um cenário artístico de reserva. Fotogrametria urbana real ainda não está incluída.

**Jogar:** https://3scud3r0.github.io/Flight-Simulator/ (a publicação depende de ativar o GitHub Pages em *Settings → Pages → Source: GitHub Actions*; o workflow está versionado em `.github/workflows/pages.yml`).

> **Escopo da versão 0.3.1:** protótipo experimental, não certificado. O modelo 6-DOF é uma aproximação sem validação por dados de ensaio. Altitudes, cartas, cenários e aeronaves não servem para navegação, treinamento ou planejamento real.

## Funcionalidades implementadas

- **Dois modos:** Voo Livre (sem placar, física convencional) e Desafio Aéreo (túnel de 14 argolas sobre o Rio, cronômetro de 3 minutos, combos de até 5×, bônus de velocidade e impulso arcade de 3,5 segundos por acerto).
- **Controle USB/Bluetooth:** Gamepad API com conexão/desconexão dinâmica, sticks analógicos, gatilhos, zona morta e opção de inverter arfagem; também funciona em navegadores móveis compatíveis com controle.
- **Celular:** manche virtual multitoque, manete, leme, flaps, trem, câmera, pausa e botão para abrir/fechar configurações, com layout adaptado a retrato/paisagem.
- **Recordes locais por aeronave:** armazenamento no próprio navegador, quando disponível, sem contas nem ranking online.
- Voo 3D com câmeras externa, cabine aproximada e torre; iluminação dinâmica de amanhecer a anoitecer, nuvens e névoa.
- Três aeronaves **inspiradas** em aviação geral, turboélice regional e jato comercial; são modelos 3D construídos no código, não réplicas de fabricantes.
- Três aeroportos simplificados: Santos Dumont (SBRJ), Galeão (SBGL) e Jacarepaguá (SBJR), com pistas, faixas, pátios e sinalização ilustrativa.
- Terreno real opcional por tiles Mapzen Terrarium carregados gradualmente; imagens orbitais Sentinel-2 EOX (uso não comercial sob a licença do provedor) ou MapTiler com chave pública própria. Quando a rede falha, o terreno artístico de reserva continua disponível. Não é fotogrametria.
- Texturas da cena de reserva sintetizadas localmente em **512 × 512** no computador, **256 × 256** no celular e **128 × 128** no Modo Compatibilidade. Imagens reais são baixadas progressivamente em blocos pequenos e podem não estar disponíveis em redes restritas. Three.js e fontes usam serviços externos.
- Física determinística em passo fixo, gravidade, densidade atmosférica, sustentação, arrasto, potência, ângulo de ataque, perda de sustentação, rolagem, arfagem, guinada, vento lateral, flaps, trem, colisão simplificada com o terreno e frenagem em solo. **O impulso de pontuação altera a aceleração somente no modo arcade**, sem ser apresentado como física aeronáutica real.
- Instrumentos: velocidade em nós, altitude em pés, razão vertical, proa, manete, configuração e destino; minimapa e rumos.
- Controles de teclado e toque; áudio opcional sintetizado localmente; resolução ajustável, pausa, reinício, decolagem da pista.
- Testes automatizados sem dependências de desenvolvimento e workflow de publicação.

## Carregamento e Modo Compatibilidade

A versão 0.3.1 prioriza a primeira imagem e a resposta dos botões. O terreno sintético inicial foi reduzido de 300 × 300 para 96 × 96 subdivisões em desktop, 64 × 64 no celular e 32 × 32 no Modo Compatibilidade. A geração de textura também foi reduzida, o número de edifícios/nuvens foi limitado e o shader de oceano agora só é criado ao selecionar **Gráficos → Alta qualidade** em computador.

A elevação real não bloqueia a inicialização: o jogo solicita blocos somente após desenhar o cenário e inicia com até nove tiles próximos, com no máximo dois downloads simultâneos em desktop e um no celular. As imagens satelitais carregam separadamente das alturas; requisições com problemas têm timeout e a cena de reserva permanece disponível quando não há DEM suficiente.

**Para dispositivos lentos ou tela de carregamento**, abra:
https://3scud3r0.github.io/Flight-Simulator/?safe=1

Esse endereço desativa terreno remoto e shaders opcionais, reduz geometria e texturas e usa a física clássica. Ainda requer WebGL e conexão com pelo menos um CDN do Three.js. Há também um link permanente no menu inicial para entrar no Modo Compatibilidade.

**Se a URL mostrar 404**, não é desempenho: o GitHub Pages ainda pode precisar ser ativado em Settings → Pages → GitHub Actions e o workflow precisa terminar com sucesso. Veja Actions para erros. Não confunda ausência de publicação com falha da aplicação.

## Executar localmente

O projeto **não exige instalação de bibliotecas por npm** para executar, mas, por segurança, abra via servidor HTTP local em vez de `file://`:

```bash
git clone https://github.com/3scud3r0/Flight-Simulator.git
cd Flight-Simulator
python3 -m http.server 8000
```

Abra http://localhost:8000. É necessária uma conexão à internet para carregar a biblioteca Three.js e as fontes; a aplicação tenta jsDelivr e, como alternativa, unpkg. São recomendados navegador moderno com WebGL habilitado, GPU dedicada/integrada recente e teclado.

### Testar

Com Node.js 20+:

```bash
npm run check   # verifica a sintaxe de todos os módulos JS
npm test        # executa testes node:test de física, geografia, controle e desafio
```

## Controles

| Tecla | Ação |
|---|---|
| W / ↑ | Arfagem positiva, elevar o nariz |
| S / ↓ | Arfagem negativa, baixar o nariz |
| A / ← e D / → | Rolar para esquerda / direita |
| Q / E | Leme para esquerda / direita |
| + / − | Aumentar / reduzir potência |
| F | Ciclar flaps: 0%, 50%, 100% |
| G | Recolher / estender trem |
| B ou Espaço | Freios no solo |
| V | Ciclar câmeras |
| P | Pausar |
| R | Reiniciar voo panorâmico |
| M | Mostrar / ocultar mapa |
| H | Ajuda |
| C | Alternar Voo Livre / Desafio |

**Para decolar:** selecione aeronave e aeroporto, clique em **Decolar da pista**, aumente gradualmente a potência com **+** e, ao atingir a velocidade de rotação daquela aeronave, use **W**. O modelo responde à massa, área da asa, potência e velocidade; é necessário manter velocidade suficiente para sustentar o voo.

## Modos de jogo, pontuação e comandos alternativos

### Voo Livre

Comece no ar ou escolha **Decolar da pista**; não há cronômetro nem pontuação. Escolha aeronave, aeroporto e condições meteorológicas. Os pontos de interesse permanecem disponíveis no minimapa.

### Desafio Aéreo

Na tela inicial, clique em **Iniciar Desafio de Argolas** ou, no painel lateral, em **Iniciar Desafio Aéreo**. As 14 argolas conectadas por trilhos luminosos formam um percurso 3D no céu. Passe **no sentido do voo e por dentro** do círculo: recebe 100 pontos básicos + pontos proporcionais à velocidade em nós, +75 ao superar 100 nós ou +125 acima de 160 nós, multiplicados por um combo de até 5×. Cada acerto disponibiliza um impulso automático de até 3,5 segundos, com aceleração adicional arcade; errar uma argola zera o combo. O jogo se encerra ao passar todas as argolas, esgotar 3 minutos ou ocorrer colisão grave. Pode reiniciar ou voltar ao Voo Livre.

Os recordes são individuais **por aeronave e por navegador/dispositivo**: gravados em `localStorage`, se o navegador permitir. Não existe ranking online ou sincronização de contas.

### Controle USB/Bluetooth

Conecte o controle no sistema operacional (USB, Bluetooth ou equivalente), abra o jogo no navegador e **aperte um botão** para o navegador reconhecer o dispositivo. Use a caixa **Controle USB / Bluetooth** para verificar o estado, desabilitar o controle ou inverter o eixo de arfagem. O site **não emparelha dispositivos Bluetooth por conta própria**; depende do navegador e do sistema operacional. Mapeamento padrão dos controles tipo Xbox/PlayStation:

| Comando no controle | Ação |
|---|---|
| Analógico esquerdo (X/Y) | Rolagem e arfagem |
| Analógico direito (X) | Leme |
| RT / R2 e LT / L2 | Aumentar e reduzir potência |
| Direcional ↑ / ↓ | Aumentar e reduzir potência |
| LB / L1 | Freios (segurar) |
| A / ✕ | Iniciar ou reiniciar desafio |
| B / ○ | Trem de pouso |
| X / □ | Flaps |
| Y / △ | Câmera |
| Start / Options | Pausa |
| Select / Share | Ajuda |

Controles com mapeamento não padronizado podem apresentar comandos diferentes. Consulte a [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API) para compatibilidade no navegador e no sistema operacional.

### Jogar no celular

Abra a URL do Pages diretamente no Chrome, Safari ou outro navegador móvel com WebGL. Arraste o círculo do **manche virtual**: para os lados para rolar e para baixo para elevar o nariz. Use o deslizante de potência e os botões de leme, câmera, pausa, trem e flaps. Toque em **☰** para abrir a configuração e selecionar o modo, e considere girar o aparelho para paisagem. Em celulares com baixo desempenho, selecione **Gráficos → Econômico**. Um controle Bluetooth também pode funcionar se for exposto pelo navegador via Gamepad API.

## Estrutura

```text
index.html                  Interface e controles acessíveis
styles.css                  Design responsivo e HUD
src/physics.js              Aeronaves, estado e integração da física
src/world.js                Coordenadas, topografia, aeroportos, texturas, edifícios
src/main.js                 Three.js, câmera, entrada, som, HUD, renderização
src/challenge.js            Regras puras do percurso e pontuação
src/course-renderer.js      Túneis/argolas 3D, materiais e descarte de GPU
src/gamepad.js              Adaptação da Gamepad API
tests/physics.test.mjs      Testes determinísticos
tests/challenge.test.mjs    Testes de colisão, cronômetro e controle
.github/workflows/pages.yml Testes e publicação no Pages
docs/ARCHITECTURE.md        Explicação de arquitetura, fórmulas e limitações
```

## GitHub Pages

1. Abra **Settings → Pages** no repositório.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. Abra **Actions → Testes e publicação no GitHub Pages** e execute **Run workflow** se não houver uma execução posterior à ativação.
4. Aguarde a conclusão verde do job de publicação. A URL será https://3scud3r0.github.io/Flight-Simulator/.

O arquivo de workflow valida o código, executa os testes e publica arquivos estáticos em cada push na branch `main`. A ativação inicial do serviço exige a configuração de Pages na conta que administra o repositório; o `GITHUB_TOKEN` padrão não pode ativá-lo automaticamente. Veja a [documentação do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Precisão e dados

As posições de referência geográfica usam projeção equiretangular local; não há ortofotos, edificações cadastrais completas, elevação DEM aferida, solo fotogramétrico, ATC, meteorologia real ou FMS. A pista 02R/20L do Santos Dumont é representada com 1323 × 42 m e a 02L/20R com 1260 × 30 m, conforme [eAIP do DECEA](https://aisweb.decea.mil.br/eaip/). **Outras geometrias de aeroportos e posições visuais são aproximadas**; consulte publicações aeronáuticas oficiais para informações reais.

As texturas são sintetizadas proceduralmente: dispensam licenciamento de ortofotos e evitam solicitações massivas a servidores de mapas. Imagens de terceiros só deverão ser incorporadas quando forem verificadas licença, atribuição, resolução, origem e permissões de redistribuição.

## Próximas etapas sugeridas

1. **Dados reais de terreno:** gerar tiles quantizados a partir de DEM com licença compatível, costa validada, malha de aeródromos e LOD por quadrantes.
2. **Visual fotorrealista:** streaming de ortofotos licenciadas, texturas PBR, nuvens volumétricas, prédios por OpenStreetMap com atribuição, impostores e occlusion culling.
3. **Física:** integração rígida de seis graus de liberdade, tabelas aerodinâmicas por aeronave, torque e modelo de hélice, curvas de motor, superfícies por velocidade, solo e vento com turbulência.
4. **Aviação:** cartas e dados sob licença, pistas/táxis detalhados, iluminação, instrumentos, procedimentos e navegação. Nunca distribuir dados de aviação como atuais sem sua verificação.
5. **Produto:** telemetria, missões, salvamento local, controles configuráveis, gamepad, testes E2E visuais, acessibilidade e orçamentos de performance.

## Contribuições

Abra uma issue com problema reproduzível, navegador, GPU, captura de tela e passos. Pull requests devem manter a lógica de física separada da renderização, passar `npm run check` e `npm test`, e documentar fontes/licenças de novos assets.

**Licença do código:** MIT. Marcas, nomes de aeroportos e referências aeronáuticas são apenas descritivos.
