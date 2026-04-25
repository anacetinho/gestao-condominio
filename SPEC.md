# SPEC.md — Administração de Condomínio (v2.1)

> **v2.1 supersede v2.0.** Três refinamentos:
> 
> 1. **Sem proporcionalidade na entrada a meio do mês** — quota é gerada pelo valor mensal completo. Acerto entre comprador/vendedor é fora da app.
> 1. **Reembolsos pós-anulação de derrama** — quando uma grande despesa é anulada com prestações já pagas, a app regista a lista de reembolsos a tratar, mas o reembolso em si é feito fora da aplicação.
> 1. **UI consolidada para múltiplas derramas** — em “Minhas contas”, se houver ≥ 2 derramas activas, a UI consolida-as numa linha tappable que abre modal com breakdown.
> 
> SaaS multi-tenant. Sem processamento de pagamentos. Administrador é morador eleito, com transferência rotativa.

**Changelog vs v2.0** está em Appendix D.

-----

## 1. High-Level Description

**Product name:** Administração de Condomínio

**One-liner:** Aplicação web onde os moradores de um prédio gerem em conjunto orçamento, quotas mensais, reuniões, ocorrências, e pequenos pedidos do dia-a-dia — sem precisar de empresa gestora externa.

**Primary user:** Moradores de prédios pequenos a médios (5–40 frações) em Portugal que se auto-administram. Idade 25–75. Administrador é morador eleito que rotaciona, sem formação técnica.

**Core problem:** Administração de condomínios pequenos é hoje feita em WhatsApp + Excel + papéis no elevador. Quotas mensais são registadas a martelo em folhas. Quando há uma grande despesa (telhado, elevador), o cálculo da derrama é feito manualmente, comunicado ao chat, e cada morador acaba a pagar de forma desorganizada. Transição de administrador é caótica.

**Mental model financeiro:**

```
   Quotas mensais ──→ Fundo comum ──→ Pagam despesas correntes
                                       (limpeza, água, electricidade, manutenção)

   Grandes despesas ──→ Reunião + voto ──→ Se aprovada:
                                            Derrama distribuída por N meses
                                            adiciona-se à quota durante N meses
```

**Happy path (lançar uma grande despesa pelo administrador):**

1. Administrador detecta necessidade (ex: reparação do telhado, orçamento €5.600).
1. Abre “Grandes Despesas” → “Nova proposta”, introduz descrição, valor total, anexa orçamento.
1. Sistema calcula automaticamente o impacto por fração (ex: 8 frações × rateio igual = €700/fração, ou conforme permilagem).
1. Administrador escolhe diluir em N meses (ex: 4 meses) → sistema mostra “€175/mês por fração durante 4 meses”.
1. Administrador associa a proposta a uma reunião agendada (ou cria nova convocatória).
1. Na reunião, admin regista decisão “Aprovada”.
1. Sistema cria automaticamente as imputações extra nas quotas dos próximos 4 meses.
1. Cada morador recebe notificação: “A sua quota mensal sobe €175 durante 4 meses devido à reparação do telhado aprovada na reunião de Abril/26.”

**Happy path (morador paga a quota do mês):**

1. Morador abre “Minhas contas”.
1. Vê a quota deste mês: **€25 (base)** + **€175 (reparação telhado)** = **€200**.
1. O valor extra aparece em cor diferente, com link para o detalhe da grande despesa aprovada.
1. Após pagar (transferência, MB Way, etc., **fora da app**), clica “Marcar como pago”.

**North star metrics:**

- ≥ 70% dos moradores entram pelo menos 1×/mês para ver a quota.
- Tempo entre proposta de grande despesa → derrama activa nas quotas: ≤ 30 dias.
- Transição de administrador feita em < 10 minutos.

**Out of scope para v1:**

- Processamento real de pagamentos (MB Way, SEPA, débito directo).
- Integração bancária / reconciliação automática.
- Cálculo automático da quota base a partir do orçamento anual (admin define manualmente em v1; cálculo guiado em P1).
- **Apuramento proporcional para entradas/saídas a meio do mês** — assunto entre comprador e vendedor (v2.1).
- **Processamento de reembolsos** quando derramas são anuladas — admin trata fora da aplicação (v2.1).
- Voto eletrónico vinculativo nas assembleias.
- Apps nativas iOS/Android (web responsive + PWA aceitáveis).
- Idiomas que não Português europeu.
- Gestão fiscal / IRC do condomínio.
- Edifícios mistos com regimes diferenciados.

-----

## 2. Technology Stack

(Inalterado face a v2.0 — Next.js 15 + Supabase + Prisma + shadcn/ui.)

