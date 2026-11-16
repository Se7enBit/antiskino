import { campingFormSchema, fieldErrors, partnerFormSchema } from '../partners';

describe('partnerFormSchema', () => {
  it('maps the form to a partners row', () => {
    expect(
      partnerFormSchema.parse({
        name: ' Demo Campings ',
        legalName: 'Demo Campings IKE',
        vatNumber: '',
        billingEmail: ' Billing@Example.GR ',
        commissionPercent: '5,5',
      }),
    ).toEqual({
      name: 'Demo Campings',
      legal_name: 'Demo Campings IKE',
      vat_number: null,
      billing_email: 'billing@example.gr',
      commission_bps: 550,
    });
  });

  it('reports each invalid field', () => {
    const result = partnerFormSchema.safeParse({
      name: ' ',
      legalName: '',
      vatNumber: '',
      billingEmail: 'nope',
      commissionPercent: '120',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error)).toEqual({
        name: true,
        billingEmail: true,
        commissionPercent: true,
      });
    }
  });
});

describe('campingFormSchema', () => {
  it('accepts a name, a slug and an optional region', () => {
    expect(campingFormSchema.parse({ name: 'Thalassa', slug: 'thalassa', region: '' })).toEqual({
      name: 'Thalassa',
      slug: 'thalassa',
      region: null,
    });
  });

  it('rejects slugs the database would refuse', () => {
    for (const slug of ['Thalassa', 'thalassa-', '-thalassa', 'tha lassa', 'θάλασσα', '']) {
      expect(campingFormSchema.safeParse({ name: 'x', slug, region: '' }).success).toBe(false);
    }
  });
});
