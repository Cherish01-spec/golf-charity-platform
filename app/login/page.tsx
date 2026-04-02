"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../utils/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" | "warning" } | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        routeUserBasedOnRole(session.user.id);
      } else {
        setInitializing(false);
      }
    };
    checkSession();
  }, [router]);

  const routeUserBasedOnRole = async (userId: string) => {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (profile?.role === "admin") {
      router.push("/admin");
    } else {
      router.push("/dashboard");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setMessage({ text: error.message, type: "error" });
    } else {
      if (data.user) {
        // STRICT SECURITY: Forcing the 'subscriber' role on all signups. 
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: data.user.email,
          role: "subscriber", 
          subscription_status: "inactive",
          charity_percentage: 10
        });

        // Since email confirmation is disabled in Supabase, we log them in or prompt them to sign in instantly
        if (data.session) {
          await routeUserBasedOnRole(data.user.id);
        } else {
          setMessage({ text: "Account securely created! You can now click 'Sign In' to access your dashboard.", type: "success" });
        }
      }
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage({ text: error.message === "Email not confirmed" ? "Please verify your email address before signing in." : error.message, type: "error" });
      setLoading(false);
    } else if (data.user) {
      await routeUserBasedOnRole(data.user.id);
    }
  };

  if (initializing) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading Digital Heroes...</div>;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl transition-all duration-300 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Digital Heroes</h1>
          <p className="text-gray-400 text-sm">Secure Authentication</p>
        </div>
        <form className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-lg bg-gray-950 border border-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="you@example.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-lg bg-gray-950 border border-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" required />
          </div>

          {message && (
            <div className={`p-4 rounded-lg text-sm font-medium ${message.type === 'error' ? 'bg-red-900/30 text-red-400 border border-red-800' : message.type === 'warning' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800' : 'bg-green-900/30 text-green-400 border border-green-800'}`}>
              {message.text}
            </div>
          )}

          <div className="flex gap-4 pt-2">
            <button onClick={handleSignIn} disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50">{loading ? "Processing..." : "Sign In"}</button>
            <button onClick={handleSignUp} disabled={loading} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg border border-gray-700 transition-colors disabled:opacity-50">Create Account</button>
          </div>
        </form>
      </div>
    </div>
  );
}