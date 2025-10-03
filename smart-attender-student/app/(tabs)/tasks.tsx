import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/providers/AuthProvider';
import { useStudentTasks } from '@/hooks/use-student-tasks';
import type { StudentTask } from '@/services/student-tasks';

export default function TasksScreen() {
  const colorScheme = useColorScheme();
  const { isMock } = useAuth();
  const { tasks, loading, error, toggleTask, refresh } = useStudentTasks();
  const [refreshing, setRefreshing] = useState(false);

  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);
  const surface = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const accent = Colors[colorScheme ?? 'light'].tint;

  useEffect(() => {
    if (!loading && refreshing) {
      setRefreshing(false);
    }
  }, [loading, refreshing]);

  const handleRefresh = () => {
    setRefreshing(true);
    refresh();
  };

  const handleToggleTask = async (task: StudentTask) => {
    await toggleTask(task);
  };

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText type="title">Tasks</ThemedText>
        <ThemedText type="subtitle">Keep up with your assignments and reminders.</ThemedText>
        {isMock && (
          <ThemedText type="default">
            Demo mode active. Tasks sync locally until Firebase is configured.
          </ThemedText>
        )}
      </View>

      <FlatList
        data={sortedTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => handleToggleTask(item)}
            style={({ pressed }) => [
              styles.taskCard,
              { backgroundColor: surface, opacity: pressed ? 0.94 : 1 }
            ]}>
            <View style={styles.cardHeader}>
              <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
              <StatusBadge status={item.status} accent={accent} />
            </View>
            {item.description && <ThemedText>{item.description}</ThemedText>}
            {item.dueDate && (
              <ThemedText type="default">
                Due {formatDueDate(item.dueDate)}
              </ThemedText>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <ThemedText>Loading tasks...</ThemedText>
          ) : (
            <ThemedText>No tasks yet. You&apos;re all caught up!</ThemedText>
          )
        }
      />

      {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}
    </ThemedView>
  );
}

function StatusBadge({ status, accent }: { status: StudentTask['status']; accent: string }) {
  const background = status === 'completed' ? accent : 'transparent';
  const textColor = status === 'completed' ? '#fff' : accent;

  return (
    <View
      style={[styles.badge, { backgroundColor: background, borderColor: accent }]}
    >
      <ThemedText type="defaultSemiBold" style={[styles.badgeText, { color: textColor }]}>
        {status.toUpperCase()}
      </ThemedText>
    </View>
  );
}

function sortTasks(tasks: StudentTask[]): StudentTask[] {
  return [...tasks].sort((a, b) => {
    const statusOrder = statusValue(a.status) - statusValue(b.status);
    if (statusOrder !== 0) {
      return statusOrder;
    }

    const dueA = parseDateMillis(a.dueDate);
    const dueB = parseDateMillis(b.dueDate);
    return dueA - dueB;
  });
}

function statusValue(status: StudentTask['status']): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'in-progress':
      return 1;
    case 'completed':
      return 2;
    default:
      return 3;
  }
}

function parseDateMillis(iso?: string): number {
  if (!iso) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = parseISO(iso);
  return isValid(parsed) ? parsed.getTime() : Number.POSITIVE_INFINITY;
}

function formatDueDate(iso: string): string {
  const parsed = parseISO(iso);
  if (!isValid(parsed)) {
    return 'soon';
  }
  return formatDistanceToNow(parsed, { addSuffix: true });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
    gap: 16
  },
  header: {
    gap: 8
  },
  listContent: {
    gap: 12,
    paddingBottom: 24
  },
  taskCard: {
    padding: 16,
    borderRadius: 16,
    gap: 8
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1
  },
  badgeText: {
    fontSize: 12,
    letterSpacing: 0.5
  },
  errorText: {
    color: '#ff5d5d'
  }
});
