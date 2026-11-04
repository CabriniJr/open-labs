export { formatTraceparent, parseTraceparent } from "./traceparent.js";
export type { TraceContext } from "./traceparent.js";
export { attribute, toOtlpJson } from "./otlp.js";
export type {
  AnyValue,
  ExportTraceServiceRequest,
  KeyValue,
  OtelResource,
  OtelSpan,
  ResourceSpans,
  ScopeSpans,
  SpanKind,
} from "./otlp.js";

// O lab dos provedores.
export { otelWorld, PARAMS_PADRAO } from "./providers/world.js";
export type { EstadoCollector, OpcoesDoMundo } from "./providers/world.js";
export { estadoOtel } from "./providers/estado.js";
export type { EstadoOtel, PontoDeMetrica } from "./providers/estado.js";
export { envelopesDe, envelopeUnico } from "./providers/envelope.js";
export type { EnvelopeEmVoo } from "./providers/envelope.js";
export { especieDaCarga, leituraDaCarga } from "./providers/carga.js";
export type { AtributoDeRecurso, PlacaDeRecurso, RegistroDeSpan } from "./providers/carga.js";
export {
  DESCRICOES,
  MAL_ENTENDIDOS,
  RECURSO_DO_PROCESSO,
  RECURSO_DO_SEGUNDO,
  ROTULOS,
} from "./providers/labels.js";
export type { MalEntendido } from "./providers/labels.js";
export {
  OTEL_VIEWS,
  VIEWS_DE_PROVIDER,
  VIEWS_SEM_SDK,
  VIEW_APPLICATION,
  VIEW_BATCH_PROCESSOR,
  VIEW_HOST,
  VIEW_LOGGER_PROVIDER,
  VIEW_METER_PROVIDER,
  VIEW_PROCESS,
  VIEW_PROCESS_SEM_SDK,
  VIEW_SDK,
  VIEW_TRACER_PROVIDER,
} from "./providers/views.js";
export {
  MAX_EXPORT_BATCH_SIZE_PADRAO,
  MAX_QUEUE_SIZE_PADRAO,
  SCHEDULED_DELAY_MS_PADRAO,
} from "./providers/batch.js";
export {
  ATRIBUTO_DE_OVERFLOW,
  EXPORT_INTERVAL_MS_PADRAO,
  LIMITE_DE_CARDINALIDADE_PADRAO,
} from "./providers/metrics.js";
export { decidir, PORTA_DA_DECISAO } from "./providers/sampler.js";
export type { Amostrador, Decisao } from "./providers/sampler.js";

// Os exercícios de instrumentação: definição, sem a resposta certa.
export { EXERCICIOS_DOS_PROVEDORES } from "./exercicios/providers.js";
export { EXERCICIOS_DA_ANATOMIA } from "./exercicios/anatomia.js";
export { EXERCICIOS_DOS_PILARES } from "./exercicios/pilares.js";
export { EXERCICIOS_DO_COLLECTOR } from "./exercicios/collector.js";
export { EXERCICIOS_DA_AMOSTRAGEM } from "./exercicios/amostragem.js";
export type { DefinicaoDeExercicio, Distrator } from "./exercicios/tipos.js";

// Cardinalidade e a conta: lab PhET-like, SEM motor (ADR §9). Aritmética sobre
// um produto cartesiano, e nenhum preço afirmado em lugar nenhum.
export { calcular, fatorDeEntrada, pontosPorSerie } from "./cardinalidade/modelo.js";
export type { Atributo, Conta, TipoDeMetrica } from "./cardinalidade/modelo.js";
export {
  ATRIBUTOS_DA_CARDINALIDADE,
  ROTULOS_DA_CARDINALIDADE,
  MAL_ENTENDIDOS_DA_CARDINALIDADE,
} from "./cardinalidade/labels.js";

