export type UserProfile = {
  id: string;
  phone: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthUser = {
  id: string;
  phone: string;
};

export type AuthStatus =
  | "loading"
  | "unconfigured"
  | "unauthenticated"
  | "authenticated";

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  profile: UserProfile | null;
  configurationError: string | null;
  requestPhoneOtp: (phone: string) => Promise<string>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<void>;
  saveDisplayName: (displayName: string) => Promise<void>;
  updateAvatar: (file: File) => Promise<string>;
  removeAvatar: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};
