import { createContext, useContext, useState, type ReactNode } from 'react';

export interface UserProfile {
  name: string;
  company: string;
  email: string;
}

interface ProfileContextValue {
  profile: UserProfile;
  updateProfile: (p: UserProfile) => void;
  isProfileSet: boolean;
}

const STORAGE_KEY = 'inspectr-profile';

const defaultProfile: UserProfile = { name: '', company: '', email: '' };

function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultProfile, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultProfile;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(loadProfile);

  const updateProfile = (p: UserProfile) => {
    setProfile(p);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  };

  const isProfileSet = !!(profile.name || profile.company);

  return (
    <ProfileContext.Provider value={{ profile, updateProfile, isProfileSet }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
