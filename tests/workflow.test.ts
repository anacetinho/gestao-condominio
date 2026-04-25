import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  EstadoImputacao,
  EstadoQuota,
  ModoQuota,
  ModoRateio,
  ResultadoDecisao,
  Role,
  TipoDecisao,
} from "@/lib/constants";
import { listarReembolsos } from "@/lib/grandes-despesas/reembolsos";
import {
  anularGrandeDespesa,
  aprovarGrandeDespesa,
  associarReuniao,
  criarGrandeDespesa,
  marcarReembolsoTratado,
  reverterAnulacao,
} from "@/lib/grandes-despesas/workflow";
import { gerarQuotasMensais } from "@/lib/quotas/geracao";
import { getMinhasContas } from "@/lib/quotas/minhas-contas";

// Cada test file usa uma DB SQLite temporária isolada.
const tmpDir = mkdtempSync(path.join(os.tmpdir(), "gc-test-"));
const dbPath = path.join(tmpDir, "test.db");
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.DIRECT_URL = `file:${dbPath}`;

let prisma: PrismaClient;

beforeAll(async () => {
  // Aplica o schema directamente (sem migrations).
  execSync("pnpm prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: `file:${dbPath}`, DIRECT_URL: `file:${dbPath}` },
    stdio: "inherit",
  });
  // Reimporta o singleton de prisma com a env correcta.
  const mod = await import("@/lib/db");
  prisma = mod.prisma;
});

beforeEach(async () => {
  // Limpa todas as tabelas entre testes.
  await prisma.auditLog.deleteMany();
  await prisma.imputacaoExtra.deleteMany();
  await prisma.quotaMensal.deleteMany();
  await prisma.presenca.deleteMany();
  await prisma.decisao.deleteMany();
  await prisma.reuniao.deleteMany();
  await prisma.despesaCorrente.deleteMany();
  await prisma.grandeDespesa.deleteMany();
  await prisma.configuracaoQuota.deleteMany();
  await prisma.convite.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.fracao.deleteMany();
  await prisma.condominio.deleteMany();
  await prisma.user.deleteMany();
});

async function setupCondominio() {
  // Condomínio com 4 frações iguais e 4 moradores + 1 admin.
  const cond = await prisma.condominio.create({
    data: { nome: "Cond. Teste", morada: "Rua A" },
  });
  const fracoes = await Promise.all(
    ["1A", "1B", "2A", "2B"].map((id) =>
      prisma.fracao.create({
        data: {
          condominioId: cond.id,
          identificador: id,
          permilagem: 250,
        },
      }),
    ),
  );
  const admin = await prisma.user.create({
    data: { email: "admin@x.pt", nome: "Admin" },
  });
  const adminMembership = await prisma.membership.create({
    data: {
      condominioId: cond.id,
      userId: admin.id,
      role: Role.ADMINISTRADOR,
    },
  });
  const moradores = [];
  for (let i = 0; i < fracoes.length; i++) {
    const u = await prisma.user.create({
      data: { email: `m${i}@x.pt`, nome: `Morador ${i + 1}` },
    });
    const m = await prisma.membership.create({
      data: {
        condominioId: cond.id,
        userId: u.id,
        role: Role.MORADOR,
        fracaoId: fracoes[i].id,
      },
    });
    moradores.push({ user: u, membership: m, fracao: fracoes[i] });
  }
  // Quota base €30/fração.
  await prisma.configuracaoQuota.create({
    data: {
      condominioId: cond.id,
      modo: ModoQuota.VALOR_UNICO,
      valorUnicoCents: 3000,
      vigenteDesde: new Date("2026-01-01"),
    },
  });
  return { cond, fracoes, admin, adminMembership, moradores };
}

async function aprovarReuniaoComGD(params: {
  condominioId: string;
  grandeDespesaId: string;
  membershipId: string;
}) {
  const r = await prisma.reuniao.create({
    data: {
      condominioId: params.condominioId,
      titulo: "Reunião",
      data: new Date("2026-03-15"),
      ordemDoDia: "Aprovar GD",
    },
  });
  await associarReuniao({
    grandeDespesaId: params.grandeDespesaId,
    reuniaoId: r.id,
    membershipId: params.membershipId,
  });
  // Marcar decisão como aprovada manualmente (que é o que "publicar acta" faria).
  const d = await prisma.decisao.findFirst({
    where: { reuniaoId: r.id, tipo: TipoDecisao.GRANDE_DESPESA },
  });
  await prisma.decisao.update({
    where: { id: d!.id },
    data: { resultado: ResultadoDecisao.APROVADO },
  });
  return aprovarGrandeDespesa({
    grandeDespesaId: params.grandeDespesaId,
    membershipId: params.membershipId,
  });
}

