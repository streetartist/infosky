"use client";

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
    return (
        <div className={`markdown-content ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    // Custom styling for various elements
                    h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 text-white">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xl font-bold mb-3 text-white">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 text-white">{children}</h3>,
                    p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="ml-2">{children}</li>,
                    code: ({ className, children, ...props }) => {
                        const isInline = !className;
                        if (isInline) {
                            return (
                                <code className="bg-gray-800 px-1.5 py-0.5 rounded text-cyan-400 text-sm" {...props}>
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code className={`${className} block bg-gray-900 p-3 rounded-lg overflow-x-auto text-sm`} {...props}>
                                {children}
                            </code>
                        );
                    },
                    pre: ({ children }) => <pre className="mb-3">{children}</pre>,
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-cyan-500 pl-4 italic text-gray-400 mb-3">
                            {children}
                        </blockquote>
                    ),
                    a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                            {children}
                        </a>
                    ),
                    table: ({ children }) => (
                        <div className="overflow-x-auto mb-3">
                            <table className="min-w-full border border-gray-700">{children}</table>
                        </div>
                    ),
                    th: ({ children }) => (
                        <th className="border border-gray-700 px-3 py-2 bg-gray-800 text-left font-semibold">{children}</th>
                    ),
                    td: ({ children }) => (
                        <td className="border border-gray-700 px-3 py-2">{children}</td>
                    ),
                    hr: () => <hr className="border-gray-700 my-4" />,
                    strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