// O lab do Collector: um receiver, duas pipelines, uma cópia para cada.
export { collectorWorld, PARAMS_DO_COLLECTOR } from "./collector/world.js";
export type {
  SpanDoCollector,
  EstadoDaApp,
  EstadoDoReceiver,
  EstadoDoLimiter,
  EstadoDoLote,
  EstadoDoFiltro,
  EstadoDoDestino,
  EstadoDoDescarte,
} from "./collector/world.js";
export { estadoDoCollector, LEITOR_DO_SPAN_DO_COLLECTOR } from "./collector/estado.js";
export type { EstadoDoCollector } from "./collector/estado.js";
export { VIEW_COLLECTOR, VIEWS_DO_COLLECTOR } from "./collector/views.js";
export {
  ROTULOS_COLLECTOR,
  ROTAS_DO_COLLECTOR,
  ROTA_FILTRADA,
  MAL_ENTENDIDOS_DO_COLLECTOR,
} from "./collector/labels.js";

// O lab da amostragem: head decide antes de saber; tail precisa do trace inteiro.
export { amostragemWorld, PARAMS_DA_AMOSTRAGEM, hashDoTrace } from "./amostragem/world.js";
export type {
  SpanAmostrado,
  EstadoDaAppAmostrada,
  EstadoDoHead,
  EstadoDoBalanceador,
  EstadoDoTail,
  TraceAberto,
  TraceNoBackend,
  EstadoDoBackendDeTraces,
  EstadoDoDescarteDeTraces,
} from "./amostragem/world.js";
export { estadoDaAmostragem, LEITOR_DO_SPAN_AMOSTRADO } from "./amostragem/estado.js";
export type { EstadoDaAmostragem, EstadoDeUmGateway } from "./amostragem/estado.js";
export { VIEW_AMOSTRAGEM, VIEWS_DA_AMOSTRAGEM } from "./amostragem/views.js";
export {
  ROTULOS_AMOSTRAGEM,
  SERVICOS_DO_TRACE,
  MAL_ENTENDIDOS_DA_AMOSTRAGEM,
} from "./amostragem/labels.js";

// O lab dos três pilares: as mesmas requisições, três gravadores.
export { pilaresWorld, PARAMS_DOS_PILARES, latenciaDe } from "./pilares/world.js";
export type {
  EstadoMedidor,
  EstadoRegistrador,
  EstadoServico,
  EstadoTracer,
} from "./pilares/world.js";
export { estadoDosPilares, LEITOR_DA_REQUISICAO } from "./pilares/estado.js";
export type { EstadoDosPilares, RespostaDoSinal } from "./pilares/estado.js";
export { baldeDe, BALDES, chaveDaSerie } from "./pilares/carga.js";
export type { Requisicao } from "./pilares/carga.js";
export { ROTULOS_PILARES, MAL_ENTENDIDOS_DOS_PILARES } from "./pilares/labels.js";
export { VIEW_PILARES, VIEWS_DOS_PILARES } from "./pilares/views.js";

// O lab da anatomia de um trace: a árvore que ninguém possui.
export { anatomiaWorld, PARAMS_DA_ANATOMIA } from "./anatomia/world.js";
export type { EstadoBackend, EstadoServico as EstadoServicoDaAnatomia } from "./anatomia/world.js";
export { estadoDaAnatomia, LEITOR_DA_CHAMADA } from "./anatomia/estado.js";
export type { ArvoreMontada, EstadoDaAnatomia, NoDaArvore } from "./anatomia/estado.js";
export type { Chamada, SpanExportado } from "./anatomia/carga.js";
export { MAL_ENTENDIDOS_DA_ANATOMIA, ROTULOS_ANATOMIA, SERVICOS } from "./anatomia/labels.js";
export { VIEW_ANATOMIA, VIEWS_DA_ANATOMIA } from "./anatomia/views.js";

// O herói da landing: o oleoduto visto de fora, com um span seguido de ponta a ponta.
export { heroiWorld } from "./heroi/world.js";
export { LEITOR_DO_SPAN, tituloDoSpan } from "./heroi/estado.js";
export { spanDoHeroi } from "./heroi/carga.js";
export type { SpanDoHeroi } from "./heroi/carga.js";
export { ATRIBUTO_DO_COLLECTOR, ROTULOS_HEROI, VALOR_DO_COLLECTOR } from "./heroi/labels.js";
export { VIEW_HEROI, VIEWS_DO_HEROI } from "./heroi/views.js";