|Camada                    |Escolha                   |Versão|
|--------------------------|--------------------------|------|
|Framework                 |Next.js (App Router)      |15+   |
|Linguagem                 |TypeScript                |5.5+  |
|BD                        |PostgreSQL via Supabase   |16+   |
|ORM                       |Prisma                    |5.20+ |
|Auth                      |Supabase Auth (magic link)|—     |
|UI                        |shadcn/ui + Tailwind      |latest|
|Validação                 |Zod                       |3.23+ |
|Forms                     |React Hook Form + Zod     |—     |
|Storage                   |Supabase Storage          |—     |
|Email                     |Resend                    |—     |
|Calendar export           |`ics`                     |3.7+  |
|Notificações WhatsApp (P1)|Meta WhatsApp Cloud API   |v21+  |
|Cron jobs                 |Vercel Cron               |—     |
|Tests                     |Vitest + Playwright       |—     |
|Lint/Format               |Biome                     |1.9+  |
|Package manager           |pnpm                      |9+    |
|Deployment                |Vercel + Supabase         |—     |

```bash
pnpm dev                       # Dev local
pnpm prisma migrate dev        # Migrations
pnpm biome check .             # Lint + Format
pnpm test                      # Unit
pnpm test:e2e                  # E2E
pnpm build && pnpm start
```

-----

## 3. Architecture & File Structure

### Modelo de papéis

|Papel            |Cor mockup|Vê                                                                                |Edita                                                                                                                     |
|-----------------|----------|----------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|
|**Morador**      |Azul      |Quotas próprias, contas gerais, reuniões, ocorrências, comunidade                 |Pedidos, ocorrências, perfil, marcar quota como paga                                                                      |
|**Administrador**|Verde     |Tudo do morador + visão de quem pagou/não pagou + **lista de reembolsos a tratar**|Tudo do morador + quota base, despesas correntes, grandes despesas, reuniões, membros, **marcar reembolsos como tratados**|

### Folder layout

```
/administracao-condominio
  /app
    /(public)
      /sign-in
      /accept-invite/[token]
    /(app)
      /[condominioId]
        /dashboard
        /orcamento
          /minhas-contas
          /contas-gerais
          /projeccao
        /reunioes
        /ocorrencias
        /comunidade/...
        /conta/...
        /admin
          /quota-base
          /despesas-correntes
          /grandes-despesas
            /[grandeDespesaId]
            /[grandeDespesaId]/reembolsos    ← v2.1: tracking de reembolsos pós-anulação
            /nova
          /membros
          /transferir
          /configuracoes
    /api
      /webhooks/resend
      /cron
        /gerar-quotas-mensais
        /lembretes
    middleware.ts
  /components
    /ui
    /domain
      QuotaCard.tsx
      DerramaBreakdownModal.tsx        ← v2.1: modal para ≥2 derramas
      GrandeDespesaForm.tsx
      DerramaPreview.tsx
      ReembolsoTracker.tsx             ← v2.1: lista de reembolsos a tratar
      ...
  /lib
    /db
    /auth
    /tenancy
    /quotas
    /grandes-despesas
    /notifications
    /validation
  /prisma
    schema.prisma
    /migrations
  /tests
  README.md
  SPEC.md
  WORKING.md
```

### Data flow narratives

**Quota mensal:**

1. **Cron mensal** (dia 1, 06:00) — para cada `Membership` activa em cada `Condominio`, cria 1 `QuotaMensal` com `valorBaseCents` derivado de `ConfiguracaoQuota` activa. **Sem proporcionalidade**: o valor é sempre o valor mensal cheio, mesmo para membros que entraram a meio do mês anterior (v2.1).
1. **Aplicação de derramas** — `ImputacaoExtra` aprovadas com `mesAplicacao` corrente são associadas à `QuotaMensal`.
1. **Notificação** — email “Quota de [mês/ano] disponível: €X (base) + €Y (extras)”.
1. **Pagamento manual** — morador transfere fora da app, marca como pago.

**Grande despesa (derrama):**

1. Admin cria `GrandeDespesa` (rascunho).
1. Sistema calcula em tempo real `impactoPorFracao`.
1. Admin associa a um `Decisao` de uma `Reuniao` agendada.
1. Reunião acontece, admin regista resultado.
1. Se `APROVADA` → trigger automático cria `N × M` registos de `ImputacaoExtra`.
1. Próxima geração mensal de quotas absorve os extras automaticamente.

**Anulação de derrama (v2.1):**

1. Admin anula `GrandeDespesa(APROVADA)`.
1. `ImputacaoExtra` PENDENTES (futuras) → `ANULADA`, removidas das próximas quotas.
1. `ImputacaoExtra` APLICADAS (passadas, em quotas já pagas) → `ANULADA`, com `reembolsadaEm=null`, ficam visíveis em “Reembolsos a tratar”.
1. Admin trata reembolsos um a um, fora da app.
1. Para cada reembolso tratado, admin clica “Marcar como tratado” → `reembolsadaEm` preenchido.

