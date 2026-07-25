import { readAllControlSettings } from '@/lib/app-settings';
import { isEmergencyLockdown, getFeatureFlags } from '@/lib/edge-config';
import { AdminSettingsClient } from './AdminSettingsClient';

export default async function AdminSettingsPage() {
  const [controls, lockdown, featureFlags] = await Promise.all([
    readAllControlSettings(),
    isEmergencyLockdown(),
    getFeatureFlags(),
  ]);

  return (
    <AdminSettingsClient
      initialControls={controls}
      initialLockdown={lockdown}
      initialFeatureFlags={featureFlags}
    />
  );
}
