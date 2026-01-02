# The Call: Islamic Prayer Companion Agent

> **A production OpenHarness application demonstrating intelligent, context-aware agent orchestration**

---

## Overview

**The Call** is an iOS application that helps Muslim professionals organize their lives around prayer times using an intelligent AI companion. Unlike simple prayer time calculators, The Call uses a sophisticated multi-agent system to provide context-aware, personalized guidance.

**Key Insight**: This is NOT a simple request-response workflow. It's a **background-running cognitive system** that continuously monitors user context and intelligently decides when and how to intervene.

---

## The Real Architecture

### What Makes This Different

**Traditional prayer apps**: Calculate prayer times → Send notification at fixed time

**The Call**: Continuously analyzes context → Makes intelligent decisions → Provides contextual guidance

### System Components

#### 1. iOS Application (User Interface)
- **Location Services**: GPS tracking, location history
- **Calendar Integration**: Read/write user calendar
- **Notification System**: Local and push notifications  
- **Voice Interface**: Optional ElevenLabs voice interaction
- **Data Storage**: User preferences, prayer history, patterns

#### 2. Background Harness (The Brain)
- **Runs continuously**: Wakes every 5-15 minutes
- **Orchestrates agents**: Delegates tasks to specialist agents
- **Makes decisions**: When to notify, what to say, which actions to offer
- **Learns patterns**: Adapts to user behavior over time

#### 3. Multi-Agent System
- **Context Builder**: Processes location, calendar, prayer times, traffic
- **Risk Analyzer**: Identifies urgency (prayer window closing, traveling, conflicts)
- **Decision Maker**: Determines if/when/how to intervene
- **Action Planner**: Crafts personalized messages and action buttons
- **Pattern Learner**: Learns user preferences and habits

---

## Architectural Pattern: Hybrid Agent-Supervisor

**Recommended Architecture**: Combines hierarchical coordination with reactive event handling

![[diagrams/option4-hybrid-supervisor.excalidraw]]

### Why This Pattern?

1. **Supervisor manages main loop**: Clear, predictable orchestration
2. **Specialist agents do focused work**: Context building, risk analysis, action planning
3. **Reactive agents handle cross-cutting concerns**: Urgency detection, pattern learning
4. **Event bus enables decoupling**: Agents don't need to know about each other
5. **Clear responsibility**: Supervisor coordinates, specialists execute, reactive agents monitor

---

## How It Actually Works

### Background Loop (Every 5-15 Minutes)

```typescript
const PrayerCompanionHarness = defineHarness({
  name: "prayer-companion-background",
  
  agents: {
    // Supervisor coordinates these
    supervisor: SupervisorAgent,
    contextBuilder: ContextBuilderAgent,
    riskAnalyzer: RiskAnalyzerAgent,
    actionPlanner: ActionPlannerAgent,
    
    // Reactive agents (event-driven)
    urgencyDetector: UrgencyDetectorAgent,
    patternLearner: PatternLearnerAgent,
  },
  
  run: async ({ agents, bus, schedule, state }) => {
    
    // Supervisor manages the main loop
    schedule.every("5 minutes", async () => {
      
      // === PHASE 1: BUILD CONTEXT ===
      const context = await agents.contextBuilder.execute({
        userId: state.userId,
        currentTime: new Date(),
        dataSources: {
          location: state.locationApi,
          calendar: state.calendarApi,
          prayerTimes: state.prayerApi,
          traffic: state.trafficApi,
        }
      });
      
      // context = {
      //   time: { current, nextPrayer, timeUntilPrayer, prayerWindow },
      //   location: { lat, lng, isHome, isTraveling, nearestMosque },
      //   calendar: { upcomingEvents, isBusy, nextFreeSlot },
      //   traffic: { travelTimeToMosque, routeOptions }
      // }
      
      // Publish for reactive agents
      bus.emit('context:built', context);
      
      
      // === PHASE 2: ANALYZE RISKS ===
      const risks = await agents.riskAnalyzer.execute({
        context,
        userHistory: state.history,
        userPreferences: state.preferences
      });
      
      // risks = {
      //   prayerWindowClosing: boolean,
      //   calendarConflict: boolean,
      //   travelingUnknownLocation: boolean,
      //   missedRecentPrayers: number,
      //   overallUrgency: "LOW" | "MEDIUM" | "HIGH"
      // }
      
      // Publish for reactive agents
      bus.emit('risks:analyzed', risks);
      
      
      // === PHASE 3: PLAN ACTION ===
      const action = await agents.actionPlanner.execute({
        context,
        risks,
        userPreferences: state.preferences
      });
      
      // action = {
      //   shouldNotify: boolean,
      //   message: string,
      //   actionButtons: [
      //     { label: "Get Directions", action: "navigate_to_mosque" },
      //     { label: "Remind in 10 min", action: "snooze_10min" }
      //   ],
      //   notificationType: "gentle" | "normal" | "urgent"
      // }
      
      if (action.shouldNotify) {
        emit('user:notification', action);
      }
    });
    
    
    // === REACTIVE AGENT: URGENCY DETECTOR ===
    bus.on('risks:analyzed', async (event) => {
      const urgency = await agents.urgencyDetector.execute({
        risks: event.data
      });
      
      if (urgency.level === 'HIGH') {
        // Override normal flow - immediate intervention
        bus.emit('urgent:intervention', {
          message: urgency.reason,
          overrideSchedule: true
        });
      }
    });
    
    
    // === REACTIVE AGENT: PATTERN LEARNER ===
    bus.on(['context:built', 'user:notification'], async (events) => {
      // Learn from user interactions over time
      await agents.patternLearner.execute({
        events,
        history: state.history
      });
      
      // Updates user preferences based on patterns:
      // - Preferred prayer times
      // - Typical locations (home, work, gym)
      // - Notification sensitivity
      // - Response patterns (dismisses vs accepts)
    });
  }
});
```

