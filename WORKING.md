# WORKING.md — Administração de Condomínio

> **Como usar este ficheiro:**
> 
> - **Leitura obrigatória** no início de cada sessão de Claude Code, depois de SPEC.md.
> - **Actualizar no fim de cada sessão**: o que foi feito, o que está bloqueado, decisões tomadas.
> - SPEC.md é a fonte da verdade do **o quê**. Este ficheiro é a fonte da verdade do **onde estamos** e **o que vem a seguir**.
> 
> A sessão de Claude Code começa sempre por:
> 
> 1. Ler SPEC.md inteiro.
> 1. Ler este ficheiro inteiro.
> 1. Ler "🎯 Estado actual" abaixo e propor 1 acção concreta para a sessão.
> 1. Confirmar com o humano antes de continuar.

-----

## 🎯 Estado actual

|Campo                     |Valor                                                   |
|--------------------------|--------------------------------------------------------|
|**Fase corrente**         |Fase 0 — Setup inicial                                  |
|**Última acção concluída**|(nenhuma — projecto a arrancar)                         |
|**Próxima acção**         |Inicializar repositório Next.js + Biome + estrutura base|
|**Bloqueado em**          |(nada)                                                  |
|**Última actualização**   |(preencher na primeira sessão)                          |

-----

## 🗺️ Roadmap por fases (v1 P0)

Cada fase tem um **Definition of Done** explícito. Não passar à fase seguinte sem cumprir.
Após cada fase: commit, push, actualizar este ficheiro.

### Fase 0 — Setup inicial do repositório

