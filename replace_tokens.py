import os
import re

def process(filepath, rules):
    with open(filepath, 'r') as f:
        c = f.read()
    for old, new in rules:
        if callable(old):
            c = old(c)
        else:
            c = re.sub(old, new, c)
    with open(filepath, 'w') as f:
        f.write(c)

general_cleanup = [
    (r'bg-white\b', 'bg-card'),
    (r'border-slate-\d+(/\d+)?', 'border-border'),
    (r'border-gray-\d+(/\d+)?', 'border-border'),
]

# FILE 1
rules1 = [
    (r'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', 'bg-success/10 text-success border-success/20'),
    (r'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', 'bg-primary/10 text-primary border-primary/20'),
    (r'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', 'bg-warning/10 text-warning border-warning/20'),

    (r'bg-amber-500/10', 'bg-warning/10'),
    (r'ring-amber-500/30', 'ring-warning/20'),
    (r'text-amber-700 dark:text-amber-400', 'text-warning'),
    (r'bg-amber-500 hover:bg-amber-600', 'bg-warning hover:bg-warning/90'),

    (r'bg-red-500/10', 'bg-destructive/10'),
    (r'ring-red-500/30', 'ring-destructive/20'),
    (r'text-red-600 dark:text-red-400', 'text-destructive'),
    (r'bg-red-600 hover:bg-red-700', 'bg-destructive hover:bg-destructive/90'),

    (r'bg-rose-50 border border-rose-100', 'bg-destructive/10 border-destructive/20'),
    (r'text-rose-500', 'text-destructive'),
    (r'border-rose-500/30', 'border-destructive/20'),
    (r'border-rose-100', 'border-destructive/20'),

    (r'bg-blue-50 border border-blue-100', 'bg-primary/10 border-primary/20'),
    (r'text-blue-600', 'text-primary'),
    (r'border-blue-500/30', 'border-primary/20'),
    (r'border-blue-100', 'border-primary/20'),

    (r'bg-primary hover:bg-primary/90 text-white', 'bg-primary hover:bg-primary/90 text-primary-foreground'),
    (r'bg-gradient-to-br from-primary to-accent-violet flex items-center justify-center text-white', 'bg-gradient-to-br from-primary to-accent-violet flex items-center justify-center text-primary-foreground'),

    (r'bg-slate-\d+(/\d+)?', 'bg-secondary'),
    (r'text-slate-\d+(/\d+)?', 'text-muted-foreground'),
    (r'bg-gray-\d+(/\d+)?', 'bg-secondary'),
    (r'text-gray-\d+(/\d+)?', 'text-muted-foreground'),
] + general_cleanup
process('src/components/bookings/BookingsTable.tsx', rules1)

# FILE 2
rules2 = [
    (r'bg-slate-[789]00(/\d+)?', 'bg-card'),
    (r'text-slate-[345]00(/\d+)?', 'text-muted-foreground'),
    (r'text-slate-950', 'text-foreground'),

    (r'bg-slate-\d+(/\d+)?', 'bg-secondary'),
    (r'text-slate-\d+(/\d+)?', 'text-muted-foreground'),

    (r'bg-indigo-600 hover:bg-indigo-500', 'bg-primary hover:bg-primary/90'),
    (r'bg-indigo-600 text-white border-indigo-600', 'bg-primary text-primary-foreground border-primary'),
    (r'shadow-indigo-900/20', 'shadow-primary/20'),
    (r'border-indigo-900/50', 'border-primary/50'),
    (r'hover:border-indigo-700/50', 'hover:border-primary/50'),
    (r'text-indigo-400', 'text-primary'),
    (r'text-indigo-300', 'text-primary'),
    (r'hover:text-indigo-300', 'hover:text-primary'),
    (r'hover:text-indigo-200', 'hover:text-primary'),
    (r'hover:bg-indigo-950/30', 'hover:bg-primary/10'),
    (r'hover:border-indigo-500/50', 'hover:border-primary/50'),
    (r'hover:border-indigo-300', 'hover:border-primary/30'),
    (r'bg-indigo-900/30', 'bg-primary/10'),
    (r'bg-indigo-\d+(/\d+)?', 'bg-primary/10'),
    (r'text-indigo-\d+(/\d+)?', 'text-primary'),

    (r'bg-emerald-600 hover:bg-emerald-500', 'bg-success hover:bg-success/90'),

    (r'text-green-[34]00(/\d+)?', 'text-success'),
    (r'bg-green-(500/10|900/40)', 'bg-success/10'),
    (r'border-green-500/(50|20)', 'border-success/20'),
    (r'hover:bg-green-900/60', 'hover:bg-success/20'),
    (r'bg-green-\d+(/\d+)?', 'bg-success/10'),
    (r'text-green-\d+(/\d+)?', 'text-success'),

    (r'text-yellow-400(/\d+)?', 'text-warning'),
    (r'bg-yellow-500/10', 'bg-warning/10'),
    (r'border-yellow-500/20', 'border-warning/20'),
    (r'bg-yellow-\d+(/\d+)?', 'bg-warning/10'),
    (r'text-yellow-\d+(/\d+)?', 'text-warning'),

    (r'text-amber-400(/\d+)?', 'text-warning'),
    (r'bg-amber-\d+(/\d+)?', 'bg-warning/10'),
    (r'text-amber-\d+(/\d+)?', 'text-warning'),

    (r'text-red-[34]00(/\d+)?', 'text-destructive'),
    (r'bg-red-(500/10|900/40|950/30)', 'bg-destructive/10'),
    (r'border-red-500/50', 'border-destructive/20'),
    (r'hover:bg-red-900/60', 'hover:bg-destructive/20'),
    (r'hover:border-red-900/50', 'hover:border-destructive/20'),
    (r'bg-red-\d+(/\d+)?', 'bg-destructive/10'),
    (r'text-red-\d+(/\d+)?', 'text-destructive'),

    (r'text-blue-400(/\d+)?', 'text-primary'),
    (r'bg-blue-500/10', 'bg-primary/10'),
    (r'bg-blue-\d+(/\d+)?', 'bg-primary/10'),
    (r'text-blue-\d+(/\d+)?', 'text-primary'),
] + general_cleanup
process('src/features/bookings/components/AppointmentScorecard.tsx', rules2)

