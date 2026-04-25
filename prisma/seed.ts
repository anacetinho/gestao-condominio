/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import { ModoQuota, Role } from "../lib/constants";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding…");

  const admin = await prisma.user.upsert({
    where: { email: "admin@exemplo.pt" },
    update: {},
    create: { email: "admin@exemplo.pt", nome: "Maria Admin" },
  });
  const m1 = await prisma.user.upsert({
    where: { email: "morador1@exemplo.pt" },
    update: {},
    create: { email: "morador1@exemplo.pt", nome: "João Costa" },
  });
  const m2 = await prisma.user.upsert({
    where: { email: "morador2@exemplo.pt" },
    update: {},
    create: { email: "morador2@exemplo.pt", nome: "Ana Pereira" },
  });

  const cond = await prisma.condominio.create({
    data: {
      nome: "Cond. Alameda 12",
      morada: "Rua da Alameda 12, 1000-001 Lisboa",
    },
  });

  const f1 = await prisma.fracao.create({
    data: { condominioId: cond.id, identificador: "1ºA", permilagem: 250 },
  });
  const f2 = await prisma.fracao.create({
    data: { condominioId: cond.id, identificador: "1ºB", permilagem: 250 },
  });
  const f3 = await prisma.fracao.create({
    data: { condominioId: cond.id, identificador: "2ºA", permilagem: 250 },
  });
  const f4 = await prisma.fracao.create({
    data: { condominioId: cond.id, identificador: "2ºB", permilagem: 250 },
  });

  await prisma.membership.create({
    data: { condominioId: cond.id, userId: admin.id, role: Role.ADMINISTRADOR, fracaoId: f1.id },
  });
  await prisma.membership.create({
    data: { condominioId: cond.id, userId: m1.id, role: Role.MORADOR, fracaoId: f2.id },
  });
  await prisma.membership.create({
    data: { condominioId: cond.id, userId: m2.id, role: Role.MORADOR, fracaoId: f3.id },
  });
  void f4;

  await prisma.configuracaoQuota.create({
    data: {
      condominioId: cond.id,
      modo: ModoQuota.VALOR_UNICO,
      valorUnicoCents: 3000,
      vigenteDesde: new Date(),
    },
  });

  console.log("Seed concluído. Faça login com admin@exemplo.pt");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