// O lab da propagação de contexto, sobre o palco animado.
export { formatBaggage, parseBaggage } from "./contexto/baggage.js";
export type { Baggage } from "./contexto/baggage.js";
export { CAMINHO, INSTRUMENTADOS, OPCOES_PADRAO, propagar } from "./contexto/propagacao.js";
export type { Chamada as ChamadaDePropagacao, OpcoesDePropagacao, Propagacao, Servico, SpanGerado } from "./contexto/propagacao.js";
export { ALTURA, LARGURA, filmeDoContexto, rotuloDoContexto } from "./contexto/filme.js";
export type { DetalheDoContexto, Foco } from "./contexto/filme.js";

// O lab da implantação do Collector: agent, gateway, e onde um trace fica inteiro.
export { entregar, MODOS, NOS_DO_CLUSTER, PODS, REPLICAS, SPANS } from "./implantacao/modelo.js";
export type { Entrega, Modo, OpcoesDeImplantacao } from "./implantacao/modelo.js";
export { ALTURA_DA_IMPLANTACAO, LARGURA_DA_IMPLANTACAO, filmeDaImplantacao } from "./implantacao/filme.js";
export type { DetalheDaImplantacao, LinhaDaTabela } from "./implantacao/filme.js";

// A vitrine do Collector: o modo showcase do lab do pipeline.
export { envelopeDaVitrine, filmeDaVitrineOtel } from "./vitrine/filme.js";
export type { DetalheDaVitrineOtel } from "./vitrine/filme.js";

// A identidade do handbook: os ícones de cada papel, iguais em todo lab.
export { ICONES_OTEL } from "./icones/icones.js";
export type { IconeOtel } from "./icones/icones.js";

// O payload OTLP em protobuf: o codificador e o filme do lab.
export { bytesEmJson, chave, codificarRequisicao, hex, varint } from "./protobuf/codificar.js";
export type { CampoCodificado, Codificacao, TipoDoCampo, WireType } from "./protobuf/codificar.js";
export { envelopeDoProtobuf, SPAN_DO_PROTOBUF, tomDoCampo } from "./protobuf/exemplo.js";
export { filmeDaViagem, spanDaViagem } from "./protobuf/viagem.js";
export type { Codificacao as CodificacaoDaViagem, DetalheDaViagem, LinhaDoDiario, OpcoesDaViagem } from "./protobuf/viagem.js";

// O showcase da anatomia: uma requisição, e a árvore que o backend monta depois.
export { ALTURA_DA_ANATOMIA, LARGURA_DA_ANATOMIA, OPCOES_DA_VITRINE_DA_ANATOMIA, filmeDaVitrineDaAnatomia, umaRequisicao } from "./anatomia/vitrine.js";
export type { ChamadaDaVitrine, DetalheDaVitrineDaAnatomia, LinhaDoWaterfall, OpcoesDaVitrineDaAnatomia, RequisicaoDaVitrine, SpanDaVitrine } from "./anatomia/vitrine.js";

// A forma de uma métrica: o agregador, a temporalidade e o que o backend conclui.
export { baldeDe as baldeDoHistograma, coletar, INTERVALO_MS, lerNoBackend, LIMITES_DOS_BALDES, novoAgregador, OPCOES_DA_METRICA, registrar, reiniciar, roteiro, rodar, ROTULOS_DOS_BALDES } from "./metrica/modelo.js";
export type { Agregador, Corrida, Evento, OpcoesDaMetrica, Passo, PontoExportado, Temporalidade } from "./metrica/modelo.js";
export { ALTURA_DA_METRICA, LARGURA_DA_METRICA, filmeDaMetrica } from "./metrica/filme.js";
export type { DetalheDaMetrica } from "./metrica/filme.js";
export { MAL_ENTENDIDOS_DA_METRICA } from "./metrica/labels.js";

