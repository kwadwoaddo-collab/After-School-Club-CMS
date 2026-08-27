# SprintScale CMS — Visual Asset Capture & Production Standards
## Technical Specifications for Screenshots, Video Screencasts, Annotations & Transcripts

---

## 1. Screenshot Capture Specifications

### Viewports & Dimensions
| Device Profile | Viewport Resolution | Target UI Surface | Standard Aspect Ratio |
|---|---|---|---|
| **Desktop Web** | **1440 × 900 px** | Main Staff Dashboard, Settings, Finance, Roll Call | 16:10 |
| **Tablet Kiosk** | **1024 × 768 px** | Tablet Kiosk Mode, Daily Arrival/Departure | 4:3 |
| **Mobile Web** | **375 × 812 px** | Parent Portal, Magic Link Login, Mobile Navigation | 9:19.5 |

### Composition & Cropping Rules
1. **Contextual Orientation:** Include the top header and left sidebar in desktop views so the user understands where the feature is located in the application hierarchy.
2. **Eliminate Browser Distractions:** Hide browser developer consoles, extension icons, bookmarks bars, and personal tabs.
3. **Synthetic Persona Consistency:** The top-right user pill must display the active synthetic persona (e.g. `Eleanor Vance (Owner)`, `Marcus Sterling (Manager)`, `Chloe Bennett (Front Desk)`, or `Liam Harper (Tutor)`).
4. **Zero Loading / Glitch States:** Capture views only after all asynchronous data has fully resolved.

---

## 2. Numbered Callout & Annotation Guidelines

Screenshots demonstrating sequential multi-step workflows must use restrained, accessible visual callouts:

```
┌─────────────────────────────────────────────────────────────┐
│                    ANNOTATION STYLING STANDARD              │
├─────────────────────────────────────────────────────────────┤
│  • Bounding Box: 2px solid cyan/accent border (`#0284c7`).  │
│  • Number Badges: 22px solid pill (`#0284c7`) with white   │
│    bold numbers (1, 2, 3) placed at top-left of target.     │
│  • Caption Alignment: Under image, provide matching numbered │
│    step descriptions.                                       │
│  • Legibility Guard: Never place badges over button text.   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Micro-Video Production Specifications

### Format & Duration
- **Duration:** 30 seconds to 90 seconds (Max 120 seconds for complex multi-step workflows).
- **Resolution:** 1080p (1920 × 1080 px) or native 1440 × 900 px at 30 fps.
- **Pacing:** Smooth, deliberate mouse movement; pause for 1 second on target buttons before clicking.

### Video Flow Architecture
1. **Title Screen (0:00 - 0:03):** Display Video ID, Task Title, and Role badge.
2. **Starting State (0:03 - 0:10):** Orient the user on the starting page.
3. **Execution Steps (0:10 - 0:45):** Demonstrate the click path smoothly without erratic cursor motion.
4. **Result State (0:45 - 0:55):** Show confirmation message, updated table row, or badge change.
5. **Closing Summary (0:55 - 1:00):** Final completion screen.

---

## 4. Transcript & Narration Standard

Every video screencast must be paired with an exact verbatim transcript stored in `assets/transcripts/[video-id].md`:

```markdown
# Transcript: [Video ID] — [Task Title]

- **Role:** [e.g. Front Desk]
- **Target Route:** [e.g. `/dashboard/attendance`]
- **Duration:** [e.g. 45 Seconds]
- **Synthetic Persona:** [e.g. Chloe Bennett]

### Timeline & Narration
- `00:00 - 00:10` — **Starting Location:** "Log in to the dashboard and open the Attendance tab from the left sidebar."
- `00:10 - 00:25` — **Action:** "Locate Oliver Jenkins in the afternoon register and click the green Check In button."
- `00:25 - 00:40` — **Rationale:** "Checking the pupil in timestamps their arrival immediately, satisfying local attendance audit requirements."
- `00:40 - 00:45` — **Expected Result:** "The status badge turns green, showing the exact check-in time."
```