-----

## 4. Detailed Features

### Feature 1: Onboarding e Auth (multi-tenant)

**Priority:** P0
*(Inalterada face a v1, com 1 nota nova de v2.1.)*

**Edge case adicional (v2.1):**

- **Membership criada a meio do mês:** sistema gera `QuotaMensal` para o **valor mensal completo** quando o cron correr (próximo dia 1). UI informa admin no momento da adição: “A primeira quota será cobrada pelo valor mensal completo. Eventual acerto com o anterior morador é entre as partes (fora da app).”
- O mesmo princípio aplica-se a saídas: se o `leftAt` de um Membership for a meio do mês, a `QuotaMensal` desse mês mantém-se cobrada integralmente. Acerto é privado.

-----

### Feature 2: Dashboard

**Priority:** P0
*(Inalterada face a v2.0.)*

-----

### Feature 3: ⭐ Minhas Contas (morador) — UI ADAPTATIVA EM v2.1

**Priority:** P0
**Trigger:** “Orçamento” → “Minhas contas”.

**Comportamento — adaptativo ao número de extras (v2.1):**

|Cenário   |UI                                                                                                                                                                  |
|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|0 extras  |Card mostra só “Base €X / Total €X”                                                                                                                                 |
|1 extra   |Card mostra “Base”, linha extra **nomeada** em laranja (clicável → detalhe da grande despesa)                                                                       |
|≥ 2 extras|Card mostra “Base”, **uma única linha consolidada** “Extras (N derramas) €Y” em laranja, **tappable** → abre modal `<DerramaBreakdownModal/>` com breakdown completo|

**Conteúdo do modal `<DerramaBreakdownModal/>`:**

- Para cada derrama activa neste mês:
  - Título da grande despesa
  - Valor desta prestação
  - Indicador “Prestação X de Y”
  - Reunião que aprovou (data + link)
  - Botão “Ver detalhe” → abre o detalhe completo da grande despesa
- No fim: total dos extras + lembrete do total da quota.

**Resto do ecrã (inalterado v2.0):**

- Histórico das quotas dos últimos 12 meses.
- Filtros: todas / pagas / pendentes / em atraso.
- Total anual a pagar / pago.
- Botão “Marcar como pago” + opção de anexar comprovativo.

**Schema da resposta da API (`GET /api/condominios/[id]/quotas/me`):**

```typescript
{
  mesCorrente: {
    quotaId: string,
    mes: number, ano: number,
    valorBaseCents: number,
    extras: Array<{
      id: string,
      grandeDespesaId: string,
      titulo: string,
      valorCents: number,
      prestacaoActual: number,
      prestacoesTotal: number,
      reuniaoId: string,
      reuniaoData: string  // ISO date
    }>,
    valorTotalCents: number,
    estado: 'PENDENTE' | 'PAGA' | 'EM_ATRASO',
    pagaEm: Date | null
  },
  historico: QuotaResumo[]
}
```

A decisão “1 extra vs ≥2 extras” é puramente client-side: front-end conta `mesCorrente.extras.length` e renderiza o componente apropriado.

**Edge cases:**

- Quota do mês ainda não gerada → estado vazio: “Quota de [mês] ainda não está disponível. Volte amanhã ou contacte o administrador.”
- Extras revertidos (grande despesa anulada) → quota é recalculada; UI mostra aviso “Esta quota foi corrigida em [data] devido a [motivo]”.
- Quota corrigida após pagamento (raro) → notificação especial ao morador.

-----

### Feature 4: Contas Gerais (todos)

**Priority:** P0
*(Inalterada face a v2.0.)*

-----

### Feature 5: Projecção Anual

**Priority:** P1
*(Inalterada face a v2.0.)*

-----

### Feature 6: Reuniões — Convocatórias (admin)

**Priority:** P0
*(Inalterada face a v2.0.)*

-----

### Feature 7: Reuniões — Presenças e Actas

**Priority:** P0
*(Inalterada face a v2.0.)*

-----

### Feature 8: Ocorrências

**Priority:** P0
*(Inalterada face a v1.)*

-----

### Feature 9–13: Comunidade e Conta

**Priority:** P1 / P2
*(Inalteradas. Ver v1 §4.9–4.13.)*

-----

### Feature 14: Quota Base — Configuração (admin)

**Priority:** P0
*(Inalterada face a v2.0.)*

-----

### Feature 15: Despesas Correntes (admin)

**Priority:** P0
*(Inalterada face a v2.0.)*

-----

### Feature 16: ⭐ Grandes Despesas (workflow completo)

**Priority:** P0

#### 16a–c. Criar proposta, associar a reunião, voto

