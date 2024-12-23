

import { SearchMode } from '@/types/search';

interface SearchTypeSelectorProps {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
}

export function SearchTypeSelector({ mode, onChange }: SearchTypeSelectorProps) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-300 w-fit mb-4">
      <button
        className={`px-4 py-2 ${
          mode === 'raw'
            ? 'bg-blue-500 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-100'
        }`}
        onClick={() => onChange('raw')}
      >
        Raw Search
      </button>
      <button
        className={`px-4 py-2 ${
          mode === 'ai'
            ? 'bg-blue-500 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-100'
        }`}
        onClick={() => onChange('ai')}
      >
        AI Search
      </button>
    </div>
  );
}