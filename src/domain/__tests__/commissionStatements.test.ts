import { commissionCsv, summarizeCommission, type CommissionLine } from '../commission';

const line = (patch: Partial<CommissionLine>): CommissionLine => ({
  partnerId: 'p1',
  partnerName: 'Thalassa Ltd',
  campingName: 'Camping Thalassa',
  ref: 'ANT-AAAAAA',
  arrival: '2027-07-01',
  departure: '2027-07-03',
  nights: 2,
  totalCents: 5000,
  commissionBps: 600,
  commissionCents: 300,
  ...patch,
});

const HEADERS = [
  'Partner',
  'Camping',
  'Reference',
  'Arrival',
  'Departure',
  'Nights',
  'Stay',
  'Rate',
  'Commission',
] as [string, string, string, string, string, string, string, string, string];

describe('summarizeCommission', () => {
  it('adds up stays and commission per partner, by name', () => {
    expect(
      summarizeCommission([
        line({}),
        line({ ref: 'ANT-BBBBBB', totalCents: 9050, commissionCents: 543 }),
        line({ partnerId: 'p2', partnerName: 'Ammos', ref: 'ANT-CCCCCC' }),
      ]),
    ).toEqual([
      { partnerId: 'p2', partnerName: 'Ammos', stays: 1, staysCents: 5000, commissionCents: 300 },
      {
        partnerId: 'p1',
        partnerName: 'Thalassa Ltd',
        stays: 2,
        staysCents: 14050,
        commissionCents: 843,
      },
    ]);
  });
});

describe('commissionCsv', () => {
  it('writes a spreadsheet-friendly CSV in the language', () => {
    const csv = commissionCsv(
      [line({ commissionBps: 550, commissionCents: 498, totalCents: 9050 })],
      HEADERS,
      'el',
    );
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Partner;Camping;Reference;Arrival;Departure;Nights;Stay;Rate;Commission',
      'Thalassa Ltd;Camping Thalassa;ANT-AAAAAA;2027-07-01;2027-07-03;2;90,50;5,5%;4,98',
      '',
    ]);
    expect(commissionCsv([line({})], HEADERS, 'en')).toContain(';50.00;6%;3.00');
  });

  it('quotes fields with separators or quotes', () => {
    expect(commissionCsv([line({ partnerName: 'A; "B"' })], HEADERS, 'en')).toContain(
      '"A; ""B""";Camping Thalassa',
    );
  });
});