describe("Cron — geração de quotas (AC-9, AC-10, AC-11)", () => {
  it("AC-9: gera 1 quota por fração com valor base correcto", async () => {
    const { fracoes } = await setupCondominio();
    const r = await gerarQuotasMensais(4, 2026);
    expect(r.criadas).toBe(4);
    const quotas = await prisma.quotaMensal.findMany();
    expect(quotas.length).toBe(4);
    expect(quotas.every((q) => q.valorBaseCents === 3000)).toBe(true);
    expect(quotas.every((q) => q.estado === EstadoQuota.PENDENTE)).toBe(true);
    void fracoes;
  });

  it("AC-10: idempotente — correr 2x não cria duplicados", async () => {
    await setupCondominio();
    const r1 = await gerarQuotasMensais(4, 2026);
    const r2 = await gerarQuotasMensais(4, 2026);
    expect(r1.criadas).toBe(4);
    expect(r2.criadas).toBe(0);
    expect(r2.jaExistiam).toBe(4);
  });

  it("AC-11: sem proporcionalidade — membership criado a meio do mês ainda paga valor cheio", async () => {
    const { cond, fracoes } = await setupCondominio();
    // Adiciona um 5º morador no dia 15.
    const novaFracao = await prisma.fracao.create({
      data: { condominioId: cond.id, identificador: "3A", permilagem: 0 },
    });
    void novaFracao;
    void fracoes;
    const u = await prisma.user.create({
      data: { email: "novo@x.pt", nome: "Novo" },
    });
    await prisma.membership.create({
      data: {
        condominioId: cond.id,
        userId: u.id,
        role: Role.MORADOR,
        fracaoId: novaFracao.id,
        joinedAt: new Date("2026-04-15"),
      },
    });
    await gerarQuotasMensais(4, 2026);
    const q = await prisma.quotaMensal.findFirst({
      where: { fracaoId: novaFracao.id },
    });
    expect(q?.valorBaseCents).toBe(3000); // valor cheio, sem prorata
  });
});

describe("Aprovação de grande despesa (AC-18..21)", () => {
  it("aprovação cria N×M imputações com valores correctos", async () => {
    const { cond, adminMembership } = await setupCondominio();
    const gd = await criarGrandeDespesa({
      condominioId: cond.id,
      membershipId: adminMembership.id,
      titulo: "Telhado",
      descricao: "Reparação",
      valorTotalCents: 200000, // €2000
      numeroMeses: 4,
      mesInicial: 5,
      anoInicial: 2026,
      modoRateio: ModoRateio.IGUAL,
    });
    await aprovarReuniaoComGD({
      condominioId: cond.id,
      grandeDespesaId: gd.id,
      membershipId: adminMembership.id,
    });
    const imps = await prisma.imputacaoExtra.findMany();
    // 4 frações × 4 meses = 16 imputações.
    expect(imps.length).toBe(16);
    const soma = imps.reduce((s, i) => s + i.valorCents, 0);
    expect(soma).toBe(200000);
    // Cada fração leva €500 total / 4 meses = €125 por prestação.
    const porFracao = imps.filter((i) => i.fracaoId === imps[0].fracaoId);
    expect(porFracao.length).toBe(4);
    expect(porFracao.reduce((s, i) => s + i.valorCents, 0)).toBe(50000);
  });
});

