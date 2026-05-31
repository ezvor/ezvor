export type OppCategory =
  | "Open Source"
  | "Competitive Programming"
  | "Hackathons"
  | "Internships"
  | "Scholarships"
  | "Fellowships"
  | "Bootcamps";

export type OppStatus = "Open" | "Closed" | "Upcoming" | "Rolling";
export type OppRegion = "Global" | "Pakistan";

export interface Opportunity {
  id: string;
  title: string;
  org: string;
  category: OppCategory;
  field: string;
  blurb: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  timing: string;
  eligibility: string;
  url: string;
  tags: string[];
  stipend?: string;
  /** Current application status (curated baseline; can be refreshed live). */
  status?: OppStatus;
  /** Region focus — used for the Pakistan filter. */
  region?: OppRegion;
  /** Short note shown next to status, e.g. "Has unpaid project tracks". */
  statusNote?: string;
}

export const CATEGORIES: OppCategory[] = [
  "Open Source",
  "Competitive Programming",
  "Hackathons",
  "Internships",
  "Scholarships",
  "Fellowships",
  "Bootcamps",
];

export const OPPORTUNITIES: Opportunity[] = [
  {
    id: "gsoc",
    title: "Google Summer of Code (GSoC)",
    org: "Google",
    category: "Open Source",
    field: "Software / Open Source",
    blurb:
      "Global program where contributors spend a summer writing code for open-source organizations under mentorship.",
    difficulty: "Intermediate",
    timing: "Applications: Mar–Apr • Coding: May–Aug",
    eligibility: "18+ open-source newcomers (students & non-students)",
    url: "https://summerofcode.withgoogle.com/",
    tags: ["mentorship", "remote", "global"],
    stipend: "$750–$3300",
    status: "Closed",
    region: "Global",
    statusNote: "2025 applications closed — next cycle opens Mar 2026",
  },
  {
    id: "lfx",
    title: "LFX Mentorship",
    org: "Linux Foundation",
    category: "Open Source",
    field: "Software / Cloud Native",
    blurb:
      "Paid remote mentorships across CNCF and Linux Foundation projects like Kubernetes, Envoy, and Prometheus.",
    difficulty: "Intermediate",
    timing: "3 cohorts per year (Spring/Summer/Fall)",
    eligibility: "Anyone 18+, beginner-friendly tracks available",
    url: "https://lfx.linuxfoundation.org/tools/mentorship/",
    tags: ["paid", "cloud-native", "remote"],
    stipend: "$0–$6600",
    status: "Rolling",
    region: "Global",
    statusNote: "Mix of paid & unpaid tracks — many projects are unpaid",
  },
  {
    id: "outreachy",
    title: "Outreachy",
    org: "Software Freedom Conservancy",
    category: "Open Source",
    field: "Software / Open Source",
    blurb:
      "Paid, remote internships in open source for people subject to under-representation in tech.",
    difficulty: "Beginner",
    timing: "May–Aug & Dec–Mar cohorts",
    eligibility: "Underrepresented groups in tech, 18+",
    url: "https://www.outreachy.org/",
    tags: ["paid", "inclusive", "remote"],
    stipend: "$7000",
  },
  {
    id: "mlh-fellowship",
    title: "MLH Fellowship",
    org: "Major League Hacking",
    category: "Open Source",
    field: "Software Engineering",
    blurb:
      "12-week remote program building real projects in a pod with peers and mentors — like an internship alternative.",
    difficulty: "Beginner",
    timing: "Summer, Fall & Spring batches",
    eligibility: "Students & early-career developers",
    url: "https://fellowship.mlh.io/",
    tags: ["cohort", "remote", "portfolio"],
  },
  {
    id: "summer-of-bitcoin",
    title: "Summer of Bitcoin (SoB)",
    org: "Summer of Bitcoin",
    category: "Open Source",
    field: "Blockchain / Bitcoin",
    blurb:
      "Global summer internship introducing students to Bitcoin open-source development with mentorship and stipend.",
    difficulty: "Intermediate",
    timing: "Applications: Feb–Mar • Program: Jun–Aug",
    eligibility: "University students worldwide",
    url: "https://www.summerofbitcoin.org/",
    tags: ["bitcoin", "mentorship", "stipend"],
    stipend: "$3000–$5000",
    status: "Closed",
    region: "Global",
    statusNote: "2025 cohort closed — applications typically reopen Feb",
  },
  {
    id: "hacktoberfest",
    title: "Hacktoberfest",
    org: "DigitalOcean",
    category: "Open Source",
    field: "Open Source",
    blurb:
      "Month-long celebration of open source — make quality PRs to earn rewards and learn collaboration.",
    difficulty: "Beginner",
    timing: "Every October",
    eligibility: "Open to everyone",
    url: "https://hacktoberfest.com/",
    tags: ["beginner-friendly", "swag", "global"],
  },
  {
    id: "season-of-docs",
    title: "Google Season of Docs",
    org: "Google",
    category: "Open Source",
    field: "Technical Writing",
    blurb:
      "Connects technical writers with open-source projects to improve documentation.",
    difficulty: "Intermediate",
    timing: "Mid-year",
    eligibility: "Technical writers, open-source orgs",
    url: "https://developers.google.com/season-of-docs",
    tags: ["docs", "writing", "remote"],
  },
  {
    id: "icpc",
    title: "ICPC World Finals",
    org: "ICPC Foundation",
    category: "Competitive Programming",
    field: "Algorithms",
    blurb:
      "The most prestigious algorithmic team programming contest for university students worldwide.",
    difficulty: "Advanced",
    timing: "Regionals: Oct–Dec • Finals: Spring",
    eligibility: "University teams of 3",
    url: "https://icpc.global/",
    tags: ["team", "algorithms", "prestige"],
  },
  {
    id: "meta-hacker-cup",
    title: "Meta Hacker Cup",
    org: "Meta",
    category: "Competitive Programming",
    field: "Algorithms",
    blurb:
      "Meta's annual open algorithmic programming contest with global online rounds and a finals.",
    difficulty: "Advanced",
    timing: "Qualification rounds in autumn",
    eligibility: "Open to everyone 18+",
    url: "https://www.facebook.com/codingcompetitions/hacker-cup",
    tags: ["algorithms", "global", "online"],
  },
  {
    id: "codeforces",
    title: "Codeforces Rounds",
    org: "Codeforces",
    category: "Competitive Programming",
    field: "Algorithms",
    blurb:
      "Frequent rated contests to sharpen problem-solving and climb the global competitive-programming ladder.",
    difficulty: "Intermediate",
    timing: "Weekly rounds year-round",
    eligibility: "Open to everyone",
    url: "https://codeforces.com/",
    tags: ["practice", "rating", "weekly"],
  },
  {
    id: "ethglobal",
    title: "ETHGlobal Hackathons",
    org: "ETHGlobal",
    category: "Hackathons",
    field: "Web3 / Blockchain",
    blurb:
      "Premier global hackathon series for building decentralized apps with large prize pools.",
    difficulty: "Intermediate",
    timing: "Multiple events year-round",
    eligibility: "Builders worldwide",
    url: "https://ethglobal.com/",
    tags: ["web3", "prizes", "global"],
  },
  {
    id: "nasa-space-apps",
    title: "NASA Space Apps Challenge",
    org: "NASA",
    category: "Hackathons",
    field: "Data / Space Tech",
    blurb:
      "World's largest annual hackathon solving real challenges with open NASA data.",
    difficulty: "Beginner",
    timing: "Every October",
    eligibility: "Open to all ages and backgrounds",
    url: "https://www.spaceappschallenge.org/",
    tags: ["data", "global", "impact"],
  },
  {
    id: "smart-india-hackathon",
    title: "Smart India Hackathon",
    org: "Government of India",
    category: "Hackathons",
    field: "Software / Hardware",
    blurb:
      "Nationwide initiative providing students a platform to solve pressing problems with cash prizes.",
    difficulty: "Intermediate",
    timing: "Annual (winter)",
    eligibility: "Indian college students (teams)",
    url: "https://www.sih.gov.in/",
    tags: ["india", "prizes", "team"],
  },
  {
    id: "google-step",
    title: "Google STEP Internship",
    org: "Google",
    category: "Internships",
    field: "Software Engineering",
    blurb:
      "Paid summer software-engineering internship for first- and second-year undergraduates.",
    difficulty: "Intermediate",
    timing: "Applications: Sep–Oct • Summer role",
    eligibility: "1st/2nd-year undergrad students",
    url: "https://buildyourfuture.withgoogle.com/programs/step",
    tags: ["paid", "early-career", "onsite"],
    stipend: "Competitive",
  },
  {
    id: "microsoft-explore",
    title: "Microsoft Explore Internship",
    org: "Microsoft",
    category: "Internships",
    field: "Software / Product",
    blurb:
      "12-week summer internship for first/second-year students rotating through SWE and PM.",
    difficulty: "Intermediate",
    timing: "Applications: autumn • Summer role",
    eligibility: "1st/2nd-year undergrad students",
    url: "https://careers.microsoft.com/students/",
    tags: ["paid", "rotational", "early-career"],
    stipend: "Competitive",
  },
  {
    id: "meta-university",
    title: "Meta University",
    org: "Meta",
    category: "Internships",
    field: "Engineering / Analytics",
    blurb:
      "Paid hands-on internship for students from underrepresented communities to build real products.",
    difficulty: "Intermediate",
    timing: "Summer",
    eligibility: "Rising juniors, underrepresented groups",
    url: "https://www.metacareers.com/careerprograms/students",
    tags: ["paid", "inclusive", "mentorship"],
    stipend: "Competitive",
  },
  {
    id: "grace-hopper-scholarship",
    title: "Grace Hopper Celebration Scholarship",
    org: "AnitaB.org",
    category: "Scholarships",
    field: "Women in Tech",
    blurb:
      "Scholarships to attend the world's largest gathering of women and non-binary technologists.",
    difficulty: "Beginner",
    timing: "Applications in spring",
    eligibility: "Women & non-binary students in tech",
    url: "https://ghc.anitab.org/",
    tags: ["women-in-tech", "conference", "network"],
  },
  {
    id: "github-fund",
    title: "GitHub Education Scholarships",
    org: "GitHub",
    category: "Scholarships",
    field: "Software / Open Source",
    blurb:
      "Free developer tools, learning resources, and program access for verified students.",
    difficulty: "Beginner",
    timing: "Rolling",
    eligibility: "Verified students worldwide",
    url: "https://education.github.com/",
    tags: ["tools", "students", "free"],
  },
  {
    id: "z-fellows",
    title: "Z Fellows",
    org: "Z Fellows",
    category: "Fellowships",
    field: "Founders / Builders",
    blurb:
      "1-week fellowship + small investment connecting ambitious builders with top mentors.",
    difficulty: "Advanced",
    timing: "Rolling cohorts",
    eligibility: "Builders & aspiring founders",
    url: "https://www.zfellows.com/",
    tags: ["startup", "investment", "network"],
    stipend: "$10000",
  },
  {
    id: "kleiner-perkins",
    title: "KP Fellows",
    org: "Kleiner Perkins",
    category: "Fellowships",
    field: "Engineering / Product / Design",
    blurb:
      "Selective summer fellowship placing top students at leading venture-backed startups.",
    difficulty: "Advanced",
    timing: "Applications: autumn • Summer role",
    eligibility: "Undergrad & grad students",
    url: "https://fellows.kleinerperkins.com/",
    tags: ["startup", "elite", "network"],
  },
  {
    id: "github-campus-expert",
    title: "GitHub Campus Experts",
    org: "GitHub",
    category: "Fellowships",
    field: "Community / Leadership",
    blurb:
      "Training program empowering students to build tech communities on their campuses.",
    difficulty: "Beginner",
    timing: "Rolling applications",
    eligibility: "Students 18+ active in communities",
    url: "https://education.github.com/experts",
    tags: ["leadership", "community", "training"],
  },

  // ───────────────────────── Pakistan-focused ─────────────────────────
  {
    id: "bytewise-fellowship",
    title: "Bytewise Fellowship",
    org: "Bytewise Limited",
    category: "Fellowships",
    field: "Software / Data / Web",
    blurb:
      "Free 3-month remote fellowship for Pakistani students — structured tracks in MERN, Python, Data Science, Flutter, and more with mentor support.",
    difficulty: "Beginner",
    timing: "Cohorts announced ~once a year",
    eligibility: "Pakistani students & fresh graduates",
    url: "https://www.bytewise.com.pk/",
    tags: ["pakistan", "remote", "mentorship", "free"],
    status: "Upcoming",
    region: "Pakistan",
    statusNote: "Watch their LinkedIn for the next cohort",
  },
  {
    id: "digiskills",
    title: "DigiSkills.pk",
    org: "Govt. of Pakistan / VU",
    category: "Bootcamps",
    field: "Freelancing / Digital Skills",
    blurb:
      "Government-funded free online training in freelancing, web/mobile development, data analytics, digital marketing and more — with certificates.",
    difficulty: "Beginner",
    timing: "Rolling batches year-round",
    eligibility: "Pakistani nationals (free registration)",
    url: "https://digiskills.pk/",
    tags: ["pakistan", "free", "certificate", "freelancing"],
    status: "Open",
    region: "Pakistan",
  },
  {
    id: "atomcamp",
    title: "atomcamp Data Science Bootcamp",
    org: "atomcamp",
    category: "Bootcamps",
    field: "Data Science / AI",
    blurb:
      "Pakistan-based intensive bootcamps in Data Science, Data Analytics and AI with hands-on projects and job-prep support.",
    difficulty: "Intermediate",
    timing: "Multiple cohorts per year",
    eligibility: "Students & professionals in Pakistan",
    url: "https://atomcamp.com/",
    tags: ["pakistan", "data-science", "cohort"],
    status: "Open",
    region: "Pakistan",
  },
  {
    id: "10pearls-shine",
    title: "10Pearls Shine Internship",
    org: "10Pearls",
    category: "Internships",
    field: "Software Engineering",
    blurb:
      "Paid internship & training program at one of Pakistan's leading software houses, spanning engineering, QA, design and data.",
    difficulty: "Intermediate",
    timing: "Summer & rolling intakes",
    eligibility: "Pakistani undergrads & fresh grads",
    url: "https://10pearls.com/shine/",
    tags: ["pakistan", "paid", "industry"],
    status: "Upcoming",
    region: "Pakistan",
    stipend: "Paid",
  },
  {
    id: "arbisoft-internship",
    title: "Arbisoft Internship",
    org: "Arbisoft",
    category: "Internships",
    field: "Software / Data / ML",
    blurb:
      "Competitive paid internships at a top Lahore-based product & services company working with global clients like Edx and Quizlet.",
    difficulty: "Intermediate",
    timing: "Summer intake",
    eligibility: "Pakistani students (strong fundamentals)",
    url: "https://arbisoft.com/careers",
    tags: ["pakistan", "paid", "product"],
    status: "Upcoming",
    region: "Pakistan",
    stipend: "Paid",
  },
  {
    id: "gdgoc",
    title: "Google Developer Groups on Campus (GDGoC)",
    org: "Google",
    category: "Fellowships",
    field: "Community / All Domains",
    blurb:
      "Campus chapters across Pakistani universities running workshops, study jams and hackathons — a launchpad for leadership and networking.",
    difficulty: "Beginner",
    timing: "Lead applications mid-year; events year-round",
    eligibility: "University students in Pakistan",
    url: "https://developers.google.com/community/gdg",
    tags: ["pakistan", "community", "leadership"],
    status: "Open",
    region: "Pakistan",
  },
  {
    id: "nascon",
    title: "NaSCon (FAST-NUCES)",
    org: "FAST-NUCES Islamabad",
    category: "Hackathons",
    field: "Software / Tech Olympiad",
    blurb:
      "One of Pakistan's largest student tech & science conventions — competitive programming, hackathons, gaming and more.",
    difficulty: "Intermediate",
    timing: "Annual (spring)",
    eligibility: "Students across Pakistan",
    url: "https://nascon.pk/",
    tags: ["pakistan", "competition", "networking"],
    status: "Upcoming",
    region: "Pakistan",
  },
  {
    id: "softec",
    title: "SOFTEC",
    org: "FAST-NUCES Lahore",
    category: "Hackathons",
    field: "Software / Tech Competitions",
    blurb:
      "Flagship international tech event with software competitions, speed programming, app design and a job fair.",
    difficulty: "Intermediate",
    timing: "Annual",
    eligibility: "Students across Pakistan & abroad",
    url: "https://softec.org.pk/",
    tags: ["pakistan", "competition", "job-fair"],
    status: "Upcoming",
    region: "Pakistan",
  },
  {
    id: "hec-scholarships",
    title: "HEC Scholarships",
    org: "Higher Education Commission",
    category: "Scholarships",
    field: "Higher Education",
    blurb:
      "National & international scholarships for Pakistani students — need-based, merit and overseas PhD/MS funding.",
    difficulty: "Beginner",
    timing: "Various deadlines year-round",
    eligibility: "Pakistani students (varies by program)",
    url: "https://www.hec.gov.pk/english/scholarshipsgrants/Pages/default.aspx",
    tags: ["pakistan", "funding", "education"],
    status: "Open",
    region: "Pakistan",
  },

  // ───────────────────────── More domains (global) ─────────────────────────
  {
    id: "headstarter",
    title: "Headstarter Fellowship",
    org: "Headstarter AI",
    category: "Fellowships",
    field: "AI / Software Engineering",
    blurb:
      "7-week remote fellowship building 5 AI projects with mentorship from engineers at Google, Amazon and Meta.",
    difficulty: "Intermediate",
    timing: "Multiple cohorts per year",
    eligibility: "Students & early-career devs worldwide",
    url: "https://headstarter.co/",
    tags: ["ai", "remote", "projects"],
    status: "Open",
    region: "Global",
  },
  {
    id: "datacamp-donates",
    title: "DataCamp Donates",
    org: "DataCamp",
    category: "Scholarships",
    field: "Data Science / Analytics",
    blurb:
      "Free access to DataCamp's full data science, analytics and engineering curriculum for eligible learners via nonprofits.",
    difficulty: "Beginner",
    timing: "Rolling",
    eligibility: "Learners via partner nonprofits",
    url: "https://www.datacamp.com/donates",
    tags: ["data-science", "free", "courses"],
    status: "Open",
    region: "Global",
  },
  {
    id: "kaggle-competitions",
    title: "Kaggle Competitions",
    org: "Kaggle (Google)",
    category: "Competitive Programming",
    field: "Data Science / ML",
    blurb:
      "Real-world ML competitions with prizes and a path to Kaggle ranks — the best way to build a data science portfolio.",
    difficulty: "Intermediate",
    timing: "New competitions year-round",
    eligibility: "Open to everyone",
    url: "https://www.kaggle.com/competitions",
    tags: ["data-science", "ml", "portfolio"],
    status: "Open",
    region: "Global",
  },
  {
    id: "aws-cloud-club",
    title: "AWS Cloud Clubs & Certs",
    org: "Amazon Web Services",
    category: "Bootcamps",
    field: "Cloud / DevOps",
    blurb:
      "Student-led cloud clubs plus free learning paths toward AWS certifications — ideal for Cloud, DevOps and Data Architect tracks.",
    difficulty: "Beginner",
    timing: "Rolling",
    eligibility: "Students worldwide",
    url: "https://aws.amazon.com/training/awsacademy/",
    tags: ["cloud", "devops", "certification"],
    status: "Open",
    region: "Global",
  },
];

