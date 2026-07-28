import Link from 'next/link';
import { Mail, Phone, ChevronRight } from 'lucide-react';
import DeleteParentButton from '@/features/parents/components/DeleteParentButton';
import { getAvatarGradient } from '@/components/ui/utils';

export interface ParentRow {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    childCount: number;
    childrenList: Array<{ id: string; first_name: string; last_name: string }>;
    outstanding: number;
}

interface ParentsTableProps {
    parents: ParentRow[];
}

function getInitials(firstName: string, lastName: string) {
    return `${firstName.charAt(0) || ''}${lastName.charAt(0) || ''}`.toUpperCase();
}

export default function ParentsTable({ parents }: ParentsTableProps) {
    if (parents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-dashed border-border rounded-3xl">
                <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mb-4 text-3xl">👪</div>
                <h3 className="text-foreground font-bold mb-2">No parents found</h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                    Try adjusting your search or filters.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-card border border-border rounded-[32px] overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border bg-secondary/10">
                            <th className="py-4 px-6 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Parent</th>
                            <th className="py-4 px-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Contact</th>
                            <th className="py-4 px-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Linked Children</th>
                            <th className="py-4 px-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Balance</th>
                            <th className="py-4 px-4 w-10" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {parents.map((parent) => {
                            const fullName = `${parent.firstName} ${parent.lastName}`;
                            const initials = getInitials(parent.firstName, parent.lastName);
                            const gradient = getAvatarGradient(parent.firstName);
                            const outstanding = parent.outstanding;

                            return (
                                <tr key={parent.id} className="group hover:bg-secondary/40 transition-colors cursor-pointer">
                                    <td className="py-3 px-6">
                                        <Link href={`/dashboard/parents/${parent.id}`} className="flex items-center gap-3 active:scale-[0.985] transition-all duration-100">
                                            <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-sm`}>
                                                {initials}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                                    {fullName}
                                                </p>
                                            </div>
                                        </Link>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            {parent.phone && (
                                                <a href={`tel:${parent.phone}`} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors" title={parent.phone}>
                                                    <Phone className="w-4 h-4" />
                                                </a>
                                            )}
                                            {parent.email && (
                                                <a href={`mailto:${parent.email}`} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors" title={parent.email}>
                                                    <Mail className="w-4 h-4" />
                                                </a>
                                            )}
                                            {!parent.phone && !parent.email && (
                                                <span className="text-xs text-muted-foreground/50">—</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        {parent.childrenList && parent.childrenList.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {parent.childrenList.map((child) => (
                                                    <Link
                                                        key={child.id}
                                                        href={`/dashboard/students/${child.id}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        title={`${child.first_name} ${child.last_name}`}
                                                        className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
                                                    >
                                                        {child.first_name} {child.last_name}
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-xs font-medium text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md">
                                                No children
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        {outstanding > 0 ? (
                                            <span className="text-sm font-bold text-red-600">
                                                £{outstanding.toFixed(2)}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-slate-400 font-medium">£0.00</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <DeleteParentButton parentId={parent.id} parentName={fullName} childCount={parent.childCount} />
                                            <Link href={`/dashboard/parents/${parent.id}`} className="p-2 text-muted-foreground hover:text-primary transition-colors active:scale-90 duration-100">
                                                <ChevronRight className="w-4 h-4" />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
