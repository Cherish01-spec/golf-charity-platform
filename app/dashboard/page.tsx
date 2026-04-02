"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [myWinnings, setMyWinnings] = useState<any[]>([]);
  const [newScore, setNewScore] = useState("");
  const [loading, setLoading] = useState(true);
  const [scoreError, setScoreError] = useState("");
  const [charityPercent, setCharityPercent] = useState(10); 
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [donationAmount, setDonationAmount] = useState("25");
  const [successMessage, setSuccessMessage] = useState<{title: string, desc: string} | null>(null);
  
  const [hasFiredWinConfetti, setHasFiredWinConfetti] = useState(false);

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#22c55e', '#3b82f6', '#eab308', '#a855f7', '#ffffff'],
      disableForReducedMotion: true
    });
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      setUser(session.user);

      const query = new URLSearchParams(window.location.search);
      
      if (query.get("success")) {
        await supabase
          .from("profiles")
          .update({ subscription_status: "active" })
          .eq("id", session.user.id);
        
        setSuccessMessage({
          title: "Payment Successful!",
          desc: "Welcome to Premium. Your Stableford Score Engine is now unlocked."
        });
        triggerConfetti();
        router.replace("/dashboard");
      }
      
      if (query.get("donation_success")) {
        setSuccessMessage({
          title: "Donation Processed!",
          desc: "Thank you! Your independent contribution to charity was successful."
        });
        triggerConfetti();
        router.replace("/dashboard");
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      
      setProfile(profileData);
      if (profileData?.charity_percentage) setCharityPercent(profileData.charity_percentage);

      const { data: scoresData } = await supabase
        .from("scores")
        .select("*")
        .eq("user_id", session.user.id)
        .order("played_date", { ascending: false })
        .limit(5);

      if (scoresData) setScores(scoresData);

      const { data: winningsData } = await supabase
        .from("winnings")
        .select("*")
        .eq("user_id", session.user.id);
        
      if (winningsData) setMyWinnings(winningsData);

      setLoading(false);
    };

    fetchDashboardData();
  }, [router]);

  useEffect(() => {
    const unclaimedWin = myWinnings.find(w => w.status === 'unclaimed');
    if (unclaimedWin && !hasFiredWinConfetti) {
      triggerConfetti();
      setHasFiredWinConfetti(true);
    }
  }, [myWinnings, hasFiredWinConfetti]);

  // FULLY REWRITTEN BULLETPROOF SCORE SYNC
  const handleAddScore = async () => {
    try {
      setScoreError("");
      const scoreValue = parseInt(newScore);

      if (isNaN(scoreValue) || scoreValue < 1 || scoreValue > 45) {
        setScoreError("Score must be between 1 and 45.");
        return;
      }

      // Check limit and delete oldest
      if (scores.length >= 5) {
        const confirmReplace = window.confirm("You already have 5 active scores. Adding this new score will automatically remove your oldest score. Do you wish to continue?");
        if (!confirmReplace) return;

        const oldestScore = scores[scores.length - 1];
        const { error: deleteError } = await supabase.from("scores").delete().eq("id", oldestScore.id);
        
        if (deleteError) {
          setScoreError(`Delete Error: ${deleteError.message}`);
          return; 
        }
      }

      // Insert new score with the required date
      const { data, error } = await supabase
        .from("scores")
        .insert([{ 
          user_id: user.id, 
          score: scoreValue,
          played_date: new Date().toISOString() 
        }])
        .select();

      if (error) {
        setScoreError(`Insert Error: ${error.message}`);
        return;
      } 
      
      // Force database re-sync if successful
      if (data) {
        const { data: freshScores, error: fetchError } = await supabase
          .from("scores")
          .select("*")
          .eq("user_id", user.id)
          .order("played_date", { ascending: false })
          .limit(5);
          
        if (fetchError) {
           setScoreError(`Fetch Error: ${fetchError.message}`);
           return;
        }
          
        if (freshScores) setScores(freshScores);
        setNewScore("");
      }
    } catch (err: any) {
      console.error("Unexpected error:", err);
      setScoreError(`System Error: ${err.message}`);
    }
  };

  const handleUpdateCharity = async (newVal: number) => {
    setCharityPercent(newVal);
    await supabase.from("profiles").update({ charity_percentage: newVal }).eq("id", user.id);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, winningId: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    setUploadingId(winningId);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${winningId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('proofs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('proofs')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from("winnings")
        .update({ 
          status: 'pending_verification',
          proof_url: publicUrl 
        })
        .eq('id', winningId);

      if (dbError) throw dbError;

      setSuccessMessage({
        title: "Proof Uploaded!",
        desc: "Your document was uploaded securely and is waiting for Admin verification."
      });
      triggerConfetti();
      
      const updatedWinnings = myWinnings.map(w => 
        w.id === winningId ? { ...w, status: 'pending_verification', proof_url: publicUrl } : w
      );
      setMyWinnings(updatedWinnings);
      
    } catch (error: any) {
      console.error("Upload error:", error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploadingId(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const simulateStripeCheckout = async () => {
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });

      const data = await response.json();
      if (data.url) window.location.href = data.url; 
      else alert("Checkout failed to load.");
    } catch (error) {
      console.error("Network error:", error);
    }
  };

  const processOneTimeDonation = async () => {
    const amount = Number(donationAmount);
    if (!amount || isNaN(amount) || amount <= 0) return alert("Please enter a valid amount.");

    try {
      const response = await fetch('/api/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email, amount: amount }),
      });

      const data = await response.json();
      if (data.url) window.location.href = data.url; 
      else alert("Donation checkout failed to load.");
    } catch (error) {
      console.error("Network error:", error);
    } finally {
      setIsDonationModalOpen(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading Dashboard...</div>;
  }

  const unclaimedWin = myWinnings.find(w => w.status === 'unclaimed');
  const hasPendingVerifications = myWinnings.some(w => w.status === 'pending_verification');
  const isActive = profile?.subscription_status === 'active'; 

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 relative pb-24 md:pb-8">
      
      {/* Mobile Glass Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-gray-900/70 backdrop-blur-xl border-b border-gray-800/50 p-4 z-40 flex justify-between items-center shadow-lg">
         <h1 className="text-lg font-bold tracking-tight text-white">Player Dashboard</h1>
         <button onClick={handleSignOut} className="bg-red-900/30 text-red-400 hover:bg-red-900/50 text-xs font-bold py-2 px-3 rounded-lg border border-red-900/50">
            Sign Out
         </button>
      </div>

      <div className="max-w-6xl mx-auto space-y-8 mt-16 md:mt-0">
        
        <div className="hidden md:flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Player Dashboard</h1>
            <p className="text-gray-400 mt-1">{user?.email}</p>
          </div>
          <button onClick={handleSignOut} className="bg-gray-800 hover:bg-gray-700 text-sm font-medium py-2 px-4 rounded-lg transition-colors border border-gray-700">
            Sign Out
          </button>
        </div>

        {unclaimedWin && (
          <div className="bg-green-900/30 border border-green-500/50 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center shadow-[0_0_30px_rgba(34,197,94,0.15)] animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold text-green-400">🎉 YOU WON A DRAW!</h2>
              <p className="text-gray-300 mt-1">Your Stableford score was selected. Claim your prize of <span className="font-bold text-white">${unclaimedWin.amount.toFixed(2)}</span>.</p>
            </div>
            
            <div className="mt-4 md:mt-0 w-full md:w-auto relative">
              <input 
                type="file" accept="image/*" id={`proof-upload-${unclaimedWin.id}`} className="hidden" 
                onChange={(e) => handleFileChange(e, unclaimedWin.id)}
                disabled={uploadingId === unclaimedWin.id}
              />
              <label 
                htmlFor={`proof-upload-${unclaimedWin.id}`}
                className={`block text-center w-full md:w-auto bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg cursor-pointer ${uploadingId === unclaimedWin.id ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
              >
                {uploadingId === unclaimedWin.id ? "Uploading File..." : "Select & Upload Proof"}
              </label>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl col-span-1">
            <h2 className="text-lg font-semibold mb-4 text-white">Subscription</h2>
            <div className="p-4 bg-gray-950 rounded-lg border border-gray-800 mb-4 flex items-center justify-between">
              <span className="text-gray-400 text-sm">Status</span>
              <div className="text-right">
                <span className={`text-sm font-bold uppercase tracking-wider ${isActive ? 'text-green-500' : 'text-red-500'}`}>
                  {profile?.subscription_status || "Inactive"}
                </span>
                {isActive && <p className="text-xs text-gray-500 mt-1">Renews: {new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString()}</p>}
              </div>
            </div>
            {!isActive && (
              <button onClick={simulateStripeCheckout} className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                Upgrade to Premium
              </button>
            )}
            <p className="text-xs text-gray-500 mt-3 text-center">Billed Monthly or Annually via Stripe</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl col-span-1 lg:col-span-2">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-3">
              <h2 className="text-lg font-semibold text-green-400">Charity Impact</h2>
              <button 
                onClick={() => setIsDonationModalOpen(true)} 
                className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-md"
              >
                One-Time Donation
              </button>
            </div>
            
            <p className="text-sm text-gray-400 mb-4">You are directing <span className="text-white font-bold">{charityPercent}%</span> of your subscription to your chosen cause.</p>
            <input 
              type="range" min="10" max="100" value={charityPercent} 
              onChange={(e) => setCharityPercent(parseInt(e.target.value))}
              onMouseUp={(e) => handleUpdateCharity(parseInt((e.target as HTMLInputElement).value))}
              className="w-full accent-green-500 mb-6"
            />

            <div className="p-4 bg-gray-950 rounded-lg border border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-gray-500 text-sm block mb-1">Currently Supporting:</span>
                <p className="font-medium text-lg text-white">
                  {profile?.selected_charity_id ? "Charity ID Linked" : "No Charity Selected Yet"}
                </p>
              </div>
              <button onClick={() => router.push("/charities")} className="w-full sm:w-auto text-blue-400 hover:text-blue-300 text-sm transition-colors border border-blue-900/50 px-4 py-2 rounded-lg bg-blue-900/20">
                Browse Directory &rarr;
              </button>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl col-span-1 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <h2 className="text-lg font-semibold mb-4 text-purple-400">Participation Summary</h2>
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-400">Next Official Draw</p>
                    <p className="font-bold text-lg">End of Month</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Eligibility Status</p>
                    <p className={scores.length > 0 && isActive ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                      {isActive ? (scores.length > 0 ? "Active Entry" : "Needs Scores") : "Needs Subscription"}
                    </p>
                  </div>
                </div>
             </div>

             <div>
                <h2 className="text-lg font-semibold mb-4 text-yellow-400">Winnings Overview</h2>
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 flex justify-between items-center h-[76px]">
                  <div>
                    <p className="text-sm text-gray-400">Lifetime Won</p>
                    <p className="font-bold text-xl">${profile?.total_winnings || "0.00"}</p>
                  </div>
                  
                  {hasPendingVerifications ? (
                     <div className="text-right">
                       <p className="text-sm text-gray-400 mb-1">Verification Status</p>
                       <span className="text-yellow-500 text-[10px] md:text-xs font-bold uppercase animate-pulse">Awaiting Admin Review</span>
                     </div>
                  ) : (
                    <button className="bg-gray-800 text-gray-500 cursor-not-allowed text-xs md:text-sm font-medium py-2 px-3 md:px-4 rounded-lg border border-gray-800" disabled>
                      No Pending Claims
                    </button>
                  )}
                </div>
             </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl col-span-1 lg:col-span-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h2 className="text-xl font-semibold text-blue-400">Stableford Engine</h2>
                <p className="text-sm text-gray-400 mt-1">Only your 5 most recent scores are active for the monthly draw.</p>
              </div>
              
              <div className="flex gap-3 w-full md:w-auto">
                <input 
                  type="number" min="1" max="45" value={newScore} onChange={(e) => setNewScore(e.target.value)}
                  placeholder="Score (1-45)" disabled={!isActive}
                  className="w-full md:w-32 bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <button onClick={handleAddScore} disabled={!isActive} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50">
                  Submit
                </button>
              </div>
            </div>

            {!isActive && <p className="text-red-400 text-sm mb-4">Active subscription required to enter scores.</p>}
            {scoreError && <p className="text-red-400 text-sm mb-4 font-bold">{scoreError}</p>}

            <div className="space-y-3">
              {scores.length === 0 ? (
                <div className="p-6 border border-dashed border-gray-800 rounded-xl text-center text-gray-500">
                  No scores submitted yet. Enter your first score above!
                </div>
              ) : (
                scores.map((score, index) => (
                  <div key={score.id} className="flex justify-between items-center p-4 bg-gray-950 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500 text-sm font-mono">#{index + 1}</span>
                      <span className="text-xl font-bold text-white">{score.score} pts</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(score.played_date).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      </div>

      {isDonationModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-2">One-Time Donation</h2>
            <p className="text-gray-400 text-sm mb-6">Enter the amount you would like to independently contribute to your selected cause.</p>
            
            <div className="relative mb-6">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
              <input 
                type="number" 
                value={donationAmount} 
                onChange={(e) => setDonationAmount(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-lg font-medium"
                placeholder="25"
                min="1"
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button 
                onClick={() => setIsDonationModalOpen(false)}
                className="w-full sm:w-auto px-5 py-3 sm:py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors font-medium border border-gray-800 sm:border-none"
              >
                Cancel
              </button>
              <button 
                onClick={processOneTimeDonation}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white px-6 py-3 sm:py-2 rounded-lg font-bold transition-all shadow-lg shadow-green-900/20"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-gray-900 border border-green-500/30 p-8 rounded-2xl shadow-[0_0_40px_rgba(34,197,94,0.15)] w-full max-w-sm animate-fade-in text-center relative overflow-hidden">
            
            <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-2">{successMessage.title}</h2>
            <p className="text-gray-400 text-sm mb-8">{successMessage.desc}</p>
            
            <button 
              onClick={() => setSuccessMessage(null)}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-green-900/20 hover:scale-105"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}