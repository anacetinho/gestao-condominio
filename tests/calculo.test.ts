import { ModoRateio } from "@/lib/constants";
import {
  calcularImputacaoPorFracao,
  calcularMesPrestacao,
  dividirPorPrestacoes,
} from "@/lib/grandes-despesas/calculo";
import { describe, expect, it } from "vitest";

describe("calcularImputacaoPorFracao", () => {
  it("rateio igual: divide €700 por 8 frações sem perder cêntimos", () => {
    const fracoes = Array.from({ length: 8 }, (_, i) => ({
      id: `f${i}`,
      permilagem: 125,
    }));
    const result = calcularImputacaoPorFracao(70000, fracoes, ModoRateio.IGUAL);
    expect(result.length).toBe(8);
    const soma = result.reduce((s, r) => s + r.valorTotalCents, 0);
    expect(soma).toBe(70000);
    // todas as frações têm 8750 cents
    expect(result.every((r) => r.valorTotalCents === 8750)).toBe(true);
  });

  it("rateio igual: distribui resto pelas primeiras frações", () => {
    const fracoes = [
      { id: "a", permilagem: 333 },
      { id: "b", permilagem: 333 },
      { id: "c", permilagem: 334 },
    ];
    const result = calcularImputacaoPorFracao(10000, fracoes, ModoRateio.IGUAL);
    const soma = result.reduce((s, r) => s + r.valorTotalCents, 0);
    expect(soma).toBe(10000);
    expect(result[0].valorTotalCents).toBe(3334);
    expect(result[1].valorTotalCents).toBe(3333);
    expect(result[2].valorTotalCents).toBe(3333);
  });

  it("rateio por permilagem: respeita pesos e absorve resto na última fração", () => {
    const fracoes = [
      { id: "a", permilagem: 250 },
      { id: "b", permilagem: 250 },
      { id: "c", permilagem: 500 },
    ];
    const result = calcularImputacaoPorFracao(10000, fracoes, ModoRateio.PERMILAGEM);
    expect(result[0].valorTotalCents).toBe(2500);
    expect(result[1].valorTotalCents).toBe(2500);
    expect(result[2].valorTotalCents).toBe(5000);
    expect(result.reduce((s, r) => s + r.valorTotalCents, 0)).toBe(10000);
  });

  it("permilagem que não soma 1000 lança erro", () => {
    const fracoes = [
      { id: "a", permilagem: 200 },
      { id: "b", permilagem: 300 },
    ];
    expect(() => calcularImputacaoPorFracao(1000, fracoes, ModoRateio.PERMILAGEM)).toThrow();
  });

  it("rejeita valor zero ou negativo", () => {
    const fracoes = [{ id: "a", permilagem: 1000 }];
    expect(() => calcularImputacaoPorFracao(0, fracoes, ModoRateio.IGUAL)).toThrow();
    expect(() => calcularImputacaoPorFracao(-10, fracoes, ModoRateio.IGUAL)).toThrow();
  });
});

describe("dividirPorPrestacoes", () => {
  it("distribui €175 em 4 prestações exactas", () => {
    const r = dividirPorPrestacoes(17500, 4);
    expect(r).toEqual([4375, 4375, 4375, 4375]);
    expect(r.reduce((s, v) => s + v, 0)).toBe(17500);
  });

  it("distribui resto pelas primeiras prestações", () => {
    const r = dividirPorPrestacoes(10003, 3);
    // 3334 + 3334 + 3335 ou similar — soma = 10003
    expect(r.reduce((s, v) => s + v, 0)).toBe(10003);
    expect(r[0]).toBeGreaterThanOrEqual(r[2]);
  });

  it("rejeita numeroMeses < 1", () => {
    expect(() => dividirPorPrestacoes(100, 0)).toThrow();
  });
});

describe("calcularMesPrestacao", () => {
  it("avança 1 mês dentro do ano", () => {
    expect(calcularMesPrestacao(3, 2026, 1)).toEqual({ mes: 4, ano: 2026 });
  });
  it("avança virando ano", () => {
    expect(calcularMesPrestacao(11, 2026, 3)).toEqual({ mes: 2, ano: 2027 });
  });
  it("prestação 0 = inicial", () => {
    expect(calcularMesPrestacao(7, 2026, 0)).toEqual({ mes: 7, ano: 2026 });
  });
});
