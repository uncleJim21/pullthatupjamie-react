import React from 'react';
import { MessageSquareText, Upload, Play, ArrowUpRight, Loader2 } from 'lucide-react';
import { NebulaThumbnail } from '../components/workflow/WorkflowMessage.tsx';

const Section: React.FC<{ title: string; accent?: string; children: React.ReactNode }> = ({ title, accent, children }) => (
  <div className="mb-10">
    <div className="flex items-center gap-3 mb-3">
      <h2 className="text-white text-lg font-semibold">{title}</h2>
      {accent && <span className="text-[11px] text-gray-500 font-mono">{accent}</span>}
    </div>
    {children}
  </div>
);

const DevSwatches: React.FC = () => (
  <div className="min-h-screen bg-black p-8 max-w-2xl mx-auto">
    <h1 className="text-white text-2xl font-bold mb-2">Card Swatches</h1>
    <p className="text-gray-500 text-sm mb-8">Temporary dev page — DELETE before production</p>

    {/* ── Research Session Card ── */}
    <Section title="Research Session Card" accent="#f08b47 / #cc4400">
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        className="research-session-card flex items-center gap-3 px-3 py-3 rounded-lg no-underline group relative overflow-hidden transition-all"
        style={{
          border: '3px solid rgba(240,139,71,0.15)',
          background: 'radial-gradient(ellipse at 25% 40%, rgba(240,139,71,0.15), transparent 60%), radial-gradient(ellipse at 75% 60%, rgba(204,68,0,0.1), transparent 55%), #08080c',
          boxShadow: '0 0 10px rgba(240,139,71,0.15), 0 0 25px rgba(204,68,0,0.06), inset 0 0 15px rgba(240,139,71,0.06)',
        }}
      >
        <NebulaThumbnail />
        <span className="flex-1 min-w-0 z-10">
          <span className="block text-sm font-medium text-white truncate">VCs on AI Regulation: Market Forces vs. Government Control</span>
          <span className="block text-[10px] text-orange-300/50 mt-0.5">Research Session</span>
        </span>
        <ArrowUpRight className="w-4 h-4 text-orange-400/40 group-hover:text-orange-300 transition-colors flex-shrink-0 z-10" />
      </a>
    </Section>

    {/* ── Nebula Thumbnail at various sizes ── */}
    <Section title="Nebula Thumbnail Sizes" accent="Canvas2D">
      <div className="flex items-end gap-4">
        <div className="text-center">
          <NebulaThumbnail size={32} />
          <p className="text-gray-600 text-[10px] mt-1">32px</p>
        </div>
        <div className="text-center">
          <NebulaThumbnail size={48} />
          <p className="text-gray-600 text-[10px] mt-1">48px</p>
        </div>
        <div className="text-center">
          <NebulaThumbnail size={64} />
          <p className="text-gray-600 text-[10px] mt-1">64px</p>
        </div>
        <div className="text-center">
          <NebulaThumbnail size={96} />
          <p className="text-gray-600 text-[10px] mt-1">96px</p>
        </div>
      </div>
    </Section>

    {/* ── Transcribe Chip — Galaxy Blue with luminescent border ── */}
    <Section title="SubmitOnDemandChip (Transcribe)" accent="galaxy blue — #3366ff">
      <div className="action-chip action-chip--transcribe rounded-lg p-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded bg-gray-800/60 flex items-center justify-center flex-shrink-0">
            <Upload className="w-4 h-4 text-blue-400/70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-200 text-sm font-medium">Transcribe this episode</p>
            <p className="text-gray-300 text-xs mt-0.5 truncate">#2394 - Palmer Luckey</p>
            <p className="text-gray-600 text-[10px] mt-1 line-clamp-2">This episode hasn't been transcribed yet. Transcribe it to search its contents.</p>
          </div>
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <button className="px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors" style={{ color: '#7799ff', background: 'rgba(51,102,255,0.1)', border: '1px solid rgba(51,102,255,0.22)' }}>
              Transcribe
            </button>
            <span className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 rounded-md border border-gray-800 hover:text-gray-300 hover:border-gray-700 transition-colors cursor-pointer">
              <Play className="w-2.5 h-2.5" />
              Preview
            </span>
          </div>
        </div>
      </div>
      {/* Processing state */}
      <div className="action-chip action-chip--transcribe rounded-lg p-3 mt-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded bg-gray-800/60 flex items-center justify-center flex-shrink-0">
            <Upload className="w-4 h-4 text-blue-400/70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-200 text-sm font-medium">Transcribe this episode</p>
            <p className="text-gray-300 text-xs mt-0.5 truncate">#2394 - Palmer Luckey</p>
            <p className="text-blue-400/70 text-[10px] mt-1">1/1 processed</p>
          </div>
          <button disabled className="px-3 py-1.5 text-xs rounded-lg opacity-50 cursor-not-allowed flex items-center gap-1.5" style={{ color: '#7799ff', background: 'rgba(51,102,255,0.1)', border: '1px solid rgba(51,102,255,0.22)' }}>
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing…
          </button>
        </div>
      </div>
    </Section>

    {/* ── Follow-up Chip ── */}
    <Section title="FollowUpChip (Follow-up Message)" accent="neutral white">
      <p className="text-gray-600 text-[10px] mb-2 italic">Sends a pre-written message as the next chat turn. Real example from backend:</p>
      <button className="action-chip action-chip--followup flex items-center gap-2 px-3 py-2 text-xs text-gray-300 rounded-lg transition-all text-left">
        <MessageSquareText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="truncate">Search Lex Fridman for Palmer Luckey</span>
      </button>
    </Section>

    {/* ── Color Palette Reference ── */}
    <Section title="Color Palette">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Chapter Orange', hex: '#f08b47' },
          { label: 'Paragraph Deep Red-Orange', hex: '#cc4400' },
          { label: 'Cyan Accent', hex: '#50b4c8' },
          { label: 'Galaxy Blue', hex: '#3366ff' },
          { label: 'Feed Blue-White', hex: '#b8cbff' },
          { label: 'Neutral White', hex: '#ffffff' },
        ].map(({ label, hex }) => (
          <div key={hex} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#0e0e10] border border-white/5">
            <div className="w-6 h-6 rounded-full flex-shrink-0 border border-white/10" style={{ backgroundColor: hex, boxShadow: `0 0 8px ${hex}44` }} />
            <div>
              <p className="text-white text-xs">{label}</p>
              <p className="text-gray-500 text-[10px] font-mono">{hex}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  </div>
);

export default DevSwatches;
