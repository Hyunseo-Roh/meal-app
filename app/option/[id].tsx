import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { supabase } from '../../lib/supabase';
import { spacing } from '../../theme/tokens';

/**
 * TEMPORARY placeholder — Step 2 only.
 *
 * Confirms a card tap carries the real recommendation_options.id through. Looks
 * up the option's meal_id to prove the row exists. Replaced by Screen 5
 * ("Why We Chose This") in Step 3.
 */
export default function OptionPlaceholder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mealId, setMealId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('recommendation_options')
      .select('meal_id')
      .eq('id', id)
      .single()
      .then(({ data }) => setMealId(data?.meal_id ?? 'not found'));
  }, [id]);

  return (
    <Screen style={styles.screen}>
      <Text variant="caption" color="textSecondary" style={styles.tag}>
        Temporary · option selected
      </Text>
      <Text variant="title">Why this one.</Text>
      <View style={styles.block}>
        <Text variant="caption" color="textSecondary">
          Option id
        </Text>
        <Text variant="body">{id}</Text>
      </View>
      <View style={styles.block}>
        <Text variant="caption" color="textSecondary">
          Meal id
        </Text>
        <Text variant="body">{mealId ?? '…'}</Text>
      </View>
      <Text variant="body" color="textSecondary">
        Next: Screen 5 will explain the pick.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
    gap: spacing.lg,
  },
  tag: {
    marginBottom: spacing.sm,
  },
  block: {
    gap: spacing.xs,
  },
});