export interface RoadmapStage {
  title: string;
  items: string[];
}

export interface Roadmap {
  id: string;
  role: string;
  icon: string;
  summary: string;
  duration: string;
  stages: RoadmapStage[];
}

export const ROADMAPS: Roadmap[] = [
  {
    id: "frontend",
    role: "Frontend Developer",
    icon: "Layout",
    summary: "Build modern, accessible, performant user interfaces.",
    duration: "4–6 months",
    stages: [
      { title: "Foundations", items: ["HTML semantics", "CSS & Flexbox/Grid", "JavaScript ES6+", "Git & GitHub"] },
      { title: "Core", items: ["React fundamentals", "State management", "TypeScript", "Responsive design"] },
      { title: "Tooling", items: ["Vite/Webpack", "Testing (Vitest/RTL)", "REST & GraphQL", "Accessibility"] },
      { title: "Advanced", items: ["Performance optimization", "SSR frameworks", "Design systems", "CI/CD basics"] },
    ],
  },
  {
    id: "backend",
    role: "Backend Developer",
    icon: "Server",
    summary: "Design APIs, databases, and scalable server systems.",
    duration: "5–7 months",
    stages: [
      { title: "Foundations", items: ["A language (Node/Go/Python)", "Data structures", "Git", "Linux & CLI"] },
      { title: "Core", items: ["REST API design", "SQL databases", "Authentication", "ORMs"] },
      { title: "Systems", items: ["Caching (Redis)", "Message queues", "Docker", "Testing"] },
      { title: "Advanced", items: ["System design", "Microservices", "Observability", "Cloud deployment"] },
    ],
  },
  {
    id: "data-scientist",
    role: "Data Scientist",
    icon: "BarChart3",
    summary: "Turn data into insights and predictive models.",
    duration: "6–9 months",
    stages: [
      { title: "Foundations", items: ["Python", "Statistics & probability", "Pandas & NumPy", "SQL"] },
      { title: "Core", items: ["Data visualization", "EDA", "Scikit-learn", "Feature engineering"] },
      { title: "Modeling", items: ["Regression & classification", "Model evaluation", "Time series", "NLP basics"] },
      { title: "Advanced", items: ["Deep learning", "MLOps basics", "A/B testing", "Storytelling with data"] },
    ],
  },
  {
    id: "ml-engineer",
    role: "ML Engineer",
    icon: "BrainCircuit",
    summary: "Ship machine-learning systems to production.",
    duration: "8–12 months",
    stages: [
      { title: "Foundations", items: ["Python & math", "Linear algebra", "Probability", "DSA"] },
      { title: "ML Core", items: ["Supervised learning", "Neural networks", "PyTorch/TensorFlow", "Evaluation"] },
      { title: "Engineering", items: ["Data pipelines", "Model serving", "Docker & APIs", "Experiment tracking"] },
      { title: "Advanced", items: ["LLMs & transformers", "MLOps & monitoring", "Distributed training", "Scaling"] },
    ],
  },
  {
    id: "devops",
    role: "DevOps / Cloud Engineer",
    icon: "Cloud",
    summary: "Automate, deploy, and operate reliable infrastructure.",
    duration: "6–9 months",
    stages: [
      { title: "Foundations", items: ["Linux & networking", "Bash scripting", "Git", "A programming language"] },
      { title: "Core", items: ["Docker", "CI/CD pipelines", "Cloud (AWS/GCP)", "Infrastructure as Code"] },
      { title: "Orchestration", items: ["Kubernetes", "Monitoring & logging", "Terraform", "Secrets management"] },
      { title: "Advanced", items: ["Site reliability", "Security & DevSecOps", "Cost optimization", "Service mesh"] },
    ],
  },
  {
    id: "cybersecurity",
    role: "Cybersecurity Analyst",
    icon: "ShieldCheck",
    summary: "Defend systems and hunt for vulnerabilities.",
    duration: "6–10 months",
    stages: [
      { title: "Foundations", items: ["Networking", "Operating systems", "Linux", "Security basics"] },
      { title: "Core", items: ["Cryptography", "Web security (OWASP)", "Scripting (Python)", "Threat modeling"] },
      { title: "Offense/Defense", items: ["Penetration testing", "SIEM tools", "Incident response", "Forensics"] },
      { title: "Advanced", items: ["Cloud security", "Red/Blue teaming", "Certifications", "Compliance"] },
    ],
  },
  {
    id: "open-source",
    role: "Open Source Contributor",
    icon: "GitBranch",
    summary: "Break into open source and win mentorships like GSoC & LFX.",
    duration: "3–5 months",
    stages: [
      { title: "Get Ready", items: ["Master Git & GitHub", "Pick a language", "Read CONTRIBUTING docs", "Set up dev env"] },
      { title: "First Steps", items: ["Find good-first-issues", "Fix docs/tests", "Open quality PRs", "Engage in community"] },
      { title: "Grow", items: ["Take larger issues", "Review others' PRs", "Join project chats", "Build reputation"] },
      { title: "Programs", items: ["Apply to GSoC/LFX", "Write strong proposals", "Outreachy/SoB", "Become a maintainer"] },
    ],
  },
  {
    id: "competitive-programmer",
    role: "Competitive Programmer",
    icon: "Trophy",
    summary: "Sharpen algorithms to crack ICPC and Meta Hacker Cup.",
    duration: "6–12 months",
    stages: [
      { title: "Basics", items: ["A language (C++/Java)", "Time complexity", "Arrays & strings", "Sorting & searching"] },
      { title: "Core DSA", items: ["Recursion", "Stacks/queues", "Trees & graphs", "Hashing"] },
      { title: "Algorithms", items: ["Dynamic programming", "Greedy", "Graph algorithms", "Number theory"] },
      { title: "Contest Mode", items: ["Codeforces rounds", "Virtual contests", "Upsolving", "ICPC team practice"] },
    ],
  },
];

