# Aetheria — Megamapa ficcional

Aetheria é **um segundo mundo**, isolado do Rio de Janeiro. É um mundo inteiramente inventado. Não reaproveita o terreno do Rio nem simula cidades reais. Não utiliza satélites, fotogrametria comercial, dados externos, credenciais ou downloads de mapas.

## Versão inicial jogável

- **20 regiões** contínuas em um atlas de aproximadamente **3.200 × 2.400 km**; o terreno é amostrado de forma determinística a partir de uma semente.
- **60 aeroportos fictícios** AE-01 a AE-60: 8 internacionais, 32 regionais e 20 locais especiais. Cada um recebe pista, marcações, luzes e volumes de terminais quando a aeronave se aproxima.
- Regiões: Borealis, Skadia, Nørdalen, Vértice, Lúmina, Virídia, Miragem, Eón, Calíope, Nova Íris, Auralis, Pelágia, Tempestária, Ferrum, Neon Prime, Sahr, Helion, Obsidiana, Kharon e Aether.
- Perfil de relevo por bioma: montanhas e geleiras, fiordes, savanas e florestas, ilha tropical e oceano, cânions, vulcão, desertos e bases polares. Fronteiras do relevo são suavizadas pela contribuição das duas regiões mais próximas.
- Skylines e arquitetura procedural por perfil urbano, vegetação por instâncias nas áreas apropriadas, rochedos suspensos **decorativos** na região fantástica de Aether.
- Voo Livre e Desafio Aéreo; instrumentos, aeronaves, teclado, controle e controles móveis permanecem utilizáveis. Records de desafio segregados por mundo.
- Navegação global simplificada: todos os aeroportos no seletor, salto rápido para as 20 regiões e minimapa de abrangência continental.
- O mundo fica em torno da aeronave por streaming; não são construídos os 7,68 milhões de km² ao mesmo tempo.

## Alternar mundos

No seletor **MUNDO / MAPA** ou na abertura, escolher **Rio de Janeiro** ou **Aetheria**. O Rio mantém seus três aeroportos e opções DEM/satélite. Aetheria não exibe opções de satélite do Rio.

URLs de entrada direta, quando GitHub Pages estiver publicado:

- Rio: `https://3scud3r0.github.io/Flight-Simulator/`
- Aetheria: `https://3scud3r0.github.io/Flight-Simulator/?world=aetheria`
- Aetheria leve: `https://3scud3r0.github.io/Flight-Simulator/?world=aetheria&safe=1`
- Rio leve: `https://3scud3r0.github.io/Flight-Simulator/?safe=1`

## Uso correto dos 180 algoritmos

A biblioteca em `src/engine/` fornece 180 núcleos numerados. O mundo utiliza funções de geração fractal, erosão/forma geológica aproximada, distribuição de biomas, amostragem atmosférica, vento tridimensional, decisões de infraestrutura e materiais procedurais. A física e o desafio continuam integrados pelo loop de voo do simulador. O streaming impõe limites de 9 tiles no celular/compatibilidade e 25 no desktop; até um novo tile é gerado a cada cinco quadros. Geometria e materiais são liberados ao sair da região.

**Não são executados todos os 180 algoritmos por quadro nem todos estão integrados a um efeito visual.** Várias funções são utilitários de preparação, geração, diagnóstico, áudio ou funções CPU que ainda precisariam de render passes WebGL, dados e testes de GPU. Executá-las sem necessidade tornaria o jogo instável. Aetheria é uma versão original procedural **jogável/experimental**, não conteúdo gráfico fotorrealista AAA já finalizado.

## Limites e fidelidade

As coordenadas AE são unidades fictícias locais em metros, não latitude/longitude WGS84. As pistas são ilustrativas, e suas distâncias não representam cartas aeronáuticas. A ilha suspensa é apenas visual e não entra no cálculo de colisão de terreno. Aproximações, turbulência e atmosfera são educativas: não certificadas nem adequadas à navegação. Os aeroportos distantes não têm edifícios renderizados até que a aeronave esteja perto. A tecnologia não requer armazenamento integral do mapa.

## Testes

```bash
npm run check
npm test
npm run test:aetheria
```

`tests/aetheria.test.mjs` cobre os 20 domínios, 60 aeroportos, categoria das pistas, relevo, nível das cabeceiras, determinismo, vento e desafio; `tests/aetheria-renderer.test.mjs` cobre o limite de tiles, geração progressiva e descarte de recursos por renderizador simulado. A validação visual WebGL real e os testes de desempenho em diferentes GPUs ainda dependem de execução em navegador.
