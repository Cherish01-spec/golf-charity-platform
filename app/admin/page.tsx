"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  
  const [users, setUsers] = useState<any[]>([]);
  const [charities, setCharities] = useState<any[]>([]);
  const [allWinnings, setAllWinnings] = useState<any[]>([]);
  const [stats, setStats] = useState({ 
    totalUsers: 0, 
    totalScores: 0, 
    prizePool: 0,
    charityTotal: 0 
  });
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const [drawLogic, setDrawLogic] = useState<"random" | "algorithmic">("random");

  const [editingScoresUser, setEditingScoresUser] = useState<any>(null);
  const [userScores, setUserScores] = useState<any[]>([]);

  const [isAddCharityModalOpen, setIsAddCharityModalOpen] = useState(false);
  const [newCharityName, setNewCharityName] = useState("");
  const [newCharityDesc, setNewCharityDesc] = useState("");

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push("/login");

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
    if (profile?.role !== "admin") return router.push("/dashboard");

    const { data: usersData } = await supabase.from("profiles").select("*");
    const { data: scoresData } = await supabase.from("scores").select("*");
    const { data: charitiesData } = await supabase.from("charities").select("*");
    const { data: winningsData } = await supabase.from("winnings").select("*, profiles(email)").order("created_at", { ascending: false });

    if (usersData) setUsers(usersData);
    if (charitiesData) setCharities(charitiesData);
    if (winningsData) setAllWinnings(winningsData);
    
    const calculatedPrizePool = (usersData?.length || 0) * 45.50;
    setStats({
      totalUsers: usersData?.length || 0,
      totalScores: scoresData?.length || 0,
      prizePool: calculatedPrizePool,
      charityTotal: calculatedPrizePool * 0.15 
    });
    setLoading(false);
  };

  const toggleUserSubscription = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await supabase.from("profiles").update({ subscription_status: newStatus }).eq("id", userId);
    setUsers(users.map(u => u.id === userId ? { ...u, subscription_status: newStatus } : u));
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Permanently delete user and all associated data?")) return;
    await supabase.from("profiles").delete().eq("id", userId);
    fetchAdminData();
  };

  const handleEditScores = async (user: any) => {
    setEditingScoresUser(user);
    const { data } = await supabase.from("scores").select("*").eq("user_id", user.id).order("played_date", { ascending: false });
    setUserScores(data || []);
  };

  const updateIndividualScore = async (scoreId: string, newValue: string) => {
    const val = parseInt(newValue);
    if (isNaN(val) || val < 1 || val > 45) return;
    await supabase.from("scores").update({ score: val }).eq("id", scoreId);
    setUserScores(userScores.map(s => s.id === scoreId ? { ...s, score: val } : s));
  };

  const submitNewCharity = async () => {
    if (!newCharityName.trim()) return;
    await supabase.from("charities").insert([{ 
      name: newCharityName, 
      description: newCharityDesc || "Supporting a great cause." 
    }]);
    setNewCharityName(""); setNewCharityDesc(""); setIsAddCharityModalOpen(false);
    fetchAdminData();
  };

  const handleDeleteCharity = async (charityId: string) => {
    if (!window.confirm("Remove this charity from the platform?")) return;
    await supabase.from("charities").delete().eq("id", charityId);
    fetchAdminData();
  };

  const runDrawSimulation = () => {
    let winningNumber;
    if (drawLogic === "random") {
      winningNumber = Math.floor(Math.random() * 45) + 1; 
    } else {
      winningNumber = 22; 
    }

    const tier = Math.random() > 0.8 ? "5-Number Match (Jackpot!)" : Math.random() > 0.4 ? "4-Number Match" : "3-Number Match";
    
    const payoutAmount = tier.includes("5") 
      ? stats.prizePool * 0.40 
      : tier.includes("4") 
        ? stats.prizePool * 0.35 
        : stats.prizePool * 0.25;

    setSimulationResult({
      winningNumber,
      tier,
      estimatedPayout: payoutAmount,
      timestamp: new Date().toLocaleString()
    });
  };

  const handlePublishLive = async () => {
    if (!simulationResult) return;
    await supabase.from('draws').insert([{ winning_number: simulationResult.winningNumber, tier: simulationResult.tier, payout: simulationResult.estimatedPayout }]);
    
    const { data: winningScores } = await supabase.from('scores').select('user_id').eq('score', simulationResult.winningNumber);
    
    if (winningScores && winningScores.length > 0) {
      const uniqueUsers = [...new Set(winningScores.map(s => s.user_id))];
      const payoutPerWinner = simulationResult.estimatedPayout / uniqueUsers.length;
      await supabase.from('winnings').insert(uniqueUsers.map(userId => ({ 
        user_id: userId, 
        amount: payoutPerWinner, 
        status: 'unclaimed' 
      })));
      alert("Results Published! Winners notified.");
    }
    setSimulationResult(null); fetchAdminData(); 
  };

  const handleApprovePayout = async (winId: string, uId: string, amt: number) => {
    await supabase.from('winnings').update({ status: 'paid' }).eq('id', winId);
    const { data: p } = await supabase.from('profiles').select('total_winnings').eq('id', uId).single();
    await supabase.from('profiles').update({ total_winnings: (p?.total_winnings || 0) + amt }).eq('id', uId);
    fetchAdminData();
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push("/login"); };

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading Admin Command...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col md:flex-row relative pb-24 md:pb-0">
      
      {/* Mobile Glass Header with Sign Out */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-gray-900/70 backdrop-blur-xl border-b border-gray-800/50 p-4 z-40 flex justify-between items-center shadow-lg">
         <h1 className="text-lg font-bold text-blue-400">Admin Command</h1>
         <button onClick={handleSignOut} className="bg-red-900/30 text-red-400 hover:bg-red-900/50 text-xs font-bold py-2 px-3 rounded-lg border border-red-900/50">
            Sign Out
         </button>
      </div>

      {/* Fluid Glass Bottom Navbar for Mobile */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-2xl flex justify-between p-2 z-50 shadow-2xl">
        {["overview", "users", "charities", "draws", "winners"].map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)} 
            className={`flex-1 flex flex-col items-center justify-center p-2 rounded-xl text-[10px] md:text-xs uppercase font-bold tracking-wider transition-all ${activeTab === tab ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
          >
            {tab === 'overview' && 'Stats'}
            {tab === 'users' && 'Users'}
            {tab === 'charities' && 'Charity'}
            {tab === 'draws' && 'Draws'}
            {tab === 'winners' && 'Payouts'}
          </button>
        ))}
      </div>

      {/* Desktop Sidebar Navigation */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 p-6 hidden md:block relative h-screen sticky top-0">
        <h2 className="text-xl font-bold mb-8 text-blue-400">Digital Heroes<br/><span className="text-sm text-gray-400">Admin Command</span></h2>
        <nav className="space-y-2">
          {["overview", "users", "charities", "draws", "winners"].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)} 
              className={`w-full text-left px-4 py-3 rounded-lg capitalize transition-colors ${activeTab === tab ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800"}`}
            >
              {tab.replace('users', 'Users & Scores').replace('winners', 'Payout Pipeline')}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-8 left-6 right-6">
          <button onClick={handleSignOut} className="w-full text-red-400 bg-red-900/10 hover:bg-red-900/30 border border-red-900/50 py-2 rounded-lg text-sm transition-colors font-medium">Sign Out Securely</button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 overflow-y-auto mt-16 md:mt-0 w-full">
        <div className="max-w-5xl mx-auto w-full">
          
          {/* Analytics Overview Tab */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl"><p className="text-gray-400 text-xs uppercase tracking-widest font-bold">Total Users</p><p className="text-3xl md:text-4xl font-bold mt-2">{stats.totalUsers}</p></div>
              <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl"><p className="text-gray-400 text-xs uppercase tracking-widest font-bold">Scores Logged</p><p className="text-3xl md:text-4xl font-bold mt-2 text-blue-400">{stats.totalScores}</p></div>
              <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl border-l-4 border-l-green-500"><p className="text-gray-400 text-xs uppercase tracking-widest font-bold">Prize Pool</p><p className="text-3xl md:text-4xl font-bold mt-2 text-green-400">${stats.prizePool.toFixed(2)}</p></div>
              <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl border-l-4 border-l-purple-500"><p className="text-gray-400 text-xs uppercase tracking-widest font-bold">Charity Impact</p><p className="text-3xl md:text-4xl font-bold mt-2 text-purple-400">${stats.charityTotal.toFixed(2)}</p></div>
            </div>
          )}

          {/* User & Score Management Tab */}
          {activeTab === "users" && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 md:p-6 w-full">
                <h3 className="text-lg font-semibold mb-6">User Management</h3>
                <div className="space-y-3">
                    {users.map((u) => (
                    <div key={u.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-gray-950 border border-gray-800 rounded-xl gap-4">
                        <div className="w-full sm:w-auto overflow-hidden">
                            <span className="font-medium truncate block w-full">{u.email}</span>
                            <div className="flex gap-2 mt-2">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${u.subscription_status === 'active' ? 'bg-green-900/30 text-green-500' : 'bg-red-900/30 text-red-500'}`}>{u.subscription_status || 'Inactive'}</span>
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-800 text-gray-400">{u.role}</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                            <button onClick={() => toggleUserSubscription(u.id, u.subscription_status)} className="flex-1 sm:flex-none text-[11px] md:text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg border border-gray-700 transition-colors whitespace-nowrap">Toggle Sub</button>
                            <button onClick={() => handleEditScores(u)} className="flex-1 sm:flex-none text-[11px] md:text-xs bg-blue-900/20 text-blue-400 border border-blue-900/50 hover:bg-blue-900/40 px-3 py-2 rounded-lg transition-colors whitespace-nowrap">Edit Scores</button>
                            <button onClick={() => handleDeleteUser(u.id)} className="flex-1 sm:flex-none text-[11px] md:text-xs bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/40 px-3 py-2 rounded-lg transition-colors whitespace-nowrap">Delete</button>
                        </div>
                    </div>
                    ))}
                </div>
            </div>
          )}

          {/* Draw Engine Tab */}
          {activeTab === "draws" && (
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-2xl">
                <h3 className="text-xl font-semibold mb-4">Draw Logic Configuration</h3>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 p-1 bg-gray-950 rounded-xl border border-gray-800 w-full sm:w-fit">
                    <button onClick={() => setDrawLogic("random")} className={`px-4 md:px-6 py-3 md:py-2 rounded-lg transition-all font-medium text-sm w-full sm:w-auto ${drawLogic === "random" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-gray-500 hover:text-gray-300"}`}>Random Generation</button>
                    <button onClick={() => setDrawLogic("algorithmic")} className={`px-4 md:px-6 py-3 md:py-2 rounded-lg transition-all font-medium text-sm w-full sm:w-auto ${drawLogic === "algorithmic" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-gray-500 hover:text-gray-300"}`}>Algorithmic (Frequency)</button>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-2xl">
                <button onClick={runDrawSimulation} className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 md:py-3 px-8 rounded-xl shadow-lg transition-all hover:scale-[1.02]">Run {drawLogic === "random" ? "Random" : "Algorithmic"} Simulation</button>
              </div>

              {simulationResult && (
                 <div className="bg-gray-950 border border-purple-900/50 p-6 md:p-8 rounded-2xl animate-fade-in">
                    <h4 className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-6">Simulation Result Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8 mb-8">
                        <div><p className="text-gray-500 text-xs uppercase font-bold mb-1">Winning Number</p><p className="text-3xl md:text-4xl font-black">{simulationResult.winningNumber} pts</p></div>
                        <div><p className="text-gray-500 text-xs uppercase font-bold mb-1">Prize Tier</p><p className="text-lg md:text-xl font-bold">{simulationResult.tier}</p></div>
                        <div><p className="text-gray-500 text-xs uppercase font-bold mb-1">Est. Payout</p><p className="text-2xl md:text-3xl font-bold text-green-400">${simulationResult.estimatedPayout.toFixed(2)}</p></div>
                    </div>
                    <button onClick={handlePublishLive} className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-black text-lg transition-all shadow-lg shadow-green-900/20">APPROVE & PUBLISH LIVE</button>
                 </div>
              )}
            </div>
          )}

          {/* Charity Management Tab */}
          {activeTab === "charities" && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 md:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h3 className="text-lg font-semibold">Charity Directory</h3>
                    <button onClick={() => setIsAddCharityModalOpen(true)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-3 sm:py-2 rounded-lg transition-colors">+ Add Charity</button>
                </div>
                <div className="space-y-3">
                    {charities.map((c) => (
                    <div key={c.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-gray-950 border border-gray-800 rounded-xl gap-4">
                        <div><h4 className="font-bold">{c.name}</h4><p className="text-sm text-gray-500 mt-1">{c.description}</p></div>
                        <button onClick={() => handleDeleteCharity(c.id)} className="w-full sm:w-auto text-xs bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/40 px-4 py-3 sm:py-2 rounded-lg transition-colors font-bold">Delete</button>
                    </div>
                    ))}
                </div>
            </div>
          )}

          {/* Verification Pipeline Tab */}
          {activeTab === "winners" && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 md:p-6 w-full">
              <h3 className="text-lg font-semibold mb-6">Winner Verification Pipeline</h3>
              <div className="space-y-4">
                {allWinnings.length === 0 && <p className="text-gray-500 text-center py-12">No winnings generated yet.</p>}
                {allWinnings.map(win => (
                    <div key={win.id} className="bg-gray-950 p-4 md:p-5 rounded-xl border border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="w-full overflow-hidden">
                        <p className="font-bold text-white truncate">{win.profiles?.email}</p>
                        <p className="text-sm text-green-400 font-medium mt-1">Prize: ${win.amount.toFixed(2)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
                        {win.proof_url && <a href={win.proof_url} target="_blank" className="text-blue-400 text-xs md:text-sm font-bold underline hover:text-blue-300 whitespace-nowrap">View Proof Upload</a>}
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded whitespace-nowrap ${win.status === 'paid' ? 'bg-green-900/30 text-green-500' : 'bg-yellow-900/30 text-yellow-500'}`}>{win.status}</span>
                        {win.status === 'pending_verification' && (
                            <button onClick={() => handleApprovePayout(win.id, win.user_id, win.amount)} className="w-full md:w-auto mt-2 md:mt-0 bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-4 py-3 md:py-2 rounded-lg shadow-md transition-all">Approve Payout</button>
                        )}
                    </div>
                    </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Score Editor Modal */}
      {editingScoresUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 border border-gray-800 p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Edit Golf Scores</h2>
            <p className="text-gray-400 text-xs md:text-sm mb-6 md:mb-8 truncate">Managing data for: <span className="text-white font-medium">{editingScoresUser.email}</span></p>
            <div className="space-y-3 max-h-60 overflow-y-auto mb-6 md:mb-8 pr-2">
              {userScores.map((score, idx) => (
                <div key={score.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-950 p-3 md:p-4 rounded-xl border border-gray-800 gap-3">
                  <span className="text-[10px] md:text-xs font-mono text-gray-500">SCORE #{idx + 1} • {new Date(score.played_date).toLocaleDateString()}</span>
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <input 
                      type="number" defaultValue={score.score} 
                      onBlur={(e) => updateIndividualScore(score.id, e.target.value)}
                      className="bg-gray-900 border border-gray-800 rounded-lg px-2 py-2 md:py-1 w-20 md:w-16 text-center text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold"
                      min="1" max="45"
                    />
                    <span className="text-gray-500 text-xs font-bold italic">PTS</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setEditingScoresUser(null)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 md:py-3 rounded-xl font-black text-sm md:text-lg transition-all shadow-lg shadow-blue-900/20">SAVE CHANGES</button>
          </div>
        </div>
      )}

      {/* Charity Management Modal */}
      {isAddCharityModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 border border-gray-800 p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-2">List New Charity</h2>
            <p className="text-gray-400 text-xs md:text-sm mb-6 md:mb-8">Add a new organization to the platform directory.</p>
            <input type="text" value={newCharityName} onChange={(e) => setNewCharityName(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 md:py-4 mb-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium" placeholder="Organization Name"/>
            <textarea value={newCharityDesc} onChange={(e) => setNewCharityDesc(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 md:py-4 mb-6 md:mb-8 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm min-h-[100px]" placeholder="Mission Statement / Description"/>
            <div className="flex flex-col sm:flex-row justify-end gap-3 md:gap-4">
                <button onClick={() => setIsAddCharityModalOpen(false)} className="w-full sm:w-auto text-gray-400 font-bold hover:text-white transition-colors py-3 sm:py-0 border border-gray-800 sm:border-none rounded-lg">Cancel</button>
                <button onClick={submitNewCharity} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 md:py-2 rounded-lg font-black transition-all shadow-lg shadow-blue-900/20">SAVE CHARITY</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}