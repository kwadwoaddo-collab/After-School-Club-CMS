const fs = require('fs');

const processFile = (filepath, rules) => {
    let content = fs.readFileSync(filepath, 'utf8');
    for (const [old, replace] of rules) {
        content = content.replace(old, replace);
    }
    fs.writeFileSync(filepath, content);
};

const generalCleanup = [
    [/\bbg-white\b/g, 'bg-card'],
    [/border-slate-\d+(\/\d+)?/g, 'border-border'],
    [/border-gray-\d+(\/\d+)?/g, 'border-border'],
];

const rules1 = [
    ['bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', 'bg-success/10 text-success border-success/20'],
    ['bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', 'bg-primary/10 text-primary border-primary/20'],
    ['bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', 'bg-warning/10 text-warning border-warning/20'],

    [/bg-amber-500\/10/g, 'bg-warning/10'],
    [/ring-amber-500\/30/g, 'ring-warning/20'],
    [/text-amber-700 dark:text-amber-400/g, 'text-warning'],
    [/bg-amber-500 hover:bg-amber-600/g, 'bg-warning hover:bg-warning/90'],

    [/bg-red-500\/10/g, 'bg-destructive/10'],
    [/ring-red-500\/30/g, 'ring-destructive/20'],
    [/text-red-600 dark:text-red-400/g, 'text-destructive'],
    [/bg-red-600 hover:bg-red-700/g, 'bg-destructive hover:bg-destructive/90'],

    ['bg-rose-50 border border-rose-100', 'bg-destructive/10 border-destructive/20'],
    [/text-rose-500/g, 'text-destructive'],
    [/border-rose-500\/30/g, 'border-destructive/20'],
    [/border-rose-100/g, 'border-destructive/20'],

    ['bg-blue-50 border border-blue-100', 'bg-primary/10 border-primary/20'],
    [/text-blue-600/g, 'text-primary'],
    [/border-blue-500\/30/g, 'border-primary/20'],
    [/border-blue-100/g, 'border-primary/20'],

    ['bg-primary hover:bg-primary/90 text-white', 'bg-primary hover:bg-primary/90 text-primary-foreground'],
    ['bg-gradient-to-br from-primary to-accent-violet flex items-center justify-center text-white', 'bg-gradient-to-br from-primary to-accent-violet flex items-center justify-center text-primary-foreground'],

    [/bg-slate-\d+(\/\d+)?/g, 'bg-secondary'],
    [/text-slate-\d+(\/\d+)?/g, 'text-muted-foreground'],
    [/bg-gray-\d+(\/\d+)?/g, 'bg-secondary'],
    [/text-gray-\d+(\/\d+)?/g, 'text-muted-foreground'],
    ...generalCleanup
];

processFile('src/components/bookings/BookingsTable.tsx', rules1);

