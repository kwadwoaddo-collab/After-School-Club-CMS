import re
import json

with open("src/features/students/components/StudentProfile.tsx", "r") as f:
    content = f.read()

# 1. Add sessionSlots
content = content.replace("centreId?: string | null;", "centreId?: string | null;\n        sessionSlots?: string | null;")

# 2. Extract flags and replace completeness score with Critical Flags Dashboard
content = re.sub(
    r"const completenessFields = \[.*?\];\n\s*const completenessScore = .*?;\n",
    "",
    content,
    flags=re.DOTALL
)

# Replace the completeness bar UI with Critical Flags Dashboard
bar_pattern = r'<div className="flex items-center gap-3 max-w-xs mx-auto sm:mx-0 pt-1">.*?</div>\s*</div>\s*</div>'

critical_flags_ui = """</div>
                    </div>
                    {/* Critical Flags Dashboard */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                        {/* Financial Health */}
                        <div className="p-3 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Banknote className="w-4 h-4 text-muted-foreground" />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Balance</span>
                            </div>
                            <span className={cn("text-sm font-black", billingConfig && billingConfig.agreedMonthlyPence < 0 ? "text-destructive" : "text-foreground")}>
                                {billingConfig ? `£${(billingConfig.agreedMonthlyPence / 100).toFixed(2)}/mo` : '£0.00'}
                            </span>
                        </div>
                        {/* Operational Health */}
                        <div className={cn("p-3 rounded-2xl border shadow-sm flex items-center justify-between", attendanceRate < 80 && attendanceBreakdown.total > 0 ? 'border-warning/40 bg-warning/10' : 'border-border bg-card')}>
                            <div className="flex items-center gap-2">
                                <Clock className={cn("w-4 h-4", attendanceRate < 80 && attendanceBreakdown.total > 0 ? 'text-warning' : 'text-muted-foreground')} />
                                <span className={cn("text-[10px] font-bold uppercase tracking-wider", attendanceRate < 80 && attendanceBreakdown.total > 0 ? 'text-warning' : 'text-muted-foreground')}>30-Day Att.</span>
                            </div>
                            <span className={cn('text-sm font-black', attendanceRate < 80 && attendanceBreakdown.total > 0 ? 'text-warning' : 'text-foreground')}>{attendanceRate}%</span>
                        </div>
                        {/* Safety */}
                        <div className={cn("p-3 rounded-2xl border shadow-sm flex items-center justify-between", (initialNotes.some(n => n.category === 'Medical') || initialNotes.some(n => n.category === 'Safeguarding')) ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-card')}>
                            <div className="flex items-center gap-2">
                                <ShieldAlert className={cn("w-4 h-4", (initialNotes.some(n => n.category === 'Medical') || initialNotes.some(n => n.category === 'Safeguarding')) ? 'text-destructive' : 'text-muted-foreground')} />
                                <span className={cn("text-[10px] font-bold uppercase tracking-wider", (initialNotes.some(n => n.category === 'Medical') || initialNotes.some(n => n.category === 'Safeguarding')) ? 'text-destructive' : 'text-muted-foreground')}>Safety Flags</span>
                            </div>
                            <span className={cn("text-sm font-black", (initialNotes.some(n => n.category === 'Medical') || initialNotes.some(n => n.category === 'Safeguarding')) ? "text-destructive" : "text-muted-foreground")}>
                                {(initialNotes.some(n => n.category === 'Medical') || initialNotes.some(n => n.category === 'Safeguarding')) ? "Active" : "None"}
                            </span>
                        </div>
                    </div>"""

content = re.sub(bar_pattern, critical_flags_ui, content, flags=re.DOTALL)

# 3. Replace the Stats strip
# We just need to remove the Stats strip because it's replaced by the Critical Flags dashboard
stats_strip_pattern = r'\{\/\* Stats strip \*\/.*?\}'
# wait, actually regexing this is hard. Let's just find the exact text
stats_strip_str = """{/* Stats strip */}
                    <div className="mt-8 grid grid-cols-3 border-t border-border -mx-8">
                        <div className="px-8 py-5 border-r border-border flex flex-col gap-0.5">
                            <span className={sL}>Total Sessions</span>
                            <span className="text-xl font-black text-foreground">{attendanceBreakdown.total}</span>
                        </div>
                        <Link
                            href={`/dashboard/students/${student.id}/attendance`}
                            className="px-8 py-5 border-r border-border flex flex-col gap-0.5 hover:bg-secondary/40 transition-colors"
                        >
                            <span className={sL}>Attendance Rate</span>
                            <span className={cn(
                                'text-xl font-black',
                                attendanceRate >= 80 ? 'text-success' : attendanceRate >= 60 ? 'text-warning' : 'text-destructive'
                            )}>
                                {attendanceRate}%
                            </span>
                        </Link>
                        <div className="px-8 py-5 flex flex-col gap-0.5">
                            <span className={sL}>Registered</span>
                            <span className="text-xl font-black text-foreground">
                                {student.registeredSessions && student.registeredSessions.length > 0 ? 'Yes' : 'No'}
                            </span>
                        </div>
                    </div>"""
content = content.replace(stats_strip_str, "")

# 4. Refactor Permanent Schedule
schedule_target = r'<div>\s*<p className={\`\$\{sL\} mb-2\`}>After-School \(Mon – Fri\)</p>.*?</div>\s*</div>\s*</div>\s*</div>'

schedule_replacement = """<div>
                                            {student.sessionSlots ? (
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                    {(() => {
                                                        let slots = [];
                                                        try {
                                                            slots = JSON.parse(student.sessionSlots);
                                                        } catch (e) {}
                                                        
                                                        return slots.map((slot: string) => {
                                                            const checked = selectedSchedules.includes(slot);
                                                            return (
                                                                <label key={slot} className="flex items-center gap-2 p-3 bg-card rounded-xl border border-border cursor-pointer hover:border-primary/30 transition-colors">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        onChange={() => handleToggleSession(slot)}
                                                                        className="rounded border-border text-primary focus:ring-primary/30 w-4 h-4"
                                                                    />
                                                                    <span className={cn('text-xs font-bold transition-colors', checked ? 'text-primary' : 'text-foreground')}>
                                                                        {slot}
                                                                    </span>
                                                                </label>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground italic p-4 bg-secondary/50 rounded-xl">
                                                    No dynamic session configurations found. Ensure the Centre has session slots configured.
                                                </p>
                                            )}
                                        </div>
"""

content = re.sub(schedule_target, schedule_replacement, content, flags=re.DOTALL)

with open("src/features/students/components/StudentProfile.tsx", "w") as f:
    f.write(content)
