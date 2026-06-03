import { createClient } from "@/lib/supabase/client";
import { getSupabaseErrorMessage } from "@/lib/supabase-error";

export type CompanyProfile = {
  id: string;
  userId: string;
  email: string;
  phone: string;
  ico: string;
  companyName: string;
  billingStreet: string;
  billingCity: string;
  billingZip: string;
  dic: string;
  icDph: string;
  operationStreet: string;
  operationCity: string;
  operationZip: string;
  hasPremium: boolean;
};

export type CompanyProfileInput = Omit<CompanyProfile, "id" | "userId" | "hasPremium">;

type CompanyRow = {
  id: string;
  user_id: string;
  email: string;
  phone: string;
  ico: string;
  company_name: string;
  billing_street: string;
  billing_city: string;
  billing_zip: string;
  dic: string;
  ic_dph: string;
  operation_street: string;
  operation_city: string;
  operation_zip: string;
  has_premium: boolean;
};

function mapCompanyRow(row: CompanyRow): CompanyProfile {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    phone: row.phone,
    ico: row.ico,
    companyName: row.company_name,
    billingStreet: row.billing_street,
    billingCity: row.billing_city,
    billingZip: row.billing_zip,
    dic: row.dic,
    icDph: row.ic_dph,
    operationStreet: row.operation_street,
    operationCity: row.operation_city,
    operationZip: row.operation_zip,
    hasPremium: row.has_premium,
  };
}

function profileToRow(userId: string, profile: CompanyProfileInput) {
  return {
    user_id: userId,
    email: profile.email.trim(),
    phone: profile.phone.trim(),
    ico: profile.ico.trim(),
    company_name: profile.companyName.trim(),
    billing_street: profile.billingStreet.trim(),
    billing_city: profile.billingCity.trim(),
    billing_zip: profile.billingZip.trim(),
    dic: profile.dic.trim(),
    ic_dph: profile.icDph.trim(),
    operation_street: profile.operationStreet.trim(),
    operation_city: profile.operationCity.trim(),
    operation_zip: profile.operationZip.trim(),
  };
}

export function companyProfileToAccount(profile: CompanyProfile): CompanyProfileInput & {
  hasPremium: boolean;
} {
  return {
    email: profile.email,
    phone: profile.phone,
    ico: profile.ico,
    companyName: profile.companyName,
    billingStreet: profile.billingStreet,
    billingCity: profile.billingCity,
    billingZip: profile.billingZip,
    dic: profile.dic,
    icDph: profile.icDph,
    operationStreet: profile.operationStreet,
    operationCity: profile.operationCity,
    operationZip: profile.operationZip,
    hasPremium: profile.hasPremium,
  };
}

export function accountToCompanyInput(account: {
  email: string;
  phone: string;
  ico: string;
  companyName: string;
  billingStreet: string;
  billingCity: string;
  billingZip: string;
  dic: string;
  icDph: string;
  operationStreet: string;
  operationCity: string;
  operationZip: string;
}): CompanyProfileInput {
  return {
    email: account.email,
    phone: account.phone,
    ico: account.ico,
    companyName: account.companyName,
    billingStreet: account.billingStreet,
    billingCity: account.billingCity,
    billingZip: account.billingZip,
    dic: account.dic,
    icDph: account.icDph,
    operationStreet: account.operationStreet,
    operationCity: account.operationCity,
    operationZip: account.operationZip,
  };
}

export function companyProfileToForm(profile: CompanyProfile): CompanyProfileInput {
  return {
    email: profile.email,
    phone: profile.phone,
    ico: profile.ico,
    companyName: profile.companyName,
    billingStreet: profile.billingStreet,
    billingCity: profile.billingCity,
    billingZip: profile.billingZip,
    dic: profile.dic,
    icDph: profile.icDph,
    operationStreet: profile.operationStreet,
    operationCity: profile.operationCity,
    operationZip: profile.operationZip,
  };
}

export function companyProfileToServiceLocation(profile: CompanyProfile): {
  address: string;
  city: string;
  zipCode: string;
} {
  const city = profile.operationCity.trim() || profile.billingCity.trim();
  const street = profile.operationStreet.trim() || profile.billingStreet.trim();
  const zip = profile.operationZip.trim() || profile.billingZip.trim();

  return {
    address: street,
    city,
    zipCode: zip,
  };
}

export async function fetchCurrentCompanyProfile(): Promise<CompanyProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, user_id, email, phone, ico, company_name, billing_street, billing_city, billing_zip, dic, ic_dph, operation_street, operation_city, operation_zip, has_premium",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST205") {
      throw new Error(
        "Chýba tabuľka companies. Spustite migráciu supabase/companies.sql v Supabase SQL editore.",
      );
    }
    throw error;
  }

  if (!data) return null;
  return mapCompanyRow(data as CompanyRow);
}

export async function createCompanyProfile(userId: string, profile: CompanyProfileInput) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("companies")
    .insert(profileToRow(userId, profile))
    .select(
      "id, user_id, email, phone, ico, company_name, billing_street, billing_city, billing_zip, dic, ic_dph, operation_street, operation_city, operation_zip, has_premium",
    )
    .single();

  if (error) throw error;
  return mapCompanyRow(data as CompanyRow);
}

export async function updateCompanyProfile(userId: string, profile: CompanyProfileInput) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("companies")
    .update(profileToRow(userId, profile))
    .eq("user_id", userId)
    .select(
      "id, user_id, email, phone, ico, company_name, billing_street, billing_city, billing_zip, dic, ic_dph, operation_street, operation_city, operation_zip, has_premium",
    )
    .single();

  if (error) throw error;
  return mapCompanyRow(data as CompanyRow);
}

export async function updateCompanyPassword(newPassword: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signOutCurrentUser() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function formatAuthError(error: unknown) {
  return getSupabaseErrorMessage(error);
}