const rules2 = [
    [/bg-slate-[789]00(\/\d+)?/g, 'bg-card'],
    [/text-slate-[345]00(\/\d+)?/g, 'text-muted-foreground'],
    [/text-slate-950/g, 'text-foreground'],

    [/bg-slate-\d+(\/\d+)?/g, 'bg-secondary'],
    [/text-slate-\d+(\/\d+)?/g, 'text-muted-foreground'],

    ['bg-indigo-600 hover:bg-indigo-500', 'bg-primary hover:bg-primary/90'],
    ['bg-indigo-600 text-white border-indigo-600', 'bg-primary text-primary-foreground border-primary'],
    ['shadow-indigo-900/20', 'shadow-primary/20'],
    ['border-indigo-900/50', 'border-primary/50'],
    ['hover:border-indigo-700/50', 'hover:border-primary/50'],
    [/text-indigo-400/g, 'text-primary'],
    [/text-indigo-300/g, 'text-primary'],
    [/hover:text-indigo-300/g, 'hover:text-primary'],
    [/hover:text-indigo-200/g, 'hover:text-primary'],
    ['hover:bg-indigo-950/30', 'hover:bg-primary/10'],
    ['hover:border-indigo-500/50', 'hover:border-primary/50'],
    ['hover:border-indigo-300', 'hover:border-primary/30'],
    ['bg-indigo-900/30', 'bg-primary/10'],
    [/bg-indigo-\d+(\/\d+)?/g, 'bg-primary/10'],
    [/text-indigo-\d+(\/\d+)?/g, 'text-primary'],

    ['bg-emerald-600 hover:bg-emerald-500', 'bg-success hover:bg-success/90'],

    [/text-green-[34]00(\/\d+)?/g, 'text-success'],
    [/bg-green-(500\/10|900\/40)/g, 'bg-success/10'],
    [/border-green-500\/(50|20)/g, 'border-success/20'],
    ['hover:bg-green-900/60', 'hover:bg-success/20'],
    [/bg-green-\d+(\/\d+)?/g, 'bg-success/10'],
    [/text-green-\d+(\/\d+)?/g, 'text-success'],

    [/text-yellow-400(\/\d+)?/g, 'text-warning'],
    ['bg-yellow-500/10', 'bg-warning/10'],
    ['border-yellow-500/20', 'border-warning/20'],
    [/bg-yellow-\d+(\/\d+)?/g, 'bg-warning/10'],
    [/text-yellow-\d+(\/\d+)?/g, 'text-warning'],

    [/text-amber-400(\/\d+)?/g, 'text-warning'],
    [/bg-amber-\d+(\/\d+)?/g, 'bg-warning/10'],
    [/text-amber-\d+(\/\d+)?/g, 'text-warning'],

    [/text-red-[34]00(\/\d+)?/g, 'text-destructive'],
    [/bg-red-(500\/10|900\/40|950\/30)/g, 'bg-destructive/10'],
    ['border-red-500/50', 'border-destructive/20'],
    ['hover:bg-red-900/60', 'hover:bg-destructive/20'],
    ['hover:border-red-900/50', 'hover:border-destructive/20'],
    [/bg-red-\d+(\/\d+)?/g, 'bg-destructive/10'],
    [/text-red-\d+(\/\d+)?/g, 'text-destructive'],

    [/text-blue-400(\/\d+)?/g, 'text-primary'],
    ['bg-blue-500/10', 'bg-primary/10'],
    [/bg-blue-\d+(\/\d+)?/g, 'bg-primary/10'],
    [/text-blue-\d+(\/\d+)?/g, 'text-primary'],
    ...generalCleanup
];

processFile('src/features/bookings/components/AppointmentScorecard.tsx', rules2);

const rules3 = [
    ['bg-slate-900 text-white', 'bg-foreground text-background'],
    [/bg-slate-\d+(\/\d+)?/g, 'bg-secondary'],
    [/text-slate-\d+(\/\d+)?/g, 'text-muted-foreground'],

    [/bg-amber-\d+(\/\d+)?/g, 'bg-warning/10'],
    [/text-amber-\d+(\/\d+)?/g, 'text-warning'],
    [/border-amber-\d+(\/\d+)?/g, 'border-warning/20'],

    [/bg-rose-\d+(\/\d+)?/g, 'bg-destructive/10'],
    [/text-rose-\d+(\/\d+)?/g, 'text-destructive'],
    [/border-rose-\d+(\/\d+)?/g, 'border-destructive/20'],

    [/bg-blue-\d+(\/\d+)?/g, 'bg-primary/10'],
    [/text-blue-\d+(\/\d+)?/g, 'text-primary'],
    [/border-blue-\d+(\/\d+)?/g, 'border-primary/20'],
    ...generalCleanup
];

processFile('src/components/students/InternalNotesTimeline.tsx', rules3);