export interface Resource {
  id: string;
  title: string;
  provider: string;
  topic: string;
  type: "Course" | "Practice" | "Docs" | "Roadmap" | "Community" | "Video";
  free: boolean;
  url: string;
}

export const RESOURCES: Resource[] = [
  { id: "freecodecamp", title: "freeCodeCamp", provider: "freeCodeCamp", topic: "Web Development", type: "Course", free: true, url: "https://www.freecodecamp.org/" },
  { id: "cs50", title: "CS50: Intro to Computer Science", provider: "Harvard", topic: "Computer Science", type: "Course", free: true, url: "https://cs50.harvard.edu/x/" },
  { id: "roadmapsh", title: "Developer Roadmaps", provider: "roadmap.sh", topic: "Career Paths", type: "Roadmap", free: true, url: "https://roadmap.sh/" },
  { id: "leetcode", title: "LeetCode", provider: "LeetCode", topic: "DSA / Interviews", type: "Practice", free: true, url: "https://leetcode.com/" },
  { id: "neetcode", title: "NeetCode 150", provider: "NeetCode", topic: "DSA / Interviews", type: "Practice", free: true, url: "https://neetcode.io/" },
  { id: "cp-algorithms", title: "CP-Algorithms", provider: "CP-Algorithms", topic: "Competitive Programming", type: "Docs", free: true, url: "https://cp-algorithms.com/" },
  { id: "mdn", title: "MDN Web Docs", provider: "Mozilla", topic: "Web Development", type: "Docs", free: true, url: "https://developer.mozilla.org/" },
  { id: "kaggle", title: "Kaggle Learn", provider: "Kaggle", topic: "Data Science / ML", type: "Course", free: true, url: "https://www.kaggle.com/learn" },
  { id: "fastai", title: "Practical Deep Learning", provider: "fast.ai", topic: "Machine Learning", type: "Course", free: true, url: "https://course.fast.ai/" },
  { id: "fullstackopen", title: "Full Stack Open", provider: "University of Helsinki", topic: "Full Stack", type: "Course", free: true, url: "https://fullstackopen.com/" },
  { id: "firstcontributions", title: "First Contributions", provider: "Open Source", topic: "Open Source", type: "Community", free: true, url: "https://firstcontributions.github.io/" },
  { id: "tryhackme", title: "TryHackMe", provider: "TryHackMe", topic: "Cybersecurity", type: "Practice", free: true, url: "https://tryhackme.com/" },
  { id: "theodinproject", title: "The Odin Project", provider: "The Odin Project", topic: "Full Stack", type: "Course", free: true, url: "https://www.theodinproject.com/" },
  { id: "missing-semester", title: "The Missing Semester", provider: "MIT", topic: "Dev Tools", type: "Course", free: true, url: "https://missing.csail.mit.edu/" },

  // ───────────────────── Free YouTube channels & playlists ─────────────────────
  { id: "yt-freecodecamp", title: "freeCodeCamp.org (full courses)", provider: "YouTube · freeCodeCamp", topic: "Web Development", type: "Video", free: true, url: "https://www.youtube.com/@freecodecamp" },
  { id: "yt-codewithharry", title: "CodeWithHarry (Web, Python, DSA)", provider: "YouTube · CodeWithHarry", topic: "Full Stack", type: "Video", free: true, url: "https://www.youtube.com/@CodeWithHarry" },
  { id: "yt-apnacollege", title: "Apna College (DSA + Dev)", provider: "YouTube · Apna College", topic: "DSA / Interviews", type: "Video", free: true, url: "https://www.youtube.com/@ApnaCollegeOfficial" },
  { id: "yt-neetcode", title: "NeetCode (LeetCode patterns)", provider: "YouTube · NeetCode", topic: "DSA / Interviews", type: "Video", free: true, url: "https://www.youtube.com/@NeetCode" },
  { id: "yt-abdulbari", title: "Abdul Bari (Algorithms)", provider: "YouTube · Abdul Bari", topic: "Competitive Programming", type: "Video", free: true, url: "https://www.youtube.com/@abdul_bari" },
  { id: "yt-mosh", title: "Programming with Mosh", provider: "YouTube · Mosh", topic: "Software Engineering", type: "Video", free: true, url: "https://www.youtube.com/@programmingwithmosh" },
  { id: "yt-netninja", title: "The Net Ninja (Frontend)", provider: "YouTube · Net Ninja", topic: "Web Development", type: "Video", free: true, url: "https://www.youtube.com/@NetNinja" },
  { id: "yt-fireship", title: "Fireship (quick deep-dives)", provider: "YouTube · Fireship", topic: "Software Engineering", type: "Video", free: true, url: "https://www.youtube.com/@Fireship" },
  { id: "yt-coreyschafer", title: "Corey Schafer (Python)", provider: "YouTube · Corey Schafer", topic: "Data Science / ML", type: "Video", free: true, url: "https://www.youtube.com/@coreyms" },
  { id: "yt-krishnaik", title: "Krish Naik (Data Science & ML)", provider: "YouTube · Krish Naik", topic: "Data Science / ML", type: "Video", free: true, url: "https://www.youtube.com/@krishnaik06" },
  { id: "yt-statquest", title: "StatQuest (ML & Stats)", provider: "YouTube · StatQuest", topic: "Machine Learning", type: "Video", free: true, url: "https://www.youtube.com/@statquest" },
  { id: "yt-nana", title: "TechWorld with Nana (DevOps)", provider: "YouTube · Nana", topic: "DevOps / Cloud", type: "Video", free: true, url: "https://www.youtube.com/@TechWorldwithNana" },
  { id: "yt-networkchuck", title: "NetworkChuck (Cloud & Networking)", provider: "YouTube · NetworkChuck", topic: "DevOps / Cloud", type: "Video", free: true, url: "https://www.youtube.com/@NetworkChuck" },
  { id: "yt-alextheanalyst", title: "Alex The Analyst (Data Analytics)", provider: "YouTube · Alex The Analyst", topic: "Data Science / ML", type: "Video", free: true, url: "https://www.youtube.com/@AlexTheAnalyst" },
];

export const FIELDS = [
  "All",
  "Software / Open Source",
  "Algorithms",
  "Web3 / Blockchain",
  "Data / Space Tech",
  "Software Engineering",
  "Women in Tech",
  "Founders / Builders",
];