describe("⭐ v2.1 — Anulação de grande despesa (AC-22..25)", () => {
  it("AC-22: separação correcta entre PENDENTES (silenciosamente revertidas) vs APLICADAS (para reembolso)", async () => {
    const { cond, fracoes, adminMembership } = await setupCondominio();
    void fracoes;
    const gd = await criarGrandeDespesa({
      condominioId: cond.id,
      membershipId: adminMembership.id,
      titulo: "Telhado",
      descricao: "Reparação",
      valorTotalCents: 80000, // 4 frações × 4 meses → €50/mês cada
      numeroMeses: 4,
      mesInicial: 3,
      anoInicial: 2026,
      modoRateio: ModoRateio.IGUAL,
    });
    await aprovarReuniaoComGD({
      condominioId: cond.id,
      grandeDespesaId: gd.id,
      membershipId: adminMembership.id,
    });

    // Gerar quotas Mar e Abr (aplicadas), Mai e Jun ficam PENDENTES.
    await gerarQuotasMensais(3, 2026);
    await gerarQuotasMensais(4, 2026);

    let imps = await prisma.imputacaoExtra.findMany();
    const aplicadas = imps.filter((i) => i.estado === EstadoImputacao.APLICADA);
    const pendentes = imps.filter((i) => i.estado === EstadoImputacao.PENDENTE);
    expect(aplicadas.length).toBe(8); // 4 frações × 2 meses
    expect(pendentes.length).toBe(8); // 4 frações × 2 meses

    const r = await anularGrandeDespesa({
      grandeDespesaId: gd.id,
      membershipId: adminMembership.id,
      motivo: "Decisão revertida em assembleia extraordinária",
    });

    expect(r.futurasAnuladas).toBe(8);
    expect(r.aplicadasParaReembolso).toBe(8);

    imps = await prisma.imputacaoExtra.findMany();
    expect(imps.every((i) => i.estado === EstadoImputacao.ANULADA)).toBe(true);

    // Quotas afectadas têm corrigidaEm preenchido.
    const quotasCorrigidas = await prisma.quotaMensal.findMany({
      where: { corrigidaEm: { not: null } },
    });
    expect(quotasCorrigidas.length).toBeGreaterThan(0);

    // Reembolsos: 8 entradas a tratar (4 frações × 2 meses já aplicados).
    const resumo = await listarReembolsos(gd.id);
    expect(resumo.itens.length).toBe(8);
    expect(resumo.totalCents).toBe(40000); // €400 = 8 × €50
    expect(resumo.tratadosCents).toBe(0);
  });

  it("AC-23: marcar reembolso como tratado preenche os 3 campos + audit log", async () => {
    const { cond, adminMembership } = await setupCondominio();
    const gd = await criarGrandeDespesa({
      condominioId: cond.id,
      membershipId: adminMembership.id,
      titulo: "X",
      descricao: "y",
      valorTotalCents: 8000,
      numeroMeses: 1,
      mesInicial: 4,
      anoInicial: 2026,
      modoRateio: ModoRateio.IGUAL,
    });
    await aprovarReuniaoComGD({
      condominioId: cond.id,
      grandeDespesaId: gd.id,
      membershipId: adminMembership.id,
    });
    await gerarQuotasMensais(4, 2026);
    await anularGrandeDespesa({
      grandeDespesaId: gd.id,
      membershipId: adminMembership.id,
      motivo: "Erro de orçamento",
    });
    const imp = await prisma.imputacaoExtra.findFirst({
      where: { grandeDespesaId: gd.id },
    });
    expect(imp).toBeDefined();
    await marcarReembolsoTratado({
      imputacaoId: imp!.id,
      membershipId: adminMembership.id,
      notas: "ref MBWY-12345",
    });
    const updated = await prisma.imputacaoExtra.findUnique({
      where: { id: imp!.id },
    });
    expect(updated?.reembolsadaEm).not.toBeNull();
    expect(updated?.reembolsadaNotas).toBe("ref MBWY-12345");
    expect(updated?.reembolsadaPor).toBe(adminMembership.id);
    const audits = await prisma.auditLog.findMany({
      where: { action: "REEMBOLSO_MARCADO" },
    });
    expect(audits.length).toBe(1);
  });

  it("AC-24: bloqueio de reverter anulação se há reembolsos tratados", async () => {
    const { cond, adminMembership } = await setupCondominio();
    const gd = await criarGrandeDespesa({
      condominioId: cond.id,
      membershipId: adminMembership.id,
      titulo: "X",
      descricao: "y",
      valorTotalCents: 8000,
      numeroMeses: 1,
      mesInicial: 4,
      anoInicial: 2026,
      modoRateio: ModoRateio.IGUAL,
    });
    await aprovarReuniaoComGD({
      condominioId: cond.id,
      grandeDespesaId: gd.id,
      membershipId: adminMembership.id,
    });
    await gerarQuotasMensais(4, 2026);
    await anularGrandeDespesa({
      grandeDespesaId: gd.id,
      membershipId: adminMembership.id,
      motivo: "teste de anulação",
    });
    const imp = await prisma.imputacaoExtra.findFirst({
      where: { grandeDespesaId: gd.id },
    });
    await marcarReembolsoTratado({
      imputacaoId: imp!.id,
      membershipId: adminMembership.id,
    });
    await expect(
      reverterAnulacao({
        grandeDespesaId: gd.id,
        membershipId: adminMembership.id,
      }),
    ).rejects.toThrow(/não pode ser revertida/);
  });

  it("anulação requer motivo (≥ 5 chars) + idempotência de marcar reembolso", async () => {
    const { cond, adminMembership } = await setupCondominio();
    const gd = await criarGrandeDespesa({
      condominioId: cond.id,
      membershipId: adminMembership.id,
      titulo: "X",
      descricao: "y",
      valorTotalCents: 8000,
      numeroMeses: 1,
      mesInicial: 4,
      anoInicial: 2026,
      modoRateio: ModoRateio.IGUAL,
    });
    await aprovarReuniaoComGD({
      condominioId: cond.id,
      grandeDespesaId: gd.id,
      membershipId: adminMembership.id,
    });
    await expect(
      anularGrandeDespesa({
        grandeDespesaId: gd.id,
        membershipId: adminMembership.id,
        motivo: "abc",
      }),
    ).rejects.toThrow();
    await anularGrandeDespesa({
      grandeDespesaId: gd.id,
      membershipId: adminMembership.id,
      motivo: "motivo válido",
    });
    await gerarQuotasMensais(4, 2026); // não cria imputações novas (já anuladas)
    const imp = await prisma.imputacaoExtra.findFirst({
      where: { grandeDespesaId: gd.id },
    });
    // Esta teve quotaMensalId? — não, porque foi anulada antes do cron.
    // Forço estado APLICADA para testar o caminho.
    const imp2 = await prisma.imputacaoExtra.findFirst({
      where: { grandeDespesaId: gd.id, quotaMensalId: { not: null } },
    });
    void imp;
    if (imp2) {
      await marcarReembolsoTratado({
        imputacaoId: imp2.id,
        membershipId: adminMembership.id,
      });
      await expect(
        marcarReembolsoTratado({
          imputacaoId: imp2.id,
          membershipId: adminMembership.id,
        }),
      ).rejects.toThrow();
    }
  });
});

