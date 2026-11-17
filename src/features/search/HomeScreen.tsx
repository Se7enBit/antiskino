import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useLiveCampings } from '@/api/search';
import { paramsFromRequest, regionsOf } from '@/domain/search';
import { useT } from '@/i18n';
import { BodyText, Screen, colors, spacing } from '@/ui';

import { SearchForm } from './SearchForm';

/** Home: the search form (SPEC F1). */
export function HomeScreen() {
  const t = useT();
  const campings = useLiveCampings();
  return (
    <Screen>
      <View style={styles.intro}>
        <Text style={styles.title} accessibilityRole="header">
          {t('search.title')}
        </Text>
        <BodyText>{t('search.subtitle')}</BodyText>
      </View>
      <SearchForm
        regions={regionsOf(campings.data ?? [])}
        onSearch={(request) =>
          router.push({ pathname: '/search', params: paramsFromRequest(request) })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.xs },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
});
