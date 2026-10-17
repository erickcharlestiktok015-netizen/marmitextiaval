import { describe, it, expect } from 'vitest';
import { normalizeEmail, normalizePhone, normalizeFirstName } from './facebook-capi.server';

describe('Meta CAPI normalização', () => {
  it('email em minúsculo e sem espaços', () => expect(normalizeEmail('  Maria@Email.COM ')).toBe('maria@email.com'));
  it('telefone só números com DDI 55', () => expect(normalizePhone('(85) 99999-1234')).toBe('5585999991234'));
  it('não duplica o DDI 55', () => expect(normalizePhone('5585999991234')).toBe('5585999991234'));
  it('primeiro nome', () => expect(normalizeFirstName('José da Silva')).toBe('jose'));
});
