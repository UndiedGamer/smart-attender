import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type ModalParams = {
  status?: string;
  message?: string;
  proximity?: string;
  notes?: string;
  className?: string;
  subject?: string;
};

export default function ModalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<ModalParams>();

  const status = (params.status ?? 'present').toLowerCase();
  const message = params.message ?? 'Attendance recorded.';
  const proximityMeters = Number.parseFloat(params.proximity ?? '0');
  const notes = typeof params.notes === 'string' && params.notes.length > 0 ? params.notes.split('|') : [];
  const className = params.className ?? 'Class';
  const subject = params.subject ?? 'Subject';

  const statusColor = status === 'present' ? '#0a7ea4' : '#d64545';

  return (
    <ThemedView style={styles.container}>
      <View style={styles.card}>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <ThemedText type="defaultSemiBold" style={[styles.statusText, { color: statusColor }]}>
            {status.toUpperCase()}
          </ThemedText>
        </View>
        <ThemedText type="title" style={styles.title}>
          {className}
        </ThemedText>
        <ThemedText type="subtitle">{subject}</ThemedText>
        <ThemedText type="default" style={styles.message}>
          {message}
        </ThemedText>
        {Number.isFinite(proximityMeters) && proximityMeters > 0 && (
          <ThemedText type="default">Distance from class: {proximityMeters.toFixed(1)} m</ThemedText>
        )}
        {notes.length > 0 && (
          <View style={styles.notes}>
            {notes.map((note, index) => (
              <ThemedText key={`${note}-${index}`} type="default">
                • {note}
              </ThemedText>
            ))}
          </View>
        )}
      </View>

      <Pressable style={styles.dismissButton} onPress={() => router.back()}>
        <ThemedText type="defaultSemiBold" style={styles.dismissLabel}>
          Dismiss
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  card: {
    borderRadius: 18,
    padding: 24,
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    letterSpacing: 1,
  },
  title: {
    textAlign: 'left',
  },
  message: {
    lineHeight: 20,
  },
  notes: {
    gap: 4,
  },
  dismissButton: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0a7ea4',
  },
  dismissLabel: {
    color: '#fff',
  },
});