- [ ] `pnpm create next-app@latest` com TypeScript, App Router, Tailwind, Biome
- [ ] Instalar deps: `prisma`, `@prisma/client`, `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `react-hook-form`, `@hookform/resolvers`, `resend`, `ics`, `vitest`, `@playwright/test`, `lucide-react`
- [ ] `pnpm dlx shadcn@latest init` + componentes iniciais (button, card, input, dialog, form, label, select)
- [ ] Criar estrutura de pastas conforme SPEC §3
- [ ] Criar `.env.example` com todas as variáveis listadas em SPEC §11
- [ ] Criar `README.md` mínimo (instalar / correr / testar / deploy)
- [ ] Configurar `biome.json` (regras: warn em `any`, error em unused imports)
- [ ] Configurar Vitest (`vitest.config.ts`) e Playwright (`playwright.config.ts`)
- [ ] `.gitignore`: `.env*`, `node_modules`, `.next`, `coverage`, `playwright-report`
- [ ] Criar repo no GitHub, primeiro commit, push
- **DOD:** `pnpm dev` mostra página default; `pnpm test` exits 0; `pnpm biome check .` exits 0; repo no GitHub.

### Fase 1 — Infra: Supabase + Prisma + Auth

- [ ] Criar projecto Supabase (manual, via dashboard) — anotar URLs em "🔗 Recursos externos" abaixo
- [ ] Criar projecto Resend, obter API key e domínio verificado
- [ ] Preencher `.env.local` com chaves reais
- [ ] Criar `prisma/schema.prisma` com **todos** os modelos do SPEC §5 v2.1 (incluindo os 3 campos novos de `ImputacaoExtra`)
- [ ] `pnpm prisma migrate dev --name initial`
- [ ] Implementar helpers em `/lib/db` (Prisma client singleton com tenant extension)
- [ ] Implementar helpers em `/lib/auth` (Supabase server client, getSession)
- [ ] Implementar `middleware.ts` (auth check + tenant resolution do URL `[condominioId]`)
- [ ] Configurar RLS no Supabase para todas as tabelas com `condominioId`
- [ ] Página `/sign-in` (magic link via Supabase)
- [ ] Página `/accept-invite/[token]`
- [ ] Página vazia `/[condominioId]/dashboard` (apenas autenticada)
- **DOD:** Utilizador faz signup → recebe magic link → entra → vê página em branco do dashboard. Tentativa de aceder cross-tenant é 403. Test manual de RLS via SQL directo bloqueia.
- **🚨 CHECKPOINT:** Antes de avançar para Fase 2, confirmar com humano: schema Prisma + RLS testados.

### Fase 2 — Onboarding (Feature 1)

- [ ] Form "Criar condomínio" + criação de Membership(role=ADMINISTRADOR)
- [ ] Form "Adicionar fração" (admin)
- [ ] Form "Convidar morador" (gera token, envia email via Resend)
- [ ] Página `/accept-invite/[token]` — valida, cria User (se novo) + Membership(role=MORADOR)
- [ ] Helper `inviteToken.ts` (gera 32-byte random, hash em DB, expira 14 dias, single-use)
- [ ] Test E2E: 2 utilizadores, criar+convidar+aceitar
- **DOD:** AC-1, AC-2, AC-3 passam. E2E `signup-invite-accept.spec.ts` passa.

### Fase 3 — Quota base + Geração mensal (Features 14, 19, 3 parcial)

- [ ] Tela admin "Quota base" — Feature 14
  - [ ] Tabs: VALOR_UNICO, PERMILAGEM, MANUAL
  - [ ] Validação Zod (permilagens somam 1000)
  - [ ] Criação de `ConfiguracaoQuota` com `vigenteDesde`/`vigenteAte`
- [ ] Cron `/api/cron/gerar-quotas-mensais` — Feature 19
  - [ ] Protegido por `CRON_SECRET` header
  - [ ] Idempotente (`unique(fracaoId, ano, mes)`)
  - [ ] Sem proporcionalidade (regra v2.1)
  - [ ] Endpoint manual de regeneração para testes
- [ ] Vista do morador "Minhas contas" — Feature 3 **variante 1 apenas (0 extras)**
- [ ] Botão "Marcar como pago"
- [ ] Test unitário crítico: idempotência do cron, geração correcta para N membros
- **DOD:** AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-16 passam.
- **🚨 CHECKPOINT:** Antes de Fase 4, validar manualmente no Supabase que `QuotaMensal` foi criada com `valorBaseCents` correcto para uma fração com permilagem ≠ rateio igual.

### Fase 4 — Reuniões (Features 6, 7)

- [ ] Modelo `Reuniao`, `Decisao`, `Presenca` (já no schema, criar UI)
- [ ] Form "Nova convocatória" (admin)
- [ ] Geração `.ics` + envio email a todos os membros (Resend)
- [ ] Vista do morador: lista + detalhe + RSVP
- [ ] Form "Publicar acta" (admin) com gestão de presenças e decisões
- [ ] Decisões com `tipo=GENERICA` em Fase 4 (tipo=GRANDE_DESPESA fica para Fase 5)
- **DOD:** AC-21, AC-22, AC-23 (renumeradas) passam. E2E meeting-flow.

### Fase 5 — ⭐ Grandes Despesas (Feature 16 completa)

**Esta é a fase de maior risco. Dividir em sub-fases.**

#### 5a — Criar proposta + preview

- [ ] Form "Nova grande despesa" com `<DerramaPreview/>` reactivo (cálculo client-side)
- [ ] Schema validation: `numeroMeses` 1–24, `mesInicial` ≥ próximo mês
- [ ] Estado RASCUNHO

#### 5b — Associar a reunião

- [ ] Selector de reunião AGENDADA OU criar nova convocatória inline
- [ ] Cria `Decisao(tipo=GRANDE_DESPESA, grandeDespesaId)`
- [ ] Estado → EM_VOTACAO

#### 5c — Aprovação → criação de imputações

- [ ] No fluxo "Publicar acta" da Fase 4, detectar `Decisao(tipo=GRANDE_DESPESA, resultado=APROVADO)`
- [ ] Trigger cria `numeroMeses × frações` registos `ImputacaoExtra(estado=PENDENTE)`
- [ ] Notificação email a todos os moradores
- [ ] Test crítico: cálculo correcto para rateio igual e por permilagem

#### 5c+ — Upgrade da vista "Minhas contas" para variante 2 (1 extra)

- [ ] No cron mensal, ligar `ImputacaoExtra` à `QuotaMensal` recém-criada
- [ ] No cron, mudar `ImputacaoExtra.estado` para APLICADA
- [ ] UI: linha extra nomeada em laranja, clicável → modal de detalhe da grande despesa
- [ ] AC-13 passa

#### 5c++ — Variante 3 (≥ 2 extras) + modal

- [ ] Lógica adaptativa em `<QuotaCard/>`: 0 / 1 / N extras
- [ ] Componente `<DerramaBreakdownModal/>`
- [ ] AC-14, AC-15 passam

#### 5d — Execução

- [ ] Vista "Marcar como executada" + upload fatura final
- [ ] Validação: diferença > 5% requer nota explicativa
- [ ] AC-26 passa

#### 5e — Anulação + Reembolsos (v2.1)

- [ ] Anulação 2-step com motivo obrigatório
- [ ] Lógica de separação PENDENTES vs APLICADAS
- [ ] Tela `/admin/grandes-despesas/[id]/reembolsos`
- [ ] Componente `<ReembolsoTracker/>`
- [ ] Botão "Marcar reembolso como tratado" + nota livre
- [ ] Bloqueio de reverter anulação se há reembolsos tratados
- [ ] AC-22, AC-23, AC-24, AC-25 passam
- **DOD da Fase 5 inteira:** Happy path E2E v2.1 (do SPEC §10) passa em ≤ 90s.
- **🚨 CHECKPOINT:** Antes da Fase 5e (anulação), parar e confirmar com humano. Esta é a feature de maior risco — mexe em registos financeiros já consolidados.

### Fase 6 — Despesas Correntes + Contas Gerais (Features 15, 4)

- [ ] CRUD `DespesaCorrente` (admin)
- [ ] Vista "Contas gerais" (todos): saldo do fundo, lista de correntes, lista de grandes despesas
- [ ] Vista admin extra: lista nominal de quotas pagas/pendentes
- [ ] Anulação de despesa corrente (24h sem motivo, depois com motivo)
- **DOD:** Saldo do fundo calculado correctamente após N quotas pagas + M despesas correntes.

### Fase 7 — Ocorrências (Feature 8)

- [ ] Form de submissão (texto + fotos via Supabase Storage)
- [ ] Vista de lista + detalhe com chat de comentários
- [ ] Transições de estado (admin)
- [ ] Cron secundário: marca como INACTIVA se sem updates há > 60 dias
- **DOD:** AC-14, AC-15, AC-16 (numeração SPEC original) passam.

### Fase 8 — Membros + Transferência de Admin (Feature 17)

- [ ] Vista lista de membros (admin)
- [ ] Convidar / remover (soft delete)
- [ ] Fluxo de transferência: 7 dias overlap, opção de renúncia imediata
- [ ] Bloqueio: único admin não pode sair sem transferir
- **DOD:** AC-17, AC-18 (SPEC original) passam.

### Fase 9 — Audit Log (Feature 18)

- [ ] Helper `auditLog.record(action, entity, payload)`
- [ ] Chamar em todas as mutações admin (criar/anular despesa, criar/aprovar/anular grande despesa, marcar reembolso, transferir admin, alterar quota base, publicar acta)
- [ ] Vista admin: histórico dos últimos 90 dias, read-only
- **DOD:** AC-19 (SPEC original) passa.

### Fase 10 — Dashboard, Polish, Deploy

- [ ] Dashboard com cards (Feature 2)
- [ ] Templates de email (Resend) com design consistente
- [ ] Estados vazios em todas as listas
- [ ] Páginas de erro (404, 500)
- [ ] PWA manifest + ícones
- [ ] Deploy a Vercel + configurar Vercel Cron
- [ ] Setup de backups Supabase (snapshot diário, retenção 7 dias)
- [ ] Smoke test em produção: criar condomínio real, convidar 1 morador real, ciclo completo
- **DOD:** Definition of Done completo do SPEC §12.

-----

## 🚧 Fases pós-v1 (P1 / P2)

Não começar até v1 estar em produção e usado por pelo menos 1 condomínio real durante 1 mês.

- **P1.1** — Comunidade: Pedidos (Feature 9)
- **P1.2** — Comunidade: Contactos e Eventos (Feature 11)
- **P1.3** — Conta: Contactos e Partilha (Feature 12)
- **P1.4** — Projecção anual (Feature 5)
- **P1.5** — Notificações WhatsApp opt-in
- **P1.6** — Dark mode
- **P2.1** — Compras e Serviços (Feature 10)
- **P2.2** — Conta: Serviços e Habilidades (Feature 13)
- **P2.3** — Cálculo guiado de quota base a partir de orçamento

-----

## 🧭 Princípios para o Claude Code (regras pinned)

### Antes de escrever código

1. Ler SPEC.md (sempre — `view /SPEC.md`).
1. Ler este ficheiro (estado actual + fase corrente).
1. Confirmar com o humano qual é o próximo passo concreto.

### Durante o trabalho

- **Tenant filter é não-negociável.** Toda query Prisma sobre tabelas com `condominioId` filtra por `condominioId`. Se uma query precisar de cruzar tenants, marcar com helper `unsafeAcrossTenants()` e justificar.
- **Tipo > nada > `any`.** Se faltar um tipo, criar com Zod + inferência. Nunca escapar com `any`.
- **Money em inteiros (cents).** Nunca floats em valores monetários. `valorCents: Int` em todo o lado.
- **Dates em UTC na DB.** Conversão para Lisboa só na apresentação.
- **Não criar ficheiros sem necessidade.** Se um helper já existe, usar em vez de criar paralelo.
- **Migrations são imutáveis.** Não editar uma migration depois de aplicada — criar nova migration de correcção.
- **Magic strings são banidas.** Enums (no Prisma) ou constantes tipadas em `/lib/constants.ts`.

### Antes de commit

- [ ] `pnpm biome check .` exits 0
- [ ] `pnpm test` exits 0 (se houver testes na área tocada)
- [ ] WORKING.md actualizado com o que foi feito nesta sessão
- [ ] Mensagem de commit descritiva (`feat: criar quota base config + UI` em vez de `fix stuff`)
- [ ] Nada commitado em `.env*`, segredos, dumps de DB

### "Do not" rules (do SPEC Appendix A)

- ❌ Não introduzir processamento de pagamentos.
- ❌ Não imputar despesas correntes directamente a moradores.
- ❌ Não criar `ImputacaoExtra` sem `Decisao` aprovada.
- ❌ Não permitir alterar `valorBaseCents` numa `QuotaMensal` PAGA.
- ❌ Não permitir hard delete de `GrandeDespesa` aprovada.
- ❌ Não calcular quotas proporcionais para entradas/saídas a meio do mês.
- ❌ Não processar reembolsos de derramas anuladas.
- ❌ Não permitir reverter anulação se há reembolsos tratados.
- ❌ Não usar localStorage para dados sensíveis.
- ❌ Não enviar > 1 email/morador/hora/categoria.

### "Escalate to human before" (do SPEC Appendix B)

🛑 Parar e perguntar antes de:

- Alterar o modelo de derrama (relações `GrandeDespesa` ↔ `ImputacaoExtra` ↔ `QuotaMensal`).
- Permitir derramas sem voto.
- Adicionar processamento de pagamentos OU reembolsos automáticos.
- Mudar política "sem proporcionalidade na entrada a meio do mês".
- Adicionar nova integração externa não mencionada no SPEC §6.
- Schema migrations que dropem ou renomeiem colunas.
- Mudanças à política RLS.

-----

## 📒 Decision log

Registar aqui cada decisão não-trivial tomada durante a implementação, com data e justificação. Útil quando alguém (humano ou Claude) volta ao projecto semanas depois.

Formato:

```
### YYYY-MM-DD — <título curto>
**Decisão:** ...
**Razão:** ...
**Alternativas consideradas:** ...
```

### 2026-04-25 — Stack inicial (registado no SPEC)

**Decisão:** Next.js 15 + Supabase + Prisma + shadcn/ui.
**Razão:** SaaS multi-tenant + UI rica + auth + mobile-first → Next.js single-stack reduz complexidade.
**Alternativas consideradas:** FastAPI + Jinja + HTMX (descartado por densidade de UI).

### 2026-04-25 — Threshold de consolidação de extras

**Decisão:** UI consolida extras quando `extras.length >= 2`.
**Razão:** Em mobile, 2 linhas de extras já criam ruído; modal é 1-tap.
**Alternativas consideradas:** `>= 3` (mais conservador) — fica como possível ajuste se feedback de utilizadores indicar.

### 2026-04-25 — Sem proporcionalidade na entrada/saída

**Decisão:** Quota é sempre o valor mensal completo, mesmo para membros que entram a meio do mês.
**Razão:** Ajuste é responsabilidade do comprador/vendedor (decidido pelo Luís em v2.1).
**Alternativas consideradas:** Prorata por dias — descartado por aumentar complexidade sem ganho real.

-----

## ❓ Open questions

Colocar aqui questões em aberto que precisam de resposta do humano antes de avançar. Apagar quando resolvidas (mover para Decision log).

- (vazio inicialmente)

-----

## 🔗 Recursos externos

Preencher à medida que são criados.

|Recurso           |URL                |Notas                                            |
|------------------|-------------------|-------------------------------------------------|
|GitHub repo       |*(a criar Fase 0)* |                                                 |
|Vercel project    |*(a criar Fase 10)*|                                                 |
|Supabase project  |*(a criar Fase 1)* |Project ref: ___                                 |
|Supabase dashboard|*(a criar Fase 1)* |                                                 |
|Resend dashboard  |*(a criar Fase 1)* |Domínio: ___                                     |
|Domínio do produto|*(decidir)*        |Sugestões: condominio.app, gerir-condominio.pt, …|

-----

## 🛠️ Quick reference

### Comandos úteis

```bash
# Dev
pnpm dev