---

## Agent Deep-Dive: What Each Agent Actually Does

### 1. Context Builder Agent

**Role**: Gather and enrich all relevant data about user's current situation

**Input**:
```typescript
{
  userId: string,
  currentTime: Date,
  dataSources: {
    location: LocationAPI,
    calendar: CalendarAPI,
    prayerTimes: PrayerTimesAPI,
    traffic: TrafficAPI
  }
}
```

**Processing** (This is where the LLM shines):
- **Location Analysis**: 
  - Current location vs home/work (are they traveling?)
  - Nearby mosques (geocode query)
  - Distance to usual prayer locations
  
- **Temporal Analysis**:
  - Next prayer time and window duration
  - Time remaining until prayer
  - Time of day context (morning vs afternoon)
  
- **Calendar Analysis**:
  - Upcoming meetings/events
  - Free time slots
  - Conflicts with prayer times
  
- **Traffic Analysis**:
  - Travel time to nearest mosque
  - Route options
  - Current traffic conditions

**Output**:
```typescript
{
  time: {
    current: "2025-01-15T14:30:00Z",
    nextPrayer: { name: "Asr", time: "15:00:00", window: 90 },
    timeUntilPrayer: 30,
  },
  location: {
    current: { lat: 37.7749, lng: -122.4194 },
    isHome: false,
    isTraveling: true,
    nearestMosque: {
      name: "Islamic Center of SF",
      distance: 2.3,
      travelTime: 8
    }
  },
  calendar: {
    isBusy: false,
    upcomingEvents: [
      { title: "Client Call", start: "16:00:00", duration: 60 }
    ],
    nextFreeSlot: "15:00:00"
  },
  traffic: {
    travelTimeToMosque: 8,
    routeOptions: ["via Market St", "via Van Ness"]
  }
}
```

**Why This Needs an LLM**:
- Interpreting location patterns ("user is traveling" requires historical context)
- Understanding calendar semantics ("meeting" vs "lunch" → different interruption rules)
- Correlating multiple data sources
- Handling edge cases and ambiguity

---

### 2. Risk Analyzer Agent

**Role**: Identify urgency factors and potential issues

**Input**: Context from ContextBuilderAgent + user history

**Processing**:
- **Prayer Window Risk**: 
  - Is the prayer window closing soon?
  - Has user missed recent prayers?
  - Is this a critical prayer (Fajr before sunrise)?
  
- **Travel Risk**:
  - Is user in unfamiliar location?
  - Are there mosques nearby?
  - Is user actively commuting?
  
- **Calendar Risk**:
  - Will upcoming meetings conflict?
  - Does user have time to pray now?
  - Should we suggest praying before the meeting?
  
- **Pattern Risk**:
  - User typically prays at home but currently away
  - User usually dismisses notifications at this time
  - User has been inconsistent lately

