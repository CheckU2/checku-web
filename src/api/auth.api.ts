import type { VerificationTiming } from "../auth/verificationCountdown";
import { apiRequest } from "./http";
import type { ApiEnvelope, AuthContext, AuthUser, ContextSelectionResponse, LoginResponse, RegisterPayload } from "../types/api";

export interface LoginPayload {
  email: string;
  password: string;
}

export function login(payload: LoginPayload): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
    auth: false,
    retryOnUnauthorized: false,
  });
}

type RegistrationResult = VerificationTiming & { email: string; verification_email_sent: boolean };

export function register(payload: RegisterPayload): Promise<ApiEnvelope<RegistrationResult>> {
  return apiRequest<ApiEnvelope<RegistrationResult>>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
    auth: false,
    retryOnUnauthorized: false,
  });
}

export function verifyEmail(email: string, code: string): Promise<ApiEnvelope<{ message: string }>> {
  return apiRequest("/api/v1/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ email, code }),
    auth: false,
    retryOnUnauthorized: false,
  });
}

export function resendVerification(email: string): Promise<ApiEnvelope<{ message: string }>> {
  return apiRequest("/api/v1/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
    auth: false,
    retryOnUnauthorized: false,
  });
}

export function getCurrentUser(): Promise<ApiEnvelope<AuthUser>> {
  return apiRequest<ApiEnvelope<AuthUser>>("/api/v1/auth/me");
}

export function requestPasswordChange(currentPassword: string, newPassword: string) {
  return apiRequest<ApiEnvelope<VerificationTiming & { verification_required: true; message: string }>>("/api/v1/auth/change-password", {
    method: "PATCH",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export function confirmPasswordChange(code: string) {
  return apiRequest<ApiEnvelope<{ message: string }>>("/api/v1/auth/change-password/confirm", {
    method: "POST",
    body: JSON.stringify({ code }),
    retryOnUnauthorized: false,
  });
}

export function requestEmailChange(email: string, currentPassword: string) {
  return apiRequest<ApiEnvelope<VerificationTiming & { email: string; message: string }>>("/api/v1/auth/email-change", {
    method: "POST",
    body: JSON.stringify({ email, current_password: currentPassword }),
  });
}

export function confirmEmailChange(email: string, code: string) {
  return apiRequest<ApiEnvelope<{ message: string }>>("/api/v1/auth/email-change/confirm", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export function selectContext(context: AuthContext): Promise<ContextSelectionResponse> {
  return apiRequest<ContextSelectionResponse>("/api/v1/auth/context", {
    method: "POST",
    body: JSON.stringify(context),
  });
}

export function logout(refreshToken: string | null): Promise<ApiEnvelope<{ message: string }>> {
  return apiRequest<ApiEnvelope<{ message: string }>>("/api/v1/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export function requestPasswordReset(email: string): Promise<ApiEnvelope<{ message: string }>> {
  return apiRequest<ApiEnvelope<{ message: string }>>("/api/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
    auth: false,
    retryOnUnauthorized: false,
  });
}

export function resetPassword(token: string, newPassword: string): Promise<ApiEnvelope<{ message: string }>> {
  return apiRequest<ApiEnvelope<{ message: string }>>("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
    auth: false,
    retryOnUnauthorized: false,
  });
}
