import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findStaff, type Staff } from "./data";
import { hashToken, readSignedValue, signValue } from "./secrets";

const STAFF_COOKIE = "nl_staff";
const VIEW_COOKIE = "nl_view";
const TWO_WEEKS = 60 * 60 * 24 * 14;

type StaffSession = { staffId: string; exp: number };
type ViewGrant = { tokenHash: string; passwordStamp: string; exp: number };

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decode<T>(payload: string): T | null {
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function readStaffSession(): Promise<StaffSession | null> {
  const jar = await cookies();
  const raw = jar.get(STAFF_COOKIE)?.value;
  if (!raw) return null;
  const payload = readSignedValue(raw);
  if (!payload) return null;
  const session = decode<StaffSession>(payload);
  if (!session?.staffId || !session.exp || session.exp < Date.now()) return null;
  return session;
}

export async function startStaffSession(staffId: string) {
  const payload = encode({ staffId, exp: Date.now() + TWO_WEEKS * 1000 } satisfies StaffSession);
  const jar = await cookies();
  jar.set(STAFF_COOKIE, signValue(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TWO_WEEKS,
  });
}

export async function clearStaffSession() {
  const jar = await cookies();
  jar.delete(STAFF_COOKIE);
}

export async function requireStaff(): Promise<Staff> {
  const session = await readStaffSession();
  if (!session) redirect("/admin/login");
  const staff = await findStaff(session.staffId);
  if (!staff) {
    await clearStaffSession();
    redirect("/admin/login");
  }
  return staff;
}

export async function grantViewer(token: string, passwordStamp: string) {
  const payload = encode({
    tokenHash: hashToken(token),
    passwordStamp,
    exp: Date.now() + TWO_WEEKS * 1000,
  } satisfies ViewGrant);
  const jar = await cookies();
  jar.set(VIEW_COOKIE, signValue(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TWO_WEEKS,
  });
}

export async function viewerGranted(token: string, passwordStamp: string) {
  const jar = await cookies();
  const raw = jar.get(VIEW_COOKIE)?.value;
  if (!raw) return false;
  const payload = readSignedValue(raw);
  if (!payload) return false;
  const grant = decode<ViewGrant>(payload);
  if (!grant || grant.exp < Date.now()) return false;
  return grant.tokenHash === hashToken(token) && grant.passwordStamp === passwordStamp;
}
