export type AudienceKey =
  | "students"
  | "teachers"
  | "parents"
  | "schools"
  | "government"
  | "healthWorkers";

export type AudiencePage = {
  key: AudienceKey;
  eyebrow: string;
  title: string;
  lede: string;
  accentClass: string;
  facts: { title: string; text: string }[];
  activityTitle: string;
  activitySteps: string[];
};

export const learnHubCards: {
  key: AudienceKey;
  audience: string;
  title: string;
  description: string;
}[] = [
  {
    key: "students",
    audience: "Students · Grades 6–8",
    title: "Become a clean-air detective",
    description:
      "Learn how invisible pollution is measured and help your community make cleaner choices.",
  },
  {
    key: "teachers",
    audience: "Teachers",
    title: "Make air science practical",
    description:
      "Use local conditions to teach measurement, evidence, and responsible community action.",
  },
  {
    key: "parents",
    audience: "Parents and caregivers",
    title: "Plan healthier everyday routines",
    description:
      "Use a quick air, heat, and rain check for play, travel, windows, and sensitive children.",
  },
  {
    key: "schools",
    audience: "Schools",
    title: "Turn air information into a daily plan",
    description:
      "Support staff decisions for assembly, recess, sports, and classroom ventilation.",
  },
  {
    key: "government",
    audience: "Government officials",
    title: "See climate conditions across places you serve",
    description:
      "Review air, heat, and rain status for major cities and stay informed when conditions change.",
  },
  {
    key: "healthWorkers",
    audience: "Health workers",
    title: "Monitor local climate conditions for facility readiness",
    description:
      "Check air, heat, and rain near your facility and use informational guidance alongside clinical judgement.",
  },
];

export const audiencePages: Record<AudienceKey, AudiencePage> = {
  students: {
    key: "students",
    eyebrow: "For students · Grades 6–8",
    title: "Become a clean-air detective",
    lede: "Learn how invisible pollution is measured, investigate the air around you, and help your community make cleaner choices.",
    accentClass: "bg-sky-soft",
    facts: [
      {
        title: "Air can look clean",
        text: "PM2.5 particles are too small to see. A clear sky does not always mean pollution is low.",
      },
      {
        title: "AQI is a shared scale",
        text: "The Air Quality Index turns measurements into colour bands that are easier to compare.",
      },
      {
        title: "Your body gives clues",
        text: "Coughing, wheezing, or unusual tiredness are signs to stop, tell an adult, and get help.",
      },
    ],
    activityTitle: "Try a 20-minute air investigation",
    activitySteps: [
      "Observe whether the sky is clear, hazy, smoky, or dusty.",
      "Check the nearest city on Home and record its status.",
      "Compare what you noticed with the air quality reading.",
      "Choose one clean-air action and share it with your class.",
    ],
  },
  teachers: {
    key: "teachers",
    eyebrow: "For teachers · Grades 6–8",
    title: "Make air science practical",
    lede: "Use local conditions to teach measurement, evidence, health awareness, and responsible community action.",
    accentClass: "bg-surface-tint",
    facts: [
      {
        title: "Start with a question",
        text: "Ask whether air can be polluted when it looks clean, then collect student ideas before explaining PM2.5.",
      },
      {
        title: "Read status before numbers",
        text: "Build confidence with plain-language guidance, then introduce AQI and pollutant measurements.",
      },
      {
        title: "Include every learner",
        text: "Discuss how children with asthma or other sensitivities may need different activity plans.",
      },
    ],
    activityTitle: "Run a 35–45 minute clean-air lesson",
    activitySteps: [
      "Warm up with the question: Can polluted air look clean?",
      "Explore the nearest city and compare student and school advice.",
      "Give groups assembly, sports, recess, bus, or ventilation scenarios.",
      "Ask each group to plan for Good, Moderate, and Unhealthy days.",
    ],
  },
  parents: {
    key: "parents",
    eyebrow: "For parents and caregivers",
    title: "Plan healthier everyday routines",
    lede: "Use a quick air, heat, and rain check to make informed choices about play, travel, windows, and sensitive children.",
    accentClass: "bg-sky-soft",
    facts: [
      {
        title: "Check before outdoor play",
        text: "Read the nearest city's plain-language status and consider nearby smoke, dust, traffic, and heat.",
      },
      {
        title: "Adjust, do not alarm",
        text: "On poorer-air days, gentler activity, shorter sessions, and more breaks can reduce exposure.",
      },
      {
        title: "Know when to seek help",
        text: "Follow a child's health plan and seek medical help for breathing difficulty or serious symptoms.",
      },
    ],
    activityTitle: "Use a simple family check",
    activitySteps: [
      "Check air quality and heat before children go outside.",
      "Read advice for parents and children who may be sensitive.",
      "Keep prescribed medicine available and watch for symptoms.",
      "Recheck conditions if smoke, dust, weather, or heat changes.",
    ],
  },
  schools: {
    key: "schools",
    eyebrow: "For schools",
    title: "Turn air information into a daily plan",
    lede: "Support staff decisions for assembly, recess, sports, transport, and classroom ventilation while following school policy.",
    accentClass: "bg-surface-tint",
    facts: [
      {
        title: "Assign a daily checker",
        text: "Choose a staff member to review conditions before outdoor activities and again if conditions change.",
      },
      {
        title: "Plan by activity",
        text: "Assembly, strenuous sports, quiet recess, and bus queues involve different effort and exposure.",
      },
      {
        title: "Protect sensitive students",
        text: "Keep individual health plans available and ensure staff know who may need extra support.",
      },
    ],
    activityTitle: "Build a school response routine",
    activitySteps: [
      "Record the nearest city's air and heat status each morning.",
      "Share decisions for assembly, sports, recess, and transport.",
      "Review support for students with individual health plans.",
      "Follow official instructions and recheck when conditions change.",
    ],
  },
  government: {
    key: "government",
    eyebrow: "For government officials",
    title: "See climate conditions across places you serve",
    lede: "Use Climate Compass to review air, heat, and rain status for major cities and stay informed when conditions change — without replacing official monitoring or emergency systems.",
    accentClass: "bg-sky-soft",
    facts: [
      {
        title: "One shared status view",
        text: "Start with plain-language band and AQI score so teams compare places with the same vocabulary.",
      },
      {
        title: "Air, heat, and rain together",
        text: "Hot days, wet weather, and poor air often need attention at the same time.",
      },
      {
        title: "Information, not decree",
        text: "Climate Compass is a decision-support product. Formal instructions still come from your organisation and competent authorities.",
      },
    ],
    activityTitle: "Build a simple situational routine",
    activitySteps: [
      "Open Home and note status for priority cities.",
      "Record the plain-language band, AQI score, heat, and rain reading.",
      "Share the summary with the coordination channel your office already uses.",
      "Register for alerts if you want updates when air or heat needs extra care.",
    ],
  },
  healthWorkers: {
    key: "healthWorkers",
    eyebrow: "For health workers",
    title: "Monitor local climate conditions for facility readiness",
    lede: "Check air, heat, and rain near your facility, register for alerts, and use informational guidance alongside clinical judgement and local health authority instructions.",
    accentClass: "bg-sky-soft",
    facts: [
      {
        title: "Know the neighbourhood reading",
        text: "A quick status check helps staff understand outdoor conditions before community outreach or outdoor clinic activity.",
      },
      {
        title: "Alerts when things change",
        text: "Registration can notify your team when air or heat moves into bands that need extra attention.",
      },
      {
        title: "Support, not a diagnosis tool",
        text: "Climate Compass does not replace clinical assessment, triage protocols, or official public-health orders.",
      },
    ],
    activityTitle: "Set up a facility information habit",
    activitySteps: [
      "Check the nearest city status on Home before outdoor or community activities.",
      "Note the plain-language band, AQI score, heat, and rain reading for the staff board or handover.",
      "Register the facility contact channels you already use for alerts.",
      "Review readiness actions with colleagues and follow official health guidance when acting.",
    ],
  },
};

