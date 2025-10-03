import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAttendanceHistory } from '@/hooks/use-attendance-history';
import type { AttendanceLog } from '@/lib/types/student';

export default function HistoryScreen() {
  const { records, loading, error } = useAttendanceHistory(20);

  return (
    <ThemedView style={styles.screen}>
      <ThemedText type="title">Attendance history</ThemedText>
      <ThemedText type="subtitle">Latest check-ins and flags.</ThemedText>

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => undefined} />}
        renderItem={({ item }) => <HistoryItem log={item} />}
        ListEmptyComponent={
          loading ? <ThemedText>Loading history…</ThemedText> : <ThemedText>No attendance yet.</ThemedText>
        }
      />

      {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}
    </ThemedView>
  );
}

function HistoryItem({ log }: { log: AttendanceLog }) {
  const recordedLabel = log.recordedAtLabel ?? formatTimestamp(log.recordedAt);

  return (
    <ThemedView style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <ThemedText type="defaultSemiBold">{log.className}</ThemedText>
        <StatusPill status={log.status} />
      </View>
      <ThemedText type="default">{log.subject}</ThemedText>
      <ThemedText type="default">{recordedLabel}</ThemedText>
      {log.notes?.length ? (
        <ThemedText type="default">Notes: {log.notes.join(', ')}</ThemedText>
      ) : null}
    </ThemedView>
  );
}

function StatusPill({ status }: { status: string }) {
  const background = status === 'present' ? 'rgba(10, 126, 164, 0.18)' : 'rgba(236, 87, 87, 0.18)';
  const color = status === 'present' ? '#0a7ea4' : '#d64545';

  return (
    <View style={[styles.pill, { backgroundColor: background }]}> 
      <ThemedText type="defaultSemiBold" style={[styles.pillText, { color }]}
      >
        {status.toUpperCase()}
      </ThemedText>
    </View>
  );
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) {
    return 'Unknown time';
  }

  const parsed = parseISO(timestamp);
  if (!isValid(parsed)) {
    return 'Unknown time';
  }

  return formatDistanceToNow(parsed, { addSuffix: true });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
    gap: 12
  },
  listContent: {
    gap: 12,
    paddingBottom: 32
  },
  itemCard: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.05)'
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  pillText: {
    fontSize: 12,
    letterSpacing: 0.8
  },
  errorText: {
    color: '#ff5d5d'
  }
});