*(Inalterados face a v2.0.)*

#### 16d. Execução (admin marca obra como concluída)

*(Inalterada face a v2.0.)*

#### 16e. ⭐ Reembolsos pós-anulação (NOVA em v2.1)

**Trigger:** Admin anula uma `GrandeDespesa(estado=APROVADA)` que tem prestações já APLICADAS (i.e., quotas já pagas pelos moradores que incluíam essa derrama).

**Comportamento da anulação:**

1. Admin clica “Anular grande despesa” no detalhe.
1. Modal de confirmação 2-step + campo obrigatório de motivo.
1. Sistema separa as `ImputacaoExtra` em:
- **Futuras / pendentes** (`estado=PENDENTE`, ainda não aplicadas a quotas) → marcadas `ANULADA`. Removidas silenciosamente das próximas quotas.
- **Passadas / aplicadas** (`estado=APLICADA`, já em quotas pagas ou pendentes) → marcadas `ANULADA` mas com `reembolsadaEm=null`. Ficam listadas para tratamento.
1. Notificação a cada morador afectado:

> “A derrama ‘[Título]’ foi anulada. As prestações futuras (€X/mês) deixam de ser cobradas. Para o valor já pago (€Y), o administrador irá tratar do reembolso fora da aplicação.”

**Tela “Reembolsos a tratar” (admin):**
Em `/admin/grandes-despesas/[id]/reembolsos`:

- Lista de cada `ImputacaoExtra(estado=ANULADA, reembolsadaEm=null)` desta grande despesa.
- Cada linha:
  - Morador (nome + fração)
  - Mês/ano da prestação
  - Valor a reembolsar
  - Botão “Marcar reembolso como tratado” → modal pequeno com campo opcional de “nota / referência”.
- No topo: total a reembolsar agregado, total já tratado, % concluído.

**Comportamento ao “marcar como tratado”:**

- `ImputacaoExtra.reembolsadaEm = now()`.
- `ImputacaoExtra.reembolsadaNotas = nota livre` (ex: “transferência ref. MBWY-12345 a 23/04/2026”).
- Audit log: regista admin que marcou + nota.
- Sistema **não processa** o reembolso. É apenas tracking.

**Vista do morador (sem mudança de ecrã específica):**

- O morador não vê uma tela própria de reembolsos.
- A info chega-lhe pela notificação inicial e, se quiser confirmar, vê na tela de detalhe da grande despesa anulada o estado “Aguarda reembolso” ou “Reembolso tratado em [data] — nota: [texto]”.

**Edge cases:**

- Anulação revertida (admin desfaz a anulação) → operação só permitida se nenhum reembolso foi marcado como tratado. Caso contrário, bloqueada (já se mexeu em dinheiro real).
- Morador saiu do prédio entre a aplicação e a anulação → reembolso continua listado no nome dele à data da prestação. Admin tem de tratar com o ex-morador (info de contacto disponível no histórico do membership).

-----

### Feature 17: Membros e Transferência de Admin

**Priority:** P0
*(Inalterada face a v1.)*

-----

### Feature 18: Audit log

**Priority:** P0
*(Inalterada face a v2.0; v2.1 adiciona cobertura para “marcar reembolso como tratado”.)*

-----

### Feature 19: Geração mensal de quotas (cron)

**Priority:** P0

**Comportamento (alteração v2.1):** o cron gera `QuotaMensal` com **valor mensal completo** para todas as `Membership` activas, **sem proporcionalidade** para entradas a meio do mês anterior. A regra “quem mora paga o mês inteiro” simplifica o sistema e empurra o acerto para o lado privado (comprador/vendedor).

(Restante inalterado face a v2.0: idempotência, alertas em falha, ligação às `ImputacaoExtra` do mês.)

-----

## 5. Data Model (v2.1)

### Mudanças face a v2.0

Apenas 2 campos novos em `ImputacaoExtra` (para o tracking de reembolsos):

```prisma
model ImputacaoExtra {
  id               String   @id @default(cuid())
  grandeDespesaId  String
  fracaoId         String
  quotaMensalId    String?
  mesAplicacao     Int
  anoAplicacao     Int
  valorCents       Int
  prestacaoActual  Int
  prestacoesTotal  Int
  estado           EstadoImputacao @default(PENDENTE)

  // === v2.1: tracking de reembolso pós-anulação ===
  reembolsadaEm    DateTime?
  reembolsadaNotas String?
  reembolsadaPor   String?    // membershipId do admin que marcou

  grandeDespesa    GrandeDespesa @relation(fields: [grandeDespesaId], references: [id])
  fracao           Fracao        @relation(fields: [fracaoId], references: [id])
  quotaMensal      QuotaMensal?  @relation(fields: [quotaMensalId], references: [id])
  createdAt        DateTime @default(now())

  @@index([fracaoId, anoAplicacao, mesAplicacao])
  @@index([grandeDespesaId])
  @@index([grandeDespesaId, estado, reembolsadaEm])  // v2.1: para query "reembolsos a tratar"
}

enum EstadoImputacao { PENDENTE APLICADA ANULADA }
```