export const airBasicsTips = [
  {
    title: "Why outdoor conditions matter",
    text: "Air, heat, and rain can affect breathing, outdoor play, and school activity plans even when the sky looks clear.",
  },
  {
    title: "Read status before numbers",
    text: "Start with Good, Moderate, Use extra care, or Unhealthy. Numbers like PM2.5 and AQI support that story.",
  },
  {
    title: "Adjust, do not alarm",
    text: "Climate Compass helps you plan safer routines. It does not replace official advice or emergency alerts.",
  },
];

/** Matches website home `AirBasics` measurement glossary. */
export const measurementTerms = [
  {
    term: "AQI",
    explanation:
      "A simple air-quality score (often from 0 toward 500). Use this number and its colour band first — lower is generally cleaner.",
  },
  {
    term: "PM2.5",
    explanation:
      "Fine particle pollution measured in micrograms. Optional detail behind the AQI score for people who want more context.",
  },
  {
    term: "Heat index",
    explanation:
      "A way to understand how hot the weather feels, not only the temperature on a thermometer.",
  },
] as const;

/** Matches website home colour-band guide. */
export const colourGuideStatuses = [
  {
    title: "Good",
    text: "Most people can continue normal outdoor activity.",
    chipClass: "bg-aq-good/15",
    textClass: "text-aq-good",
  },
  {
    title: "Moderate",
    text: "Sensitive people may need more breaks outdoors.",
    chipClass: "bg-aq-moderate/15",
    textClass: "text-aq-moderate",
  },
  {
    title: "Use extra care",
    text: "Consider shorter or gentler outdoor activity.",
    chipClass: "bg-aq-sensitive/15",
    textClass: "text-aq-sensitive",
  },
  {
    title: "Unhealthy",
    text: "Limit strenuous outdoor activity where possible.",
    chipClass: "bg-aq-unhealthy/15",
    textClass: "text-aq-unhealthy",
  },
] as const;

/** Educational markdown guides shown on the website Guides hub. */
export const educationalGuidePaths = [
  "STUDENT_CLEAN_AIR_ACTIVITY.md",
  "TEACHER_CLEAN_AIR_LESSON.md",
  "PARENT_AIR_QUALITY_CHECKLIST.md",
  "SCHOOL_AIR_QUALITY_ACTION_GUIDE.md",
] as const;

export const audienceGuidePath: Partial<Record<AudienceKey, string>> = {
  students: "STUDENT_CLEAN_AIR_ACTIVITY.md",
  teachers: "TEACHER_CLEAN_AIR_LESSON.md",
  parents: "PARENT_AIR_QUALITY_CHECKLIST.md",
  schools: "SCHOOL_AIR_QUALITY_ACTION_GUIDE.md",
};

export const howItWorksSteps = [
  {
    title: "Choose a place",
    text: "Select the city or area you care about — home, school, workplace, or nearby community.",
  },
  {
    title: "Read today’s status",
    text: "Start with the plain-language condition, then look at the air, heat, and rain readings.",
  },
  {
    title: "Get notified",
    text: "Register for alerts so you hear when air or heat needs extra care.",
  },
];