// Um log que sabe o trace dele: o contexto ativo por thread e a ponte que o lê.
export { abrirSpan, aplicar, contextoAtivo, criarThread, fecharSpan, juntar, logar, novoProcesso, OPCOES_DO_LOG, ROTEIRO_DO_LOG, rodarLog } from "./log/modelo.js";
export type { Contexto, EstadoDoLog, Juncao, OpcoesDoLog, PassoDoLog, RegistroDeLog, SpanDoLog } from "./log/modelo.js";
export { ALTURA_DO_LOG, LARGURA_DO_LOG, filmeDoLog } from "./log/filme.js";
export type { DetalheDoLog } from "./log/filme.js";
export { MAL_ENTENDIDOS_DO_LOG } from "./log/labels.js";

// Propagar por uma fila: o contexto dentro da mensagem, e pai ou link do outro lado.
export { consumirLote, consumirUm, esperar as esperarNaFila, novaFila, OPCOES_DA_FILA, publicar, rodarFila, roteiroDaFila, tracesDaFila } from "./fila/modelo.js";
export type { Consumo, EstadoDaFila, Mensagem, OpcoesDaFila, PassoDaFila, SpanDaFila, TipoDoSpan, TraceDaFila } from "./fila/modelo.js";
export { ALTURA_DA_FILA, LARGURA_DA_FILA, filmeDaFila } from "./fila/filme.js";
export type { DetalheDaFila } from "./fila/filme.js";
export { MAL_ENTENDIDOS_DA_FILA } from "./fila/labels.js";

// Spans à mão: o tracer em miniatura, o programa do editor e o que o backend recebe.
export { executar as executarInstrucao, noBackend, nomeDeAltaCardinalidade, novoTracer, OPCOES_MANUAIS, programa as programaManual, rodarManual } from "./manual/modelo.js";
export type { EstadoManual, Instrucao, NoBackend, OpcoesManuais, SpanManual } from "./manual/modelo.js";
export { ALTURA_MANUAL, LARGURA_MANUAL, filmeManual } from "./manual/filme.js";
export type { DetalheManual } from "./manual/filme.js";
export { MAL_ENTENDIDOS_MANUAIS } from "./manual/labels.js";

// O showcase dos três pilares: um incidente, três gravadores, e o que os liga.
export { ALTURA_DOS_PILARES, filmeDosPilares, incidente, LARGURA_DOS_PILARES, OPCOES_DOS_PILARES } from "./pilares/vitrine.js";
export type { BaldeDoIncidente, DetalheDosPilares, Incidente, LinhaDeLog, OpcoesDosPilares, TraceDoIncidente } from "./pilares/vitrine.js";

// O showcase da amostragem: quando se decide, e com quanto do trace.
export { ALTURA_DA_AMOSTRAGEM, amostrar, filmeDaVitrineDaAmostragem, LARGURA_DA_AMOSTRAGEM, OPCOES_DA_VITRINE_DA_AMOSTRAGEM, TAXA_DA_VITRINE, traceQueFalha } from "./amostragem/vitrine.js";
export type { Amostragem, DecisaoDeTrace, DetalheDaVitrineDaAmostragem, ModoDaAmostragem, OpcoesDaVitrineDaAmostragem, SpanDaVitrineDeAmostragem } from "./amostragem/vitrine.js";

// O showcase da cardinalidade: o cubo de séries, um atributo de cada vez.
export { ALTURA_DA_CARDINALIDADE, BALDES_DA_VITRINE, bytesDasChaves, etapasDoCubo, EXPORTACOES_DA_VITRINE, filmeDaVitrineDaCardinalidade, LARGURA_DA_CARDINALIDADE, OPCOES_DA_VITRINE_DA_CARDINALIDADE } from "./cardinalidade/vitrine.js";
export type { DetalheDaVitrineDaCardinalidade, EtapaDoCubo, OpcoesDaVitrineDaCardinalidade } from "./cardinalidade/vitrine.js";

// O showcase dos providers: o processo em três andares, e quem decide o que sai.
export { ALTURA_DOS_PROVIDERS, filmeDaVitrineDosProviders, LARGURA_DOS_PROVIDERS, LOTE_DA_VITRINE, OPCOES_DA_VITRINE_DOS_PROVIDERS, REQUISICOES_DA_VITRINE, rodarProviders } from "./providers/vitrine.js";
export type { DetalheDaVitrineDosProviders, OpcoesDaVitrineDosProviders, ProcessoInstrumentado } from "./providers/vitrine.js";
