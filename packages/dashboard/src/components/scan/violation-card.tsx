'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Copy, Check } from 'lucide-react';

interface ViolationNode {
  html: string;
  target: string[];
  failureSummary: string;
  fix?: {
    fixedHtml: string;
    explanation: string;
  };
}

interface Violation {
  id: string;
  impact: string;
  description: string;
  help: string;
  helpUrl: string;
  wcagTags: string[];
  nodes: ViolationNode[];
}

interface ViolationCardProps {
  violation: Violation;
  index: number;
}

export function ViolationCard({ violation, index }: ViolationCardProps) {
  const [expanded, setExpanded] = useState(index === 0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const impactStyles: Record<string, { bg: string; text: string; icon: string }> = {
    critical: { bg: 'bg-red-500/20', text: 'text-red-300', icon: 'text-red-400' },
    serious: { bg: 'bg-orange-500/20', text: 'text-orange-300', icon: 'text-orange-400' },
    moderate: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', icon: 'text-yellow-400' },
    minor: { bg: 'bg-blue-500/20', text: 'text-blue-300', icon: 'text-blue-400' },
  };

  const style = impactStyles[violation.impact] || impactStyles.minor;

  const handleCopy = async (text: string, nodeIndex: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(nodeIndex);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${style.icon}`} />
          <div className="min-w-0">
            <h4 className="font-semibold text-white truncate">{violation.help}</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {violation.nodes.length} instance{violation.nodes.length !== 1 ? 's' : ''} &middot; {violation.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <span className={`px-2 py-1 rounded text-xs font-medium ${style.bg} ${style.text}`}>
            {violation.impact}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-6 pb-6 border-t border-white/5">
          <p className="text-slate-400 text-sm mt-4 mb-2">{violation.description}</p>

          {/* WCAG Tags */}
          {violation.wcagTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {violation.wcagTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-brand-500/10 text-brand-300 text-xs rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Learn more link */}
          <a
            href={violation.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mb-4"
          >
            Learn more <ExternalLink className="h-3 w-3" />
          </a>

          {/* Violation nodes */}
          <div className="space-y-4">
            {violation.nodes.map((node, nodeIndex) => (
              <div key={nodeIndex} className="rounded-lg border border-white/10 overflow-hidden">
                {/* Broken code */}
                <div className="relative">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-red-950/40 border-b border-red-500/20">
                    <span className="text-xs text-red-400 font-semibold">Current Code</span>
                    <button
                      onClick={() => handleCopy(node.html, nodeIndex)}
                      className="text-red-400 hover:text-red-300 p-1"
                      title="Copy code"
                    >
                      {copiedIndex === nodeIndex ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <pre className="p-3 text-red-200 text-sm overflow-x-auto bg-red-950/20">
                    {node.html}
                  </pre>
                </div>

                {/* Fix suggestion */}
                {node.fix && (
                  <div className="relative">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-green-950/40 border-b border-green-500/20 border-t border-t-white/10">
                      <span className="text-xs text-green-400 font-semibold">Suggested Fix</span>
                      <button
                        onClick={() => handleCopy(node.fix!.fixedHtml, -(nodeIndex + 1))}
                        className="text-green-400 hover:text-green-300 p-1"
                        title="Copy fix"
                      >
                        {copiedIndex === -(nodeIndex + 1) ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <pre className="p-3 text-green-200 text-sm overflow-x-auto bg-green-950/20">
                      {node.fix.fixedHtml}
                    </pre>
                    <p className="px-3 py-2 text-slate-400 text-xs bg-white/5 border-t border-white/5">
                      {node.fix.explanation}
                    </p>
                  </div>
                )}

                {/* CSS selector target */}
                {node.target && node.target.length > 0 && (
                  <div className="px-3 py-2 bg-white/5 border-t border-white/5">
                    <span className="text-xs text-slate-500">Selector: </span>
                    <code className="text-xs text-slate-400">{node.target.join(' > ')}</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
