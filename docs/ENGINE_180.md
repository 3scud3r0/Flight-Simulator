# Engenharia do motor — 180 algoritmos, sem mapa

**Estado:** 180 núcleos de algoritmo exportados e numerados, organizados em 11 domínios. Esta entrega **não cria cenários** e **não conecta automaticamente tudo ao jogo atual**. Os módulos são ES Modules independentes de mapas. `src/engine/index.js` disponibiliza o catálogo e todas as categorias.

## Limites declarados

- **Implementado:** funções e estruturas algorítmicas, como simulação numérica de erosão, criação de malha, quadtree/octree limitadas, FFT 2D, aerodinâmica simplificada, controle PID/LQR, IA de caminhos e controle de qualidade.
- **Não implementado como produto AAA:** render passes e shaders completos de SSR/SSAO/nuvens volumétricas, materiais compilados para GPU, streaming de centenas de gigabytes, pipelines de áudio finais, conteúdo artístico autoral em padrão comercial, otimização/compatibilidade medida em aparelhos físicos e dados aerodinâmicos validados para cada aeronave. As funções dessas categorias são **núcleos de computação/configuração**, não efeitos visuais já integrados.
- **Segurança e fidelidade:** todos os modelos de voo são **educativos/experimentais**. Nunca para treinamento, certificação ou navegação reais. Não existe pretensão de que funções CPU isoladas, por si sós, entreguem qualidade visual de um jogo AAA.
- **Isolamento:** esta biblioteca não é importada por `src/main.js`; portanto, não piora o carregamento inicial do simulador existente. A integração será feita somente quando for definido o universo fictício e houver orçamento de desempenho para cada subsistema.

## Uso

```js
import {
  Generation, Water, Dynamics, Performance, getAlgorithm, catalog
} from "./src/engine/index.js";

const altitude = Generation.fractalBrownianMotion(1.5, 3.2, { seed: 123 });
const ocean = Water.gerstnerWaves(10, 40, 12, [
  { dx: 1, dz: .3, wavelength: 90, amplitude: 1.4, speed: 2 }
]);
const coefficient = Dynamics.aeroCoefficientModel(.08, 0);
const resolution = Performance.adaptiveResolution(1, 26);
console.log(catalog.length, getAlgorithm("A001").name);
```

**Convenções:** metros, segundos, quilogramas e radianos, salvo indicação contrária; X=leste, Y=alto, Z=sul. Os arrays de alturas são `Float32Array` em ordem linha-major, quando aplicável. A física usa orientação quaternional. Números de algoritmo são estáveis entre mapas.

## Validação e desempenho

```bash
npm run check
npm test
npm run test:engine
```

Testes cobrem contagem e unicidade do catálogo, perlin/fractais, erosão, malha tetraédrica, LOD, política de memória, fila assíncrona, materiais, Sol, atmosfera, FFT, quaterniões, RK4, sustentação/arrasto, contato, LQR, malha de aeronave, A*, replay, qualidade adaptativa e recuperação de erros. Os limites de memória/trabalho nas funções críticas são intencionais. Testes em GPU/dispositivos reais continuam pendentes.

## Índice exato A001–A180

### Geologia, erosão e geometria (1–20)

Módulo: `src/engine/generation.js`.

