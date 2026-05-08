import {
  signIn, signOut, confirmSignIn,
  resetPassword, confirmResetPassword,
  fetchAuthSession,
} from 'aws-amplify/auth';
import type { Usuario } from '../types';
import config from '../config';

export type LoginResult =
  | { type: 'ok' }
  | { type: 'ok_inmobiliaria' }
  | { type: 'mfa_code' }
  | { type: 'mfa_setup'; secret: string };

const ROLES_INTERNOS = ['admin', 'coordinador', 'supervisor'];

const getRolFromSession = async (): Promise<string> => {
  const session = await fetchAuthSession();
  const groups: string[] = (session.tokens?.idToken?.payload?.['cognito:groups'] as string[]) ?? [];
  if (groups.some(g => ROLES_INTERNOS.includes(g))) return 'interno';
  return 'inmobiliaria';
};

export const login = async (username: string, password: string): Promise<LoginResult> => {
  try { await signOut(); } catch { /* ok */ }

  const { nextStep } = await signIn({
    username,
    password,
    options: { authFlowType: 'USER_PASSWORD_AUTH' },
  });

  if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
    return { type: 'mfa_code' };
  }

  if (nextStep.signInStep === 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP') {
    const secret = nextStep.totpSetupDetails.sharedSecret;
    return { type: 'mfa_setup', secret };
  }

  // Login sin challenge — verificar si es interno o inmobiliaria
  const rol = await getRolFromSession();
  if (rol === 'inmobiliaria') return { type: 'ok_inmobiliaria' };
  return { type: 'ok' }; // interno sin MFA configurado → forzar setup
};

// Confirmar código MFA (ya configurado) o activar MFA setup — mismo método
export const confirmMfaCode = async (code: string): Promise<void> => {
  await confirmSignIn({ challengeResponse: code });
};

export const forgotPassword = (username: string) =>
  resetPassword({ username });

export const confirmForgotPassword = (username: string, code: string, newPassword: string) =>
  confirmResetPassword({ username, confirmationCode: code, newPassword });

export const getMe = async (): Promise<Usuario> => {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  const res = await fetch(`${config.apiUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('No autorizado');
  return res.json();
};

export const logout = async () => {
  await signOut();
  window.location.href = '/login';
};

export const initMfaSetup = async (): Promise<{ secret: string; qrUri: string }> => {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  const accessToken = session.tokens?.accessToken?.toString();
  if (!idToken || !accessToken) throw new Error('No tokens');
  const res = await fetch(`${config.apiUrl}/auth/mfa/setup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken }),
  });
  if (!res.ok) throw new Error('Error iniciando MFA setup');
  const data = await res.json();
  const username = session.tokens?.idToken?.payload?.['cognito:username'] as string ?? '';
  return {
    secret: data.secret_code,
    qrUri: `otpauth://totp/JAM:${encodeURIComponent(username)}?secret=${data.secret_code}&issuer=JAM%20Construcciones`,
  };
};

export const completeMfaSetup = async (code: string): Promise<void> => {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  const accessToken = session.tokens?.accessToken?.toString();
  if (!idToken || !accessToken) throw new Error('No tokens');
  const res = await fetch(`${config.apiUrl}/auth/mfa/verify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, access_token: accessToken }),
  });
  if (!res.ok) throw new Error('Código incorrecto');
};
