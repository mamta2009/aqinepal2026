import {
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  Home,
  Landmark,
  School,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";

export const knownResources = [
  {
    audience: "Families",
    title: "A family air and heat checklist",
    description:
      "Informational prompts families can discuss when outdoor conditions change.",
    href: "/guides/md/PARENT_AIR_QUALITY_CHECKLIST.md",
  },
  {
    audience: "Facilities",
    title: "School air and heat information guide",
    description:
      "Reference material for sites reviewing outdoor schedules and ventilation options.",
    href: "/guides/md/SCHOOL_AIR_QUALITY_ACTION_GUIDE.md",
  },
  {
    audience: "Learning",
    title: "A classroom lesson on clean air",
    description:
      "An optional Grades 6–8 lesson with discussion prompts and a group activity.",
    href: "/guides/md/TEACHER_CLEAN_AIR_LESSON.md",
  },
  {
    audience: "Learning",
    title: "Become an air detective",
    description:
      "An optional activity to observe surroundings and compare daily conditions.",
    href: "/guides/md/STUDENT_CLEAN_AIR_ACTIVITY.md",
  },
] as const;

export const audiencePages = {
  students: {
    eyebrow: "For students · Grades 6–8",
    title: "Become a clean-air detective",
    lede: "Learn how invisible pollution is measured, investigate the air around you, and help your community make cleaner choices.",
    icon: Search,
    accent: "bg-sky-soft",
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
      "Check the nearest city on the dashboard and record its status.",
      "Compare what you noticed with the AQI and PM2.5 reading.",
      "Choose one clean-air action and share it with your class.",
    ],
    resourceHref: "/guides/md/STUDENT_CLEAN_AIR_ACTIVITY.md",
    resourceLabel: "Open the student activity",
  },
  teachers: {
    eyebrow: "For teachers · Grades 6–8",
    title: "Make air science practical",
    lede: "Use local conditions to teach measurement, evidence, health awareness, and responsible community action.",
    icon: GraduationCap,
    accent: "bg-amber-50",
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
    resourceHref: "/guides/md/TEACHER_CLEAN_AIR_LESSON.md",
    resourceLabel: "Open the teacher lesson",
  },
  parents: {
    eyebrow: "For parents and caregivers",
    title: "Plan healthier everyday routines",
    lede: "Use a quick air and heat check to make informed choices about play, travel, windows, and sensitive children.",
    icon: Home,
    accent: "bg-rose-50",
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
    resourceHref: "/guides/md/PARENT_AIR_QUALITY_CHECKLIST.md",
    resourceLabel: "Open the family checklist",
  },
  schools: {
    eyebrow: "For schools",
    title: "Turn air information into a daily plan",
    lede: "Support staff decisions for assembly, recess, sports, transport, and classroom ventilation while following school policy.",
    icon: School,
    accent: "bg-emerald-50",
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
    resourceHref: "/guides/md/SCHOOL_AIR_QUALITY_ACTION_GUIDE.md",
    resourceLabel: "Open the school action guide",
  },
} as const;

export const audiencePathways = [
  {
    title: "School administrators and teachers",
    text: "Review local air and heat status and share clear information with staff and classrooms.",
    href: "/schools",
    icon: School,
  },
  {
    title: "Parents and guardians",
    text: "Check nearby air and heat conditions and register for alerts when you want updates.",
    href: "/parents",
    icon: HeartHandshake,
  },
  {
    title: "Government officials",
    text: "Track conditions across selected places and stay informed when air or heat worsens.",
    href: "/dashboard",
    icon: Landmark,
  },
  {
    title: "Health workers",
    text: "Monitor local air and heat, receive alerts, and log facility readiness actions.",
    href: "/registration",
    icon: Stethoscope,
  },
] as const;

export const processSteps = [
  {
    title: "Choose a place",
    text: "Select the city or area you care about — home, school, workplace, or nearby community.",
    icon: Users,
  },
  {
    title: "Read today’s status",
    text: "Start with the plain-language condition, then look at the AQI score and heat reading.",
    icon: ClipboardCheck,
  },
  {
    title: "Get notified",
    text: "Register for alerts so you hear when air or heat needs extra care.",
    icon: ShieldCheck,
  },
] as const;
