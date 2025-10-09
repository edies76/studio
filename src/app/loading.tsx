import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-900">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
        <p className="text-gray-400">Loading DocuGen AI...</p>
      </div>
    </div>
  );
}
