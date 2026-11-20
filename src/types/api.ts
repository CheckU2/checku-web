export type UserRole =
  | "student"
  | "teacher"
  | "tutor"
  | "institution_owner"
  | "institution_admin"
  | "career_director"
  | "platform_super_admin"
  | "career_admin"
  | "admin"
  | "super_admin"
  | string;

export interface AuthContext {
  institution_id: string | null;
  institution_name?: string | null;
  role: UserRole;
  scope_type: string;
  scope_id: string | null;
  career_id?: string | null;
  permissions: string[];
}

export interface AuthUser {
  id?: string;
  _id?: string;
  full_name?: string;
  email: string;
  role: UserRole;
  is_active?: boolean;
  career_id?: string;
  institution_id?: string;
  account_type?: "student" | "teacher" | "staff";
  contexts?: AuthContext[];
  active_context?: AuthContext | null;
  timezone?: string;
  avatar?: string | null;
  bio?: string;
  banner_color?: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginResponse extends ApiEnvelope<AuthTokens & { user: AuthUser }> {}
export interface RegisterPayload {
  account_type: "student" | "teacher";
  institution_id?: string;
  career_id?: string;
  timezone?: string;
  full_name: string;
  email: string;
  password: string;
}

export interface ContextSelectionResponse extends ApiEnvelope<AuthTokens & { user: AuthUser }> {}

export interface UserRecord extends Record<string, unknown> {
  id?: string;
  _id?: string;
  full_name?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
}

export interface ListResponse<T> extends ApiEnvelope<T[]> {
  meta?: { page: number; limit: number; total: number };
}