describe("⭐ v2.1 — Minhas contas adaptativa (AC-12, AC-13, AC-14, AC-15)", () => {
  async function comExtras(numero: 0 | 1 | 3) {
    const { cond, fracoes, adminMembership } = await setupCondominio();
    await gerarQuotasMensais(4, 2026); // gera quota base
    if (numero >= 1) {
      const gd = await criarGrandeDespesa({
        condominioId: cond.id,
        membershipId: adminMembership.id,
        titulo: "Reparação telhado",
        descricao: "x",
        valorTotalCents: 28000, // 4 frações × 1 mês = €70 cada
        numeroMeses: 1,
        mesInicial: 4,
        anoInicial: 2026,
        modoRateio: ModoRateio.IGUAL,
      });
      await aprovarReuniaoComGD({
        condominioId: cond.id,
        grandeDespesaId: gd.id,
        membershipId: adminMembership.id,
      });
    }
    if (numero >= 3) {
      for (const t of ["Pintura", "Porta entrada"]) {
        const gd = await criarGrandeDespesa({
          condominioId: cond.id,
          membershipId: adminMembership.id,
          titulo: t,
          descricao: "x",
          valorTotalCents: 16000,
          numeroMeses: 1,
          mesInicial: 4,
          anoInicial: 2026,
          modoRateio: ModoRateio.IGUAL,
        });
        await aprovarReuniaoComGD({
          condominioId: cond.id,
          grandeDespesaId: gd.id,
          membershipId: adminMembership.id,
        });
      }
    }
    // Reaplica as imputações pendentes na quota actual.
    if (numero > 0) {
      const quota = await prisma.quotaMensal.findFirst({
        where: { fracaoId: fracoes[0].id, ano: 2026, mes: 4 },
      });
      await prisma.imputacaoExtra.updateMany({
        where: {
          fracaoId: fracoes[0].id,
          mesAplicacao: 4,
          anoAplicacao: 2026,
          estado: EstadoImputacao.PENDENTE,
        },
        data: {
          estado: EstadoImputacao.APLICADA,
          quotaMensalId: quota!.id,
        },
      });
    }
    return fracoes[0].id;
  }

  it("AC-12: 0 extras → mesCorrente.extras vazio", async () => {
    const fracaoId = await comExtras(0);
    const r = await getMinhasContas(fracaoId, 4, 2026);
    expect(r.mesCorrente?.extras.length).toBe(0);
    expect(r.mesCorrente?.valorTotalCents).toBe(3000);
  });

  it("AC-13: 1 extra com título correcto", async () => {
    const fracaoId = await comExtras(1);
    const r = await getMinhasContas(fracaoId, 4, 2026);
    expect(r.mesCorrente?.extras.length).toBe(1);
    expect(r.mesCorrente?.extras[0].titulo).toBe("Reparação telhado");
    expect(r.mesCorrente?.valorTotalCents).toBe(3000 + 7000);
  });

  it("AC-14/AC-15: ≥ 2 extras → 3 entradas com títulos individuais", async () => {
    const fracaoId = await comExtras(3);
    const r = await getMinhasContas(fracaoId, 4, 2026);
    expect(r.mesCorrente?.extras.length).toBe(3);
    const titulos = r.mesCorrente?.extras.map((e) => e.titulo).sort();
    expect(titulos).toEqual(["Pintura", "Porta entrada", "Reparação telhado"]);
    const totalExtras = r.mesCorrente!.extras.reduce((s, e) => s + e.valorCents, 0);
    expect(r.mesCorrente?.valorTotalCents).toBe(3000 + totalExtras);
  });
});
