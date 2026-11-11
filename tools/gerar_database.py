import json, hashlib, datetime, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
TODAY = datetime.date(2026, 11, 11)

def pick(key, opts):
    h = int(hashlib.md5(key.encode()).hexdigest(), 16)
    return opts[h % len(opts)]

# distribuição de exemplo (dados de demonstração)
DEMO = ["conforme"] * 6 + ["parcial", "nao_conforme", "nao_avaliado"]

def reqs(prefix, items, dist=None):
    dist = dist or DEMO
    out = []
    for i, d in enumerate(items, 1):
        rid = f"{prefix}.{i:02d}"
        out.append({"id": rid, "descricao": d, "status": pick(rid, dist), "evidencia": ""})
    return out

def dates(key, period_days):
    off = int(hashlib.md5(key.encode()).hexdigest(), 16) % period_days
    ult = TODAY - datetime.timedelta(days=off)
    prox = ult + datetime.timedelta(days=period_days)
    # alguns vencidos para demonstração
    if pick(key + "v", [0, 0, 0, 0, 1]):
        prox = TODAY - datetime.timedelta(days=5 + off % 20)
    return ult.isoformat(), prox.isoformat()

RESP = ["Coord. SMS", "Supervisor de Elétrica", "Supervisor de Mecânica", "OIM", "Técnico de Segurança",
        "Engenheiro de Integridade", "Supervisor de Manutenção", "Toolpusher", "Enfermeiro do Trabalho", "Coord. de Qualidade"]

