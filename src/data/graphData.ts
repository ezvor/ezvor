// Interactive, NeetCode-style graph roadmaps.
// Each roadmap is a small DAG: nodes positioned on a layered grid (row = depth,
// col = horizontal fraction 0..1), connected by edges. Every node carries
// hand-picked FREE resources (mostly YouTube) so learners can go deep instantly.

export type ResourceKind = "Video" | "Playlist" | "Practice" | "Docs" | "Course";

export interface NodeResource {
  label: string;
  provider: string;
  url: string;
  kind: ResourceKind;
}

export interface GraphNode {
  id: string;
  label: string;
  /** Depth layer, 0 = top. */
  row: number;
  /** Horizontal position as a fraction 0..1. */
  col: number;
  desc: string;
  optional?: boolean;
  resources: NodeResource[];
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface GraphRoadmap {
  id: string;
  title: string;
  tagline: string;
  icon: string; // lucide icon name
  /** css color token name, e.g. "primary" | "chart-2" ... */
  accent: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const GRAPH_ROADMAPS: GraphRoadmap[] = [
  // ─────────────────────────────── DSA / Interviews ───────────────────────────────
  {
    id: "dsa",
    title: "DSA & Coding Interviews",
    tagline: "The NeetCode-style path from arrays to system design.",
    icon: "Binary",
    accent: "primary",
    nodes: [
      {
        id: "basics",
        label: "Programming Basics",
        row: 0,
        col: 0.5,
        desc: "Pick one language (C++/Java/Python). Master syntax, loops, functions, recursion.",
        resources: [
          { label: "C++ Full Course", provider: "Apna College", url: "https://www.youtube.com/@ApnaCollegeOfficial", kind: "Playlist" },
          { label: "Python for Beginners", provider: "Programming with Mosh", url: "https://www.youtube.com/watch?v=_uQrJ0TkZlc", kind: "Video" },
        ],
      },
      {
        id: "complexity",
        label: "Time & Space Complexity",
        row: 1,
        col: 0.5,
        desc: "Big-O notation — the language of efficiency. Analyze before you optimize.",
        resources: [
          { label: "Big-O Notation", provider: "freeCodeCamp", url: "https://www.youtube.com/watch?v=Mo4vesaut8g", kind: "Video" },
          { label: "Abdul Bari — Complexity", provider: "Abdul Bari", url: "https://www.youtube.com/@abdul_bari", kind: "Playlist" },
        ],
      },
      {
        id: "arrays",
        label: "Arrays & Hashing",
        row: 2,
        col: 0.22,
        desc: "Two pointers, sliding window, prefix sums and hash maps.",
        resources: [
          { label: "Arrays & Hashing", provider: "NeetCode", url: "https://neetcode.io/roadmap", kind: "Practice" },
          { label: "Sliding Window", provider: "NeetCode", url: "https://www.youtube.com/@NeetCode", kind: "Video" },
        ],
      },
      {
        id: "linkedlist",
        label: "Stacks, Queues & Linked Lists",
        row: 2,
        col: 0.78,
        desc: "Linear structures and the patterns built on them.",
        resources: [
          { label: "Linked List", provider: "Apna College", url: "https://www.youtube.com/@ApnaCollegeOfficial", kind: "Playlist" },
          { label: "Stack & Queue", provider: "NeetCode", url: "https://neetcode.io/roadmap", kind: "Practice" },
        ],
      },
      {
        id: "trees",
        label: "Trees & Binary Search",
        row: 3,
        col: 0.3,
        desc: "Binary trees, BST, traversals and recursion patterns.",
        resources: [
          { label: "Trees Masterclass", provider: "NeetCode", url: "https://www.youtube.com/@NeetCode", kind: "Video" },
          { label: "Binary Search", provider: "LeetCode", url: "https://leetcode.com/explore/", kind: "Practice" },
        ],
      },
      {
        id: "graphs",
        label: "Graphs & BFS/DFS",
        row: 3,
        col: 0.7,
        desc: "Traversals, shortest paths and union-find.",
        resources: [
          { label: "Graph Algorithms", provider: "Abdul Bari", url: "https://www.youtube.com/@abdul_bari", kind: "Playlist" },
          { label: "Graphs", provider: "NeetCode", url: "https://neetcode.io/roadmap", kind: "Practice" },
        ],
      },
      {
        id: "dp",
        label: "Dynamic Programming",
        row: 4,
        col: 0.5,
        desc: "1D & 2D DP, memoization and the classic patterns.",
        resources: [
          { label: "DP for Beginners", provider: "freeCodeCamp", url: "https://www.youtube.com/watch?v=oBt53YbR9Kk", kind: "Video" },
          { label: "Aditya Verma DP", provider: "Aditya Verma", url: "https://www.youtube.com/@TheAdityaVerma", kind: "Playlist" },
        ],
      },
      {
        id: "interview",
        label: "Interview Prep",
        row: 5,
        col: 0.5,
        desc: "Mock interviews, Blind 75 / NeetCode 150 and behavioral rounds.",
        resources: [
          { label: "NeetCode 150", provider: "NeetCode", url: "https://neetcode.io/practice", kind: "Practice" },
          { label: "Tech Interview Handbook", provider: "Free", url: "https://www.techinterviewhandbook.org/", kind: "Docs" },
        ],
      },
    ],
    edges: [
      { from: "basics", to: "complexity" },
      { from: "complexity", to: "arrays" },
      { from: "complexity", to: "linkedlist" },
      { from: "arrays", to: "trees" },
      { from: "linkedlist", to: "trees" },
      { from: "linkedlist", to: "graphs" },
      { from: "trees", to: "dp" },
      { from: "graphs", to: "dp" },
      { from: "dp", to: "interview" },
    ],
  },

  // ─────────────────────────────── Frontend ───────────────────────────────
  {
    id: "frontend",
    title: "Frontend Engineer",
    tagline: "From HTML to production-grade React apps.",
    icon: "Layout",
    accent: "chart-2",
    nodes: [
      {
        id: "html",
        label: "HTML & CSS",
        row: 0,
        col: 0.5,
        desc: "Semantic HTML, Flexbox, Grid and responsive design.",
        resources: [
          { label: "HTML & CSS Course", provider: "freeCodeCamp", url: "https://www.youtube.com/watch?v=mU6anWqZJcc", kind: "Video" },
          { label: "CSS Tutorial", provider: "Net Ninja", url: "https://www.youtube.com/@NetNinja", kind: "Playlist" },
        ],
      },
      {
        id: "js",
        label: "JavaScript (ES6+)",
        row: 1,
        col: 0.5,
        desc: "The language of the web — DOM, async, fetch, modules.",
        resources: [
          { label: "JavaScript Course", provider: "freeCodeCamp", url: "https://www.youtube.com/watch?v=PkZNo7MFNFg", kind: "Video" },
          { label: "JS Info", provider: "javascript.info", url: "https://javascript.info/", kind: "Docs" },
        ],
      },
      {
        id: "git",
        label: "Git & Tooling",
        row: 2,
        col: 0.22,
        desc: "Version control, npm, bundlers and the terminal.",
        resources: [
          { label: "Git & GitHub", provider: "freeCodeCamp", url: "https://www.youtube.com/watch?v=RGOj5yH7evk", kind: "Video" },
        ],
      },
      {
        id: "react",
        label: "React",
        row: 2,
        col: 0.7,
        desc: "Components, hooks, state and the React mental model.",
        resources: [
          { label: "React Course", provider: "freeCodeCamp", url: "https://www.youtube.com/watch?v=bMknfKXIFA8", kind: "Video" },
          { label: "Official Docs", provider: "react.dev", url: "https://react.dev/learn", kind: "Docs" },
        ],
      },
      {
        id: "ts",
        label: "TypeScript",
        row: 3,
        col: 0.4,
        desc: "Type-safe JavaScript for scalable apps.",
        resources: [
          { label: "TypeScript Course", provider: "freeCodeCamp", url: "https://www.youtube.com/watch?v=30LWjhZzg50", kind: "Video" },
        ],
      },
      {
        id: "advanced",
        label: "Frameworks & Perf",
        row: 4,
        col: 0.5,
        desc: "Next.js / TanStack, testing, accessibility and performance.",
        resources: [
          { label: "Next.js", provider: "Fireship", url: "https://www.youtube.com/@Fireship", kind: "Video" },
          { label: "web.dev", provider: "Google", url: "https://web.dev/learn/", kind: "Docs" },
        ],
      },
    ],
    edges: [
      { from: "html", to: "js" },
      { from: "js", to: "git" },
      { from: "js", to: "react" },
      { from: "react", to: "ts" },
      { from: "git", to: "ts" },
      { from: "ts", to: "advanced" },
    ],
  },

  // ─────────────────────────────── Data Science ───────────────────────────────
  {
    id: "data-science",
    title: "Data Scientist",
    tagline: "Python, stats, ML and storytelling with data.",
    icon: "BarChart3",
    accent: "chart-3",
    nodes: [
      {
        id: "python",
        label: "Python",
        row: 0,
        col: 0.5,
        desc: "Core Python plus NumPy and Pandas for data wrangling.",
        resources: [
          { label: "Python Full Course", provider: "Corey Schafer", url: "https://www.youtube.com/@coreyms", kind: "Playlist" },
          { label: "Pandas", provider: "Kaggle Learn", url: "https://www.kaggle.com/learn/pandas", kind: "Course" },
        ],
      },
      {
        id: "stats",
        label: "Statistics & Probability",
        row: 1,
        col: 0.3,
        desc: "Distributions, hypothesis testing and inference.",
        resources: [
          { label: "StatQuest", provider: "StatQuest", url: "https://www.youtube.com/@statquest", kind: "Playlist" },
        ],
      },
      {
        id: "sql",
        label: "SQL & Databases",
        row: 1,
        col: 0.7,
        desc: "Querying, joins and aggregation for analytics.",
        resources: [
          { label: "SQL Course", provider: "freeCodeCamp", url: "https://www.youtube.com/watch?v=HXV3zeQKqGY", kind: "Video" },
        ],
      },
      {
        id: "viz",
        label: "Data Viz & EDA",
        row: 2,
        col: 0.5,
        desc: "Matplotlib, seaborn and telling stories with charts.",
        resources: [
          { label: "Data Analytics", provider: "Alex The Analyst", url: "https://www.youtube.com/@AlexTheAnalyst", kind: "Playlist" },
        ],
      },
      {
        id: "ml",
        label: "Machine Learning",
        row: 3,
        col: 0.5,
        desc: "Scikit-learn, regression, classification and evaluation.",
        resources: [
          { label: "ML Playlist", provider: "Krish Naik", url: "https://www.youtube.com/@krishnaik06", kind: "Playlist" },
          { label: "Intro to ML", provider: "Kaggle Learn", url: "https://www.kaggle.com/learn/intro-to-machine-learning", kind: "Course" },
        ],
      },
      {
        id: "dl",
        label: "Deep Learning & MLOps",
        row: 4,
        col: 0.5,
        desc: "Neural nets, PyTorch and shipping models to production.",
        resources: [
          { label: "Practical Deep Learning", provider: "fast.ai", url: "https://course.fast.ai/", kind: "Course" },
        ],
      },
    ],
    edges: [
      { from: "python", to: "stats" },
      { from: "python", to: "sql" },
      { from: "stats", to: "viz" },
      { from: "sql", to: "viz" },
      { from: "viz", to: "ml" },
      { from: "ml", to: "dl" },
    ],
  },

  // ─────────────────────────────── DevOps / Cloud ───────────────────────────────
  {
    id: "devops",
    title: "DevOps & Cloud Engineer",
    tagline: "Automate, containerize and operate at scale.",
    icon: "Cloud",
    accent: "chart-4",
    nodes: [
      {
        id: "linux",
        label: "Linux & Networking",
        row: 0,
        col: 0.5,
        desc: "Shell, processes, permissions and how the internet works.",
        resources: [
          { label: "Linux for DevOps", provider: "NetworkChuck", url: "https://www.youtube.com/@NetworkChuck", kind: "Playlist" },
        ],
      },
      {
        id: "scripting",
        label: "Bash & a Language",
        row: 1,
        col: 0.3,
        desc: "Automate with Bash plus Python or Go.",
        resources: [
          { label: "Bash Scripting", provider: "freeCodeCamp", url: "https://www.youtube.com/watch?v=tK9Oc6AEnR4", kind: "Video" },
        ],
      },
      {
        id: "docker",
        label: "Docker",
        row: 1,
        col: 0.7,
        desc: "Containerize apps for consistent environments.",
        resources: [
          { label: "Docker Tutorial", provider: "TechWorld with Nana", url: "https://www.youtube.com/@TechWorldwithNana", kind: "Playlist" },
        ],
      },
      {
        id: "cicd",
        label: "CI/CD",
        row: 2,
        col: 0.5,
        desc: "GitHub Actions, pipelines and automated deploys.",
        resources: [
          { label: "CI/CD Explained", provider: "TechWorld with Nana", url: "https://www.youtube.com/@TechWorldwithNana", kind: "Video" },
        ],
      },
      {
        id: "k8s",
        label: "Kubernetes",
        row: 3,
        col: 0.5,
        desc: "Orchestrate containers across clusters.",
        resources: [
          { label: "Kubernetes Course", provider: "TechWorld with Nana", url: "https://www.youtube.com/watch?v=X48VuDVv0do", kind: "Video" },
        ],
      },
      {
        id: "cloud",
        label: "Cloud & IaC",
        row: 4,
        col: 0.5,
        desc: "AWS/GCP, Terraform and monitoring.",
        resources: [
          { label: "AWS Cloud", provider: "freeCodeCamp", url: "https://www.youtube.com/watch?v=3hLmDS179YE", kind: "Video" },
          { label: "Terraform", provider: "Docs", url: "https://developer.hashicorp.com/terraform/tutorials", kind: "Docs" },
        ],
      },
    ],
    edges: [
      { from: "linux", to: "scripting" },
      { from: "linux", to: "docker" },
      { from: "scripting", to: "cicd" },
      { from: "docker", to: "cicd" },
      { from: "cicd", to: "k8s" },
      { from: "k8s", to: "cloud" },
    ],
  },

  // ─────────────────────────────── Open Source ───────────────────────────────
  {
    id: "open-source",
    title: "Open Source Contributor",
    tagline: "Break in and win GSoC / LFX / Outreachy.",
    icon: "GitBranch",
    accent: "chart-5",
    nodes: [
      {
        id: "git",
        label: "Git & GitHub",
        row: 0,
        col: 0.5,
        desc: "Branches, PRs, forks and collaboration workflow.",
        resources: [
          { label: "Git & GitHub", provider: "freeCodeCamp", url: "https://www.youtube.com/watch?v=RGOj5yH7evk", kind: "Video" },
        ],
      },
      {
        id: "firstpr",
        label: "First Contribution",
        row: 1,
        col: 0.5,
        desc: "Good-first-issues, docs and small fixes.",
        resources: [
          { label: "First Contributions", provider: "Open Source", url: "https://firstcontributions.github.io/", kind: "Practice" },
          { label: "good first issues", provider: "GitHub", url: "https://goodfirstissue.dev/", kind: "Practice" },
        ],
      },
      {
        id: "community",
        label: "Engage with Community",
        row: 2,
        col: 0.5,
        desc: "Join chats, review PRs and build reputation.",
        resources: [
          { label: "How to Contribute", provider: "opensource.guide", url: "https://opensource.guide/how-to-contribute/", kind: "Docs" },
        ],
      },
      {
        id: "proposal",
        label: "Write a Proposal",
        row: 3,
        col: 0.5,
        desc: "Craft a strong, specific GSoC/LFX proposal.",
        resources: [
          { label: "GSoC Proposal Guide", provider: "Google", url: "https://google.github.io/gsocguides/student/writing-a-proposal", kind: "Docs" },
        ],
      },
      {
        id: "apply",
        label: "Apply to Programs",
        row: 4,
        col: 0.5,
        desc: "GSoC, LFX, Outreachy, Summer of Bitcoin.",
        resources: [
          { label: "Browse Opportunities", provider: "PathPilot", url: "/opportunities", kind: "Practice" },
        ],
      },
    ],
    edges: [
      { from: "git", to: "firstpr" },
      { from: "firstpr", to: "community" },
      { from: "community", to: "proposal" },
      { from: "proposal", to: "apply" },
    ],
  },
];