**Semântica dos estados (clarificada em v2.1):**

- `PENDENTE` — imputação criada, ainda não foi associada a uma `QuotaMensal` (mês futuro).
- `APLICADA` — imputação foi associada a uma `QuotaMensal` (mês corrente ou passado).
- `ANULADA` — imputação revertida por anulação da grande despesa. Se `reembolsadaEm IS NULL`, está em “reembolsos a tratar”.

(Restante do schema inalterado face a v2.0 — ver v2.0 §5 para o resto: `Condominio`, `Fracao`, `User`, `Membership`, `ConfiguracaoQuota`, `QuotaMensal`, `DespesaCorrente`, `GrandeDespesa`, `Reuniao`, `Decisao`, `Presenca`, `Ocorrencia`, `Pedido`, `Oferta`, `Evento`, `AuditLog`.)

**Retenção (inalterada):**

- `ConfiguracaoQuota`, `QuotaMensal`, `GrandeDespesa`, `ImputacaoExtra`, `DespesaCorrente`: indefinidamente (legal).
- `AuditLog`: 5 anos.

-----

## 6. External Integrations

(Inalterado face a v1: Supabase, Resend, Meta WhatsApp Cloud API opcional.)

-----

## 7. Design Requirements

### Princípios mantidos

Mobile-first, 3 pilares × 3 faixas, “você”, WCAG 2.1 AA.

### ⭐ Ecrã “Minhas contas” — variantes (v2.1)

**Variante 1 — sem extras:**

```
┌──────────────────────────────────────┐
│ Quota deste mês — Abril 2026         │
│ ┌──────────────────────────────────┐ │
│ │  Base                    €25,00  │ │
│ │  ──────────────────────────────  │ │
│ │  Total a pagar           €25,00  │ │
│ │                                  │ │
│ │  ⏳ Pendente                     │ │
│ │  [    Marcar como pago    ]      │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**Variante 2 — 1 extra (idêntica a v2.0):**

```
┌──────────────────────────────────────┐
│ Quota deste mês — Abril 2026         │
│ ┌──────────────────────────────────┐ │
│ │  Base                    €25,00  │ │
│ │  + Reparação telhado     €70,00  │ │  ← cor laranja, clicável
│ │  ──────────────────────────────  │ │
│ │  Total a pagar           €95,00  │ │
│ │                                  │ │
│ │  [ Marcar como pago ]            │ │
│ └──────────────────────────────────┘ │
│ ⓘ 2ª de 3 prestações — Reunião Mar/26│
└──────────────────────────────────────┘
```

**Variante 3 — ≥ 2 extras (NOVA em v2.1):**

```
┌──────────────────────────────────────┐
│ Quota deste mês — Abril 2026         │
│ ┌──────────────────────────────────┐ │
│ │  Base                    €25,00  │ │
│ │  + Extras (3 derramas)  €170,00 ›│ │  ← laranja, tappable
│ │  ──────────────────────────────  │ │
│ │  Total a pagar          €195,00  │ │
│ │                                  │ │
│ │  [ Marcar como pago ]            │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘

Tap na linha "Extras" → abre modal:

┌──────────────────────────────────────┐
│ ✕  Extras de Abril 2026              │
│                                      │
│ Tem 3 derramas activas este mês:     │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Reparação telhado                │ │
│ │ €70,00 · prestação 2 de 3        │ │
│ │ Aprovada em Reunião 15/Mar/2026  │ │
│ │ [Ver detalhe →]                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Pintura fachada                  │ │
│ │ €60,00 · prestação 1 de 6        │ │
│ │ Aprovada em Reunião 02/Apr/2026  │ │
│ │ [Ver detalhe →]                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Substituição porta entrada       │ │
│ │ €40,00 · prestação 1 de 1        │ │
│ │ Aprovada em Reunião 02/Apr/2026  │ │
│ │ [Ver detalhe →]                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Total dos extras:        €170,00     │
│ + Base (€25,00)                      │
│ = Quota total Abril:     €195,00     │
└──────────────────────────────────────┘
```

### ⭐ Ecrã “Reembolsos a tratar” (admin, NOVO em v2.1)

```
┌──────────────────────────────────────┐
│ ← Reparação telhado (anulada)        │
│                                      │
│ Reembolsos a tratar                  │
│                                      │
│ Total a reembolsar:    €280,00       │
│ Já tratados:           €70,00 (25%)  │
│ Pendentes:             €210,00       │
│                                      │
│ [ A tratar ] Tratados  Todos         │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Maria Silva — 1ºA                │ │
│ │ Mar/2026 · €70,00                │ │
│ │ [ Marcar reembolso como tratado ]│ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ João Costa — 1ºB                 │ │
│ │ Mar/2026 · €70,00                │ │
│ │ [ Marcar reembolso como tratado ]│ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Ana Pereira — 2ºA                │ │
│ │ Mar/2026 · €70,00                │ │
│ │ ✓ Tratado em 23/Apr/2026         │ │
│ │ Ref: MBWY-12345                  │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### Convenções de cor

