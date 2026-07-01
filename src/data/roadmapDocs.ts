// Curated official documentation / learning links for roadmap skill items.
// Keys are matched against roadmap item labels (case-insensitive, exact first,
// then keyword fallback). Anything not found falls back to a docs search.

export const DOC_LINKS: Record<string, string> = {
  // --- Web / Frontend ---
  "html semantics": "https://developer.mozilla.org/en-US/docs/Glossary/Semantics",
  "css & flexbox/grid": "https://css-tricks.com/snippets/css/complete-guide-grid/",
  "javascript es6+": "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
  "git & github": "https://docs.github.com/en/get-started",
  "git": "https://git-scm.com/doc",
  "react fundamentals": "https://react.dev/learn",
  "react": "https://react.dev/learn",
  "state management": "https://react.dev/learn/managing-state",
  "typescript": "https://www.typescriptlang.org/docs/",
  "responsive design": "https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design",
  "vite/webpack": "https://vitejs.dev/guide/",
  "testing (vitest/rtl)": "https://vitest.dev/guide/",
  "rest & graphql": "https://graphql.org/learn/",
  "accessibility": "https://developer.mozilla.org/en-US/docs/Web/Accessibility",
  "performance optimization": "https://web.dev/learn/performance/",
  "ssr frameworks": "https://nextjs.org/docs",
  "design systems": "https://www.designsystems.com/",
  "ci/cd basics": "https://docs.github.com/en/actions",

  // --- Backend / Systems ---
  "a language (node/go/python)": "https://nodejs.org/en/learn",
  "data structures": "https://www.geeksforgeeks.org/data-structures/",
  "linux & cli": "https://linuxjourney.com/",
  "rest api design": "https://restfulapi.net/",
  "sql databases": "https://www.postgresql.org/docs/",
  "authentication": "https://auth0.com/docs/get-started",
  "orms": "https://www.prisma.io/docs",
  "caching (redis)": "https://redis.io/docs/latest/",
  "message queues": "https://www.rabbitmq.com/tutorials",
  "docker": "https://docs.docker.com/get-started/",
  "testing": "https://jestjs.io/docs/getting-started",
  "system design": "https://github.com/donnemartin/system-design-primer",
  "microservices": "https://microservices.io/patterns/index.html",
  "observability": "https://opentelemetry.io/docs/",
  "cloud deployment": "https://docs.aws.amazon.com/",

  // --- Data Science / ML ---
  "python": "https://docs.python.org/3/tutorial/",
  "python & math": "https://docs.python.org/3/tutorial/",
  "statistics & probability": "https://www.khanacademy.org/math/statistics-probability",
  "pandas & numpy": "https://pandas.pydata.org/docs/",
  "sql": "https://mode.com/sql-tutorial/",
  "data visualization": "https://matplotlib.org/stable/tutorials/index.html",
  "eda": "https://pandas.pydata.org/docs/getting_started/intro_tutorials/",
  "scikit-learn": "https://scikit-learn.org/stable/user_guide.html",
  "feature engineering": "https://www.kaggle.com/learn/feature-engineering",
  "regression & classification": "https://scikit-learn.org/stable/supervised_learning.html",
  "model evaluation": "https://scikit-learn.org/stable/modules/model_evaluation.html",
  "time series": "https://otexts.com/fpp3/",
  "nlp basics": "https://huggingface.co/learn/nlp-course",
  "deep learning": "https://www.deeplearning.ai/",
  "mlops basics": "https://ml-ops.org/",
  "a/b testing": "https://www.optimizely.com/optimization-glossary/ab-testing/",
  "storytelling with data": "https://www.storytellingwithdata.com/",
  "linear algebra": "https://www.khanacademy.org/math/linear-algebra",
  "probability": "https://www.khanacademy.org/math/statistics-probability/probability-library",
  "dsa": "https://neetcode.io/roadmap",
  "supervised learning": "https://scikit-learn.org/stable/supervised_learning.html",
  "neural networks": "https://www.3blue1brown.com/topics/neural-networks",
  "pytorch/tensorflow": "https://pytorch.org/tutorials/",
  "evaluation": "https://scikit-learn.org/stable/modules/model_evaluation.html",
  "data pipelines": "https://airflow.apache.org/docs/",
  "model serving": "https://www.tensorflow.org/tfx/guide/serving",
  "docker & apis": "https://docs.docker.com/get-started/",
  "experiment tracking": "https://mlflow.org/docs/latest/index.html",
  "llms & transformers": "https://huggingface.co/learn/nlp-course/chapter1/1",
  "mlops & monitoring": "https://ml-ops.org/",
  "distributed training": "https://pytorch.org/tutorials/beginner/dist_overview.html",
  "scaling": "https://www.ray.io/docs",

  // --- DevOps / Cloud ---
  "linux & networking": "https://linuxjourney.com/",
  "bash scripting": "https://www.gnu.org/software/bash/manual/bash.html",
  "a programming language": "https://www.python.org/about/gettingstarted/",
  "ci/cd pipelines": "https://docs.github.com/en/actions",
  "cloud (aws/gcp)": "https://docs.aws.amazon.com/",
  "infrastructure as code": "https://developer.hashicorp.com/terraform/docs",
  "kubernetes": "https://kubernetes.io/docs/home/",
  "monitoring & logging": "https://prometheus.io/docs/introduction/overview/",
  "terraform": "https://developer.hashicorp.com/terraform/docs",
  "secrets management": "https://developer.hashicorp.com/vault/docs",
  "site reliability": "https://sre.google/books/",
  "security & devsecops": "https://owasp.org/www-project-devsecops-guideline/",
  "cost optimization": "https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/welcome.html",
  "service mesh": "https://istio.io/latest/docs/",

  // --- Cybersecurity ---
  "networking": "https://www.cloudflare.com/learning/network-layer/what-is-the-network-layer/",
  "operating systems": "https://pages.cs.wisc.edu/~remzi/OSTEP/",
  "linux": "https://linuxjourney.com/",
  "security basics": "https://www.cybrary.it/",
  "cryptography": "https://cryptohack.org/",
  "web security (owasp)": "https://owasp.org/www-project-top-ten/",
  "scripting (python)": "https://docs.python.org/3/tutorial/",
  "threat modeling": "https://owasp.org/www-community/Threat_Modeling",
  "penetration testing": "https://www.tryhackme.com/",
  "siem tools": "https://www.splunk.com/en_us/training.html",
  "incident response": "https://www.sans.org/incident-response/",
  "forensics": "https://www.autopsy.com/",
  "cloud security": "https://cloudsecurityalliance.org/education",
  "red/blue teaming": "https://www.hackthebox.com/",
  "certifications": "https://www.comptia.org/certifications",
  "compliance": "https://www.iso.org/isoiec-27001-information-security.html",

  // --- Open Source ---
  "master git & github": "https://docs.github.com/en/get-started",
  "pick a language": "https://roadmap.sh/",
  "read contributing docs": "https://opensource.guide/how-to-contribute/",
  "set up dev env": "https://opensource.guide/how-to-contribute/",
  "find good-first-issues": "https://goodfirstissue.dev/",
  "fix docs/tests": "https://opensource.guide/how-to-contribute/",
  "open quality prs": "https://docs.github.com/en/pull-requests",
  "engage in community": "https://opensource.guide/building-community/",
  "apply to gsoc/lfx": "https://summerofcode.withgoogle.com/",
  "write strong proposals": "https://google.github.io/gsocguides/student/writing-a-proposal",
  "outreachy/sob": "https://www.outreachy.org/",
  "become a maintainer": "https://opensource.guide/best-practices/",

  // --- Competitive Programming ---
  "a language (c++/java)": "https://en.cppreference.com/w/",
  "time complexity": "https://www.bigocheatsheet.com/",
  "arrays & strings": "https://neetcode.io/roadmap",
  "sorting & searching": "https://cp-algorithms.com/",
  "recursion": "https://neetcode.io/roadmap",
  "stacks/queues": "https://neetcode.io/roadmap",
  "trees & graphs": "https://cp-algorithms.com/graph/breadth-first-search.html",
  "hashing": "https://cp-algorithms.com/string/string-hashing.html",
  "dynamic programming": "https://cp-algorithms.com/dynamic_programming/intro-to-dp.html",
  "greedy": "https://www.geeksforgeeks.org/greedy-algorithms/",
  "graph algorithms": "https://cp-algorithms.com/graph/",
  "number theory": "https://cp-algorithms.com/algebra/",
  "codeforces rounds": "https://codeforces.com/",
  "virtual contests": "https://codeforces.com/gyms",
  "upsolving": "https://codeforces.com/",
  "icpc team practice": "https://icpc.global/",

  // --- SQA / QA ---
  "software testing basics": "https://www.guru99.com/software-testing.html",
  "sdlc & stlc": "https://www.guru99.com/software-testing-life-cycle.html",
  "test case design": "https://www.guru99.com/test-case.html",
  "bug reporting": "https://www.atlassian.com/software/jira/guides/getting-started/overview",
  "manual testing": "https://www.guru99.com/manual-testing.html",
  "api testing (postman)": "https://learning.postman.com/docs/introduction/overview/",
  "sql for testers": "https://mode.com/sql-tutorial/",
  "test management tools": "https://www.atlassian.com/software/jira",
  "selenium": "https://www.selenium.dev/documentation/",
  "cypress": "https://docs.cypress.io/",
  "playwright": "https://playwright.dev/docs/intro",
  "junit/testng": "https://junit.org/junit5/docs/current/user-guide/",
  "ci/cd for tests": "https://docs.github.com/en/actions",
  "performance testing (jmeter)": "https://jmeter.apache.org/usermanual/index.html",
  "security testing": "https://owasp.org/www-project-web-security-testing-guide/",
  "test strategy": "https://www.ministryoftesting.com/",

  // --- Data Analyst ---
  "excel / google sheets": "https://support.microsoft.com/en-us/excel",
  "descriptive statistics": "https://www.khanacademy.org/math/statistics-probability",
  "sql querying": "https://mode.com/sql-tutorial/",
  "power bi": "https://learn.microsoft.com/en-us/power-bi/",
  "tableau": "https://help.tableau.com/current/guides/get-started-tutorial/en-us/get-started-tutorial-home.htm",
  "data cleaning": "https://pandas.pydata.org/docs/user_guide/missing_data.html",
  "python for analysis": "https://pandas.pydata.org/docs/",
  "dashboards & reports": "https://learn.microsoft.com/en-us/power-bi/create-reports/",
  "business metrics & kpis": "https://www.klipfolio.com/resources/kpi-examples",
  "storytelling": "https://www.storytellingwithdata.com/",
  "etl basics": "https://www.talend.com/resources/what-is-etl/",
  "data warehousing": "https://cloud.google.com/learn/what-is-a-data-warehouse",

  // --- Data Engineer ---
  "python & sql": "https://docs.python.org/3/tutorial/",
  "data modeling": "https://www.holistics.io/books/setup-analytics/data-modeling-layer/",
  "batch vs streaming": "https://www.confluent.io/learn/batch-vs-real-time-data-processing/",
  "apache spark": "https://spark.apache.org/docs/latest/",
  "apache airflow": "https://airflow.apache.org/docs/",
  "apache kafka": "https://kafka.apache.org/documentation/",
  "dbt": "https://docs.getdbt.com/",
  "cloud data platforms": "https://cloud.google.com/bigquery/docs",
  "snowflake/bigquery": "https://docs.snowflake.com/",
  "orchestration": "https://airflow.apache.org/docs/",
  "data lakes": "https://docs.databricks.com/",
  "data quality & governance": "https://greatexpectations.io/",

  // --- Data Architect ---
  "relational modeling": "https://www.postgresql.org/docs/current/ddl.html",
  "nosql modeling": "https://www.mongodb.com/docs/manual/data-modeling/",
  "normalization": "https://www.guru99.com/database-normalization.html",
  "data warehouse design": "https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/",
  "dimensional modeling": "https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/",
  "master data management": "https://www.informatica.com/resources/articles/what-is-master-data-management.html",
  "data mesh": "https://www.datamesh-architecture.com/",
  "data lineage": "https://openlineage.io/docs/",
  "security & compliance": "https://gdpr.eu/",
  "cloud architecture": "https://aws.amazon.com/architecture/",
  "cost & performance": "https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/welcome.html",

  // --- Full Stack ---
  "html/css/js": "https://developer.mozilla.org/en-US/docs/Learn",
  "frontend framework": "https://react.dev/learn",
  "backend framework": "https://expressjs.com/",
  "databases (sql/nosql)": "https://www.postgresql.org/docs/",
  "api design": "https://restfulapi.net/",
  "auth & security": "https://auth0.com/docs/get-started",
  "deployment": "https://vercel.com/docs",
  "testing & ci/cd": "https://docs.github.com/en/actions",

  // --- Mobile ---
  "dart & flutter": "https://docs.flutter.dev/",
  "kotlin (android)": "https://kotlinlang.org/docs/home.html",
  "swift (ios)": "https://developer.apple.com/documentation/swift",
  "ui layouts": "https://docs.flutter.dev/ui",
  "state management (mobile)": "https://docs.flutter.dev/data-and-backend/state-mgmt/intro",
  "local storage": "https://docs.flutter.dev/cookbook/persistence",
  "rest api integration": "https://docs.flutter.dev/cookbook/networking/fetch-data",
  "push notifications": "https://firebase.google.com/docs/cloud-messaging",
  "app store deployment": "https://developer.apple.com/app-store/submitting/",

  // --- UI/UX Design ---
  "design principles": "https://www.interaction-design.org/literature",
  "color & typography": "https://material.io/design/typography/the-type-system.html",
  "figma": "https://help.figma.com/hc/en-us",
  "wireframing": "https://www.figma.com/resource-library/what-is-wireframing/",
  "prototyping": "https://help.figma.com/hc/en-us/articles/360040314193-Guide-to-prototyping-in-Figma",
  "user research": "https://www.nngroup.com/topic/user-research/",
  "usability testing": "https://www.nngroup.com/articles/usability-testing-101/",
  "design systems & tokens": "https://www.designsystems.com/",
  "accessibility (wcag)": "https://www.w3.org/WAI/WCAG21/quickref/",
  "portfolio": "https://www.behance.net/",

  // --- AI Engineer ---
  "prompt engineering": "https://www.promptingguide.ai/",
  "llm apis": "https://platform.openai.com/docs/",
  "rag (retrieval)": "https://python.langchain.com/docs/tutorials/rag/",
  "vector databases": "https://docs.pinecone.io/",
  "langchain": "https://python.langchain.com/docs/introduction/",
  "fine-tuning": "https://huggingface.co/docs/transformers/training",
  "embeddings": "https://platform.openai.com/docs/guides/embeddings",
  "ai app deployment": "https://huggingface.co/docs/hub/spaces",

  // --- Cloud Architect ---
  "cloud fundamentals": "https://aws.amazon.com/getting-started/",
  "compute & storage": "https://docs.aws.amazon.com/ec2/",
  "networking & vpc": "https://docs.aws.amazon.com/vpc/",
  "well-architected framework": "https://aws.amazon.com/architecture/well-architected/",
  "high availability": "https://docs.aws.amazon.com/whitepapers/latest/real-time-communication-on-aws/high-availability-and-scalability-on-aws.html",
  "disaster recovery": "https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-workloads-on-aws.html",
  "multi-cloud": "https://cloud.google.com/architecture",
  "cloud certifications": "https://aws.amazon.com/certification/",

  // --- Database Administrator ---
  "rdbms fundamentals": "https://www.postgresql.org/docs/",
  "sql & pl/sql": "https://www.postgresql.org/docs/current/plpgsql.html",
  "indexing & tuning": "https://use-the-index-luke.com/",
  "backup & recovery": "https://www.postgresql.org/docs/current/backup.html",
  "replication": "https://www.postgresql.org/docs/current/high-availability.html",
  "high availability & clustering": "https://www.postgresql.org/docs/current/high-availability.html",
  "monitoring": "https://www.pgadmin.org/docs/",
  "database security": "https://www.postgresql.org/docs/current/user-manag.html",

  // --- Network Engineer ---
  "osi & tcp/ip model": "https://www.cloudflare.com/learning/ddos/glossary/open-systems-interconnection-model-osi/",
  "subnetting": "https://www.cisco.com/c/en/us/support/docs/ip/routing-information-protocol-rip/13788-3.html",
  "routing & switching": "https://www.cisco.com/c/en/us/solutions/small-business/resource-center/networking/networking-basics.html",
  "firewalls & vpn": "https://www.cloudflare.com/learning/access-management/what-is-a-vpn/",
  "network security": "https://www.cisco.com/c/en/us/products/security/what-is-network-security.html",
  "wireless networking": "https://www.cisco.com/c/en/us/products/wireless/what-is-wifi.html",
  "cloud networking": "https://docs.aws.amazon.com/vpc/",
  "ccna certification": "https://www.cisco.com/site/us/en/learn/training-certifications/certifications/associate/ccna.html",

  // --- Business Analyst ---
  "requirements gathering": "https://www.iiba.org/career-resources/a-business-analysis-professionals-foundation-for-success/babok/",
  "process modeling (bpmn)": "https://www.bpmn.org/",
  "stakeholder management": "https://www.iiba.org/",
  "user stories & use cases": "https://www.atlassian.com/agile/project-management/user-stories",
  "data analysis basics": "https://mode.com/sql-tutorial/",
  "agile & scrum": "https://scrumguides.org/scrum-guide.html",
  "documentation": "https://www.atlassian.com/software/confluence",
  "uat": "https://www.guru99.com/user-acceptance-testing.html",

  // --- Game Developer ---
  "c# or c++": "https://learn.microsoft.com/en-us/dotnet/csharp/",
  "unity": "https://docs.unity3d.com/Manual/index.html",
  "unreal engine": "https://dev.epicgames.com/documentation/en-us/unreal-engine",
  "game math & physics": "https://gamemath.com/",
  "2d/3d graphics": "https://learnopengl.com/",
  "game design principles": "https://www.gamedeveloper.com/design",
  "audio & animation": "https://docs.unity3d.com/Manual/AnimationSection.html",
  "publishing games": "https://partner.steamgames.com/doc/home",

  // --- Blockchain Developer ---
  "blockchain fundamentals": "https://ethereum.org/en/developers/docs/",
  "solidity": "https://docs.soliditylang.org/",
  "smart contracts": "https://ethereum.org/en/developers/docs/smart-contracts/",
  "ethereum & evm": "https://ethereum.org/en/developers/docs/evm/",
  "web3.js / ethers.js": "https://docs.ethers.org/",
  "dapps": "https://ethereum.org/en/developers/docs/dapps/",
  "hardhat/foundry": "https://hardhat.org/docs",
  "security & auditing": "https://consensys.github.io/smart-contract-best-practices/",
};

const SPECIALS: Record<string, string> = {
  "c++": "cpp",
  "c#": "csharp",
  ".net": "dotnet",
};

/** Resolve a documentation URL for a roadmap item label. */
export function getDocLink(item: string): string {
  const key = item.trim().toLowerCase();
  if (DOC_LINKS[key]) return DOC_LINKS[key];

  // keyword fallback: find a known key contained in the item (or vice versa)
  for (const [k, url] of Object.entries(DOC_LINKS)) {
    if (key.includes(k) || k.includes(key)) return url;
  }

  // final fallback: a docs-focused search
  let q = item;
  for (const [sym, word] of Object.entries(SPECIALS)) {
    q = q.split(sym).join(word);
  }
  return `https://www.google.com/search?q=${encodeURIComponent(q + " official documentation")}`;
}
