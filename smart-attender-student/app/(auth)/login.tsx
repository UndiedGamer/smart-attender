import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/providers/AuthProvider';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const { user, loading, error, signIn, isMock, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('student@example.com');
  const [password, setPassword] = useState('password123');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  const handleSubmit = async () => {
    setLocalError(null);

    if (!email.trim() || !password) {
      setLocalError('Enter an email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await signIn(email, password);
    } catch (submitError) {
      console.error('Sign in failed', submitError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setLocalError('Add your email to receive a reset link.');
      return;
    }

    try {
      await requestPasswordReset(email);
      setLocalError('Password reset email sent. Check your inbox.');
    } catch (resetError) {
      console.error('Password reset failed', resetError);
      setLocalError('Unable to send reset email.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title">Smart Attender</ThemedText>
          <ThemedText type="subtitle">Sign in to mark attendance and view your day.</ThemedText>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <ThemedText type="defaultSemiBold">Email</ThemedText>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              style={[styles.input, { borderColor: Colors[colorScheme ?? 'light'].tint }]}
              placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="defaultSemiBold">Password</ThemedText>
            <TextInput
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="********"
              style={[styles.input, { borderColor: Colors[colorScheme ?? 'light'].tint }]}
              placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
            />
          </View>

          {(error || localError) && (
            <ThemedText type="default" style={styles.errorText}>
              {localError ?? error}
            </ThemedText>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: Colors[colorScheme ?? 'light'].tint,
              opacity: pressed || isSubmitting ? 0.8 : 1
            }
          ]}
          disabled={isSubmitting}>
          {isSubmitting || loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText type="defaultSemiBold" style={styles.buttonLabel}>
              Sign in
            </ThemedText>
          )}
        </Pressable>

        <Pressable style={styles.secondaryAction} onPress={handleResetPassword}>
          <ThemedText type="link">Forgot password?</ThemedText>
        </Pressable>

        {isMock && (
          <View style={styles.mockNotice}>
            <ThemedText type="defaultSemiBold">Mock mode enabled</ThemedText>
            <ThemedText type="default">
              Firebase credentials are missing. You can still explore the app with demo data.
            </ThemedText>
          </View>
        )}
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 24
  },
  header: {
    gap: 8
  },
  form: {
    gap: 20,
    marginTop: 12
  },
  inputGroup: {
    gap: 8
  },
  input: {
    borderWidth: 1.25,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16
  },
  button: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center'
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 16
  },
  secondaryAction: {
    marginTop: -8
  },
  errorText: {
    color: '#d64545'
  },
  mockNotice: {
    marginTop: 'auto',
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: 6
  }
});
