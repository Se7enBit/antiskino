import { fireEvent, screen } from '@testing-library/react-native';

import { useCommissionMonth, useSetStatementStatus } from '@/api/commission';
import type { CommissionLine } from '@/domain/commission';
import { i18n } from '@/i18n';
import { saveTextFile } from '@/lib/saveFile';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { AdminCommission } from '../AdminCommission';

jest.mock('@/api/commission', () => ({
  useCommissionMonth: jest.fn(),
  useSetStatementStatus: jest.fn(),
}));
jest.mock('@/lib/saveFile', () => ({ saveTextFile: jest.fn(() => Promise.resolve()) }));
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual<object>('@/lib/dates'),
  todayInAthens: () => '2027-08-14',
}));

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

function setup(
  lines: CommissionLine[],
  statements: { partner_id: string; total_cents: number; status: string }[] = [],
) {
  jest.mocked(useCommissionMonth).mockReturnValue({
    isPending: false,
    isError: false,
    data: { lines, statements },
  } as unknown as ReturnType<typeof useCommissionMonth>);
  const setStatus = fakeMutation();
  jest
    .mocked(useSetStatementStatus)
    .mockReturnValue(setStatus as unknown as ReturnType<typeof useSetStatementStatus>);
  return setStatus;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('en');
});

describe('Admin commission', () => {
  it('shows last month’s commission per partner and marks statements', async () => {
    const setStatus = setup([
      line({}),
      line({ ref: 'ANT-BBBBBB', commissionCents: 543, totalCents: 9050 }),
    ]);
    await renderWithLanguage(<AdminCommission />);
    expect(useCommissionMonth).toHaveBeenCalledWith('2027-07-01');
    expect(screen.getByText('July 2027')).toBeTruthy();
    expect(screen.getByText('Completed stays: 2 · value €140.50')).toBeTruthy();
    expect(screen.getByTestId('commission-due-p1').props.children).toBe('Commission due: €8.43');
    expect(screen.getByText('Open')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('mark-sent-p1'));
    expect(setStatus.mutate).toHaveBeenCalledWith({ partnerId: 'p1', status: 'sent' });
  });

  it('flags a statement whose total changed after it was marked', async () => {
    setup([line({})], [{ partner_id: 'p1', total_cents: 200, status: 'sent' }]);
    await renderWithLanguage(<AdminCommission />);
    expect(screen.getByText('Sent')).toBeTruthy();
    expect(
      screen.getByText('When marked, the total was €2.00; mark it again to update it.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('mark-sent-p1')).toBeNull();
    expect(screen.getByTestId('mark-open-p1')).toBeTruthy();
  });

  it('downloads the month’s stays as CSV and moves between months', async () => {
    setup([line({})]);
    await renderWithLanguage(<AdminCommission />);
    await fireEvent.press(screen.getByTestId('commission-csv'));
    expect(saveTextFile).toHaveBeenCalledWith(
      'antiskino-commission-2027-07.csv',
      expect.stringContaining('Thalassa Ltd;Camping Thalassa;ANT-AAAAAA'),
      'text/csv',
    );
    await fireEvent.press(screen.getByTestId('month-prev'));
    expect(useCommissionMonth).toHaveBeenLastCalledWith('2027-06-01');
  });

  it('says when nothing was completed', async () => {
    setup([]);
    await renderWithLanguage(<AdminCommission />);
    expect(screen.getByText('No completed stays in this month.')).toBeTruthy();
  });
});
