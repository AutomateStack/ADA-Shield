'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Copy, Check } from 'lucide-react';

interface AffectedElement {
  selector: string;
  currentCode: string;
  fixType: 'HTML' | 'CSS' | 'STRUCTURE' | 'REVIEW';
  explanation: string;
  suggestedFix: string;
  actionRequired: string;
  showCodeDiff: boolean;
}

interface Violation {
  id: string;
  impact: string;
  description: string;
  help: string;
  helpUrl: string;
  wcagTags: string[];
  affectedElements: AffectedElement[];
}

interface ViolationCardProps {
  violation: Violation;
  index: number;
}

export function ViolationCard({ violation, index }: ViolationCardProps) {
  const [expanded, setExpanded] = useState(index === 0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const impactStyles: Record<string, { bg: string; text: string; icon: string; alertBg: string; alertText: string; alertBorder: string; cardBorder: string }> = {
    critical: {
      bg: 'bg-red-500/20', text: 'text-red-300', icon: 'text-red-400',
      alertBg: 'bg-red-950/50', alertText: 'text-red-200', alertBorder: 'border-l-4 border-l-red-500 border-b border-red-500/20',
      cardBorder: 'border-l-4 border-l-red-500',
    },
    serious: {
      bg: 'bg-orange-500/20', text: 'text-orange-300', icon: 'text-orange-400',
      alertBg: 'bg-orange-950/50', alertText: 'text-orange-200', alertBorder: 'border-l-4 border-l-orange-500 border-b border-orange-500/20',
      cardBorder: 'border-l-4 border-l-orange-500',
    },
    moderate: {
      bg: 'bg-yellow-500/20', text: 'text-yellow-300', icon: 'text-yellow-400',
      alertBg: 'bg-yellow-950/40', alertText: 'text-yellow-200', alertBorder: 'border-l-4 border-l-yellow-500 border-b border-yellow-500/20',
      cardBorder: 'border-l-4 border-l-yellow-500',
    },
    minor: {
      bg: 'bg-blue-500/20', text: 'text-blue-300', icon: 'text-blue-400',
      alertBg: 'bg-blue-950/30', alertText: 'text-blue-200', alertBorder: 'border-l-4 border-l-blue-500 border-b border-blue-500/20',
      cardBorder: 'border-l-4 border-l-blue-400',
    },
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
              {violation.affectedElements.length} instance{violation.affectedElements.length !== 1 ? 's' : ''} &middot; {violation.id}
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

      {/* Expanded content — always in DOM so @media print can reveal it */}
      <div
        data-violation-body
        className={`px-6 pb-6 border-t border-white/5${expanded ? '' : ' hidden'}`}
      >
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
            {violation.affectedElements.map((element, elIndex) => (
              <div key={elIndex} className={`rounded-lg border border-white/10 overflow-hidden ${style.cardBorder}`}>

                {/* Fix type badge */}
                <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
                  {element.fixType === 'CSS' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-300">
                      CSS Change Required — not an HTML fix
                    </span>
                  )}
                  {element.fixType === 'STRUCTURE' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/20 text-purple-300">
                      Page Structure Fix Required
                    </span>
                  )}
                  {element.fixType === 'HTML' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-500/20 text-green-300">
                      HTML Fix — copy and replace
                    </span>
                  )}
                  {element.fixType === 'REVIEW' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-500/20 text-slate-300">
                      Manual Review Required
                    </span>
                  )}
                </div>

                {/* Plain-English explanation — alert-coloured based on impact */}
                <div className={`px-3 py-2.5 text-sm flex items-start gap-2 ${style.alertBg} ${style.alertBorder}`}>
                  <AlertTriangle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${style.icon}`} />
                  <p className={`${style.alertText} leading-snug`}>{element.explanation}</p>
                </div>

                {/* Code diff (HTML violations only) */}
                {element.showCodeDiff ? (
                  <>
                    {/* Current broken code */}
                    <div className="relative">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-red-950/40 border-b border-red-500/20">
                        <span className="text-xs text-red-400 font-semibold">Current Code</span>
                        <button
                          onClick={() => handleCopy(element.currentCode, elIndex)}
                          className="text-red-400 hover:text-red-300 p-1"
                          title="Copy current code"
                        >
                          {copiedIndex === elIndex ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      <pre className="p-3 text-red-200 text-sm overflow-x-auto bg-red-950/20">
                        {element.currentCode}
                      </pre>
                    </div>

                    {/* Suggested HTML fix */}
                    <div className="relative">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-green-950/40 border-b border-green-500/20 border-t border-t-white/10">
                        <span className="text-xs text-green-400 font-semibold">Suggested Fix</span>
                        <button
                          onClick={() => handleCopy(element.suggestedFix, -(elIndex + 1))}
                          className="text-green-400 hover:text-green-300 p-1"
                          title="Copy fix"
                        >
                          {copiedIndex === -(elIndex + 1) ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      <pre className="p-3 text-green-200 text-sm overflow-x-auto bg-green-950/20">
                        {element.suggestedFix}
                      </pre>
                    </div>
                  </>
                ) : (
                  /* CSS / STRUCTURE / REVIEW — show instructions block */
                  <div className="relative">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-brand-900/40 border-b border-brand-500/20">
                      <span className="text-xs text-brand-300 font-semibold">How to Fix</span>
                      <button
                        onClick={() => handleCopy(element.suggestedFix, -(elIndex + 1))}
                        className="text-brand-400 hover:text-brand-300 p-1"
                        title="Copy instructions"
                      >
                        {copiedIndex === -(elIndex + 1) ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <pre className="p-3 text-slate-300 text-sm overflow-x-auto bg-white/5 whitespace-pre-wrap">
                      {element.suggestedFix}
                    </pre>
                  </div>
                )}

                {/* Action required summary */}
                <div className="px-3 py-2 bg-white/5 border-t border-white/5 flex items-start gap-2">
                  <span className="text-xs font-semibold text-amber-400 whitespace-nowrap flex-shrink-0">
                    Action needed:
                  </span>
                  <span className="text-xs text-slate-300">{element.actionRequired}</span>
                </div>

                {/* CSS selector */}
                {element.selector && (
                  <div className="px-3 py-2 bg-white/5 border-t border-white/5">
                    <span className="text-xs text-slate-500">Selector: </span>
                    <code className="text-xs text-slate-400">{element.selector}</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
    </div>
  );
}