| ID | Função | Escopo |
|---|---|---|
| A001 | `perlin2()` | Núcleo testável; integração com mundo/renderizador posterior |
| A002 | `simplex2()` | Núcleo testável; integração com mundo/renderizador posterior |
| A003 | `fractalBrownianMotion()` | Núcleo testável; integração com mundo/renderizador posterior |
| A004 | `ridgedMultifractal()` | Núcleo testável; integração com mundo/renderizador posterior |
| A005 | `domainWarp()` | Núcleo testável; integração com mundo/renderizador posterior |
| A006 | `tectonicUplift()` | Núcleo testável; integração com mundo/renderizador posterior |
| A007 | `voronoiGeology()` | Núcleo testável; integração com mundo/renderizador posterior |
| A008 | `hydraulicErosion()` | Núcleo testável; integração com mundo/renderizador posterior |
| A009 | `thermalErosion()` | Núcleo testável; integração com mundo/renderizador posterior |
| A010 | `aeolianErosion()` | Núcleo testável; integração com mundo/renderizador posterior |
| A011 | `depositSediment()` | Núcleo testável; integração com mundo/renderizador posterior |
| A012 | `riverFlowDirection()` | Núcleo testável; integração com mundo/renderizador posterior |
| A013 | `watershedBasins()` | Núcleo testável; integração com mundo/renderizador posterior |
| A014 | `glacierProfile()` | Núcleo testável; integração com mundo/renderizador posterior |
| A015 | `volcanicCaldera()` | Núcleo testável; integração com mundo/renderizador posterior |
| A016 | `caveDensity()` | Núcleo testável; integração com mundo/renderizador posterior |
| A017 | `marchingCubesTetrahedra()` | Núcleo testável; integração com mundo/renderizador posterior |
| A018 | `dualContourCell()` | Núcleo testável; integração com mundo/renderizador posterior |
| A019 | `signedDistanceSphere()` | Núcleo testável; integração com mundo/renderizador posterior |
| A020 | `biomeWeights()` | Núcleo testável; integração com mundo/renderizador posterior |

### LOD, visibilidade e streaming (21–40)

Módulo: `src/engine/streaming.js`.

| ID | Função | Escopo |
|---|---|---|
| A021 | `quadtree()` | Núcleo testável; integração com mundo/renderizador posterior |
| A022 | `octree()` | Núcleo testável; integração com mundo/renderizador posterior |
| A023 | `geometryClipmap()` | Núcleo testável; integração com mundo/renderizador posterior |
| A024 | `continuousLOD()` | Núcleo testável; integração com mundo/renderizador posterior |
| A025 | `screenSpaceError()` | Núcleo testável; integração com mundo/renderizador posterior |
| A026 | `geomorph()` | Núcleo testável; integração com mundo/renderizador posterior |
| A027 | `stitchTileSkirt()` | Núcleo testável; integração com mundo/renderizador posterior |
| A028 | `frustumCullSphere()` | Núcleo testável; integração com mundo/renderizador posterior |
| A029 | `occlusionCull()` | Núcleo testável; integração com mundo/renderizador posterior |
| A030 | `hierarchicalZBuffer()` | Núcleo testável; integração com mundo/renderizador posterior |
| A031 | `packInstances()` | Núcleo testável; integração com mundo/renderizador posterior |
| A032 | `indirectDrawCommands()` | Núcleo testável; integração com mundo/renderizador posterior |
| A033 | `spatialStreamQueue()` | Núcleo testável; integração com mundo/renderizador posterior |
| A034 | `predictivePrefetch()` | Núcleo testável; integração com mundo/renderizador posterior |
| A035 | `memoryBudget()` | Núcleo testável; integração com mundo/renderizador posterior |
| A036 | `disposeResources()` | Núcleo testável; integração com mundo/renderizador posterior |
| A037 | `boundedWorkerPool()` | Núcleo testável; integração com mundo/renderizador posterior |
| A038 | `originRebase()` | Núcleo testável; integração com mundo/renderizador posterior |
| A039 | `splitDouble()` | Núcleo testável; integração com mundo/renderizador posterior |
| A040 | `prioritizedWork()` | Núcleo testável; integração com mundo/renderizador posterior |

### Materiais e texturização (41–55)

Módulo: `src/engine/materials.js`.

