# Arquitetura técnica — Rio Flight 0.1

Este documento explica cada módulo e as equações do modelo. A versão inicial não tenta reproduzir um FSTD certificado: equilibra custo computacional, clareza da implementação e respostas plausíveis aos comandos.

## 1. Escolhas de engenharia

- **HTML, CSS, JavaScript ES Modules:** arquivos servidos diretamente por HTTP, sem compilação, backend ou chave de API. Isso reduz a superfície operacional do GitHub Pages.
- **Three.js 0.180.0:** renderizador WebGL acessado por importação dinâmica de CDN com fallback de provedor. As APIs públicas de geometria, materiais, luzes e instancing bastam para o primeiro marco.
- **Separação de responsabilidades:** `physics.js` não conhece DOM nem Three.js; `world.js` contém projeção geográfica, amostragem de solo e geração do cenário; `main.js` traduz entradas, integra a simulação e mostra a saída.
- **Passo de física fixo:** acumulador com `dt = 1/60 s` e máximo de 0,15 s de atraso. Variações de FPS não mudam arbitrariamente a sequência de integração; atrasos grandes são descartados para evitar a “espiral da morte”.
- **Geometrias instanciadas:** edifícios compartilham geometria e material, reduzindo o número de chamadas de desenho para bairros inteiros.
- **Texturas geradas localmente:** canvas desenha ruído, juntas no piso e ondulações, criando texturas de 2048 px reproduzíveis; o uso de fotografias não autorizadas foi evitado.
- **Projeção local:** metros aproximados com centro geográfico fixo; não usar esta aproximação para percursos intercontinentais.

## 2. Sistema de coordenadas

O motor usa metros, com **X para leste**, **Y para cima** e **Z para sul**. Assim, proa 0° aponta para o norte, ou `-Z`; proa 90° aponta para o leste, ou `+X`.

Com latitude `φ`, longitude `λ`, origem `φ₀, λ₀` em graus e raio linear aproximado `M = 111320 m/grau`:

```text
x = (λ − λ₀) × M × cos(φ₀)
z = −(φ − φ₀) × M
```

A conversão inversa é `φ = φ₀ − z/M` e `λ = λ₀ + x/(M cos φ₀)`. Ela preserva distâncias localmente, mas distorce escalas à medida que se afasta da origem.

## 3. Equações simplificadas de voo

`physics.js` define cada aeronave por massa `m`, área alar `S`, potência representada por empuxo disponível `T_max`, coeficientes aerodinâmicos, velocidades e limites.

### 3.1 Atmosfera, pressão dinâmica e ângulo de ataque

```text
ρ(h) = 1,225 × exp(−max(0,h) / 8500)     [kg/m³]
q    = 0,5 × ρ(h) × V²                    [Pa]
γ    = atan2(v_vertical, max(V, 5))       [rad]
α    = atitude_de_arfagem − γ + 0,018    [rad]
```

A equação de densidade é uma aproximação exponencial de atmosfera padrão, **não** um modelo meteorológico. O ângulo de ataque mede a orientação da asa em relação à trajetória; o termo 0,018 representa incidência simplificada.

### 3.2 Sustentação, estol e arrasto

```text
C_L = limitar(C_L0 + a × α + flap × 0,31, −0,8, C_Lmax)
L   = q × S × C_L
C_D = C_D0 + k × C_L² + trem × 0,016 + flap × 0,055
D   = q × S × C_D
```

Acima do ângulo crítico, o código reduz `C_L` gradualmente. Isso gera perda de sustentação e aviso de estol, sem afirmar representar dinâmica pós-estol real. Flaps aumentam sustentação e arrasto; trem estendido aumenta arrasto.

### 3.3 Translação e curva

