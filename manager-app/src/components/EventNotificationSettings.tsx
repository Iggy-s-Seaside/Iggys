import { Bell, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePushSubscription } from '../hooks/usePushSubscription';

export function EventNotificationSettings() {
  const { supported, needsConfig, subscribed, busy, permission, enable, disable } = usePushSubscription();
  const toggle = async () => {
    const result = await (subscribed ? disable() : enable());
    if (result.ok) toast.success(subscribed ? 'Phone reminders turned off' : 'Phone reminders turned on');
    else if (result.reason !== 'permission dismissed') toast.error(result.reason || 'Could not change notifications');
  };
  return <section className="card p-5">
    <h2 className="font-semibold text-lg flex items-center gap-2"><Bell size={22} className="text-primary" />Event reminders</h2>
    <p className="text-sm text-text-secondary mt-2 mb-4">A week before, the day before and on the day. Covers confirmed private bookings and active public events.</p>
    {supported ? <button className={subscribed ? 'btn-secondary' : 'btn-primary'} disabled={busy} onClick={toggle}>{busy && <Loader2 className="animate-spin" size={18} />}{subscribed ? 'Turn off on this device' : 'Turn on phone reminders'}</button>
      : <p className="text-sm text-text-secondary">{needsConfig ? 'Phone reminders are being set up. Reminders are still visible here.' : 'On iPhone or iPad: open this app in Safari, tap Share, then Add to Home Screen. Open it from the Home Screen to turn on reminders.'}</p>}
    {permission === 'denied' && <p className="text-sm text-danger mt-3">Notifications are blocked in this browser’s settings. Allow notifications there, then return here.</p>}
    {subscribed && <p className="text-sm text-success mt-3">Notifications are on for this device.</p>}
    <p className="text-xs text-text-muted mt-3">You only need to turn this on once on each phone or computer. Reminder times use Seaside time.</p>
  </section>;
}