| ID | Função | Escopo |
|---|---|---|
| A041 | `materialByBiome()` | Núcleo testável; integração com mundo/renderizador posterior |
| A042 | `pbrMaterial()` | Núcleo testável; integração com mundo/renderizador posterior |
| A043 | `normalMapFromHeight()` | Núcleo testável; integração com mundo/renderizador posterior |
| A044 | `parallaxOcclusion()` | Núcleo testável; integração com mundo/renderizador posterior |
| A045 | `triplanarWeights()` | Núcleo testável; integração com mundo/renderizador posterior |
| A046 | `textureSplat()` | Núcleo testável; integração com mundo/renderizador posterior |
| A047 | `virtualTexturePages()` | Núcleo testável; integração com mundo/renderizador posterior |
| A048 | `anisotropicLevel()` | Núcleo testável; integração com mundo/renderizador posterior |
| A049 | `projectedDecal()` | Núcleo testável; integração com mundo/renderizador posterior |
| A050 | `wetnessMaterial()` | Núcleo testável; integração com mundo/renderizador posterior |
| A051 | `snowAccumulation()` | Núcleo testável; integração com mundo/renderizador posterior |
| A052 | `microdetailBlend()` | Núcleo testável; integração com mundo/renderizador posterior |
| A053 | `seasonalVegetation()` | Núcleo testável; integração com mundo/renderizador posterior |
| A054 | `ecologicalSpecies()` | Núcleo testável; integração com mundo/renderizador posterior |
| A055 | `impostorSelection()` | Núcleo testável; integração com mundo/renderizador posterior |

### Iluminação e atmosfera (56–74)

Módulo: `src/engine/lighting.js`.

| ID | Função | Escopo |
|---|---|---|
| A056 | `solarEphemeris()` | Núcleo testável; integração com mundo/renderizador posterior |
| A057 | `lunarEphemeris()` | Núcleo testável; integração com mundo/renderizador posterior |
| A058 | `rayleighScattering()` | Núcleo testável; integração com mundo/renderizador posterior |
| A059 | `mieScattering()` | Núcleo testável; integração com mundo/renderizador posterior |
| A060 | `multipleScattering()` | Núcleo testável; integração com mundo/renderizador posterior |
| A061 | `aerialPerspective()` | Núcleo testável; integração com mundo/renderizador posterior |
| A062 | `volumetricFogRay()` | Núcleo testável; integração com mundo/renderizador posterior |
| A063 | `volumetricLightBeam()` | Núcleo testável; integração com mundo/renderizador posterior |
| A064 | `cascadedShadowSplits()` | Núcleo testável; integração com mundo/renderizador posterior |
| A065 | `contactShadows()` | Núcleo testável; integração com mundo/renderizador posterior |
| A066 | `screenSpaceAmbientOcclusion()` | Núcleo testável; integração com mundo/renderizador posterior |
| A067 | `screenSpaceReflectionRay()` | Núcleo testável; integração com mundo/renderizador posterior |
| A068 | `imageBasedLighting()` | Núcleo testável; integração com mundo/renderizador posterior |
| A069 | `automaticExposure()` | Núcleo testável; integração com mundo/renderizador posterior |
| A070 | `acesTonemap()` | Núcleo testável; integração com mundo/renderizador posterior |
| A071 | `selectiveBloom()` | Núcleo testável; integração com mundo/renderizador posterior |
| A072 | `cityNightLights()` | Núcleo testável; integração com mundo/renderizador posterior |
| A073 | `aviationLightPhase()` | Núcleo testável; integração com mundo/renderizador posterior |
| A074 | `airportLighting()` | Núcleo testável; integração com mundo/renderizador posterior |

### Nuvens e meteorologia (75–92)

Módulo: `src/engine/weather.js`.

