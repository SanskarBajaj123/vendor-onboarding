import { z } from "zod";

export const TAX_ID_HINTS: Record<string, string> = {
  US: "Format: XX-XXXXXXX",
  UK: "Format: GB123456789",
  IN: "15-character alphanumeric GSTIN",
};

export const vendorFormSchema = z
  .object({
    legal_name: z.string().min(1, "Required"),
    trading_name: z.string().optional(),
    country: z.enum(["US", "UK", "IN"]),
    street: z.string().min(1, "Required"),
    city: z.string().min(1, "Required"),
    region: z.string().min(1, "Required"),
    postal_code: z.string().min(1, "Required"),
    tax_id: z.string().min(1, "Required"),
    pan: z.string().optional(),
    bank_name: z.string().min(1, "Required"),
    bank_account_holder_name: z.string().min(1, "Required"),
    bank_account_number: z.string().min(1, "Required"),
    bank_routing_number: z.string().min(1, "Required"),
    contact_name: z.string().min(1, "Required"),
    contact_email: z.string().min(1, "Required").email("Invalid email address"),
    contact_phone: z
      .string()
      .optional()
      .refine(
        (v) => !v || /^\d{10}$/.test(v),
        "Must be exactly 10 digits"
      ),
  })
  .superRefine((data, ctx) => {
    if (data.country === "US" && !/^\d{2}-\d{7}$/.test(data.tax_id)) {
      ctx.addIssue({ code: "custom", path: ["tax_id"], message: TAX_ID_HINTS.US });
    }
    if (data.country === "UK" && !/^GB\d{9}$/.test(data.tax_id)) {
      ctx.addIssue({ code: "custom", path: ["tax_id"], message: TAX_ID_HINTS.UK });
    }
    if (data.country === "IN") {
      if (!/^[0-9A-Z]{15}$/.test(data.tax_id)) {
        ctx.addIssue({ code: "custom", path: ["tax_id"], message: TAX_ID_HINTS.IN });
      }
      if (!data.pan || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(data.pan)) {
        ctx.addIssue({ code: "custom", path: ["pan"], message: "Format: AAAAA9999A" });
      }
    }
  });

export type VendorFormValues = z.infer<typeof vendorFormSchema>;