# Migrations
pnpm prisma migrate dev --name <nome>
pnpm prisma migrate deploy            # produção
pnpm prisma studio                    # GUI da BD

# Tests
pnpm test                             # unit
pnpm test:watch
pnpm test:e2e                         # Playwright headed
pnpm test:e2e --headed=false          # CI

# Lint / format
pnpm biome check .
pnpm biome check --write .            # auto-fix

# Build
pnpm build
pnpm start                            # local production server

# Cron manual (debug)
curl -X POST http://localhost:3000/api/cron/gerar-quotas-mensais \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Ficheiros importantes

- `SPEC.md` — fonte da verdade do produto.
- `WORKING.md` — este ficheiro.
- `prisma/schema.prisma` — modelo de dados.
- `middleware.ts` — auth + tenant.
- `/lib/tenancy/` — helpers críticos de isolamento.
- `/lib/quotas/` — lógica de geração mensal.
- `/lib/grandes-despesas/` — lógica de derramas.
- `/tests/manual/checklist.md` — testes manuais antes de release.

### Variáveis de ambiente esperadas

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=                    # postgres direct (Prisma)
DIRECT_URL=                      # postgres direct (migrations)
RESEND_API_KEY=
RESEND_FROM_EMAIL=
NEXT_PUBLIC_APP_URL=             # ex: http://localhost:3000
CRON_SECRET=                     # 32+ char random
```

-----

## 🏁 Definition of Done — v1 do produto

(Cópia do SPEC §12 para referência rápida.)

```
[ ] Features P0 (1, 2, 3, 4, 6, 7, 8, 14, 15, 16 incl. 16e, 17, 18, 19) implementadas
[ ] Todos os AC com prefixo "AC-" passam (35 critérios em v2.1)
[ ] pnpm test exits 0
[ ] pnpm test:e2e (incluindo happy path v2.1) exits 0
[ ] pnpm biome check . exits 0
[ ] Cron do dia 1 verificado em produção pelo menos 1 ciclo completo
[ ] Pelo menos 1 anulação de grande despesa testada
[ ] README.md cobre: setup, deploy, criação do primeiro condomínio,
    configuração de quota base, lançamento de grande despesa, anulação e reembolsos
[ ] .env.example completo
[ ] 1 condomínio real (o do Luís) em produção com ≥ 3 moradores e
    pelo menos 1 ciclo de quota mensal cobrado
[ ] RLS verificado: tentar aceder cross-tenant via SQL é bloqueado
[ ] Backup automático Supabase verificado
```

-----

## 📝 Log de sessões

Cada sessão de Claude Code adiciona uma entrada aqui no fim. Formato:

```
### YYYY-MM-DD HH:MM — <fase> — <duração>
**Feito:**
- ...
**Não feito (planeado mas não acabado):**
- ...
**Bloqueios:**
- ...
**Próxima sessão:**
- ...
```

(vazio — primeira sessão preenche)