# ------------------------------------------------------------------ NRs
NRS = [
 ("NR-01", "Disposições Gerais e Gerenciamento de Riscos Ocupacionais", True, "Coord. SMS", 365, [
   "Programa de Gerenciamento de Riscos (PGR) implementado, com inventário de riscos atualizado",
   "Plano de ação do PGR com cronograma, responsáveis e acompanhamento",
   "Ordens de serviço / informações de SST disponibilizadas aos trabalhadores",
   "Capacitações e treinamentos com conteúdo, carga horária e certificados registrados",
   "Análise de acidentes e doenças relacionadas ao trabalho integrada ao GRO",
   "Tratamento das informações das contratadas e prestadores no PGR"]),
 ("NR-02", "Inspeção Prévia (REVOGADA)", False, "", 365, []),
 ("NR-03", "Embargo e Interdição", True, "OIM", 365, [
   "Procedimento interno para atendimento a embargos/interdições da fiscalização",
   "Registro de termos de embargo/interdição recebidos e ações de levantamento"]),
 ("NR-04", "Serviços Especializados em Segurança e Medicina do Trabalho (SESMT)", True, "Coord. SMS", 365, [
   "SESMT dimensionado conforme grau de risco e número de empregados",
   "Registro do SESMT e profissionais habilitados",
   "Relatórios e indicadores de SST elaborados pelo SESMT"]),
 ("NR-05", "Comissão Interna de Prevenção de Acidentes (CIPA)", True, "Técnico de Segurança", 365, [
   "CIPA/CIPLAT constituída e eleita conforme NR-05 e NR-37",
   "Reuniões ordinárias mensais com atas registradas",
   "Treinamento dos membros da CIPA/CIPLAT",
   "Mapa de riscos / participação na identificação de perigos"]),
 ("NR-06", "Equipamentos de Proteção Individual (EPI)", True, "Técnico de Segurança", 180, [
   "EPIs com Certificado de Aprovação (CA) válido",
   "Fichas de entrega de EPI assinadas e atualizadas",
   "Treinamento sobre uso, guarda e conservação de EPIs",
   "Seleção de EPI baseada no inventário de riscos do PGR",
   "Higienização, substituição e controle de validade dos EPIs"]),
 ("NR-07", "Programa de Controle Médico de Saúde Ocupacional (PCMSO)", True, "Enfermeiro do Trabalho", 365, [
   "PCMSO elaborado com base nos riscos do PGR",
   "ASOs admissionais, periódicos, retorno, mudança de risco e demissionais em dia",
   "Relatório analítico anual do PCMSO",
   "Exames complementares conforme agentes de exposição (ruído, benzeno etc.)"]),
 ("NR-08", "Edificações", True, "Supervisor de Manutenção", 365, [
   "Pisos, escadas, rampas e passarelas em condições seguras",
   "Proteção contra quedas em aberturas e desníveis"]),
 ("NR-09", "Avaliação e Controle das Exposições Ocupacionais a Agentes Físicos, Químicos e Biológicos", True, "Coord. SMS", 365, [
   "Avaliações quantitativas de ruído e vibração",
   "Avaliação de exposição a agentes químicos (benzeno, H2S, fluidos de perfuração)",
   "Medidas de controle e monitoramento periódico das exposições",
   "Programa de Conservação Auditiva implementado"]),
 ("NR-10", "Segurança em Instalações e Serviços em Eletricidade", True, "Supervisor de Elétrica", 365, [
   "Prontuário das Instalações Elétricas (PIE) atualizado",
   "Diagramas unifilares atualizados e com especificação do aterramento",
   "Laudos de SPDA e aterramento",
   "Trabalhadores com treinamento NR-10 Básico e SEP válidos",
   "Procedimentos de bloqueio e etiquetagem (LOTO) implementados",
   "Certificação de equipamentos elétricos para atmosferas explosivas",
   "Relatório técnico de inspeções com recomendações e cronograma"]),
 ("NR-11", "Transporte, Movimentação, Armazenagem e Manuseio de Materiais", True, "Supervisor de Mecânica", 180, [
   "Operadores de guindaste e equipamentos de içamento habilitados e certificados",
   "Inspeção e certificação de guindastes, cabos, lingas e acessórios de içamento",
   "Plano de rigging para içamentos críticos",
   "Indicação de carga máxima permitida nos equipamentos"]),
 ("NR-12", "Segurança no Trabalho em Máquinas e Equipamentos", True, "Supervisor de Mecânica", 365, [
   "Inventário de máquinas e equipamentos com apreciação de riscos",
   "Proteções fixas e móveis com intertravamento",
   "Dispositivos de parada de emergência funcionais e testados",
   "Manuais e procedimentos de trabalho e segurança disponíveis",
   "Capacitação dos operadores de máquinas (ex.: pipe handling, top drive)"]),
 ("NR-13", "Caldeiras, Vasos de Pressão, Tubulações e Tanques Metálicos de Armazenamento", True, "Engenheiro de Integridade", 365, [
   "Prontuário de vasos de pressão, caldeiras e tubulações completos",
   "Registro de Segurança e Relatórios de Inspeção atualizados",
   "Inspeções de segurança iniciais, periódicas e extraordinárias em dia",
   "Válvulas de segurança (PSV) calibradas e com certificado",
   "Plaqueta de identificação e categoria dos vasos",
   "Profissional Habilitado (PH) designado",
   "Operadores de unidades de processo/caldeira treinados"]),
 ("NR-14", "Fornos", False, "", 365, []),
 ("NR-15", "Atividades e Operações Insalubres", True, "Coord. SMS", 365, [
   "Laudo de insalubridade (LTCAT) atualizado",
   "Pagamento de adicional quando aplicável e medidas de neutralização"]),
 ("NR-16", "Atividades e Operações Perigosas", True, "Coord. SMS", 365, [
   "Laudo de periculosidade (inflamáveis, eletricidade, radiação ionizante)",
   "Identificação das áreas de risco"]),
 ("NR-17", "Ergonomia", True, "Coord. SMS", 365, [
   "Avaliação Ergonômica Preliminar (AEP) realizada",
   "Análise Ergonômica do Trabalho (AET) quando necessária",
   "Mobiliário e postos de trabalho adequados (salas de controle, sondador)",
   "Organização do trabalho em turnos e regime de embarque"]),
 ("NR-18", "Segurança e Saúde no Trabalho na Indústria da Construção", False, "", 365, []),
 ("NR-19", "Explosivos", True, "Toolpusher", 365, [
   "Armazenamento de explosivos (canhoneio) em paiol adequado",
   "Procedimento de manuseio de explosivos e controle de rádio-silêncio",
   "Pessoal habilitado e controle de estoque com o Exército (SFPC)"]),
 ("NR-20", "Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis", True, "Coord. SMS", 365, [
   "Projeto da instalação e análise de riscos (HAZOP/APR)",
   "Prontuário da instalação conforme NR-20",
   "Plano de inspeção e manutenção de equipamentos",
   "Capacitação NR-20 dos trabalhadores conforme classe da instalação",
   "Plano de Resposta a Emergências (PRE)",
   "Controle de fontes de ignição e Permissão de Trabalho a quente"]),
 ("NR-21", "Trabalhos a Céu Aberto", True, "Técnico de Segurança", 365, [
   "Proteção contra intempéries e exposição solar",
   "Disponibilidade de água potável e áreas de descanso"]),
 ("NR-22", "Segurança e Saúde Ocupacional na Mineração", False, "", 365, []),
 ("NR-23", "Proteção Contra Incêndios", True, "Técnico de Segurança", 180, [
   "Saídas de emergência sinalizadas e desobstruídas",
   "Extintores inspecionados, recarregados e testados hidrostaticamente",
   "Brigada de incêndio treinada e exercícios periódicos",
   "Sistemas fixos de combate a incêndio inspecionados"]),
 ("NR-24", "Condições Sanitárias e de Conforto nos Locais de Trabalho", True, "OIM", 365, [
   "Instalações sanitárias, vestiários e refeitórios adequados",
   "Controle de potabilidade da água",
   "Camarotes e áreas de vivência adequados (ver NR-37)"]),
 ("NR-25", "Resíduos Industriais", True, "Coord. SMS", 365, [
   "Plano de gerenciamento de resíduos (cascalho, fluidos, oleosos)",
   "Segregação, acondicionamento e destinação final com MTR",
   "Treinamento sobre manuseio de resíduos"]),
 ("NR-26", "Sinalização e Identificação de Segurança", True, "Técnico de Segurança", 365, [
   "Cores de segurança e identificação de tubulações",
   "Rotulagem de produtos químicos conforme GHS",
   "Fichas de Dados de Segurança (FDS) disponíveis"]),
 ("NR-27", "Registro Profissional do Técnico de Segurança (REVOGADA)", False, "", 365, []),
 ("NR-28", "Fiscalização e Penalidades", True, "Coord. SMS", 365, [
   "Controle de autos de infração e notificações recebidas",
   "Atendimento aos prazos concedidos pela fiscalização"]),
 ("NR-29", "Segurança e Saúde no Trabalho Portuário", False, "", 365, []),
 ("NR-30", "Segurança e Saúde no Trabalho Aquaviário", True, "OIM", 365, [
   "Grupo de Segurança e Saúde no Trabalho a Bordo (GSSTB) quando aplicável",
   "Condições de habitabilidade e alimentação da tripulação",
   "Documentação marítima e tripulação de segurança (Marinha do Brasil)"]),
 ("NR-31", "Segurança e Saúde no Trabalho na Agricultura e Pecuária", False, "", 365, []),
 ("NR-32", "Segurança e Saúde no Trabalho em Serviços de Saúde", True, "Enfermeiro do Trabalho", 365, [
   "Enfermaria de bordo com plano de riscos biológicos",
   "Gerenciamento de resíduos de serviços de saúde",
   "Vacinação dos profissionais de saúde"]),
 ("NR-33", "Segurança e Saúde nos Trabalhos em Espaços Confinados", True, "Técnico de Segurança", 180, [
   "Cadastro e sinalização de todos os espaços confinados (tanques, pits, colunas)",
   "Permissão de Entrada e Trabalho (PET) emitida e arquivada",
   "Supervisores de entrada e vigias capacitados",
   "Monitoramento contínuo da atmosfera com detectores calibrados",
   "Plano de resgate e equipe treinada"]),
 ("NR-34", "Condições e Meio Ambiente de Trabalho na Indústria da Construção, Reparação e Desmonte Naval", True, "Supervisor de Manutenção", 365, [
   "Aplicação durante docagem/reparos em estaleiro",
   "Trabalho a quente com PT e observador",
   "Montagem e uso de andaimes conforme norma"]),
 ("NR-35", "Trabalho em Altura", True, "Técnico de Segurança", 180, [
   "Análise de Risco (AR) e Permissão de Trabalho (PT) para trabalho em altura",
   "Trabalhadores capacitados e com aptidão em ASO",
   "Sistemas de proteção contra quedas inspecionados (cintos, talabartes, linhas de vida)",
   "Plano de resgate e emergência para trabalho em altura (ex.: torre, plataforma do torrista)"]),
 ("NR-36", "Segurança e Saúde no Trabalho em Empresas de Abate e Processamento de Carnes", False, "", 365, []),
 ("NR-37", "Segurança e Saúde em Plataformas de Petróleo", True, "OIM", 180, [
   "CIPLAT constituída e atuante",
   "Treinamentos básico e avançado de segurança para plataforma (NR-37)",
   "Plano de Resposta a Emergências da plataforma e simulados periódicos",
   "Condições de habitabilidade, alimentação e áreas de vivência",
   "Gerenciamento de riscos em operações de perfuração e produção",
   "Monitoramento de agentes químicos e controle de H2S",
   "Comunicação de acidentes e incidentes à fiscalização",
   "Inspeções de segurança e manutenção de equipamentos críticos",
   "Sistemas de detecção, alarme e proteção contra incêndio e explosão"]),
 ("NR-38", "Segurança e Saúde no Trabalho nas Atividades de Limpeza Urbana e Manejo de Resíduos Sólidos", False, "", 365, []),
]

