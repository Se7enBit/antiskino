import { fireEvent, render, screen } from '@testing-library/react-native';

import { DateRangePicker, type DateRange } from '../DateRangePicker';

const labels = { previousMonth: 'Previous month', nextMonth: 'Next month' };

async function setup(range: DateRange = { arrival: null, departure: null }) {
  const onChange = jest.fn();
  await render(
    <DateRangePicker
      {...range}
      onChange={onChange}
      minDate="2027-07-05"
      maxNights={3}
      language="en"
      labels={labels}
    />,
  );
  return onChange;
}

const disabled = (day: string) =>
  screen.getByTestId(`day-${day}`).props.accessibilityState.disabled;

describe('DateRangePicker', () => {
  it('shows the month of the first possible day, Monday first', async () => {
    await setup();
    expect(screen.getByText('July 2027')).toBeTruthy();
    expect(
      screen.getAllByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/).map((n) => n.props.children),
    ).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(disabled('2027-07-04')).toBe(true);
    expect(disabled('2027-07-05')).toBe(false);
    expect(screen.getByTestId('month-prev').props.accessibilityState.disabled).toBe(true);
  });

  it('picks the arrival first', async () => {
    const onChange = await setup();
    await fireEvent.press(screen.getByTestId('day-2027-07-10'));
    expect(onChange).toHaveBeenCalledWith({ arrival: '2027-07-10', departure: null });
  });

  it('then the departure, up to the longest stay', async () => {
    const onChange = await setup({ arrival: '2027-07-10', departure: null });
    expect(disabled('2027-07-13')).toBe(false);
    expect(disabled('2027-07-14')).toBe(true);
    await fireEvent.press(screen.getByTestId('day-2027-07-12'));
    expect(onChange).toHaveBeenCalledWith({ arrival: '2027-07-10', departure: '2027-07-12' });
  });

  it('starts over when tapping a day on or before the arrival, or after a full range', async () => {
    const onChange = await setup({ arrival: '2027-07-10', departure: null });
    await fireEvent.press(screen.getByTestId('day-2027-07-08'));
    expect(onChange).toHaveBeenLastCalledWith({ arrival: '2027-07-08', departure: null });
    onChange.mockClear();
    await screen.rerender(
      <DateRangePicker
        arrival="2027-07-10"
        departure="2027-07-12"
        onChange={onChange}
        minDate="2027-07-05"
        maxNights={3}
        language="en"
        labels={labels}
      />,
    );
    await fireEvent.press(screen.getByTestId('day-2027-07-20'));
    expect(onChange).toHaveBeenLastCalledWith({ arrival: '2027-07-20', departure: null });
  });

  it('moves between months', async () => {
    await setup({ arrival: '2027-12-30', departure: null });
    expect(screen.getByText('December 2027')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('month-next'));
    expect(screen.getByText('January 2028')).toBeTruthy();
    expect(screen.getByTestId('day-2028-01-02')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('month-prev'));
    expect(screen.getByText('December 2027')).toBeTruthy();
  });
});
