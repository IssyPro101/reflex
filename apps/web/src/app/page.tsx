"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Landing } from "@/components/landing/Landing";
import { Dashboard } from "@/components/dashboard/Dashboard";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-6"
      >
        <div className="w-12 h-12 rounded-xl border border-white/[0.08] bg-[#0A0A0A] flex items-center justify-center shadow-2xl">
          <img src="/logo.png" alt="Reflex" className="w-5 h-5" />
        </div>
        <div className="w-40 h-[3px] rounded-full bg-white/[0.04] overflow-hidden">
          <div className="h-full w-1/3 bg-white/[0.8] rounded-full animate-loading-bar" />
        </div>
      </motion.div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const {
    status,
    accessToken,
    authState,
    needsOnboarding,
    signInWithGoogle,
    signOut,
    refresh,
  } = useAuth();

  useEffect(() => {
    if (status === "authenticated" && needsOnboarding) {
      router.replace("/getting-started");
    }
  }, [status, needsOnboarding, router]);

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status === "unauthenticated" || !authState?.app.authenticated) {
    return <Landing onSignIn={signInWithGoogle} />;
  }

  if (needsOnboarding) {
    return <LoadingScreen />;
  }

  return (
    <Dashboard
      accessToken={accessToken!}
      authState={authState}
      onSignOut={signOut}
      onRefresh={refresh}
    />
  );
}