(Inalteradas v2.0.)

- Valor base: `text-foreground`
- Extras (derramas): `text-orange-600 dark:text-orange-400`
- Estado PAGO/Tratado: `text-green-600`
- Estado EM_ATRASO: badge vermelho
- Estado PENDENTE: neutro

-----

## 8. Non-Functional Requirements

(Inalterado face a v2.0.)

-----

## 9. Acceptance Criteria

### Onboarding e Multi-tenancy

*(AC-1 a AC-5: como em v1.)*

### Quota base

*(AC-6 a AC-8: como em v2.0.)*

### Geração mensal de quotas (cron) — alterada em v2.1

- **AC-9:** Dado o cron a correr no dia 1 do mês, quando executa, então cria 1 `QuotaMensal` por cada Membership activa do condomínio com `valorBaseCents` = configuração activa, `estado=PENDENTE`.
- **AC-10:** Idempotência: cron a correr 2x no mesmo mês não cria duplicados (`unique(fracaoId, ano, mes)`).
- **AC-11 (alterada em v2.1):** Dada uma `Membership` criada no dia 15 do mês, quando o trigger de criação corre, então é criada `QuotaMensal` para esse mês com `valorBaseCents` = **valor mensal completo da configuração** (sem proporcionalidade). UI exibe nota informativa ao admin.

### ⭐ Minhas contas — atualizada em v2.1

- **AC-12 (alterada em v2.1):** Dado um morador com 0 extras este mês, quando vê “Minhas contas”, então a UI mostra apenas linha “Base” e “Total” sem qualquer secção de extras.
- **AC-13 (renumerada de AC-12):** Dado um morador com **1 extra** de €70 (grande despesa “Reparação telhado”), quando vê “Minhas contas”, então a UI mostra “Base €25” + linha **nomeada** “+ Reparação telhado €70” em laranja, clicável para detalhe da grande despesa.
- **AC-14 (NOVA em v2.1):** Dado um morador com **3 extras** totalizando €170, quando vê “Minhas contas”, então a UI mostra “Base €25” + linha **consolidada** “+ Extras (3 derramas) €170” em laranja, tappable.
- **AC-15 (NOVA em v2.1):** Dada a UI consolidada da AC-14, quando o morador toca na linha “Extras”, então abre modal `<DerramaBreakdownModal/>` listando as 3 derramas com: título, valor desta prestação, “Prestação X de Y”, data da reunião que aprovou, link para detalhe.
- **AC-16:** Dada uma quota com `estado=PENDENTE`, quando o morador clica “Marcar como pago”, então `estado=PAGA` e `pagaEm=now()`.
- **AC-17:** Dada uma quota cuja imputação extra é anulada (grande despesa anulada), então a UI mostra aviso “Esta quota foi corrigida em [data] devido a [motivo]” e o total é recalculado.

### Grandes despesas — workflow completo

*(AC-18 a AC-21: equivalentes a AC-15 a AC-18 da v2.0 — preview, associação a reunião, aprovação, ligação ao mês.)*

### ⭐ Anulação de derrama com reembolsos — alterada em v2.1

- **AC-22 (alterada em v2.1):** Dada uma `GrandeDespesa(APROVADA)` com 4 prestações, das quais 2 já APLICADAS (em quotas PAGAS) e 2 PENDENTES, quando admin a anula:
  - Operação requer 2-step confirmation + motivo obrigatório.
  - As 2 PENDENTES → `ImputacaoExtra.estado=ANULADA`, sem entrada na lista de reembolsos.
  - As 2 APLICADAS → `ImputacaoExtra.estado=ANULADA` com `reembolsadaEm=null`, listadas em “Reembolsos a tratar”.
  - Cada morador afectado recebe notificação informando do reembolso a tratar fora da aplicação.
  - Audit log regista a anulação com motivo.
