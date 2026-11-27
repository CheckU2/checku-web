import { apiRequest } from "./http";
import type { ApiEnvelope } from "../types/api";

export interface Institution { id: string; name: string; slug: string; timezone?: string; period_type: "quarter" | "semester"; status?: string; }
export interface InstitutionCareer { id: string; name: string; code?: string | null; }
export interface RoleAssignment { institution_id: string; user_id: string; role: string; scope_type: string; scope_id: string | null; }
export interface InstitutionMember {
  matricula?: string | null;
  id: string;
  full_name: string;
  email: string;
  account_type: string;
  career_id?: string | null;
  membership_status: "active" | "pending";
  roles: Array<{role:string;scope_type:string;scope_id:string|null}>;
}
export interface RoleRequest {
  id:string;
  user_id:string;
  full_name:string;
  email:string;
  institution_id:string;
  requested_role:string;
  scope_type:string;
  scope_id:string|null;
  status:string;
  created_at:string;
  reason?:string|null;
}
export interface InstitutionScopes {
  careers:Array<{id:string;name:string;code?:string}>;
  groups:Array<{id:string;name:string;code?:string;career_id?:string}>;
  classes:Array<{id:string;career_id?:string;group_id?:string}>;
}

export const listInstitutions = () => apiRequest<ApiEnvelope<Institution[]>>("/api/v1/institutions/public", { auth: false, retryOnUnauthorized: false });
export const listInstitutionCareers = (institutionId: string) => apiRequest<ApiEnvelope<InstitutionCareer[]>>(`/api/v1/institutions/${encodeURIComponent(institutionId)}/careers/public`, { auth: false, retryOnUnauthorized: false });
export const createInstitution = (data: { name: string; slug: string; period_type: "quarter" | "semester" }) => apiRequest<ApiEnvelope<{id:string;status:string}>>("/api/v1/platform/institutions", { method: "POST", body: JSON.stringify(data) });
export const assignInstitutionOwner = (id:string,data:{email:string;full_name?:string;password?:string}) => apiRequest<ApiEnvelope<{id:string;email:string;full_name:string}>>(`/api/v1/platform/institutions/${encodeURIComponent(id)}/owner`,{method:"POST",body:JSON.stringify(data)});
export const updateInstitutionSettings = (id: string, data: {period_type: "quarter" | "semester"}) => apiRequest<ApiEnvelope<Institution>>(`/api/v1/institutions/${encodeURIComponent(id)}/settings`, {method:"PATCH",body:JSON.stringify(data)});
export const assignInstitutionRole = (id: string, data: {user_id:string;role:string;scope_type:string;scope_id:string|null}) => apiRequest<ApiEnvelope<RoleAssignment>>(`/api/v1/institutions/${encodeURIComponent(id)}/role-assignments`,{method:"POST",body:JSON.stringify(data)});
export const revokeInstitutionRole = (id: string, data: {user_id:string;role:string;scope_type:string;scope_id:string|null}) => apiRequest<ApiEnvelope<RoleAssignment>>(`/api/v1/institutions/${encodeURIComponent(id)}/role-assignments`,{method:"DELETE",body:JSON.stringify(data)});
export const listInstitutionMembers = (id:string) => apiRequest<ApiEnvelope<InstitutionMember[]>>(`/api/v1/institutions/${encodeURIComponent(id)}/members`);
export const listInstitutionScopes = (id:string) => apiRequest<ApiEnvelope<InstitutionScopes>>(`/api/v1/institutions/${encodeURIComponent(id)}/scopes`);
export const listRoleRequests = (id: string, status = "pending", signal?: AbortSignal) => apiRequest<ApiEnvelope<RoleRequest[]>>(`/api/v1/institutions/${encodeURIComponent(id)}/role-requests?status=${encodeURIComponent(status)}`, { signal });
export const approveRoleRequest = (institutionId:string,requestId:string) => apiRequest<ApiEnvelope<{id:string;status:string}>>(`/api/v1/institutions/${encodeURIComponent(institutionId)}/role-requests/${encodeURIComponent(requestId)}/approve`,{method:"POST"});
export const rejectRoleRequest = (institutionId:string,requestId:string,reason:string) => apiRequest<ApiEnvelope<{id:string;status:string}>>(`/api/v1/institutions/${encodeURIComponent(institutionId)}/role-requests/${encodeURIComponent(requestId)}/reject`,{method:"POST",body:JSON.stringify({reason})});