```text
a_frente = (T − D − freio) / m − 9,81 × sin(γ)
a_vertical = (L × cos(rolagem))/m − 9,81
V_seguinte = limitar(V + a_frente × dt, 0, V_max × 1,16)
v_vertical_seguinte = limitar(v_vertical + a_vertical × dt, −95, 95)
d_proa/dt ≈ 9,81 × tan(rolagem) / max(V, 22) + comando_leme × 0,1
dx/dt = sin(proa) × V_horizontal + vento_X
dz/dt = −cos(proa) × V_horizontal + vento_Z
```

Os comandos de profundor e aileron alteram os ângulos por taxas limitadas e amortecidas. O passo de Euler explícito é suficientemente barato para a demonstração, mas um futuro modelo 6-DOF deve usar equações completas de forças/momentos, quaterniões e integrador mais robusto.

### 3.4 Contato com o solo

A altura do contato é `altura_amostrada + distância_do_centro_à_pista`. Velocidade vertical muito alta no toque aciona aviso de dano; freio é aplicado somente quando `onGround`. Há **apenas um contato agregado**, sem modelos individuais de pneus, suspensão, aderência ou colisão com edifícios.

## 4. Geografia e renderização

`world.js` combina contorno sul interpolado entre pontos, recorte aproximado da Baía de Guanabara e uma lagoa elíptica. O relevo usa soma de funções gaussianas:

```text
h(x,z) = h_base + Σ Hᵢ × exp(−2,35 × [
            ((x−xᵢ)/σxᵢ)² + ((z−zᵢ)/σzᵢ)² ])
```

Essa função **não representa um DEM real**. Os principais marcos usam coordenadas de referência aproximadas; a geometria do Cristo é construída de caixas e uma esfera. As texturas são geradas por Canvas, marcadas como sRGB, repetidas no material e filtradas anisotropicamente. Para a malha de terreno de 300 × 300 subdivisões, cada vértice guarda posição, cor e UV.

A aplicação representa SBRJ com duas pistas nas dimensões publicadas pelo DECEA; sua costa, seus pátios e os outros aeroportos **não** equivalem às cartas publicadas. Novos dados geográficos requerem licença, revisão e datas de validade.

## 5. Fluxo de execução

```text
documento HTML → carrega Three.js → cria cenário + aeronave
             → captura teclado/toque e configurações
             → requestAnimationFrame
                 → acumula tempo e integra stepFlight a 60 Hz
                 → atualiza posição e orientação do modelo 3D
                 → atualiza iluminação, câmera e áudio
                 → atualiza mapa/HUD a ~5,5 Hz
                 → desenha cena com WebGL
```

A simulação não emite dados para servidores próprios, nem tem perfil, contas ou rastreamento. Se uma página for hospedada com fontes e Three.js por CDN, esses provedores receberão solicitações normais do navegador.

## 6. Qualidade e testes

`npm run check` verifica a sintaxe de todos os módulos. `npm test` verifica parâmetros físicos, projeção e retorno geográfico, altitude dos aeródromos, pista SBRJ, terreno/água, limites de manete/proa, integridade do solo, passo inválido e determinismo de cenários idênticos.

O teste automatizado **não** substitui um ensaio gráfico em Chrome/Firefox/Safari com WebGL e não comprova fidelidade aerodinâmica. A CI deve passar antes da publicação via GitHub Pages.

## 7. Limitações deliberadas e próximos componentes

| Componente | Agora | Próxima evolução |
|---|---|---|
| Terreno | Equações e costa artística | DEM multirresolução com LOD |
| Aeródromos | Runways simplificadas | Dados certificados por versão |
| Aeronaves | Malhas nativas | Modelos detalhados licenciados e LOD |
| Física | Forças agregadas | 6-DOF e coeficientes medidos |
| Meteorologia | Presets visuais e vento constante | Ambiente dinâmico e turbulência |
| Instrumentação | HUD ilustrativo | Instrumentos de cabine 3D e navegação |
| Multiplayer | Não incluído | Backend dedicado com estado autoritativo |
| Testes | Unidade + sintaxe | End-to-end com screenshots, FPS e regressão |
