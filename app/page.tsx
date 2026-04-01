import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white selection:bg-blue-500/30">
      {/* Premium Navbar */}
      <nav className="border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-md fixed w-full top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="text-xl font-bold tracking-tighter text-white">Digital Heroes</div>
          <Link
            href="/login"
            className="bg-blue-600 hover:bg-blue-700 text-sm font-medium py-2.5 px-6 rounded-full transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)] hover:shadow-[0_0_25px_rgba(37,99,235,0.4)]"
          >
            Sign In / Join
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-16 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        
        {/* Live Status Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-900/20 text-blue-400 text-sm font-medium mb-8 border border-blue-800/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Platform Live • Next Draw: End of Month
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
          Play with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Purpose.</span><br />
          Win with <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">Impact.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-12 leading-relaxed">
          A premium subscription platform where your Stableford scores enter you into monthly prize draws, all while routing 10% of your membership directly to a charity of your choice.
        </p>

        <Link
          href="/login"
          className="bg-white text-gray-950 hover:bg-gray-200 text-lg font-bold py-4 px-10 rounded-full transition-all hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.1)]"
        >
          Start Your Membership
        </Link>

        {/* How It Works Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 w-full text-left">
          
          <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-3xl hover:border-gray-700 transition-colors">
            <div className="h-12 w-12 bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-400 font-bold text-xl mb-6">1</div>
            <h3 className="text-xl font-bold mb-3">Track Your Scores</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Log your latest 5 Stableford scores. The engine automatically drops your oldest scores to keep your entry fresh for the draw.
            </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-3xl hover:border-gray-700 transition-colors">
            <div className="h-12 w-12 bg-purple-900/30 rounded-2xl flex items-center justify-center text-purple-400 font-bold text-xl mb-6">2</div>
            <h3 className="text-xl font-bold mb-3">Monthly Prize Draws</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Our algorithmic engine runs monthly draws based on active scores. Match 3, 4, or 5 numbers to win a share of the rolling prize pool.
            </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-3xl hover:border-gray-700 transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-bl-full blur-2xl"></div>
            <div className="h-12 w-12 bg-green-900/30 rounded-2xl flex items-center justify-center text-green-400 font-bold text-xl mb-6 relative z-10">3</div>
            <h3 className="text-xl font-bold mb-3 relative z-10">Direct Charity Impact</h3>
            <p className="text-gray-400 text-sm leading-relaxed relative z-10">
              You play, we pay. At least 10% of your subscription goes directly to the partnered charity of your choice. No middlemen.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}