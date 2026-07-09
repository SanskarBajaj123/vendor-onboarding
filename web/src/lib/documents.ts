import { api } from "./api";
import { supabase } from "./supabase";

export interface DocumentRef {
  type: string;
  storage_path: string;
  filename: string;
}

interface UploadUrlResponse {
  storage_path: string;
  signed_url: string;
  token: string;
}

export async function uploadDocument(documentType: string, file: File): Promise<DocumentRef> {
  const { storage_path, token } = await api.post<UploadUrlResponse>(
    `/vendors/upload-url?document_type=${encodeURIComponent(documentType)}&filename=${encodeURIComponent(
      file.name
    )}`
  );

  const { error } = await supabase.storage
    .from("vendor-documents")
    .uploadToSignedUrl(storage_path, token, file);
  if (error) throw error;

  return { type: documentType, storage_path, filename: file.name };
}

export const REQUIRED_DOCUMENTS: Record<string, { type: string; label: string }[]> = {
  US: [
    { type: "registration_certificate", label: "Business registration certificate" },
    { type: "bank_confirmation_letter", label: "Bank confirmation letter" },
    { type: "ein_confirmation_letter", label: "IRS EIN confirmation letter (CP 575/147C)" },
  ],
  UK: [
    { type: "registration_certificate", label: "Business registration certificate" },
    { type: "bank_confirmation_letter", label: "Bank confirmation letter" },
    { type: "vat_certificate", label: "VAT registration certificate" },
  ],
  IN: [
    { type: "registration_certificate", label: "Business registration certificate" },
    { type: "bank_confirmation_letter", label: "Bank confirmation letter" },
    { type: "gst_certificate", label: "GST registration certificate" },
    { type: "pan_card_copy", label: "PAN card copy" },
  ],
};
