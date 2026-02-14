import { Clock, MapPin } from 'lucide-react';

interface ScheduleItem {
    id: string;
    title: string;
    time: string;
    location: string;
}

const schedule: ScheduleItem[] = [
    {
        id: '1',
        title: 'Advanced Robotics',
        time: '15:30 - 17:00',
        location: 'Lab 3',
    },
    {
        id: '2',
        title: 'Beginner French',
        time: '16:00 - 17:30',
        location: 'Room 12',
    },
    {
        id: '3',
        title: 'Digital Art Masterclass',
        time: '16:30 - 18:00',
        location: 'Studio A',
    },
];

export default function TodaySchedule() {
    return (
        <div className="glass-card p-8 rounded-[32px]">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900">Today's Schedule</h3>
                <span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    3 Sessions
                </span>
            </div>

            <div className="space-y-6">
                {schedule.map((item) => (
                    <div key={item.id} className="group cursor-pointer">
                        <div className="flex items-start gap-4">
                            <div className="w-1 h-12 rounded-full bg-primary/20 group-hover:bg-primary transition-colors" />
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">
                                    {item.title}
                                </h4>
                                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                        <Clock className="w-3 h-3" />
                                        {item.time}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                        <MapPin className="w-3 h-3" />
                                        {item.location}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button className="w-full mt-8 py-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-all">
                View Full Calendar
            </button>
        </div>
    );
}