| ID | Função | Escopo |
|---|---|---|
| A075 | `cloudRaymarch()` | Núcleo testável; integração com mundo/renderizador posterior |
| A076 | `worleyPerlinCloud()` | Núcleo testável; integração com mundo/renderizador posterior |
| A077 | `cloudWeatherMap()` | Núcleo testável; integração com mundo/renderizador posterior |
| A078 | `temporalReprojection()` | Núcleo testável; integração com mundo/renderizador posterior |
| A079 | `cloudShadowMap()` | Núcleo testável; integração com mundo/renderizador posterior |
| A080 | `cumulonimbusProfile()` | Núcleo testável; integração com mundo/renderizador posterior |
| A081 | `evolveCloudCover()` | Núcleo testável; integração com mundo/renderizador posterior |
| A082 | `thermalLapseRate()` | Núcleo testável; integração com mundo/renderizador posterior |
| A083 | `internationalStandardAtmosphere()` | Núcleo testável; integração com mundo/renderizador posterior |
| A084 | `threeDimensionalWind()` | Núcleo testável; integração com mundo/renderizador posterior |
| A085 | `windShear()` | Núcleo testável; integração com mundo/renderizador posterior |
| A086 | `correlatedGust()` | Núcleo testável; integração com mundo/renderizador posterior |
| A087 | `orographicTurbulence()` | Núcleo testável; integração com mundo/renderizador posterior |
| A088 | `thermalUpdraft()` | Núcleo testável; integração com mundo/renderizador posterior |
| A089 | `precipitationIntensity()` | Núcleo testável; integração com mundo/renderizador posterior |
| A090 | `airframeIcing()` | Núcleo testável; integração com mundo/renderizador posterior |
| A091 | `meteorologicalVisibility()` | Núcleo testável; integração com mundo/renderizador posterior |
| A092 | `movingWeatherFront()` | Núcleo testável; integração com mundo/renderizador posterior |

### Oceano e água (93–102)

Módulo: `src/engine/water.js`.

| ID | Função | Escopo |
|---|---|---|
| A093 | `gerstnerWaves()` | Núcleo testável; integração com mundo/renderizador posterior |
| A094 | `fftOceanSurface()` | Núcleo testável; integração com mundo/renderizador posterior |
| A095 | `oceanSpectrum()` | Núcleo testável; integração com mundo/renderizador posterior |
| A096 | `fresnelReflection()` | Núcleo testável; integração com mundo/renderizador posterior |
| A097 | `waterAbsorption()` | Núcleo testável; integração com mundo/renderizador posterior |
| A098 | `foamGeneration()` | Núcleo testável; integração com mundo/renderizador posterior |
| A099 | `shoalingWaves()` | Núcleo testável; integração com mundo/renderizador posterior |
| A100 | `wakeField()` | Núcleo testável; integração com mundo/renderizador posterior |
| A101 | `riverFlowField()` | Núcleo testável; integração com mundo/renderizador posterior |
| A102 | `sunGlitter()` | Núcleo testável; integração com mundo/renderizador posterior |

### Dinâmica de voo (103–130)

Módulo: `src/engine/dynamics.js`.

