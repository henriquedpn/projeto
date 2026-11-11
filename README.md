# Gestão Técnica da Sonda de Perfuração

Aplicação web (HTML + CSS + JavaScript puro + banco JSON) para gerenciar o conteúdo técnico de uma sonda:

1. **Normas Regulamentadoras (NR-01 a NR-38)** – aplicabilidade, requisitos/checklist, evidências, responsável e periodicidade.
2. **SGSO – ANP (Resolução ANP nº 43/2007)** – as 17 Práticas de Gestão (PG-01 a PG-17).
3. **Itens Críticos ANP que interrompem a operação** – integridade de tubulações, dispersão de gases, bomba de incêndio e dilúvio, F&G, ESD, BOP, barreiras de poço, PSVs, energia de emergência, Ex, salvatagem, HVAC, H2S, DP/estabilidade e ECSO. Com estado operacional, registro de testes e alerta de **risco de interrupção**.
4. **Auditorias internas e externas** – escopo vinculado aos itens 1, 2 e 3, constatações (NC maior/menor, observação, oportunidade), ações corretivas, prazos e **Plano de Ação** consolidado.

## Como usar
- Abra `index.html` direto no navegador **ou** sirva a pasta: `python3 -m http.server 8000` e acesse http://localhost:8000.
- As alterações ficam salvas no navegador (localStorage). Use **Exportar JSON** para backup ou para substituir `data/database.json`.
- **Configurações → Restaurar banco original** recarrega `data/database.json`.

## Estrutura
```
index.html            interface
css/styles.css        estilos (tema claro/escuro, responsivo, impressão)
js/app.js             lógica (rotas, CRUD, painel, filtros, import/export)
data/database.json    banco de dados
data/database.js      cópia do banco para funcionar via file:// (sem servidor)
tools/gerar_database.py  regenera database.json e database.js
```

> Os dados fornecidos são **exemplos**. Valide os requisitos com o texto vigente de cada NR e resolução da ANP.