def build_item(code, title, applicable, resp, period, rlist, extra=None, dist=None):
    ult, prox = dates(code, period) if applicable else ("", "")
    it = {
        "id": code, "codigo": code, "titulo": title, "aplicavel": applicable,
        "responsavel": resp, "periodicidadeDias": period,
        "ultimaVerificacao": ult, "proximaVerificacao": prox,
        "requisitos": reqs(code, rlist, dist) if applicable else [],
        "observacoes": ""
    }
    if extra: it.update(extra)
    return it

nrs = []
for code, title, ap, resp, per, rl in NRS:
    obs = ""
    if "REVOGADA" in title: obs = "Norma revogada — mantida apenas para referência histórica."
    elif not ap: obs = "Não aplicável à atividade de perfuração offshore."
    it = build_item(code, title, ap, resp, per, rl)
    it["observacoes"] = obs
    nrs.append(it)

# ------------------------------------------------------------------ SGSO (Resolução ANP nº 43/2007)
SGSO = [
 ("PG-01", "Cultura de Segurança, Compromisso e Responsabilidade Gerencial", "Coord. SMS", [
   "Política de segurança operacional documentada e divulgada",
   "Objetivos e metas de segurança operacional definidos",
   "Recursos e responsabilidades gerenciais definidos",
   "Análise crítica do SGSO pela alta direção"]),
 ("PG-02", "Envolvimento do Pessoal", "OIM", [
   "Mecanismos de participação da força de trabalho na segurança operacional",
   "Canal de comunicação e reporte de desvios / Stop Work Authority",
   "Reuniões de segurança (DDS) registradas"]),
 ("PG-03", "Qualificação, Treinamento e Desempenho do Pessoal", "Coord. de Qualidade", [
   "Matriz de treinamento por função",
   "Registros de qualificação e certificação (IWCF/IADC WellSharp, BOSIET/T-HUET, NRs)",
   "Avaliação de desempenho e competência",
   "Programa de integração (induction) a bordo"]),
 ("PG-04", "Ambiente de Trabalho e Fatores Humanos", "Coord. SMS", [
   "Avaliação de fatores humanos em projeto e operação",
   "Gestão de fadiga e jornada de trabalho",
   "Ergonomia de painéis e salas de controle"]),
 ("PG-05", "Seleção, Controle e Gerenciamento de Contratadas", "Coord. de Qualidade", [
   "Critérios de SMS na seleção de contratadas",
   "Interface (bridging document) entre operador e contratadas",
   "Avaliação de desempenho de SMS das contratadas"]),
 ("PG-06", "Monitoramento e Melhoria Contínua do Desempenho", "Coord. de Qualidade", [
   "Indicadores de desempenho de segurança operacional (proativos e reativos)",
   "Análise de tendências e ações de melhoria",
   "Comunicação de incidentes à ANP (Resolução ANP nº 44/2009)"]),
 ("PG-07", "Auditorias", "Coord. de Qualidade", [
   "Programa anual de auditorias internas do SGSO",
   "Auditores qualificados e independentes da área auditada",
   "Relatórios de auditoria e acompanhamento das não conformidades"]),
 ("PG-08", "Gestão da Informação e da Documentação", "Coord. de Qualidade", [
   "Sistema de controle de documentos e registros",
   "Documentação técnica da instalação acessível e atualizada",
   "Controle de revisões de procedimentos"]),
 ("PG-09", "Investigação de Incidentes", "Coord. SMS", [
   "Procedimento de investigação de incidentes com análise de causa raiz",
   "Equipe de investigação qualificada",
   "Implementação e verificação de eficácia das recomendações",
   "Divulgação das lições aprendidas"]),
 ("PG-10", "Projeto, Construção, Instalação e Desativação", "Engenheiro de Integridade", [
   "Normas e padrões de projeto definidos",
   "Análise de riscos na fase de projeto",
   "Comissionamento e testes de aceitação documentados",
   "Plano de desativação de instalações"]),
 ("PG-11", "Elementos Críticos de Segurança Operacional", "Supervisor de Manutenção", [
   "Lista de Elementos Críticos de Segurança Operacional (ECSO) identificada",
   "Padrões de desempenho definidos para cada ECSO",
   "Gerenciamento de ECSO inoperantes / degradados (bypass e inibições)"]),
 ("PG-12", "Identificação e Análise de Riscos", "Coord. SMS", [
   "Estudos de análise de riscos (HAZOP, HAZID, APR) atualizados",
   "Revisão periódica das análises de risco",
   "Acompanhamento das recomendações das análises de risco"]),
 ("PG-13", "Integridade Mecânica", "Engenheiro de Integridade", [
   "Plano de inspeção e manutenção (preventiva, preditiva) implementado",
   "Programa de integridade de equipamentos estáticos e rotativos",
   "Registros de inspeções, testes e calibrações",
   "Gestão de backlog de manutenção de equipamentos críticos"]),
 ("PG-14", "Planejamento e Gerenciamento de Grandes Emergências", "OIM", [
   "Plano de Resposta a Emergência (PRE) e Plano de Emergência Individual (PEI)",
   "Simulados periódicos (abandono, incêndio, kick/blowout, homem ao mar, H2S)",
   "Recursos de resposta a emergência disponíveis e testados",
   "Comunicação com autoridades (ANP, Marinha, IBAMA)"]),
 ("PG-15", "Procedimentos Operacionais", "Toolpusher", [
   "Procedimentos operacionais escritos e aprovados",
   "Procedimentos de controle de poço disponíveis e treinados",
   "Revisão periódica dos procedimentos"]),
 ("PG-16", "Gerenciamento de Mudanças", "Coord. de Qualidade", [
   "Procedimento de Gestão de Mudanças (MOC) implementado",
   "Análise de riscos das mudanças",
   "Comunicação e treinamento após mudanças"]),
 ("PG-17", "Práticas de Trabalho Seguro e Procedimentos de Controle em Atividades Especiais", "Técnico de Segurança", [
   "Sistema de Permissão de Trabalho (PT) implementado",
   "Controle de isolamento de energias (LOTO)",
   "Controle de trabalhos a quente, espaço confinado, altura e içamento",
   "Controle de inibições e bypass de sistemas de segurança"]),
]