| ID | Função | Escopo |
|---|---|---|
| A103 | `rigidBody6DOF()` | Núcleo testável; integração com mundo/renderizador posterior |
| A104 | `quaternionIntegrate()` | Núcleo testável; integração com mundo/renderizador posterior |
| A105 | `rungeKutta4()` | Núcleo testável; integração com mundo/renderizador posterior |
| A106 | `semiImplicitIntegrator()` | Núcleo testável; integração com mundo/renderizador posterior |
| A107 | `fixedStepInterpolation()` | Núcleo testável; integração com mundo/renderizador posterior |
| A108 | `aeroCoefficientModel()` | Núcleo testável; integração com mundo/renderizador posterior |
| A109 | `lookupAeroTable()` | Núcleo testável; integração com mundo/renderizador posterior |
| A110 | `angleOfAttackSideslip()` | Núcleo testável; integração com mundo/renderizador posterior |
| A111 | `nonlinearLift()` | Núcleo testável; integração com mundo/renderizador posterior |
| A112 | `stallHysteresis()` | Núcleo testável; integração com mundo/renderizador posterior |
| A113 | `inducedDrag()` | Núcleo testável; integração com mundo/renderizador posterior |
| A114 | `parasiteDrag()` | Núcleo testável; integração com mundo/renderizador posterior |
| A115 | `groundEffect()` | Núcleo testável; integração com mundo/renderizador posterior |
| A116 | `stabilityDerivatives()` | Núcleo testável; integração com mundo/renderizador posterior |
| A117 | `aerodynamicDamping()` | Núcleo testável; integração com mundo/renderizador posterior |
| A118 | `controlAuthority()` | Núcleo testável; integração com mundo/renderizador posterior |
| A119 | `engineSpool()` | Núcleo testável; integração com mundo/renderizador posterior |
| A120 | `propellerPerformance()` | Núcleo testável; integração com mundo/renderizador posterior |
| A121 | `turbineThrust()` | Núcleo testável; integração com mundo/renderizador posterior |
| A122 | `fuelTransfer()` | Núcleo testável; integração com mundo/renderizador posterior |
| A123 | `inertiaTensor()` | Núcleo testável; integração com mundo/renderizador posterior |
| A124 | `landingGearSpring()` | Núcleo testável; integração com mundo/renderizador posterior |
| A125 | `tireFriction()` | Núcleo testável; integração com mundo/renderizador posterior |
| A126 | `differentialBraking()` | Núcleo testável; integração com mundo/renderizador posterior |
| A127 | `continuousCollision()` | Núcleo testável; integração com mundo/renderizador posterior |
| A128 | `impactEnergy()` | Núcleo testável; integração com mundo/renderizador posterior |
| A129 | `pidAutopilot()` | Núcleo testável; integração com mundo/renderizador posterior |
| A130 | `lqrController()` | Núcleo testável; integração com mundo/renderizador posterior |

### Aeronaves e cabine (131–142)

Módulo: `src/engine/airframes.js`.

| ID | Função | Escopo |
|---|---|---|
| A131 | `parametricFuselage()` | Núcleo testável; integração com mundo/renderizador posterior |
| A132 | `airfoilWingMesh()` | Núcleo testável; integração com mundo/renderizador posterior |
| A133 | `aircraftLOD()` | Núcleo testável; integração com mundo/renderizador posterior |
| A134 | `movableSurfaces()` | Núcleo testável; integração com mundo/renderizador posterior |
| A135 | `landingGearAnimation()` | Núcleo testável; integração com mundo/renderizador posterior |
| A136 | `propellerMotionBlur()` | Núcleo testável; integração com mundo/renderizador posterior |
| A137 | `layeredCabinMaterial()` | Núcleo testável; integração com mundo/renderizador posterior |
| A138 | `flightInstruments()` | Núcleo testável; integração com mundo/renderizador posterior |
| A139 | `proceduralCockpitAnimation()` | Núcleo testável; integração com mundo/renderizador posterior |
| A140 | `inertialCamera()` | Núcleo testável; integração com mundo/renderizador posterior |
| A141 | `structuralVibration()` | Núcleo testável; integração com mundo/renderizador posterior |
| A142 | `componentDamage()` | Núcleo testável; integração com mundo/renderizador posterior |

### Infraestrutura e IA (143–154)

Módulo: `src/engine/infrastructure.js`.

| ID | Função | Escopo |
|---|---|---|
| A143 | `proceduralRoadNetwork()` | Núcleo testável; integração com mundo/renderizador posterior |
| A144 | `urbanZoning()` | Núcleo testável; integração com mundo/renderizador posterior |
| A145 | `architecturalGrammar()` | Núcleo testável; integração com mundo/renderizador posterior |
| A146 | `airportLayout()` | Núcleo testável; integração com mundo/renderizador posterior |
| A147 | `proceduralRunwayMarkings()` | Núcleo testável; integração com mundo/renderizador posterior |
| A148 | `aerodromeLights()` | Núcleo testável; integração com mundo/renderizador posterior |
| A149 | `vegetationDistribution()` | Núcleo testável; integração com mundo/renderizador posterior |
| A150 | `aggregateGroundTraffic()` | Núcleo testável; integração com mundo/renderizador posterior |
| A151 | `aerialTrafficRoutes()` | Núcleo testável; integração com mundo/renderizador posterior |
| A152 | `trafficStateMachine()` | Núcleo testável; integração com mundo/renderizador posterior |
| A153 | `fictionalATC()` | Núcleo testável; integração com mundo/renderizador posterior |
| A154 | `obstacleAvoidingPath()` | Núcleo testável; integração com mundo/renderizador posterior |

