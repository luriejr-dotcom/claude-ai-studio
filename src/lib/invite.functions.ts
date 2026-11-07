import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  title: z.string().trim().max(100),
  role: z.enum(["treasurer", "officer"]),
  origin: z.string().url(),
});

export const inviteOfficer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: isExec } = await supabase.rpc("is_exec");
    if (!isExec) throw new Error("Only the President or Treasurer can invite officers");
    const { data: clubId } = await supabase.rpc("my_club_id");
    if (!clubId) throw new Error("No club found");

    // Insert through RLS as the exec.
    const { error } = await supabase.from("members").insert({
      club_id: clubId,
      name: data.name,
      email: data.email.toLowerCase(),
      title: data.title,
      role: data.role,
    });
    if (error) throw new Error(error.code === "23505" ? "That email is already on your team" : error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: `${new URL(data.origin).origin}/reset-password`,
    });
    if (invErr) return { ok: true, warning: `Added, but the invite email failed: ${invErr.message}` };
    return { ok: true, warning: null as string | null };
  });
