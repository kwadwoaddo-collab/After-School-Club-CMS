'use client';

import { useState, useEffect, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface PaginationProps {
    totalPages: number;
    currentPage: number;
}

export default function Pagination({ totalPages, currentPage }: PaginationProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { replace } = useRouter();
    const [isPending, startTransition] = useTransition();
    const [optimisticPage, setOptimisticPage] = useState(currentPage);

    useEffect(() => {
        setOptimisticPage(currentPage);
    }, [currentPage]);

    const createPageURL = (pageNumber: number) => {
        setOptimisticPage(pageNumber);
        const params = new URLSearchParams(searchParams);
        params.set('page', pageNumber.toString());
        startTransition(() => {
            replace(`${pathname}?${params.toString()}`, { scroll: false });
        });
    };

    return (
        <div className={`flex justify-center items-center mt-6 space-x-1 transition-opacity ${isPending ? 'opacity-70' : ''}`}>
            {isPending && (
                <div
                    className="fixed top-0 left-0 right-0 z-[250] h-0.5 bg-accent animate-pulse pointer-events-none"
                    aria-hidden="true"
                />
            )}
            <button
                className={`px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-md hover:bg-secondary/40 ${(optimisticPage <= 1 || isPending) ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => createPageURL(optimisticPage - 1)}
                disabled={optimisticPage <= 1 || isPending}
            >
                Previous
            </button>
            <span className="text-sm text-foreground px-2">
                Page <span className="font-semibold">{optimisticPage}</span> of <span className="font-semibold">{totalPages}</span>
            </span>
            <button
                className={`px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-md hover:bg-secondary/40 ${(optimisticPage >= totalPages || isPending) ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => createPageURL(optimisticPage + 1)}
                disabled={optimisticPage >= totalPages || isPending}
            >
                Next
            </button>
        </div>
    );
}
