'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface PaginationProps {
    totalPages: number;
    currentPage: number;
}

export default function Pagination({ totalPages, currentPage }: PaginationProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { replace } = useRouter();

    const createPageURL = (pageNumber: number | string) => {
        const params = new URLSearchParams(searchParams);
        params.set('page', pageNumber.toString());
        replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    return (
        <div className="flex justify-center items-center mt-6 space-x-1">
            <button
                className={`px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 ${(currentPage <= 1) ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => createPageURL(currentPage - 1)}
                disabled={currentPage <= 1}
            >
                Previous
            </button>
            <span className="text-sm text-gray-700 px-2">
                Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
            </span>
            <button
                className={`px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 ${(currentPage >= totalPages) ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => createPageURL(currentPage + 1)}
                disabled={currentPage >= totalPages}
            >
                Next
            </button>
        </div>
    );
}
