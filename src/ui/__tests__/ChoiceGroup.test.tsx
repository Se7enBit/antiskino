import { fireEvent, render, screen } from '@testing-library/react-native';

import { ChoiceGroup } from '../ChoiceGroup';

/** The group's own role (a plain View, so not found by role queries). */
const groupRole = () => {
  const root = screen.toJSON();
  return root && !Array.isArray(root) ? root.props.accessibilityRole : undefined;
};

const OPTIONS = [
  { value: 'tent', label: 'Tent' },
  { value: 'caravan', label: 'Caravan' },
];

describe('ChoiceGroup', () => {
  it('is a radio group for one choice, with the chosen one checked', async () => {
    const onChange = jest.fn();
    await render(<ChoiceGroup options={OPTIONS} selected="caravan" onChange={onChange} />);
    expect(groupRole()).toBe('radiogroup');
    expect(screen.getByRole('radio', { name: 'Caravan' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByRole('radio', { name: 'Tent' }).props.accessibilityState).toMatchObject({
      checked: false,
    });
    await fireEvent.press(screen.getByRole('radio', { name: 'Tent' }));
    expect(onChange).toHaveBeenCalledWith('tent');
  });

  it('is a set of checkboxes for several choices', async () => {
    await render(<ChoiceGroup options={OPTIONS} selected={['tent']} onChange={jest.fn()} />);
    expect(groupRole()).toBe('none');
    expect(screen.getByRole('checkbox', { name: 'Tent' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });
});
