# RIO FLIGHT ✦

**Simulador de voo 3D, gratuito e executado integralmente no navegador.** O primeiro cenário é uma representação artística e navegável do Rio de Janeiro.

**Jogar:** https://3scud3r0.github.io/Flight-Simulator/ (a publicação depende de ativar o GitHub Pages em *Settings → Pages → Source: GitHub Actions*; o workflow está versionado em `.github/workflows/pages.yml`).

> **Escopo da versão 0.2:** protótipo jogável. A malha geográfica, o modelo de aeronave e a aerodinâmica são aproximados. Não é um simulador profissional, não reproduz procedimentos ou cartas vigentes e não serve para treinamento, planejamento ou navegação reais.

## Funcionalidades implementadas

- **Dois modos:** Voo Livre (sem placar, física convencional) e Desafio Aéreo (túnel de 14 argolas sobre o Rio, cronômetro de 3 minutos, combos de até 5×, bônus de velocidade e impulso arcade de 3,5 segundos por acerto).
- **Controle USB/Bluetooth:** Gamepad API com conexão/desconexão dinâmica, sticks analógicos, gatilhos, zona morta e opção de inverter arfagem; também funciona em navegadores móveis compatíveis com controle.
- **Celular:** manche virtual multitoque, manete, leme, flaps, trem, câmera, pausa e botão para abrir/fechar configurações, com layout adaptado a retrato/paisagem.
- **Recordes locais por aeronave:** armazenamento no próprio navegador, quando disponível, sem contas nem ranking online.
- Voo 3D com câmeras externa, cabine aproximada e torre; iluminação dinâmica de amanhecer a anoitecer, nuvens e névoa.
- Três aeronaves **inspiradas** em aviação geral, turboélice regional e jato comercial; são modelos 3D construídos no código, não réplicas de fabricantes.
- Três aeroportos simplificados: Santos Dumont (SBRJ), Galeão (SBGL) e Jacarepaguá (SBJR), com pistas, faixas, pátios e sinalização ilustrativa.
- Cenário procedural de ~63 × 63 km: litoral, montanhas, Baía de Guanabara aproximada, prédios instanciados, Pão de Açúcar e Cristo Redentor estilizados.
- Texturas geradas localmente pela própria aplicação no navegador: solo, água, areia, concreto e asfalto, até **2048 × 2048 pixels**. Não dependem de conta, chave de API ou downloads de fotografias de terceiros. Três.js e as fontes são distribuídos por CDN.
- Física determinística em passo fixo, gravidade, densidade atmosférica, sustentação, arrasto, potência, ângulo de ataque, perda de sustentação, rolagem, arfagem, guinada, vento lateral, flaps, trem, colisão simplificada com o terreno e frenagem em solo. **O impulso de pontuação altera a aceleração somente no modo arcade**, sem ser apresentado como física aeronáutica real.
- Instrumentos: velocidade em nós, altitude em pés, razão vertical, proa, manete, configuração e destino; minimapa e rumos.
- Controles de teclado e toque; áudio opcional sintetizado localmente; resolução ajustável, pausa, reinício, decolagem da pista.
- Testes automatizados sem dependências de desenvolvimento e workflow de publicação.

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
npm run check   # verifica a sintaxe dos três módulos JS
npm test        # executa a suíte node:test de física e geografia
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
