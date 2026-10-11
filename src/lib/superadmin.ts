// Lista de correos con permisos de Plataforma / God Mode
// Este archivo es 100% universal/cliente y NO importa librerías exclusivas de Node/Firebase Admin.
const HARDCODED_SUPERADMINS = ['squeral@serveix.me'];

export function getSuperAdminEmails(): string[] {
  const envEmails = process.env.NEXT_PUBLIC_SUPERADMIN_EMAILS || '';
  const parsedEnv = envEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  
  const set = new Set([...HARDCODED_SUPERADMINS.map((e) => e.toLowerCase()), ...parsedEnv]);
  return Array.from(set);
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const list = getSuperAdminEmails();
  return list.includes(email.trim().toLowerCase());
}
