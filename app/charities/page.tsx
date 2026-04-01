"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";
import { useRouter } from "next/navigation";

export default function CharitiesPage() {
  const router = useRouter();
  const [charities, setCharities] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      // 1. Check Auth & Get Profile
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      
      setUserProfile(profile);

      // 2. Fetch Charities
      const { data: charitiesData } = await supabase
        .from("charities")
        .select("*")
        .order("name");

      if (charitiesData) setCharities(charitiesData);
      setLoading(false);
    };

    loadData();
  }, [router]);

  const handleSelectCharity = async (charityId: string) => {
    setSavingId(charityId);
    
    const { error } = await supabase
      .from("profiles")
      .update({ selected_charity_id: charityId })
      .eq("id", userProfile.id);

    if (!error) {
      setUserProfile({ ...userProfile, selected_charity_id: charityId });
    }
    setSavingId(null);
  };

  // Filter logic for the search bar
  const filteredCharities = charities.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading Directory...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header & Navigation */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Charity Directory</h1>
            <p className="text-gray-400 mt-1">Select where your 10% monthly contribution goes.</p>
          </div>
          <button 
            onClick={() => router.push("/dashboard")}
            className="bg-gray-800 hover:bg-gray-700 text-sm font-medium py-2 px-4 rounded-lg transition-colors border border-gray-700"
          >
            &larr; Back to Dashboard
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search charities by name or cause..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-green-500 shadow-lg transition-all"
          />
        </div>

        {/* Charity Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCharities.map((charity) => {
            const isSelected = userProfile?.selected_charity_id === charity.id;

            return (
              <div 
                key={charity.id} 
                className={`flex flex-col bg-gray-900 rounded-2xl overflow-hidden shadow-xl transition-all duration-300 border ${isSelected ? 'border-green-500 shadow-green-900/20' : 'border-gray-800 hover:border-gray-700'}`}
              >
                {/* Standard img tag to bypass Next.js external domain config for now */}
                <img 
                  src={charity.image_url} 
                  alt={charity.name} 
                  className="w-full h-48 object-cover opacity-80"
                />
                
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="text-xl font-bold mb-2">{charity.name}</h3>
                  <p className="text-gray-400 text-sm flex-grow mb-6 leading-relaxed">
                    {charity.description}
                  </p>
                  
                  <button 
                    onClick={() => handleSelectCharity(charity.id)}
                    disabled={isSelected || savingId === charity.id}
                    className={`w-full py-3 rounded-lg font-medium transition-colors ${
                      isSelected 
                        ? 'bg-green-900/30 text-green-400 border border-green-800 cursor-default' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {savingId === charity.id 
                      ? "Saving..." 
                      : isSelected 
                        ? "✓ Currently Supporting" 
                        : "Select This Charity"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredCharities.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            No charities found matching your search.
          </div>
        )}

      </div>
    </div>
  );
}