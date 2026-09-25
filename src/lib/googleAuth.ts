import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export const syncLeadToGoogleCalendar = async (lead: any) => {
  const token = await getAccessToken();
  if (!token) return; // Not connected

  // Determine events to sync
  const eventsToSync = [];
  
  if (lead.visitSchedule) {
    eventsToSync.push({
      summary: `[Site Visit] ${lead.clientName}`,
      description: `Phone: ${lead.contact || lead.phone || 'N/A'}\nAddress: ${lead.address || 'N/A'}`,
      location: lead.address || '',
      start: { date: new Date(lead.visitSchedule).toISOString().split('T')[0] },
      end: { date: new Date(lead.visitSchedule).toISOString().split('T')[0] }
    });
  }

  if (lead.installationSchedule) {
    eventsToSync.push({
      summary: `[Installation] ${lead.clientName}`,
      description: `Phone: ${lead.contact || lead.phone || 'N/A'}\nAddress: ${lead.address || 'N/A'}`,
      location: lead.address || '',
      start: { date: new Date(lead.installationSchedule).toISOString().split('T')[0] },
      end: { date: new Date(lead.installationSchedule).toISOString().split('T')[0] }
    });
  }

  if (lead.nextFollowUp) {
    eventsToSync.push({
      summary: `[Follow-up] ${lead.clientName}`,
      description: `Phone: ${lead.contact || lead.phone || 'N/A'}`,
      start: { date: new Date(lead.nextFollowUp).toISOString().split('T')[0] },
      end: { date: new Date(lead.nextFollowUp).toISOString().split('T')[0] }
    });
  }

  // Very basic sync: just create them. In a real app we'd need to track eventIds.
  for (const event of eventsToSync) {
    try {
      await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });
    } catch (e) {
      console.error('Failed to sync to GCal', e);
    }
  }
};
