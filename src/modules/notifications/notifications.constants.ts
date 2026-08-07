import { NotificationBroadcastType } from './notifications.types';

/** Static types for Admin "Create Notification" dropdown (share with frontend). */
export const NOTIFICATION_BROADCAST_TYPES: ReadonlyArray<{
  value: NotificationBroadcastType;
  label: string;
}> = [
  { value: 'reminder', label: 'Reminder' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'info', label: 'Info' },
  { value: 'alert', label: 'Alert' },
] as const;

export const NOTIFICATION_BROADCAST_TYPE_VALUES =
  NOTIFICATION_BROADCAST_TYPES.map((t) => t.value);
