import { useEffect, useState } from "react";
import { formatDate } from "@/utils/format";
import { getResolution, GetResolutionResponse } from "@/api/api";

interface ResolutionViewerProps {
  marketId: string;
}

export const ResolutionViewer = ({ marketId }: ResolutionViewerProps) => {
  const [data, setData] = useState<GetResolutionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResolution = async () => {
      try {
        const response = await getResolution(marketId);
        setData(response);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load resolution data");
      } finally {
        setLoading(false);
      }
    };

    fetchResolution();
  }, [marketId]);

  if (loading) {
    return (
      <div className="p-6 bg-graphite-deep/60 rounded-2xl">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-dark-700 rounded w-1/4"></div>
          <div className="h-4 bg-dark-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-graphite-deep/60 rounded-2xl border border-rose-500/30">
        <p className="text-rose-400">
          {error || "Resolution data not available"}
        </p>
      </div>
    );
  }

  const {
    resolution,
    submissions: rawSubmissions,
    resolvers: rawResolvers,
  } = data;
  const submissions = rawSubmissions ?? [];
  const resolvers = rawResolvers ?? [];

  return (
    <div className="space-y-6">
      {/* Resolution Status */}
      <div className="relative overflow-visible rounded-2xl bg-graphite-deep/60 border-2 border-emerald-500/30 p-4 sm:p-5">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

        <div className="flex items-center gap-2 mb-4">
          <svg
            className="w-5 h-5 text-emerald-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <h2 className="text-sm font-semibold text-emerald-300 uppercase tracking-wide">
            Market Resolution
          </h2>
        </div>

        {resolution ? (
          <>
            <div className="space-y-3">
              <div>
                <span className="text-moon-grey-dark text-xs">
                  Final Outcome:
                </span>
                <div className="text-white font-bold text-lg mt-1">
                  {resolution.final_outcome}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-moon-grey-dark text-xs">
                    Resolution Mode:
                  </span>
                  <div className="text-white font-medium mt-0.5">
                    {resolution.resolution_mode}
                  </div>
                </div>
                <div>
                  <span className="text-moon-grey-dark text-xs">
                    Resolved At:
                  </span>
                  <div className="text-white font-medium mt-0.5">
                    {formatDate(new Date(resolution.resolved_at))}
                  </div>
                </div>
              </div>

              {/* Canonical Hash */}
              <div className="mt-4 pt-4 border-t border-emerald-500/20">
                <span className="text-moon-grey-dark text-xs block mb-2">
                  Canonical Hash (Verifiable):
                </span>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-dark-900/50 rounded-lg text-xs font-mono text-emerald-300 break-all">
                    {resolution.canonical_hash}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(resolution.canonical_hash);
                    }}
                    className="px-3 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-xs text-moon-grey hover:text-white transition-colors"
                    title="Copy hash"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-moon-grey-dark mt-2">
                  This hash can be used to verify the resolution integrity
                  client-side.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-moon-grey">
            <p>Market has not been resolved yet.</p>
          </div>
        )}
      </div>

      {/* Resolution Trace */}
      {resolution && resolution.resolution_trace && (
        <div className="relative overflow-visible rounded-2xl bg-graphite-deep/60 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Resolution Trace
          </h3>
          <pre className="text-xs font-mono text-moon-grey bg-dark-900/50 p-4 rounded-lg overflow-x-auto">
            {JSON.stringify(resolution.resolution_trace, null, 2)}
          </pre>
        </div>
      )}

      {/* Resolvers */}
      {resolvers.length > 0 && (
        <div className="relative overflow-visible rounded-2xl bg-graphite-deep/60 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Resolvers</h3>
          <div className="space-y-3">
            {resolvers.map((mr) => (
              <div
                key={mr.resolver_id}
                className="p-3 bg-dark-900/50 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-white">
                    {mr.resolver.name}
                  </div>
                  <span className="text-xs px-2 py-1 bg-primary-500/20 text-primary-300 rounded">
                    {mr.role}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 text-xs text-moon-grey">
                  <div>Bond: {mr.bond_committed.toLocaleString()} USDC</div>
                  <div>Reputation: {mr.resolver.reputation_score}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submissions */}
      {submissions.length > 0 && (
        <div className="relative overflow-visible rounded-2xl bg-graphite-deep/60 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Resolution Submissions ({submissions.length})
          </h3>
          <div className="space-y-3">
            {submissions.map((submission) => (
              <div
                key={submission.id}
                className="p-3 bg-dark-900/50 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-white">
                    Outcome: {submission.outcome}
                  </div>
                  <div className="text-xs text-moon-grey">
                    {formatDate(new Date(submission.submitted_at))}
                  </div>
                </div>
                {submission.evidence && (
                  <div className="mt-2 text-xs text-moon-grey">
                    <span className="font-medium">Evidence:</span>
                    <pre className="mt-1 p-2 bg-dark-800 rounded text-xs overflow-x-auto">
                      {JSON.stringify(submission.evidence, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
