import re

# Comprehensive list of skills organized by domain, but combined into a flat matching list.
# Supports 24 industries present in Resume.csv
skills = [
    # IT / Software Development
    "python", "sql", "machine learning", "deep learning", "nlp", "data science", 
    "tensorflow", "pytorch", "aws", "docker", "git", "java", "javascript", 
    "html", "css", "react", "c++", "c#", "php", "ruby", "go", "kubernetes", 
    "linux", "azure", "gcp", "ci/cd", "jenkins", "spark", "hadoop", "angular", 
    "vue", "node.js", "mongodb", "postgresql", "sqlite", "mysql", "typescript", 
    "devops", "django", "flask", "springboot", "scikit-learn", "keras",
    
    # Business & Management
    "excel", "power bi", "tableau", "project management", "agile", "scrum", 
    "jira", "product management", "business analysis", "operations management",
    "strategic planning", "change management", "risk management", "consulting",
    
    # HR & Recruitment
    "recruiting", "onboarding", "talent acquisition", "payroll", "training", 
    "employee relations", "hr policies", "interviewing", "human resources",
    "performance management", "benefits administration",
    
    # Finance, Accounting & Banking
    "accounting", "auditing", "budgeting", "financial analysis", "bookkeeping", 
    "tax", "quickbooks", "sap", "general ledger", "portfolio management", 
    "wealth management", "financial modeling", "corporate finance", "banking",
    "credit analysis", "compliance", "billing", "reconciliation",
    
    # Sales, Marketing & PR
    "sales", "crm", "seo", "sem", "social media", "marketing", "negotiation", 
    "copywriting", "branding", "salesforce", "public relations", "press release", 
    "cold calling", "lead generation", "email marketing", "market research",
    
    # Healthcare & Medical
    "nursing", "patient care", "cpr", "medical terminology", "clinical", 
    "emr", "ehr", "pharmacology", "healthcare", "diagnosis", "pediatrics",
    "patient assessment", "patient education",
    
    # Engineering & Construction
    "autocad", "solidworks", "matlab", "electrical engineering", "mechanical engineering", 
    "civil engineering", "construction management", "estimating", "blueprints", 
    "safety compliance", "piping", "plc programming", "quality assurance",
    
    # Aviation
    "flight safety", "pilot", "navigation", "aviation", "aircraft maintenance", 
    "faa regulations", "avionics", "flight planning",
    
    # Chef & Culinary
    "culinary arts", "cooking", "food safety", "menu planning", "baking", 
    "recipe creation", "kitchen management", "catering", "food preparation",
    
    # Fitness & Health
    "personal training", "nutrition", "kinesiology", "yoga", "strength training", 
    "rehabilitation", "exercise physiology", "wellness",
    
    # Legal / Advocate
    "legal research", "litigation", "contracts", "advocacy", "corporate law", 
    "courtroom representation", "intellectual property", "legal writing",
    "document drafting", "case management",
    
    # Designer & Creative Arts
    "photoshop", "illustrator", "indesign", "figma", "graphic design", "ui/ux", 
    "fine arts", "photography", "video editing", "animation", "motion graphics",
    "3d modeling",
    
    # Teacher & Education
    "curriculum design", "classroom management", "lesson planning", "tutoring", 
    "special education", "educational technology", "pedagogy", "e-learning",
    
    # Apparel & Fashion
    "fashion design", "textiles", "pattern making", "merchandising", "sewing", 
    "apparel production", "styling",
    
    # Agriculture
    "crop management", "agronomy", "farming", "pest control", "livestock", 
    "soil science", "irrigation",
    
    # Automobile
    "vehicle diagnostics", "automotive repair", "engine tuning", "cad design", 
    "manufacturing", "mechanics",
    
    # BPO & Customer Support
    "customer support", "telecalling", "data entry", "call center", 
    "troubleshooting", "customer service", "help desk"
]

# Pre-compile patterns
compiled_skills = []
for skill in skills:
    pattern = re.compile(r'\b' + re.escape(skill.lower()) + r'\b')
    compiled_skills.append((skill, pattern))

def extract_skills(text):
    """
    Extracts predefined skills from a text block, respecting word boundaries
    to minimize false matches.
    """
    text = str(text).lower()
    found = []
    
    for skill, pattern in compiled_skills:
        # DOUBLE OPTIMIZATION: Check if substring exists first (runs in micro-seconds in C)
        # before running regex search to confirm word boundaries.
        if skill in text:
            if pattern.search(text):
                found.append(skill)
            
    return list(set(found))