# Aetheria Compact — quatro regiões, quatro aeroportos

Aetheria deixou de ser o protótipo de **3.200 × 2.400 km e 60 pistas de baixo detalhe**. Agora é um cenário fictício e contínuo de **48 × 36 km**, com somente quatro regiões distintas e quatro pistas conectadas por voo direto. O Rio de Janeiro permanece uma opção independente.

| Região | Aeroporto | Foco de cenário |
|---|---|---|
| Nova Íris | AE-01 Nova Íris Internacional | Terminal, hangares CC0, área urbanizada costeira, pista 2.900 m |
| Auralis | AE-02 Auralis Costeiro | Ilha e baía tropical, vegetação, costa, pista 1.600 m |
| Vértice | AE-03 Vale Vértice | Montanhas e rochas, vegetação alpina, pista 1.650 m |
| Virídia | AE-04 Clareira Virídia | Selva, montanhas baixas, pista 1.150 m |

**Os códigos AE são fictícios.** O mapa usa metros locais, não coordenadas GPS ou cartas de navegação.

## O que mudou tecnicamente

O terreno completo usa blocos de **2,4 km**, em vez dos antigos blocos de 5,6 km; malha de **42 subdivisões por bloco** em desktop, 20 no celular e 14 no modo compatibilidade. O relevo muda de forma contínua nas divisas de biomas, com transição de aproximadamente 3,6 km, e cada aeroporto nivela também as duas cabeceiras e as laterais da pista. O limite de memória da versão completa continua sendo 25 blocos no desktop e 9 no celular.

As pistas receberam taxiways, pátios, posições de estacionamento, marcações de cabeceira e luzes. A arquitetura e a natureza nas proximidades utilizam modelos **Kenney CC0 em glTF**, baixados e verificados durante a publicação, com mapas PBR do **Poly Haven CC0**. Os modelos originais e as licenças são descritos em [ASSET_SOURCES.md](ASSET_SOURCES.md). Nada disso significa importar cenários protegidos de jogos comerciais.

A **Aetheria leve** continua independente do módulo avançado: abre mesmo se o download do módulo completo falhar. O Rio conserva seus três aeroportos, sua física e seu relevo opcional. A tecla **U** mostra apenas a simulação, ocultando toda a HUD.

## Acesso

- Rio: `https://3scud3r0.github.io/Flight-Simulator/`
- Aetheria completa: `https://3scud3r0.github.io/Flight-Simulator/?world=aetheria`
- Aetheria leve: `https://3scud3r0.github.io/Flight-Simulator/?world=aetheria-lite&safe=1`

## Testes e limites

```bash
npm run check
npm test
npm run test:browser
```

O teste do navegador usa Chromium com WebGL: voa no Rio e nas duas versões de Aetheria, aguarda carregar modelos glTF reais, muda de região, testa a HUD, retorna ao Rio e simula indisponibilidade do módulo completo. A publicação só ocorre depois desse teste.

**Isto é um protótipo de aviação com recursos 3D importados, não um jogo AAA.** O número de algoritmos não é uma medida de fidelidade visual. A versão compacta privilegia locais exploráveis em vez de enormes áreas vazias; ainda faltam estradas detalhadas, tráfego convincente, aeroportos de nível profissional, pós-processamento e revisão artística em diferentes GPUs.