**Output**:
```typescript
{
  prayerWindowClosing: true,        // Only 30 min left
  calendarConflict: true,           // Meeting at 4 PM
  travelingUnknownLocation: true,   // Not home/work
  missedRecentPrayers: 2,           // Last 2 prayers missed
  overallUrgency: "HIGH"
}
```

**Why This Needs an LLM**:
- Weighing multiple risk factors
- Understanding user context and priorities
- Making judgment calls (is this "urgent"?)
- Adapting to user patterns

---

### 3. Action Planner Agent

**Role**: Craft appropriate message and action options

**Input**: Context + Risks + User Preferences

**Processing**:
- **Message Crafting**:
  - Tone based on urgency (gentle vs urgent)
  - Personalization based on user preferences
  - Context-aware details (mention travel, nearby mosque, etc.)
  
- **Action Buttons**:
  - Relevant options based on situation
  - Prioritize most likely user action
  - Include dismiss/snooze options
  
- **Timing Strategy**:
  - Should we notify now or wait?
  - Should we send follow-up if dismissed?

**Output**:
```typescript
{
  shouldNotify: true,
  message: "You're near the Islamic Center (8 min away). Asr is in 30 min, but you have a call at 4 PM. Want to pray now?",
  actionButtons: [
    { 
      label: "Get Directions", 
      action: "navigate_to_mosque",
      params: { mosqueId: "islamic-center-sf" }
    },
    { 
      label: "Remind in 10 min", 
      action: "snooze",
      params: { duration: 10 }
    },
    {
      label: "I'll pray later",
      action: "dismiss"
    }
  ],
  notificationType: "normal",
  priority: "high"
}
```

**Why This Needs an LLM**:
- Natural language generation
- Contextual phrasing
- Balancing informativeness with brevity
- Personalization based on user style

---

### 4. Urgency Detector Agent (Reactive)

**Role**: Monitor for critical situations requiring immediate action

**Listens To**: `risks:analyzed` events

**Processing**:
- Detect HIGH urgency scenarios:
  - Prayer window < 15 minutes
  - User is actively traveling and prayer is soon
  - User missed multiple prayers in a row
  
- Override normal schedule if critical

**Output** (if HIGH urgency):
```typescript
{
  level: "HIGH",
  reason: "Asr window closes in 12 minutes",
  overrideSchedule: true,
  suggestedAction: "immediate_notification"
}
```

**Why This Needs an LLM**:
- Pattern recognition (what constitutes "critical"?)
- Context-dependent thresholds
- Learning from user responses

---

### 5. Pattern Learner Agent (Reactive)

**Role**: Learn user preferences and habits over time

**Listens To**: `context:built`, `user:notification`, `user:action` events

**Processing**:
- Track user behavior patterns:
  - Typical prayer times
  - Preferred locations
  - Notification response rates
  - Dismissal patterns
  
- Update user preferences:
  - Adjust notification timing
  - Learn communication preferences
  - Identify prayer habits

**Output** (updates state):
```typescript
state.preferences = {
  ...state.preferences,
  typicalPrayerTimes: {
    Fajr: "05:30",
    Dhuhr: "12:45",
    Asr: "15:30",
    // ...
  },
  preferredMosques: [
    { id: "home-mosque", frequency: 0.8 },
    { id: "work-mosque", frequency: 0.6 }
  ],
  notificationSensitivity: "medium",
  preferredTone: "encouraging"
}
```

**Why This Needs an LLM**:
- Pattern recognition in noisy data
- Inferring preferences from behavior
- Adapting to changes over time

---

## User Experience Scenarios

### Scenario 1: User at Office, Dhuhr Approaching

**Context**:
- Time: 11:45 AM
- Location: Office (10 min from home mosque)
- Next Prayer: Dhuhr at 12:15 PM
- Calendar: Free until 1:00 PM meeting

**System Flow**:

1. **Context Builder** runs at 11:45 AM:
   ```
   {
     location: "office",
     timeUntilPrayer: 30,
     nearestMosque: { name: "Home Mosque", distance: 10min },
     calendar: { nextMeeting: "1:00 PM" }
   }
   ```

2. **Risk Analyzer** evaluates:
   ```
   {
     urgency: "MEDIUM",
     hasTimeBuffer: true,
     noConflicts: true
   }
   ```

