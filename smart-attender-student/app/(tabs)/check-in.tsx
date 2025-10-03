import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Location from 'expo-location';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/providers/AuthProvider';
import { parseQrPayload, recordAttendance, resolveSessionFromPayload } from '@/services/attendance';

export default function CheckInScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { user } = useAuth();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();

  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tint = Colors[colorScheme ?? 'light'].tint;
  const cardBackground = colorScheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)';
  const overlayBackground = 'rgba(0,0,0,0.35)';

  useEffect(() => {
    if (!cameraPermission?.granted && cameraPermission?.canAskAgain) {
      requestCameraPermission().catch(() => undefined);
    }
  }, [cameraPermission, requestCameraPermission]);

  useFocusEffect(
    useCallback(() => {
      setLastScanned(null);
      setError(null);
      setIsProcessing(false);

      return () => {
        setIsProcessing(false);
      };
    }, [])
  );

  const ensureLocationPermission = useCallback(async () => {
    if (locationPermission?.granted) {
      return locationPermission;
    }

    const result = await requestLocationPermission?.();
    if (!result?.granted) {
      throw new Error('Location permission is required to submit attendance.');
    }
    return result;
  }, [locationPermission, requestLocationPermission]);

  const handleBarcodeScanned = useCallback(
    async (scan: BarcodeScanningResult) => {
      if (isProcessing || !scan?.data) {
        return;
      }

      if (scan.data === lastScanned) {
        return;
      }

      if (!user) {
        setError('You need to be signed in to submit attendance.');
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const payload = parseQrPayload(scan.data);
        const resolvedSession = await resolveSessionFromPayload(payload);

        await ensureLocationPermission();
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

        const attendanceResult = await recordAttendance({
          student: user,
          session: resolvedSession,
          studentLocation: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
        });

        setLastScanned(scan.data);

        router.push({
          pathname: '/modal',
          params: {
            status: attendanceResult.status,
            message: attendanceResult.message,
            proximity: attendanceResult.proximityMeters.toString(),
            notes: attendanceResult.notes.join('|'),
            className: resolvedSession.session.className,
            subject: resolvedSession.session.subject
          }
        } as never);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unable to process this QR code.');
      } finally {
        setTimeout(() => setIsProcessing(false), 1200);
      }
    },
    [ensureLocationPermission, isProcessing, lastScanned, router, user]
  );

  if (!cameraPermission?.granted) {
    return (
      <PermissionPrompt
        title="Camera access needed"
        description="We need camera access to scan the classroom QR code."
        actionLabel="Grant camera access"
        onAction={() => requestCameraPermission?.()}
      />
    );
  }

  if (!locationPermission?.granted && locationPermission?.status !== Location.PermissionStatus.UNDETERMINED) {
    return (
      <PermissionPrompt
        title="Location access needed"
        description="Location data helps verify you're near the classroom."
        actionLabel="Grant location access"
        onAction={() => requestLocationPermission?.()}
      />
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.cameraContainer}>
        <CameraView
          facing={cameraFacing}
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}
        >
          <View style={[styles.overlay, { backgroundColor: overlayBackground }]}>
            <ThemedText type="defaultSemiBold">Scan the QR code</ThemedText>
            <ThemedText>Position the QR within the frame to capture it.</ThemedText>
            <ThemedText>We&apos;ll confirm your location before submitting.</ThemedText>
          </View>
        </CameraView>
      </View>

      <ThemedView style={[styles.infoCard, { backgroundColor: cardBackground }]}>
        <View style={styles.statusRow}>
          <ThemedText type="defaultSemiBold">Status</ThemedText>
          <StatusIndicator
            active={isProcessing}
            label={isProcessing ? 'Submitting attendance' : 'Ready to scan'}
            tint={tint}
          />
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.button, { borderColor: tint }]}
            onPress={() => setCameraFacing((current) => (current === 'back' ? 'front' : 'back'))}
          >
            <ThemedText type="defaultSemiBold">Flip camera</ThemedText>
          </Pressable>
          {!locationPermission?.granted && (
            <Pressable style={[styles.button, { borderColor: tint }]} onPress={() => requestLocationPermission?.()}>
              <ThemedText type="defaultSemiBold">Enable location</ThemedText>
            </Pressable>
          )}
        </View>

        {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}
      </ThemedView>
    </ThemedView>
  );
}

interface PermissionPromptProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

function PermissionPrompt({ title, description, actionLabel, onAction }: PermissionPromptProps) {
  return (
    <ThemedView style={styles.permissionContainer}>
      <ThemedText type="title" style={styles.permissionTitle}>
        {title}
      </ThemedText>
      <ThemedText style={styles.permissionDescription}>{description}</ThemedText>
      <Pressable style={styles.permissionButton} onPress={onAction}>
        <ThemedText type="defaultSemiBold" style={styles.permissionButtonLabel}>
          {actionLabel}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function StatusIndicator({ active, label, tint }: { active: boolean; label: string; tint: string }) {
  return (
    <View style={styles.statusIndicator}>
      {active && <ActivityIndicator size="small" color={tint} />}
      <ThemedText>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
    gap: 16
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden'
  },
  camera: {
    flex: 1
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 6
  },
  infoCard: {
    borderRadius: 16,
    padding: 16,
    gap: 16
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5
  },
  errorText: {
    color: '#ff5d5d'
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16
  },
  permissionTitle: {
    textAlign: 'center'
  },
  permissionDescription: {
    textAlign: 'center'
  },
  permissionButton: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12
  },
  permissionButtonLabel: {
    color: '#fff'
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  }
});
