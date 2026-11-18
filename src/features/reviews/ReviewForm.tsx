import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { REVIEW_MAX_LENGTH, reviewInputSchema, type ReviewInput } from '@/domain/reviews';
import { useT } from '@/i18n';
import { BodyText, Button, Notice, StarPicker, TextField, spacing } from '@/ui';

type Props = {
  onSubmit: (input: ReviewInput) => void;
  submitting: boolean;
  /** A message for a failed submit, or null. */
  error: string | null;
};

/** Stars and an optional text for a completed stay (SPEC F9). */
export function ReviewForm({ onSubmit, submitting, error }: Props) {
  const t = useT();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [missing, setMissing] = useState(false);

  const submit = () => {
    const parsed = reviewInputSchema.safeParse({ rating, body });
    if (!parsed.success) return setMissing(true);
    onSubmit(parsed.data);
  };

  return (
    <View style={styles.form}>
      <BodyText>{t('reviews.form.rating')}</BodyText>
      <StarPicker
        value={rating}
        onChange={(n) => {
          setRating(n);
          setMissing(false);
        }}
        starLabel={(n) => t('reviews.form.star', { count: n })}
        testID="review-stars"
      />
      {missing ? <Notice tone="error" message={t('reviews.form.ratingRequired')} /> : null}
      <TextField
        label={t('reviews.form.body')}
        value={body}
        onChangeText={setBody}
        maxLength={REVIEW_MAX_LENGTH}
        multiline
        testID="review-body"
      />
      <BodyText>{t('reviews.form.hint')}</BodyText>
      {error ? <Notice tone="error" message={error} /> : null}
      <View style={styles.row}>
        <Button
          label={t('reviews.form.submit')}
          variant="primary"
          loading={submitting}
          onPress={submit}
          testID="review-submit"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm },
  row: { flexDirection: 'row' },
});
