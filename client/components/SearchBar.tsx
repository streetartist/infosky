"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search } from 'lucide-react';

interface SearchResult {
    id: number;
    label: string;
    type: string;
}

export default function SearchBar({ onSelectNode }: { onSelectNode: (node: any) => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query.trim()) {
                try {
                    const res = await axios.get(`http://localhost:8000/api/search/?q=${query}`);
                    setResults(res.data);
                    setIsOpen(true);
                } catch (err) {
                    console.error(err);
                }
            } else {
                setResults([]);
                setIsOpen(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    return (
        <div className="relative w-64 z-50">
            <div className="flex items-center bg-gray-800/50 backdrop-blur-md border border-gray-700 rounded-full px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                <Search size={16} className="text-gray-400 mr-2" />
                <input
                    type="text"
                    className="bg-transparent border-none text-white text-sm w-full outline-none placeholder-gray-500"
                    placeholder="搜索知识点..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                />
            </div>

            {isOpen && results.length > 0 && (
                <div className="absolute top-12 left-0 w-full bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                    {results.map((res) => (
                        <div
                            key={res.id}
                            className="p-3 hover:bg-gray-800 cursor-pointer border-b border-gray-800 last:border-b-0"
                            onClick={() => {
                                onSelectNode(res); // Needs to simulate what KnowledgeGraph click does? 
                                // Or just pass the minimal data and let Main page fetch full or pass it. 
                                // Actually Search API returns full node data usually? Let's check API. 
                                // Yes, database model. 
                                setIsOpen(false);
                                setQuery('');
                            }}
                        >
                            <div className="text-sm font-bold text-gray-200">{res.label}</div>
                            <div className="text-xs text-gray-500">{res.type}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
