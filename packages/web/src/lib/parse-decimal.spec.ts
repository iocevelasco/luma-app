import { describe, expect, it } from 'vitest';
import { numberField, parseDecimal } from './parse-decimal';

describe('parseDecimal', () => {
  it('acepta coma o punto como decimal', () => {
    expect(parseDecimal('2,5')).toBe(2.5);
    expect(parseDecimal('2.5')).toBe(2.5);
    expect(parseDecimal('0,25')).toBe(0.25);
  });

  it('un entero queda entero, con o sin espacios', () => {
    expect(parseDecimal('40')).toBe(40);
    expect(parseDecimal('  7 ')).toBe(7);
  });

  it('con coma y punto, el último es el decimal y el otro separa miles', () => {
    expect(parseDecimal('1.234,5')).toBe(1234.5);
    expect(parseDecimal('1,234.5')).toBe(1234.5);
  });

  it('varios puntos son separadores de miles', () => {
    expect(parseDecimal('1.234.567')).toBe(1234567);
  });

  it('vacío o inválido da NaN, nunca un número inventado', () => {
    for (const text of ['', '   ', 'abc', '2,5,1', '--3', '3x', '-2', ',', '.5.']) {
      expect(parseDecimal(text), text).toBeNaN();
    }
  });

  it('un número que ya lo es pasa tal cual (React Hook Form pasa los valores iniciales)', () => {
    expect(parseDecimal(4)).toBe(4);
    expect(parseDecimal(0.5)).toBe(0.5);
    expect(parseDecimal(Number.NaN)).toBeNaN();
    expect(parseDecimal(Number.POSITIVE_INFINITY)).toBeNaN();
  });

  it('null y undefined dan NaN en vez de romper', () => {
    expect(parseDecimal(undefined)).toBeNaN();
    expect(parseDecimal(null)).toBeNaN();
  });
});

describe('numberField', () => {
  it('un campo vacío vale lo que se pidió; con texto, lo parsea', () => {
    expect(numberField(undefined)('')).toBeUndefined();
    expect(numberField(0)('')).toBe(0);
    expect(numberField(0)(undefined)).toBe(0);
    expect(numberField(undefined)('2,5')).toBe(2.5);
    expect(numberField(undefined)(4)).toBe(4);
  });
});
