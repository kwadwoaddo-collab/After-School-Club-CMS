import re

def update_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Text colors
    content = re.sub(r'text-slate-800', 'text-white/70', content)
    content = re.sub(r'text-gray-900', 'text-white', content)
    content = re.sub(r'text-gray-800', 'text-white/90', content)
    content = re.sub(r'text-gray-700', 'text-white/80', content)
    content = re.sub(r'text-gray-600', 'text-white/60', content)
    content = re.sub(r'text-gray-500', 'text-white/50', content)
    content = re.sub(r'text-slate-700', 'text-white/80', content)
    content = re.sub(r'text-foreground', 'text-white', content)
    content = re.sub(r'text-muted-foreground', 'text-white/50', content)

    # Backgrounds
    content = re.sub(r'bg-white\b', 'bg-white/5', content)
    content = re.sub(r'bg-slate-50', 'bg-white/5', content)
    content = re.sub(r'bg-gray-50', 'bg-white/5', content)
    content = re.sub(r'bg-secondary/40', 'bg-white/5', content)
    content = re.sub(r'bg-card', 'bg-white/5', content)
    content = re.sub(r'bg-secondary', 'bg-white/10', content)
    content = re.sub(r'bg-\[\#f5f5f7\]', 'bg-transparent', content)
    
    # Borders
    content = re.sub(r'border-border', 'border-white/10', content)
    content = re.sub(r'border-gray-200', 'border-white/10', content)
    content = re.sub(r'border-slate-200', 'border-white/10', content)
    content = re.sub(r'border-gray-300', 'border-white/10', content)

    # Fix inputs in BookingForm.tsx
    # e.g., className="w-full px-4 py-3 border border-white/10 rounded-lg ...
    content = re.sub(r'className="w-full px-4 py-3 border border-white/10 rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-white"', 
                     r'className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:ring-2 brand-ring focus:border-transparent outline-none text-white placeholder:text-white/40 font-medium transition-all"', content)
    
    # The original inputs might not have been replaced yet since they were 'border-border' and 'text-foreground'
    content = re.sub(r'className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-foreground"', 
                     r'className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:ring-2 brand-ring focus:border-transparent outline-none text-white placeholder:text-white/40 font-medium transition-all"', content)
    
    content = re.sub(r'className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-gray-900"', 
                     r'className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:ring-2 brand-ring focus:border-transparent outline-none text-white placeholder:text-white/40 font-medium transition-all"', content)
    
    content = re.sub(r'className="w-full p-4 border border-border rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-foreground resize-none"', 
                     r'className="w-full p-4 rounded-xl bg-white/5 border border-white/10 focus:ring-2 brand-ring focus:border-transparent outline-none text-white placeholder:text-white/40 font-medium transition-all resize-none"', content)

    content = re.sub(r'border-gray-800 bg-secondary/40 text-foreground font-semibold shadow-sm', 'border-white/20 bg-white/10 text-white font-semibold shadow-sm', content)
    content = re.sub(r'border-border bg-card text-muted-foreground hover:border-border hover:bg-secondary/40', 'border-white/5 bg-white/5 text-white/50 hover:border-white/10 hover:bg-white/10 hover:text-white', content)
                     
    # Buttons
    # "brand-btn" -> apply the gradient classes
    content = re.sub(r'brand-btn', 'bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white font-bold hover:from-[#4f93ff] hover:to-[#7c7fff] transition-all duration-200 shadow-[0_4px_16px_rgba(59,130,246,0.4)] hover:shadow-[0_6px_24px_rgba(59,130,246,0.5)] border-0', content)
    
    # Other fixes
    content = re.sub(r'bg-primary text-primary-foreground', 'bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white', content)
    content = re.sub(r'hover:bg-primary/90 text-primary-foreground', 'hover:from-[#4f93ff] hover:to-[#7c7fff] text-white', content)

    # Step circles
    content = re.sub(r'bg-secondary text-muted-foreground', 'bg-white/5 text-white/50 border border-white/10', content)

    with open(filepath, 'w') as f:
        f.write(content)

update_file('src/features/bookings/components/BookingForm.tsx')
update_file('src/app/register/[...slug]/page.tsx')
