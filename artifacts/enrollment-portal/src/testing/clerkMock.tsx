import type { ReactNode } from 'react';

const testAdmin = {
  id: 'playwright-admin',
  firstName: 'Playwright',
  lastName: 'Administrator',
  fullName: 'Playwright Administrator',
  primaryEmailAddress: {
    emailAddress: 'playwright-admin@example.test',
    verification: { status: 'verified' },
  },
  publicMetadata: { role: 'admin' },
};

function isTestAdminSignedIn() {
  return typeof window !== 'undefined' && window.localStorage.getItem('e2e-clerk-role') === 'admin';
}

export function ClerkProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function SignIn() {
  return null;
}

export function SignUp() {
  return null;
}

export function useAuth() {
  const isSignedIn = isTestAdminSignedIn();
  return {
    isLoaded: true,
    isSignedIn,
    userId: isSignedIn ? testAdmin.id : null,
    getToken: async () => null,
  };
}

export function useUser() {
  const isSignedIn = isTestAdminSignedIn();
  return {
    isLoaded: true,
    isSignedIn,
    user: isSignedIn ? testAdmin : null,
  };
}

export function useClerk() {
  return {
    signOut: async () => {
      window.localStorage.removeItem('e2e-clerk-role');
    },
    setActive: async () => undefined,
    addListener: () => () => undefined,
  };
}
