import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BodyText, Card } from './Card';
import { Button } from './Button';
import { colors, spacing } from './theme';

type Props<T extends { id: string }> = {
  title: string;
  items: T[];
  canEdit: boolean;
  addLabel: string;
  editLabel: string;
  emptyText: string;
  /** One line (or a few) describing an item. */
  renderSummary: (item: T) => ReactNode;
  /** The Edit button's name for screen readers, e.g. "Edit: Low season". */
  editA11yLabel?: (item: T) => string;
  /** The editor for an item, or for a new one when item is undefined. */
  renderEditor: (item: T | undefined, close: () => void) => ReactNode;
  testID: string;
};

/** A card listing items, each editable in place; one editor open at a time. */
export function EditableList<T extends { id: string }>({
  title,
  items,
  canEdit,
  addLabel,
  editLabel,
  emptyText,
  renderSummary,
  editA11yLabel,
  renderEditor,
  testID,
}: Props<T>) {
  const [editing, setEditing] = useState<string | null>(null);
  const close = () => setEditing(null);

  return (
    <Card title={title}>
      {items.length === 0 && editing !== 'new' ? <BodyText>{emptyText}</BodyText> : null}
      {items.map((item) => (
        <View key={item.id} style={styles.item}>
          {editing === item.id ? (
            renderEditor(item, close)
          ) : (
            <>
              {renderSummary(item)}
              {canEdit ? (
                <Button
                  label={editLabel}
                  accessibilityLabel={editA11yLabel?.(item)}
                  onPress={() => setEditing(item.id)}
                  testID={`${testID}-edit-${item.id}`}
                />
              ) : null}
            </>
          )}
        </View>
      ))}
      {editing === 'new' ? <View style={styles.item}>{renderEditor(undefined, close)}</View> : null}
      {canEdit && editing === null ? (
        <Button label={addLabel} onPress={() => setEditing('new')} testID={`${testID}-add`} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  item: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