- **AC-23 (NOVA em v2.1):** Dada uma `ImputacaoExtra(estado=ANULADA, reembolsadaEm=null)`, quando admin clica “Marcar reembolso como tratado” e adiciona nota opcional, então `reembolsadaEm=now()`, `reembolsadaNotas` é gravada, `reembolsadaPor` regista o admin, e operação aparece em audit log.
- **AC-24 (NOVA em v2.1):** Dada uma anulação onde pelo menos 1 reembolso foi marcado como tratado, quando admin tenta reverter a anulação, então a operação é bloqueada com mensagem clara.
- **AC-25 (NOVA em v2.1):** Dada uma `GrandeDespesa(ANULADA)`, quando o morador vê o detalhe, então cada prestação que o afectou aparece com estado: “Reembolso aguarda” OU “Reembolso tratado em [data] · nota: [texto]”.

### Execução

- **AC-26 (renumerada):** Dada uma `GrandeDespesa(APROVADA)` em execução, quando admin marca `executadaEm` com `valorFinalCents=valorTotalCents+30%`, então a operação requer nota explicativa antes de gravar.

### Reuniões, Ocorrências, Membros, Audit

*(AC-27 a AC-32: como v1/v2.0.)*

### Ops

- **AC-33:** `pnpm test` exits 0.
- **AC-34:** `pnpm test:e2e` (smoke v2.1: signup → criar condomínio → configurar quota → cron → ver Minhas contas → admin lança 2 grandes despesas → reuniões → aprovação ambas → morador vê extras consolidados → modal abre com 2 derramas → admin anula 1 derrama parcialmente cobrada → admin marca 1 reembolso como tratado) passa em ≤ 90s.
- **AC-35:** `pnpm biome check .` exits 0.

-----

## 10. Test Requirements

### Unit (Vitest)

**Crítico (cobertura ≥ 90%):**

- Cálculo de imputação: rateio igual e por permilagem.
- Geração de `ImputacaoExtra` quando grande despesa é aprovada.
- **Anulação de grande despesa** — separação correcta entre PENDENTES (silenciosamente revertidas) vs APLICADAS (marcadas para reembolso) (v2.1).
- **Marcação de reembolso como tratado** — idempotência, audit log, validação de estado prévio (v2.1).
- Soma de extras + base na vista do morador.
- **Lógica adaptativa da UI**: 0 / 1 / N extras → renderização correcta (v2.1).

**Importante (≥ 70%):** restante.

### Integration / E2E (Playwright)

**Suite obrigatória — happy path expandido em v2.1:**

1. Admin cria condomínio com 4 frações.
1. Admin configura quota base €30/fração.
1. Avança relógio → cron gera 4 `QuotaMensal`.
1. Cada morador vê quota €30 base.
1. Admin cria **2** grandes despesas (€2.000/4 meses e €600/2 meses).
1. Admin agenda reunião e associa ambas.
1. Admin publica acta com `APROVADO` para ambas.
1. Avança 1 mês.
1. Cada morador vê quota = €30 base + linha “Extras (2 derramas) €X” em laranja.
1. Tap na linha → modal abre com 2 derramas listadas.
1. Morador marca como paga.
1. Admin avança outro mês → moradores pagam de novo (3 prestações de €X).
1. Admin **anula a primeira grande despesa** (com 3 prestações já APLICADAS).
1. Sistema cria 4×3=12 entradas em “Reembolsos a tratar” (4 frações × 3 meses).
1. Admin marca 6 dos 12 como tratados.
1. Vista de “Reembolsos a tratar” mostra 50% concluído.
1. Admin tenta reverter anulação → bloqueado.

### Mocking

- Resend, Supabase Auth: como v1.
- Cron: chamada directa ao endpoint com `now()` mockado.

### Manual checklist

- 22 itens em `/tests/manual/checklist.md`. Foco em cenários críticos de v2.1: anulação parcial, reembolsos, modal de breakdown.

-----

## 11. Build, Run, Deploy

```bash
pnpm install
cp .env.example .env.local
# Variáveis: SUPABASE, DATABASE_URL, DIRECT_URL, RESEND_API_KEY,
#            RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL, CRON_SECRET

pnpm prisma generate
pnpm prisma migrate dev

pnpm dev
pnpm test
pnpm test:e2e
pnpm biome check .
```

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/gerar-quotas-mensais", "schedule": "0 5 1 * *" }
  ]
}
```

-----

## 12. Definition of Done (v1 do produto, baseado em SPEC v2.1)

```
[ ] Features P0 (1, 2, 3, 4, 6, 7, 8, 14, 15, 16 incl. 16e, 17, 18, 19) implementadas
[ ] Todos os AC com prefixo "AC-" passam (35 critérios em v2.1)
[ ] pnpm test exits 0
[ ] pnpm test:e2e (incluindo happy path v2.1 com modal e reembolsos) exits 0
[ ] pnpm biome check . exits 0
[ ] Cron do dia 1 verificado em produção pelo menos 1 ciclo completo
[ ] Pelo menos 1 anulação de grande despesa testada em ambiente real (mesmo que de teste)
[ ] README.md cobre: setup, deploy, criação do primeiro condomínio,
    configuração de quota base, lançamento de grande despesa, anulação e reembolsos