3. **Action Planner** creates notification:
   ```
   🕌 "Dhuhr is in 30 minutes. You're close to home - 
       want directions to the mosque? You'll have time 
       before your 1 PM meeting."
   
   [Get Directions] [Remind Me in 10 Min] [Dismiss]
   ```

**User Action**: Taps "Get Directions" → Opens Maps with route

**Pattern Learner**: Records that user prays Dhuhr at home mosque on weekdays

---

### Scenario 2: User Traveling, Prayer Time Approaching

**Context**:
- Time: 2:30 PM
- Location: Airport (detected from location history)
- Next Prayer: Asr at 3:00 PM
- Nearest Mosque: 2 miles away
- Prayer Space: Terminal B (database knows about airport prayer rooms)

**System Flow**:

1. **Context Builder** analyzes:
   ```
   {
     location: "airport",
     isTraveling: true,
     timeUntilPrayer: 30,
     nearestMosque: { distance: 2mi, travelTime: 15min },
     airportPrayerSpace: { terminal: "B", walkTime: 5min }
   }
   ```

2. **Risk Analyzer** flags:
   ```
   {
     urgency: "HIGH",
     travelingUnknownLocation: true,
     limitedTimeBuffer: true
   }
   ```

3. **Urgency Detector** (reactive) sees HIGH urgency:
   - Overrides schedule
   - Triggers immediate notification

4. **Action Planner** creates:
   ```
   ✈️ "I notice you're traveling. Asr is in 30 minutes. 
       There's a prayer space in Terminal B (5 min walk) 
       or a mosque 2 miles away."
   
   [Terminal B Directions] [Mosque Directions] [Pray Later]
   ```

**User Action**: Taps "Terminal B Directions" → Shows indoor navigation

**Pattern Learner**: Records that user prefers convenient options when traveling

---

### Scenario 3: User in Meeting, Prayer Window Closing

**Context**:
- Time: 4:45 PM
- Location: Office
- Next Prayer: Maghrib at 5:00 PM (window until 6:15 PM)
- Calendar: In meeting until 5:30 PM

**System Flow**:

1. **Context Builder**:
   ```
   {
     location: "office",
     timeUntilPrayer: 15,
     calendar: { inMeeting: true, until: "5:30 PM" },
     prayerWindow: 75min
   }
   ```

2. **Risk Analyzer**:
   ```
   {
     urgency: "LOW",
     userBusy: true,
     adequatePrayerWindow: true
   }
   ```

3. **Action Planner** decides:
   - Don't interrupt meeting
   - User will have time after (45 min buffer)
   - Send gentle reminder after meeting

4. **Scheduled notification** at 5:35 PM:
   ```
   🌅 "Maghrib was at 5:00 PM (window until 6:15 PM). 
       Your meeting just ended - you still have time. 
       Prayer room is on Floor 3."
   
   [OK] [Change Settings]
   ```

**User Action**: Goes to prayer room

**Pattern Learner**: Learns that user prefers not to be interrupted during meetings

---

## State Machine Pattern (Alternative View)

For clarity, we can also model this using **user states**:

![[diagrams/option5-state-machine.excalidraw]]

### State Transitions

**AT_HOME** → COMMUTING → AT_WORK → IN_MEETING → FREE_TIME → TRAVELING → PRAYING

Each state has a dedicated strategy agent that knows how to handle prayer notifications in that context.

---

## Channels: How Users Interact

The Call uses **multiple channels** for different interaction modes:

### 1. Push Notifications (Primary)
```typescript
.attach(iOSNotificationChannel({
  priority: "high",
  sound: "default",
  badge: true
}))
```

**What it does**: Sends rich notifications with action buttons

---

### 2. Voice Interface (Optional - ElevenLabs)
```typescript
.attach(ElevenLabsChannel({
  agentId: process.env.ELEVENLABS_AGENT_ID,
  systemPrompt: buildPrayerCompanionPrompt({
    personality: "encouraging",
    verbosity: "concise"
  })
}))
```

**What it does**: Narrates updates, accepts voice commands

**User Experience**:
```
🔊 "Asr is in 30 minutes. You're near the mosque. Want directions?"
🗣️ User: "Yes, give me directions"
🔊 "Opening Maps with route to Islamic Center..."
```

---