sgso = [build_item(c, t, True, r, 365, rl, {"referencia": "Resolução ANP nº 43/2007 — Regulamento Técnico do SGSO"})
        for c, t, r, rl in SGSO]

# ------------------------------------------------------------------ Itens críticos ANP (interrompem a operação)
IC = [
 ("IC-01", "Integridade de Tubulações", "Integridade", "Alta", "Engenheiro de Integridade", 180,
  "SGSO PG-13; NR-13; ASME B31.3; API 570",
  "Tubulações de processo, de lama de alta pressão, choke & kill e utilidades devem ter integridade comprovada. Perda de contenção ou espessura abaixo do mínimo exige interdição do sistema.", [
   "Plano de inspeção de tubulações com medição de espessura (US) em pontos de controle",
   "Avaliação de corrosão/erosão e taxa de corrosão calculada",
   "Teste hidrostático das linhas de alta pressão (standpipe, choke & kill manifold)",
   "Registro e tratamento de reparos provisórios (clamps) com MOC",
   "Identificação e isométricos atualizados",
   "Suportes, juntas e flanges inspecionados"]),
 ("IC-02", "Dispersão de Gases", "Processo / Segurança", "Alta", "Coord. SMS", 365,
  "SGSO PG-10/PG-12; NR-20; NR-37; API RP 505",
  "Estudos de dispersão de gases devem garantir que vents, flare, separador atmosférico (mud gas separator) e descarga do diverter não atinjam áreas de risco, tomadas de ar ou áreas habitadas.", [
   "Estudo de dispersão de gases atualizado para a configuração atual da sonda",
   "Posicionamento seguro de vents, diverter e saída do mud gas separator",
   "Classificação de áreas (zonas 0/1/2) consistente com o estudo",
   "Detecção de gás nas tomadas de ar do HVAC com intertravamento",
   "Análise de radiação térmica do flare / queimador (well test)"]),
 ("IC-03", "Sistema de Bomba de Incêndio e Dilúvio", "Combate a Incêndio", "Alta", "Supervisor de Manutenção", 30,
  "SGSO PG-11/PG-13; NR-23; NR-37; SOLAS / MODU Code; NFPA 20/15",
  "As bombas de incêndio e o sistema de dilúvio devem estar disponíveis e com desempenho comprovado. Indisponibilidade das bombas de incêndio leva à interrupção das operações.", [
   "Teste semanal de partida das bombas de incêndio (principal e emergência)",
   "Teste de desempenho (vazão x pressão) anual das bombas",
   "Teste de dilúvio por área com verificação de bicos obstruídos",
   "Rede de incêndio pressurizada (jockey pump) e válvulas de isolamento na posição correta",
   "Tanque de diesel das bombas com autonomia adequada",
   "Teste de partida automática por queda de pressão / sinal do F&G",
   "Canhões monitores e hidrantes inspecionados"]),
 ("IC-04", "Sistema de Detecção de Fogo e Gás (F&G)", "Combate a Incêndio", "Alta", "Supervisor de Elétrica", 90,
  "SGSO PG-11; NR-37; IEC 61511; MODU Code",
  "Detectores de gás inflamável, H2S, chama, fumaça e calor devem estar calibrados e com lógica de votação/ações funcionais.", [
   "Calibração/bump test periódico dos detectores de gás",
   "Teste funcional dos detectores de chama, fumaça e calor",
   "Teste da matriz de causa e efeito do F&G",
   "Controle de detectores inibidos/bypass com autorização",
   "Alarmes audiovisuais (PA/GA) testados"]),
 ("IC-05", "Sistema de Parada de Emergência (ESD) e Despressurização", "Processo / Segurança", "Alta", "Supervisor de Elétrica", 180,
  "SGSO PG-11; NR-37; IEC 61511",
  "Os níveis de ESD devem estar funcionais e testados conforme matriz de causa e efeito.", [
   "Teste dos botoeiras de ESD nos diversos níveis",
   "Teste das válvulas de shutdown (SDV) com tempo de fechamento",
   "Teste de corte de ventilação e fechamento de dampers",
   "Teste de parada de equipamentos não-Ex (ESD de equipamentos elétricos)"]),
 ("IC-06", "BOP e Sistema de Controle de Poço", "Controle de Poço", "Alta", "Toolpusher", 21,
  "Resolução ANP nº 46/2016 (SGIP); API Std 53; API RP 59",
  "BOP e sistemas de controle (acumuladores, painéis, choke manifold) devem ser testados conforme norma. Falha de BOP impede a continuidade da operação.", [
   "Teste de pressão do BOP (baixa e alta) a cada 21 dias ou conforme API Std 53",
   "Teste de função do BOP semanal a partir dos painéis",
   "Teste de capacidade dos acumuladores (drawdown test)",
   "Certificação 5 anos (recertificação) do BOP",
   "Teste do choke & kill manifold e válvulas",
   "Simulados de kick (kick drill) registrados",
   "Sistemas de backup (acústico, ROV, autoshear/deadman) testados"]),
 ("IC-07", "Barreiras de Segurança do Poço (CSB)", "Controle de Poço", "Alta", "Toolpusher", 30,
  "Resolução ANP nº 46/2016 (SGIP); NORSOK D-010",
  "Conjuntos Solidários de Barreira (CSB) devem ser definidos, testados e monitorados em todas as fases.", [
   "Esquemáticos de barreiras atualizados por fase do poço",
   "Testes de integridade das barreiras (testes de pressão, LOT/FIT)",
   "Monitoramento contínuo de parâmetros do poço (volume nos tanques, trip tank)",
   "Procedimento de resposta a perda de barreira"]),
 ("IC-08", "Vasos de Pressão e Válvulas de Segurança (PSV)", "Integridade", "Alta", "Engenheiro de Integridade", 365,
  "NR-13; SGSO PG-13; API 510; API 576",
  "Vasos de pressão (acumuladores, ar comprimido, separadores) e PSVs com inspeção vencida devem ser retirados de operação.", [
   "Inspeções de segurança periódicas em dia",
   "PSVs calibradas e lacradas com certificado",
   "Prontuário e registro de segurança atualizados",
   "Sistema de alívio dimensionado para os cenários de sobrepressão"]),
 ("IC-09", "Geração de Energia de Emergência", "Elétrica", "Alta", "Supervisor de Elétrica", 30,
  "MODU Code; NR-10; NR-37",
  "Gerador de emergência, UPS e iluminação de emergência devem estar disponíveis.", [
   "Teste semanal de partida do gerador de emergência",
   "Teste de black-out com transferência automática",
   "Teste de autonomia das UPS e baterias",
   "Iluminação de emergência e rotas de fuga testadas"]),
 ("IC-10", "Equipamentos Elétricos em Áreas Classificadas (Ex)", "Elétrica", "Média", "Supervisor de Elétrica", 365,
  "NR-10; NR-37; IEC 60079-17; IECEx",
  "Equipamentos em áreas classificadas devem possuir certificação Ex e inspeções periódicas.", [
   "Inventário Ex com certificados (INMETRO/IECEx)",
   "Inspeções detalhadas e visuais conforme IEC 60079-17",
   "Tratamento das não conformidades Ex com prazo",
   "Pessoal com competência Ex (IECEx CoPC ou equivalente)"]),
 ("IC-11", "Meios de Abandono e Salvatagem", "Emergência", "Alta", "OIM", 90,
  "NR-37; SOLAS / MODU Code; NORMAM",
  "Baleeiras, balsas, coletes e rotas de fuga devem estar disponíveis para 100% do POB (mais redundância).", [
   "Baleeiras inspecionadas e com teste de lançamento",
   "Balsas salva-vidas com certificação de revisão anual",
   "Coletes e roupas de imersão em quantidade suficiente",
   "Simulados de abandono registrados",
   "Controle de POB atualizado"]),
 ("IC-12", "Ventilação, Pressurização e HVAC", "Processo / Segurança", "Média", "Supervisor de Mecânica", 90,
  "NR-37; API RP 505; IEC 60079-13",
  "Salas pressurizadas e ventilação de áreas classificadas garantem a não-classificação de ambientes com equipamentos não-Ex.", [
   "Teste de sobrepressão das salas (LQ, salas elétricas, controle)",
   "Teste de fechamento de dampers corta-fogo",
   "Alarme de perda de pressurização funcional"]),
 ("IC-13", "Detecção e Proteção contra H2S", "Processo / Segurança", "Alta", "Coord. SMS", 90,
  "NR-37; NR-09; API RP 49",
  "Em poços com potencial de H2S, a detecção, os equipamentos de respiração e os treinamentos são obrigatórios.", [
   "Detectores fixos de H2S calibrados",
   "Equipamentos de respiração autônoma (SCBA) e sistema cascata inspecionados",
   "Treinamento de H2S da tripulação",
   "Pontos de encontro (briefing areas) definidos conforme vento"]),
 ("IC-14", "Posicionamento Dinâmico / Ancoragem e Estabilidade", "Marítimo", "Alta", "OIM", 365,
  "NORMAM; IMO MSC/Circ.645; IMCA M 103",
  "Perda de posição pode exigir desconexão de emergência (EDS). Os sistemas de DP/ancoragem e lastro devem estar íntegros.", [
   "FMEA de DP atualizado e testes de DP anuais (DP trials)",
   "Teste de EDS (Emergency Disconnect Sequence)",
   "Manual de estabilidade e controle de pesos (deck load)",
   "Sistema de lastro e detecção de alagamento testados"]),
 ("IC-15", "Gestão de Elementos Críticos (ECSO) e Inibições", "Gestão", "Alta", "Supervisor de Manutenção", 30,
  "SGSO PG-11/PG-17",
  "Inibições, bypass e backlog de manutenção de ECSO devem ser controlados com análise de risco e medidas mitigadoras.", [
   "Registro de inibições/bypass com autorização do OIM",
   "Análise de risco e medidas mitigadoras para ECSO degradados",
   "Backlog de manutenção de ECSO dentro do limite aceitável",
   "Comunicação à ANP quando aplicável"]),
]

