import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/api/auth';
import {
  useBookingContext,
  useCreateBooking,
  useMyDetails,
  useQuote,
  type BookingContext,
  type CreateBookingResponse,
} from '@/api/booking';
import { bookingTargetFromParams, type BookingTarget, type GuestDetails } from '@/domain/booking';
import { isLanguage } from '@/i18n/languages';
import { localized, useLanguage, useT } from '@/i18n';
import { useHydrated } from '@/lib/useHydrated';
import { Button, Loading, Notice, Screen, colors, spacing } from '@/ui';

import { BookingDone } from './BookingDone';
import { useBookingDraft } from './bookingDraft';
import { DetailsStep } from './DetailsStep';
import type { ItemNames } from './PriceBreakdown';
import { ReviewStep } from './ReviewStep';
import { StayStep } from './StayStep';

const STEPS = ['stay', 'details', 'review'] as const;
type Step = (typeof STEPS)[number];
type Booked = Extract<CreateBookingResponse, { booked: true }>;

/** /book?pitchType=…&arrival=…: the 3-step booking flow (SPEC F3). */
export function BookingScreen() {
  const t = useT();
  const params = useLocalSearchParams();
  // The static page is built without URL parameters.
  const hydrated = useHydrated();
  const target = hydrated ? bookingTargetFromParams(params) : null;
  return (
    <Screen>
      {!hydrated ? <Loading label={t('common.loading')} /> : null}
      {hydrated && !target ? (
        <>
          <Notice message={t('booking.badLink')} />
          <Button
            label={t('search.newSearch')}
            variant="primary"
            onPress={() => router.navigate('/')}
          />
        </>
      ) : null}
      {target ? <BookingFlow key={JSON.stringify(target)} target={target} /> : null}
    </Screen>
  );
}

function namesOf(context: BookingContext): ItemNames {
  return {
    pitch: context.pitchType.name,
    guest: Object.fromEntries(context.guestCategories.map((c) => [c.id, c.name])),
    extra: Object.fromEntries(context.extras.map((e) => [e.id, e.name])),
    fee: Object.fromEntries(context.fees.map((f) => [f.id, f.name])),
  };
}

function BookingFlow({ target }: { target: BookingTarget }) {
  const t = useT();
  const { language } = useLanguage();
  const key = JSON.stringify(target);
  const draft = useBookingDraft();
  const extras = draft.key === key ? draft.extras : {};
  const context = useBookingContext(target.pitchTypeId);
  const [booked, setBooked] = useState<Booked | null>(null);
  const quote = useQuote(
    // Nothing more to price once booked.
    context.data && !booked
      ? {
          ...target.stay,
          pitchTypeId: target.pitchTypeId,
          extras: Object.fromEntries(Object.entries(extras).filter(([, qty]) => qty > 0)),
        }
      : null,
  );
  const { session } = useAuth();
  const myDetails = useMyDetails(session?.user.id);
  const create = useCreateBooking();
  const [step, setStep] = useState<Step>('stay');
  const [details, setDetails] = useState<GuestDetails | null>(null);
  const [taken, setTaken] = useState(false);
  const [termsMissing, setTermsMissing] = useState(false);

  const { start, setGuest } = draft;
  useEffect(() => start(key), [key, start]);

  // Prefill empty fields: the signed-in user's details, the app's language.
  const email = session?.user.email;
  const profile = myDetails.data;
  useEffect(() => {
    const guest = useBookingDraft.getState().guest;
    setGuest({
      name: guest.name || profile?.full_name || '',
      email: guest.email || email || '',
      phone: guest.phone || profile?.phone || '',
      country: guest.country !== 'GR' || !profile?.country ? guest.country : profile.country,
      locale: guest.name ? guest.locale : isLanguage(profile?.locale) ? profile.locale : language,
    });
  }, [email, profile, language, setGuest]);

  if (context.isPending) return <Loading label={t('common.loading')} />;
  if (context.isError)
    return (
      <View style={styles.flow}>
        <Notice tone="error" message={t('common.error')} />
        <Button label={t('common.retry')} onPress={() => void context.refetch()} />
      </View>
    );
  if (!context.data) return <Notice message={t('booking.unavailable.not_found')} />;
  const ctx = context.data;
  const names = namesOf(ctx);

  if (booked)
    return (
      <BookingDone
        result={booked}
        campingName={ctx.camping.name}
        requestHours={ctx.camping.requestExpiryHours}
      />
    );

  const backToCamping = () => router.back();
  const submit = () => {
    if (!draft.accepted) return setTermsMissing(true);
    if (!details || !quote.data?.available) return;
    create.mutate(
      {
        ...target.stay,
        pitchTypeId: target.pitchTypeId,
        extras: Object.fromEntries(Object.entries(extras).filter(([, qty]) => qty > 0)),
        guest: details,
        acceptTerms: true,
      },
      {
        onSuccess: (result) => {
          if (result.booked) {
            setBooked(result);
            draft.finish();
          } else {
            // Taken by someone else meanwhile: back to the first step with the news.
            setTaken(true);
            setStep('stay');
          }
        },
      },
    );
  };

  return (
    <View style={styles.flow}>
      <View>
        <Text style={styles.title} accessibilityRole="header">
          {ctx.camping.name} · {localized(ctx.pitchType.name, language)}
        </Text>
        <Text style={styles.step}>
          {t('booking.stepOf', { step: STEPS.indexOf(step) + 1, name: t(`booking.steps.${step}`) })}
        </Text>
      </View>
      {taken ? <Notice tone="error" message={t('booking.taken')} /> : null}

      {step === 'stay' ? (
        <StayStep
          context={ctx}
          target={target}
          quote={quote.data}
          quoteFailed={quote.isError}
          names={names}
          extras={extras}
          onExtra={draft.setExtra}
          onBack={backToCamping}
          onContinue={() => setStep('details')}
        />
      ) : null}
      {step === 'details' ? (
        <DetailsStep
          guest={draft.guest}
          onChange={draft.setGuest}
          onBack={() => setStep('stay')}
          onContinue={(parsed) => {
            setDetails(parsed);
            setStep('review');
          }}
        />
      ) : null}
      {step === 'review' && details && quote.data?.available ? (
        <ReviewStep
          context={ctx}
          target={target}
          quote={quote.data}
          names={names}
          guest={details}
          accepted={draft.accepted}
          onAccept={draft.setAccepted}
          termsMissing={termsMissing}
          failed={create.isError}
          submitting={create.isPending}
          onBack={() => setStep('details')}
          onSubmit={submit}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flow: { gap: spacing.md },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  step: { fontSize: 15, color: colors.muted, marginTop: spacing.xs },
});
