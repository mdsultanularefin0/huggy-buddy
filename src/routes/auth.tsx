import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth-layout";
import { normalizeBdPhone, isValidBdPhone } from "@/lib/phone";



export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Veloura Essence" },
      { name: "description", content: "Sign in or create your Veloura Essence account. Shoppers can also check out as a guest." },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Sign in — Veloura Essence" },
      { property: "og:description", content: "Access your Veloura Essence account or create a new one." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/auth" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/auth" }],
  }),

  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const redirectTo = (search as { redirect?: string }).redirect ?? "/account";
      throw redirect({ to: redirectTo });
    }
  },
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("signin");



  const goNext = () => navigate({ to: search.redirect ?? "/admin" });

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    goNext();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const name = fullName.trim();
    const phoneTrim = normalizeBdPhone(phone);
    if (!name) return toast.error("Please enter your name");
    if (!isValidBdPhone(phoneTrim)) {
      return toast.error("Enter a valid Bangladeshi mobile number (e.g. 01712345678)");
    }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/admin",
        data: { full_name: name, name, phone: phoneTrim },
      },
    });

    setLoading(false);
    if (error) return toast.error(error.message);
    // Supabase returns a user with empty identities[] when the email is already registered
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      toast.error("An account with this email already exists.", {
        description: "Try signing in instead, or reset your password.",
        action: {
          label: "Sign in",
          onClick: () => setTab("signin"),
        },
      });
      return;
    }
    if (!data.session) {
      toast.success("Check your email to confirm your account");
      return;
    }
    toast.success("Account created");
    goNext();

  }


  async function handleForgot() {
    if (!email) return toast.error("Enter your email first");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) return toast.error(error.message);
    toast.success("Check your email for a password reset link");
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth" },
    });
    if (error) toast.error(error.message);
  }

  return (
    <AuthLayout>


        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gradient-luxe">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">Access your account or create a new one</p>
        </div>


        <Card className="p-6 shadow-luxe border-border/50">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input id="signin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input id="signin-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" isLoading={loading}>
                  Sign in
                </Button>
                <button type="button" onClick={handleForgot} className="text-xs text-muted-foreground hover:text-primary underline block mx-auto">
                  Forgot password?
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full name</Label>
                  <Input id="signup-name" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Phone number</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="01XXXXXXXXX"
                    required
                    value={phone}
                    onChange={(e) => setPhone(normalizeBdPhone(e.target.value))}
                    aria-invalid={phone.length > 0 && !isValidBdPhone(phone)}
                  />
                  {phone.length > 0 && !isValidBdPhone(phone) && (
                    <p className="text-xs text-destructive">
                      Enter an 11-digit Bangladeshi mobile number starting with 01.
                    </p>
                  )}
                </div>




                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input id="signup-password" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" isLoading={loading}>
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or continue with</span>
            </div>
          </div>

          <Button type="button" variant="outline-luxe" size="lg" className="w-full" onClick={handleGoogle}>
            Continue with Google
          </Button>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Shoppers can check out as a guest — no account needed.
        </p>
    </AuthLayout>
  );
}