itens = []
for code, title, cat, crit, resp, per, ref, desc, rl in IC:
    it = build_item(code, title, True, resp, per, rl, {
        "categoria": cat, "criticidade": crit, "referencia": ref, "descricao": desc,
        "interrompeOperacao": True, "estadoOperacional": pick(code + "op", ["operacional"] * 4 + ["degradado"]),
        "testes": []
    }, dist=["conforme"] * 12 + ["parcial", "nao_avaliado"])
    it["testes"].append({"data": it["ultimaVerificacao"], "descricao": "Verificação periódica", "resultado": "aprovado", "executor": resp})
    itens.append(it)
# exemplo explícito de item inoperante
for it in itens:
    if it["id"] == "IC-03":
        it["estadoOperacional"] = "degradado"
        it["requisitos"][2]["status"] = "nao_conforme"
        it["requisitos"][2]["evidencia"] = "3 bicos obstruídos no dilúvio do moon pool"

# ------------------------------------------------------------------ Auditorias
auditorias = [
 {"id": "AUD-2026-001", "tipo": "externa", "entidade": "ANP", "titulo": "Auditoria SGSO ANP",
  "dataInicio": "2026-03-10", "dataFim": "2026-03-13", "auditorLider": "Equipe SSM/ANP", "status": "concluida",
  "escopo": ["PG-11", "PG-13", "PG-17", "IC-03", "IC-06"],
  "constatacoes": [
    {"id": "C-001", "ref": "PG-13", "tipo": "nc_maior", "descricao": "Backlog de manutenção preventiva de ECSO acima de 30 dias sem análise de risco.",
     "acao": "Elaborar análise de risco do backlog e plano de recuperação.", "responsavel": "Supervisor de Manutenção", "prazo": "2026-05-15", "status": "fechada"},
    {"id": "C-002", "ref": "IC-03", "tipo": "nc_maior", "descricao": "Teste de dilúvio do moon pool com bicos obstruídos.",
     "acao": "Desobstruir bicos, flushing da rede e novo teste.", "responsavel": "Supervisor de Manutenção", "prazo": "2026-10-30", "status": "em_tratamento"},
    {"id": "C-003", "ref": "PG-17", "tipo": "nc_menor", "descricao": "PTs sem registro de teste de gás em 2 de 15 amostras.",
     "acao": "Reciclagem dos emitentes de PT.", "responsavel": "Técnico de Segurança", "prazo": "2026-06-30", "status": "fechada"}]},
 {"id": "AUD-2026-002", "tipo": "interna", "entidade": "Auditoria Interna", "titulo": "Auditoria interna NR-10 / NR-13",
  "dataInicio": "2026-08-05", "dataFim": "2026-08-06", "auditorLider": "Coord. de Qualidade", "status": "concluida",
  "escopo": ["NR-10", "NR-13", "IC-01", "IC-08"],
  "constatacoes": [
    {"id": "C-001", "ref": "NR-10", "tipo": "nc_menor", "descricao": "Diagrama unifilar do quadro QD-05 desatualizado.",
     "acao": "Atualizar diagrama e incluir no PIE.", "responsavel": "Supervisor de Elétrica", "prazo": "2026-10-15", "status": "aberta"},
    {"id": "C-002", "ref": "IC-01", "tipo": "observacao", "descricao": "Clamp provisório na linha de água salgada sem MOC associado.",
     "acao": "Abrir MOC e programar reparo definitivo.", "responsavel": "Engenheiro de Integridade", "prazo": "2026-12-20", "status": "em_tratamento"},
    {"id": "C-003", "ref": "NR-13", "tipo": "oportunidade", "descricao": "Digitalizar prontuários dos vasos de pressão.",
     "acao": "Avaliar sistema de gestão documental.", "responsavel": "Coord. de Qualidade", "prazo": "2027-02-28", "status": "aberta"}]},
 {"id": "AUD-2026-003", "tipo": "externa", "entidade": "Operadora (Cliente)", "titulo": "Auditoria de aceitação da sonda (pré-contrato)",
  "dataInicio": "2026-12-01", "dataFim": "2026-12-04", "auditorLider": "Equipe Operadora", "status": "planejada",
  "escopo": ["NR-37", "PG-14", "IC-04", "IC-05", "IC-06", "IC-11"], "constatacoes": []},
]

db = {
  "meta": {
    "sonda": "Sonda SS-01 (exemplo)", "tipo": "Semissubmersível", "operador": "Operadora Exemplo",
    "bacia": "Bacia de Santos", "versao": "1.0.0", "atualizadoEm": TODAY.isoformat(),
    "observacao": "Dados de exemplo para demonstração. Valide os requisitos com o texto vigente de cada norma/resolução."
  },
  "responsaveis": RESP,
  "nrs": nrs, "sgso": sgso, "itensCriticos": itens, "auditorias": auditorias,
}

os.makedirs(OUT, exist_ok=True)
with open(f"{OUT}/database.json", "w", encoding="utf-8") as f:
    json.dump(db, f, ensure_ascii=False, indent=2)
with open(f"{OUT}/database.js", "w", encoding="utf-8") as f:
    f.write("// Cópia de database.json para funcionar ao abrir index.html direto do disco (file://)\n")
    f.write("window.SEED_DB = ")
    json.dump(db, f, ensure_ascii=False, indent=2)
    f.write(";\n")
print(len(nrs), len(sgso), len(itens), len(auditorias))
