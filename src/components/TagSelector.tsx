// src/components/TagSelector.tsx
import { useState, useRef} from 'react';
import { X, Plus } from 'lucide-react';

interface TagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  availableTags?: string[]; // 可用的预定义标签
}

const DEFAULT_TAGS = ['VIP', 'High Risk', 'Long-term', 'New', 'Repeat Customer', 'One-time'];

export function TagSelector({ selectedTags, onChange, availableTags = DEFAULT_TAGS }: TagSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      onChange([...selectedTags, tag]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (tagToRemove: string) => {
    onChange(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue.trim());
    }
  };

  const filteredSuggestions = availableTags.filter(
    tag => !selectedTags.includes(tag) && 
    tag.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Tags <span className="text-gray-400 text-xs">(optional)</span>
      </label>
      
      {/* Selected tags */}
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-blue-600"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Tag input */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Type a tag and press Enter..."
          />
          <button
            type="button"
            onClick={() => addTag(inputValue.trim())}
            disabled={!inputValue.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
            {filteredSuggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}