const rules4 = [
    ['text-[#adc6ff]', 'text-primary'],
    [/text-slate-\d+(\/\d+)?/g, 'text-muted-foreground'],
    [/bg-slate-\d+(\/\d+)?/g, 'bg-secondary'],
    [/ring-slate-\d+(\/\d+)?/g, 'ring-border'],

    [/bg-blue-\d+(\/\d+)?/g, 'bg-primary/10'],
    [/text-blue-\d+(\/\d+)?/g, 'text-primary'],
    [/ring-blue-\d+(\/\d+)?/g, 'ring-primary/20'],

    [/bg-amber-\d+(\/\d+)?/g, 'bg-warning/10'],
    [/text-amber-\d+(\/\d+)?/g, 'text-warning'],
    [/ring-amber-\d+(\/\d+)?/g, 'ring-warning/20'],

    [/bg-violet-\d+(\/\d+)?/g, 'bg-primary/10'],
    [/text-violet-\d+(\/\d+)?/g, 'text-primary'],
    [/ring-violet-\d+(\/\d+)?/g, 'ring-primary/20'],

    [/bg-indigo-\d+(\/\d+)?/g, 'bg-primary/10'],
    [/text-indigo-\d+(\/\d+)?/g, 'text-primary'],
    [/ring-indigo-\d+(\/\d+)?/g, 'ring-primary/20'],

    [/bg-emerald-\d+(\/\d+)?/g, 'bg-success/10'],
    [/text-emerald-\d+(\/\d+)?/g, 'text-success'],
    [/ring-emerald-\d+(\/\d+)?/g, 'ring-success/20'],
    ...generalCleanup
];

processFile('src/app/dashboard/bookings/[bookingId]/page.tsx', rules4);

const rules5 = [
    ['bg-gray-700 text-white', 'bg-secondary text-foreground'],
    ['bg-blue-600 text-white', 'bg-primary text-primary-foreground'],
    ['bg-violet-600 text-white', 'bg-primary text-primary-foreground'],
    ['bg-amber-500 text-white', 'bg-warning text-white'],
    ['bg-orange-500 text-white', 'bg-warning text-white'],
    ['bg-red-600 text-white', 'bg-destructive text-white'],
    ['bg-red-500 text-white', 'bg-destructive text-white'],
    ['bg-emerald-500 text-white', 'bg-success text-white'],

    ['hover:bg-blue-100', 'hover:bg-primary/20'],
    ['hover:bg-violet-100', 'hover:bg-primary/20'],
    ['hover:bg-amber-100', 'hover:bg-warning/20'],
    ['hover:bg-orange-100', 'hover:bg-warning/20'],
    ['hover:bg-red-100', 'hover:bg-destructive/20'],
    ['hover:bg-emerald-100', 'hover:bg-success/20'],
    ['hover:bg-red-50', 'hover:bg-destructive/20'],
    ['hover:bg-blue-50', 'hover:bg-primary/20'],
    ['hover:text-red-600', 'hover:text-destructive'],
    ['hover:text-blue-600', 'hover:text-primary'],

    [/bg-blue-\d+(\/\d+)?/g, 'bg-primary/10'],
    [/text-blue-\d+(\/\d+)?/g, 'text-primary'],
    [/bg-violet-\d+(\/\d+)?/g, 'bg-primary/15'],
    [/text-violet-\d+(\/\d+)?/g, 'text-primary'],
    [/bg-amber-\d+(\/\d+)?/g, 'bg-warning/10'],
    [/text-amber-\d+(\/\d+)?/g, 'text-warning'],
    [/bg-orange-\d+(\/\d+)?/g, 'bg-warning/10'],
    [/text-orange-\d+(\/\d+)?/g, 'text-warning'],
    [/bg-emerald-\d+(\/\d+)?/g, 'bg-success/10'],
    [/text-emerald-\d+(\/\d+)?/g, 'text-success'],
    [/bg-red-\d+(\/\d+)?/g, 'bg-destructive/10'],
    [/text-red-\d+(\/\d+)?/g, 'text-destructive'],
    ...generalCleanup
];

processFile('src/components/students/ProgressNoteForm.tsx', rules5);
processFile('src/components/students/ProgressTimeline.tsx', rules5);