### Áudio e gameplay (155–166)

Módulo: `src/engine/experience.js`.

| ID | Função | Escopo |
|---|---|---|
| A155 | `proceduralEngineAudio()` | Núcleo testável; integração com mundo/renderizador posterior |
| A156 | `layeredAudioSpectrum()` | Núcleo testável; integração com mundo/renderizador posterior |
| A157 | `cockpitOcclusion()` | Núcleo testável; integração com mundo/renderizador posterior |
| A158 | `spatialAudio()` | Núcleo testável; integração com mundo/renderizador posterior |
| A159 | `aerodynamicAudio()` | Núcleo testável; integração com mundo/renderizador posterior |
| A160 | `adaptiveHUD()` | Núcleo testável; integração com mundo/renderizador posterior |
| A161 | `deterministicReplay()` | Núcleo testável; integração com mundo/renderizador posterior |
| A162 | `cinematicCamera()` | Núcleo testável; integração com mundo/renderizador posterior |
| A163 | `proceduralPrecisionCourse()` | Núcleo testável; integração com mundo/renderizador posterior |
| A164 | `trajectoryScore()` | Núcleo testável; integração com mundo/renderizador posterior |
| A165 | `combinatorialMissions()` | Núcleo testável; integração com mundo/renderizador posterior |
| A166 | `difficultyScaling()` | Núcleo testável; integração com mundo/renderizador posterior |

### Desempenho e robustez (167–180)

Módulo: `src/engine/performance.js`.

| ID | Função | Escopo |
|---|---|---|
| A167 | `adaptiveResolution()` | Núcleo testável; integração com mundo/renderizador posterior |
| A168 | `dynamicQualityBudget()` | Núcleo testável; integração com mundo/renderizador posterior |
| A169 | `gpuTimeProfiling()` | Núcleo testável; integração com mundo/renderizador posterior |
| A170 | `objectPool()` | Núcleo testável; integração com mundo/renderizador posterior |
| A171 | `allocationFreeStep()` | Núcleo testável; integração com mundo/renderizador posterior |
| A172 | `priorityScheduling()` | Núcleo testável; integração com mundo/renderizador posterior |
| A173 | `gracefulDegradation()` | Núcleo testável; integração com mundo/renderizador posterior |
| A174 | `devicePresets()` | Núcleo testável; integração com mundo/renderizador posterior |
| A175 | `frameWorkBudget()` | Núcleo testável; integração com mundo/renderizador posterior |
| A176 | `physicsInvariantTests()` | Núcleo testável; integração com mundo/renderizador posterior |
| A177 | `visualRegression()` | Núcleo testável; integração com mundo/renderizador posterior |
| A178 | `memoryLeakWatch()` | Núcleo testável; integração com mundo/renderizador posterior |
| A179 | `localTelemetry()` | Núcleo testável; integração com mundo/renderizador posterior |
| A180 | `errorRecovery()` | Núcleo testável; integração com mundo/renderizador posterior |

## Próxima etapa — somente após escolha do mundo

Converter os núcleos relevantes em subsistemas completos e perfis de desempenho por dispositivo: render passes WebGL/WebGPU, assets originais de alta qualidade, modelo físico/controle validado para cada aeronave, criação de mundo, testes de stress e telemetria em aparelhos reais. O índice não pressupõe que todos os 180 devam executar em todo quadro: algoritmos de geração e preparação podem funcionar fora da thread principal ou antes da renderização.
