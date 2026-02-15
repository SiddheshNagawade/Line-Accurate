export function LoadingScreen() {
  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-[#0f0f12] via-[#1a1a1f] to-[#0f0f12]">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-white/10"></div>
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#cc8bed] animate-spin"></div>
        </div>
        <div className="text-center">
          <p className="text-white/80 text-sm font-medium">Loading</p>
          <p className="text-white/40 text-xs mt-1">Please wait...</p>
        </div>
      </div>
    </div>
  );
}