### 3. In-App UI (Visual)
```typescript
.attach(WebSocketChannel({
  port: 3000,
  events: ["context:built", "risks:analyzed", "user:notification"]
}))
```

**What it does**: Powers the iOS app UI with real-time updates

---

### 4. Database Channel (Audit Trail)
```typescript
.attach(DatabaseChannel({
  connection: sqlite,
  tables: {
    events: "workflow_events",
    prayers: "prayer_history",
    notifications: "notification_log"
  }
}))
```

**What it does**: Stores prayer history, notifications sent, user actions

---

## Technical Implementation

### Background Execution (iOS)

**Challenge**: iOS restricts background execution

**Solution**: Use Background App Refresh + Silent Push Notifications

```swift
// iOS App Delegate
func application(_ application: UIApplication,
                performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    
    // Trigger OpenHarness workflow
    PrayerCompanionHarness.runBackgroundCheck { result in
        if result.shouldNotify {
            // Schedule local notification
            UNUserNotificationCenter.scheduleNotification(result.notification)
            completionHandler(.newData)
        } else {
            completionHandler(.noData)
        }
    }
}
```

**Frequency**: iOS allows background refresh every 15-30 minutes (system-determined)

**Workaround for more frequent checks**: Silent push notifications from server

---

### Data Sources

**Location**:
```typescript
// iOS CoreLocation
locationManager.requestWhenInUseAuthorization()
locationManager.startUpdatingLocation()
```

**Calendar**:
```typescript
// iOS EventKit
eventStore.requestAccess(to: .event) { granted, error in
    if granted {
        let events = eventStore.events(matching: predicate)
    }
}
```

**Prayer Times**:
```typescript
// Third-party API (e.g., Aladhan API)
fetch(`https://api.aladhan.com/v1/timings/${timestamp}?latitude=${lat}&longitude=${lng}`)
```

**Traffic**:
```typescript
// MapKit Directions
MKDirections.calculateDirections(from: currentLocation, to: mosque)
```

---

## Why OpenHarness is Perfect for This

### 1. Agent Coordination
- Multiple specialist agents working together
- Clear separation of concerns
- Easy to add new agents (e.g., WeatherAgent for outdoor prayer suggestions)

### 2. Background Orchestration
- `schedule.every()` primitive for background loops
- Event bus for reactive agents
- Clean state management

### 3. Provider Flexibility
- Start with Anthropic Claude
- Switch to Gemini or GPT-4 if needed
- No workflow changes required

### 4. Channel Composition
- iOS notifications + voice + in-app UI + database
- All from ONE workflow
- Add new channels without touching core logic

### 5. Type Safety
- Zod schemas for all data
- Catches errors at compile time
- Clear contracts between agents

---

## Success Metrics

**User Engagement**:
- [ ] Prayer notification acceptance rate > 70%
- [ ] Daily active users > 80%
- [ ] Average prayers logged per day > 3

**Intelligence**:
- [ ] Context-appropriate notifications > 90%
- [ ] False positives (irrelevant notifications) < 5%
- [ ] User satisfaction score > 4.5/5

**Performance**:
- [ ] Background check latency < 2 seconds
- [ ] Battery impact < 2% daily
- [ ] LLM token usage < 10K tokens/user/day

---

## Future Enhancements

**Phase 2**:
- [ ] Qibla direction with AR
- [ ] Group prayer coordination (find nearby Muslims praying)
- [ ] Mosque check-ins and social features

**Phase 3**:
- [ ] Personalized Islamic content recommendations
- [ ] Habit tracking (Quran reading, dhikr)
- [ ] Community features (masjid announcements, events)

---

## Conclusion

**The Call** demonstrates how OpenHarness enables sophisticated, context-aware AI systems:

- **Multi-agent orchestration**: Specialist agents working together
- **Temporal reasoning**: Time-aware decision making
- **Background intelligence**: Continuous monitoring without user prompts
- **Contextual interventions**: Right message, right time, right place
- **Pattern learning**: Adapts to user behavior

**This is not just a prayer app - it's an intelligent companion that understands your life and helps you prioritize what matters most.**

---

## References

- [OpenHarness Documentation](../OPENHARNESS.md)
- [Architecture Options](../diagrams/)
- [Hybrid Agent-Supervisor Pattern](../diagrams/option4-hybrid-supervisor.excalidraw)
- [State Machine Pattern](../diagrams/option5-state-machine.excalidraw)