# FILE 3
rules3 = [
    (r'bg-slate-900 text-white', 'bg-foreground text-background'),
    (r'bg-slate-\d+(/\d+)?', 'bg-secondary'),
    (r'text-slate-\d+(/\d+)?', 'text-muted-foreground'),

    (r'bg-amber-\d+(/\d+)?', 'bg-warning/10'),
    (r'text-amber-\d+(/\d+)?', 'text-warning'),
    (r'border-amber-\d+(/\d+)?', 'border-warning/20'),

    (r'bg-rose-\d+(/\d+)?', 'bg-destructive/10'),
    (r'text-rose-\d+(/\d+)?', 'text-destructive'),
    (r'border-rose-\d+(/\d+)?', 'border-destructive/20'),

    (r'bg-blue-\d+(/\d+)?', 'bg-primary/10'),
    (r'text-blue-\d+(/\d+)?', 'text-primary'),
    (r'border-blue-\d+(/\d+)?', 'border-primary/20'),
] + general_cleanup
process('src/components/students/InternalNotesTimeline.tsx', rules3)

# FILE 4
rules4 = [
    (r'text-\[#adc6ff\]', 'text-primary'),
    (r'text-slate-\d+(/\d+)?', 'text-muted-foreground'),
    (r'bg-slate-\d+(/\d+)?', 'bg-secondary'),
    (r'ring-slate-\d+(/\d+)?', 'ring-border'),

    (r'bg-blue-\d+(/\d+)?', 'bg-primary/10'),
    (r'text-blue-\d+(/\d+)?', 'text-primary'),
    (r'ring-blue-\d+(/\d+)?', 'ring-primary/20'),

    (r'bg-amber-\d+(/\d+)?', 'bg-warning/10'),
    (r'text-amber-\d+(/\d+)?', 'text-warning'),
    (r'ring-amber-\d+(/\d+)?', 'ring-warning/20'),

    (r'bg-violet-\d+(/\d+)?', 'bg-primary/10'),
    (r'text-violet-\d+(/\d+)?', 'text-primary'),
    (r'ring-violet-\d+(/\d+)?', 'ring-primary/20'),

    (r'bg-indigo-\d+(/\d+)?', 'bg-primary/10'),
    (r'text-indigo-\d+(/\d+)?', 'text-primary'),
    (r'ring-indigo-\d+(/\d+)?', 'ring-primary/20'),

    (r'bg-emerald-\d+(/\d+)?', 'bg-success/10'),
    (r'text-emerald-\d+(/\d+)?', 'text-success'),
    (r'ring-emerald-\d+(/\d+)?', 'ring-success/20'),
] + general_cleanup
process('src/app/dashboard/bookings/[bookingId]/page.tsx', rules4)

# FILE 5a & 5b
rules5 = [
    (r'bg-gray-700 text-white', 'bg-secondary text-foreground'),
    (r'bg-blue-600 text-white', 'bg-primary text-primary-foreground'),
    (r'bg-violet-600 text-white', 'bg-primary text-primary-foreground'),
    (r'bg-amber-500 text-white', 'bg-warning text-white'),
    (r'bg-orange-500 text-white', 'bg-warning text-white'),
    (r'bg-red-600 text-white', 'bg-destructive text-white'),
    (r'bg-red-500 text-white', 'bg-destructive text-white'),
    (r'bg-emerald-500 text-white', 'bg-success text-white'),

    (r'hover:bg-blue-100', 'hover:bg-primary/20'),
    (r'hover:bg-violet-100', 'hover:bg-primary/20'),
    (r'hover:bg-amber-100', 'hover:bg-warning/20'),
    (r'hover:bg-orange-100', 'hover:bg-warning/20'),
    (r'hover:bg-red-100', 'hover:bg-destructive/20'),
    (r'hover:bg-emerald-100', 'hover:bg-success/20'),
    (r'hover:bg-red-50', 'hover:bg-destructive/20'),
    (r'hover:bg-blue-50', 'hover:bg-primary/20'),
    (r'hover:text-red-600', 'hover:text-destructive'),
    (r'hover:text-blue-600', 'hover:text-primary'),

    (r'bg-blue-\d+(/\d+)?', 'bg-primary/10'),
    (r'text-blue-\d+(/\d+)?', 'text-primary'),
    (r'bg-violet-\d+(/\d+)?', 'bg-primary/15'),
    (r'text-violet-\d+(/\d+)?', 'text-primary'),
    (r'bg-amber-\d+(/\d+)?', 'bg-warning/10'),
    (r'text-amber-\d+(/\d+)?', 'text-warning'),
    (r'bg-orange-\d+(/\d+)?', 'bg-warning/10'),
    (r'text-orange-\d+(/\d+)?', 'text-warning'),
    (r'bg-emerald-\d+(/\d+)?', 'bg-success/10'),
    (r'text-emerald-\d+(/\d+)?', 'text-success'),
    (r'bg-red-\d+(/\d+)?', 'bg-destructive/10'),
    (r'text-red-\d+(/\d+)?', 'text-destructive'),
] + general_cleanup
process('src/components/students/ProgressNoteForm.tsx', rules5)
process('src/components/students/ProgressTimeline.tsx', rules5)