[ ] .env.example completo
[ ] 1 condomínio real (o do Luís) em produção com ≥ 3 moradores e
    pelo menos 1 ciclo de quota mensal cobrado
[ ] RLS verificado: tentar aceder cross-tenant via SQL é bloqueado
[ ] Backup automático Supabase verificado
```

-----

## Appendix A: “Do not” rules (v2.1)

- Não introduzir processamento de pagamentos.
- Não imputar despesas correntes directamente a moradores.
- Não criar `ImputacaoExtra` sem `Decisao` aprovada.
- Não permitir alteração de `valorBaseCents` numa `QuotaMensal` PAGA (criar nova `ConfiguracaoQuota`).
- Não permitir hard delete de `GrandeDespesa` aprovada.
- Não permitir `vigenteDesde` retroactivo sem flag explícita + motivo.
- **Não calcular quotas proporcionais para entradas/saídas a meio do mês (v2.1).** É decisão consciente — empurra acerto para fora da app.
- **Não processar reembolsos de derramas anuladas (v2.1).** App apenas regista que foram tratados.
- **Não permitir reverter anulação se já houve reembolsos marcados como tratados (v2.1).**
- Não usar localStorage para dados sensíveis.
- Não enviar mais de 1 email por morador por hora por categoria.

## Appendix B: Escalate to human before

- Alteração ao modelo de derrama.
- Mudar regra “despesas correntes saem do fundo, grandes despesas precisam de voto”.
- Permitir derramas sem voto.
- Adicionar processamento de pagamentos OU reembolsos automáticos.
- Mudar política “sem proporcionalidade na entrada a meio do mês” (v2.1).
- Mudar política de retenção de dados financeiros.

## Appendix C: Glossário (v2.1)

- **Condomínio:** Tenant. 1 prédio.
- **Fração:** Apartamento. Tem permilagem.
- **Permilagem:** Peso da fração em milésimos.
- **Quota base / Quota mensal base:** Valor mensal fixo por fração.
- **Quota mensal (instância):** Concretização num mês específico (`QuotaMensal`).
- **Fundo comum:** Saldo do condomínio. Receita = quotas. Saída = correntes + grandes executadas.
- **Despesa corrente:** Despesa do dia-a-dia, paga do fundo, não imputada.
- **Grande despesa / Obra:** Despesa significativa, requer voto.
- **Derrama:** Acréscimo à quota mensal por grande despesa aprovada. Distribuída por N meses.
- **Imputação extra:** 1 prestação de derrama em 1 mês para 1 fração (`ImputacaoExtra`).
- **Acerto privado (v2.1):** Para entradas/saídas a meio do mês, o ajuste do valor da quota é entre comprador e vendedor, fora da app.
- **Reembolso fora da app (v2.1):** Quando uma derrama é anulada com prestações já cobradas, o admin trata o reembolso aos moradores afectados fora da aplicação. A app apenas regista que foi tratado.

## Appendix D: Changelog

|Versão  |Mudança principal                                                                                                     |
|--------|----------------------------------------------------------------------------------------------------------------------|
|v1.0    |Despesas individuais imputadas a moradores                                                                            |
|**v2.0**|**Modelo de quota mensal + grandes despesas com derrama**                                                             |
|**v2.1**|**3 refinamentos: sem proporcionalidade, reembolsos fora da app com tracking, UI consolidada para múltiplas derramas**|

### Detalhe das mudanças v2.0 → v2.1

**Sem proporcionalidade (entrada/saída a meio do mês):**

- §1 Out of scope: adicionado.
- §4 Feature 1: edge case clarificado.
- §4 Feature 19: regra “valor mensal completo”.
- §9 AC-11: alterada (sem cálculo proporcional).
- Appendix A, B, C: actualizados.

**Reembolsos pós-anulação:**

- §3: adicionada rota `/admin/grandes-despesas/[id]/reembolsos` e componente `ReembolsoTracker`.
- §4 Feature 16e: nova subsecção completa.
- §5: 3 campos novos em `ImputacaoExtra` (`reembolsadaEm`, `reembolsadaNotas`, `reembolsadaPor`) + index novo.
- §7: novo mockup “Reembolsos a tratar”.
- §9 AC-22, AC-23, AC-24, AC-25: alteradas/novas.
- §10: testes unitários e E2E expandidos.

**UI consolidada para ≥ 2 derramas:**

- §3: novo componente `DerramaBreakdownModal`.
- §4 Feature 3: tabela explicativa 0/1/N extras.
- §7: 3 variantes de mockup + mockup do modal.
- §9 AC-12, AC-13, AC-14, AC-15: alteradas/novas.