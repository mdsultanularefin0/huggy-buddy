// Shared server-only admin guard. Import ONLY inside .handler() bodies of
// *.functions.ts files via dynamic import, per the client-bundle rules.

type UserRolesClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{
            data: unknown;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
};

/** Returns true if the given user has the `admin` role. */
export async function isAdmin(userId: string, supabase: unknown): Promise<boolean> {
  const client = supabase as UserRolesClient;
  const { data, error } = await client
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return !!data;
}

/** Throws "Forbidden" if the user is not an admin. */
export async function assertAdmin(userId: string, supabase: unknown): Promise<void> {
  const ok = await isAdmin(userId, supabase);
  if (!ok) throw new Error("Forbidden");
}
