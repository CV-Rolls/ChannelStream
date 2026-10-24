import { Link } from "wouter";
import { Tv, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none" />
      
      <div className="relative z-10 max-w-md text-center">
        <div className="mb-8 relative inline-block">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
          <div className="relative w-24 h-24 bg-secondary rounded-2xl flex items-center justify-center border border-white/5 shadow-2xl rotate-12">
            <Tv className="w-12 h-12 text-muted-foreground -rotate-12" />
          </div>
        </div>
        
        <h1 className="text-6xl font-display font-bold text-white mb-2">404</h1>
        <h2 className="text-2xl font-display font-medium text-white/80 mb-6">Static Signal</h2>
        <p className="text-muted-foreground mb-10 text-lg">
          The channel you're looking for doesn't exist or the signal was lost. Let's tune you back to the main guide.
        </p>
        
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shadow-lg shadow-primary/25 transition-all hover:shadow-primary/40 hover:-translate-y-1 focus:ring-4 focus:ring-primary/50 outline-none"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Guide
        </Link>
      </div>
    </div>
  );
}
