import os
import io
import re
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify, render_template, send_from_directory
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pdfplumber

from src.preprocessing import clean_text
from src.skill_extractor import extract_skills

app = Flask(__name__, static_folder="static", template_folder="templates")

# Paths
CSV_PATH = "data/Resume.csv"
CACHE_PATH = "outputs/processed_cache.pkl"

# Global state
candidates_df = None
all_categories = []

def load_data():
    """
    Loads candidate data on startup. Uses a cache file (pickle)
    to avoid reading and cleaning 56MB CSV on every server reload.
    """
    global candidates_df, all_categories
    try:
        if os.path.exists(CACHE_PATH):
            print(f"Loading cached preprocessed dataset from {CACHE_PATH}...")
            candidates_df = pd.read_pickle(CACHE_PATH)
        else:
            print(f"Reading CSV dataset from {CSV_PATH}...")
            if not os.path.exists(CSV_PATH):
                # Fallback check if CSV is under data/data/Resume.csv
                alt_path = "data/data/Resume.csv"
                if os.path.exists(alt_path):
                    df = pd.read_csv(alt_path)
                else:
                    raise FileNotFoundError(f"Dataset not found at {CSV_PATH}")
            else:
                df = pd.read_csv(CSV_PATH)
            
            print(f"Dataset loaded. Raw count: {len(df)} resumes.")
            
            # Remove duplicates or handle missing values
            df = df.dropna(subset=["Resume_str"])
            df["ID"] = df["ID"].astype(str)
            df["Category"] = df["Category"].str.upper()
            
            print("Cleaning and preprocessing resume text (this runs once and will be cached)...")
            df["Clean_Resume"] = df["Resume_str"].apply(clean_text)
            
            print("Pre-extracting skills for all resumes...")
            df["Skills"] = df["Resume_str"].apply(extract_skills)
            
            # Cache the preprocessed DataFrame
            os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
            df.to_pickle(CACHE_PATH)
            candidates_df = df
            print(f"Preprocessed data cached successfully to {CACHE_PATH}")
            
        all_categories = sorted(candidates_df["Category"].unique().tolist())
        print(f"Ready! Loaded {len(candidates_df)} resumes across {len(all_categories)} categories.")
    except Exception as e:
        print(f"ERROR: Failed to load dataset: {e}")
        # Create a tiny mock dataframe so the app doesn't crash if the CSV is completely missing
        candidates_df = pd.DataFrame(columns=["ID", "Resume_str", "Resume_html", "Category", "Clean_Resume", "Skills"])
        all_categories = ["INFORMATION-TECHNOLOGY"]

# Load dataset immediately
load_data()

# =====================================================================
# API ROUTES
# =====================================================================

@app.route("/")
def home():
    """Render main SPA frontend."""
    return render_template("index.html")

@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Get general stats about the resume database."""
    if candidates_df is None or len(candidates_df) == 0:
        return jsonify({
            "total_resumes": 0,
            "categories": {},
            "category_list": []
        })
        
    counts = candidates_df["Category"].value_counts().to_dict()
    return jsonify({
        "total_resumes": len(candidates_df),
        "categories": counts,
        "category_list": all_categories
    })

@app.route("/api/presets", methods=["GET"])
def get_presets():
    """Return mock preset job descriptions."""
    presets = {
        "data_scientist": {
            "title": "Data Scientist",
            "category": "INFORMATION-TECHNOLOGY",
            "description": (
                "We are seeking a Data Scientist to join our team. The candidate will build predictive models, "
                "perform statistical analysis, and translate business questions into machine learning workflows. "
                "Requirements: strong programming in Python and SQL. Experience with Machine Learning algorithms, "
                "NLP (Natural Language Processing), and Deep Learning framework (TensorFlow, PyTorch). "
                "Knowledge of Data Science methodologies, Git version control, and AWS cloud deployment is required."
            )
        },
        "python_developer": {
            "title": "Python Backend Developer",
            "category": "INFORMATION-TECHNOLOGY",
            "description": (
                "Looking for a Backend Engineer specializing in Python. You will design and deploy scalable "
                "web APIs, manage database integrations, and write clean, testable code. "
                "Key requirements: strong knowledge of Python, Flask, Django, SQL databases (PostgreSQL, MySQL), "
                "Docker containers, Git, and CI/CD pipelines. Knowledge of HTML, CSS, and React is a plus."
            )
        },
        "hr_manager": {
            "title": "Human Resources Manager",
            "category": "HR",
            "description": (
                "We are hiring an experienced HR Manager to oversee recruiting and employee relations. "
                "You will lead talent acquisition, candidate onboarding, employee training programs, "
                "payroll management, and compliance with HR policies. "
                "Must have strong communication, negotiation, interviewing, and project management skills."
            )
        },
        "financial_analyst": {
            "title": "Financial Analyst / Accountant",
            "category": "FINANCE",
            "description": (
                "Seeking a Senior Accountant / Financial Analyst. Responsibilities include corporate finance planning, "
                "budgeting, tax compliance, auditing, financial modeling, and managing the general ledger. "
                "Must be highly proficient in Excel, QuickBooks, SAP, financial analysis, and general bookkeeping."
            )
        },
        "healthcare_coordinator": {
            "title": "Clinical Nurse Coordinator",
            "category": "HEALTHCARE",
            "description": (
                "Looking for a clinical coordinator with experience in nursing and patient care. "
                "Key requirements: registered nurse credentials, knowledge of medical terminology, EMR systems, "
                "clinical patient assessment, pharmacology, CPR certification, and patient education. "
                "Strong communication and case management skills are required."
            )
        },
        "marketing_lead": {
            "title": "Digital Marketing Specialist",
            "category": "BUSINESS-DEVELOPMENT",
            "description": (
                "Seeking a Digital Marketing Specialist to lead brand management. "
                "You will manage social media campaigns, execute SEO / SEM audits, create copywriting materials, "
                "track analytics in CRM software, run email marketing, and conduct market research. "
                "Experience with Salesforce and lead generation is required."
            )
        }
    }
    return jsonify(presets)

@app.route("/api/parse-jd", methods=["POST"])
def parse_jd():
    """Extract skills from a job description text."""
    data = request.json or {}
    jd_text = data.get("job_description", "")
    
    extracted = extract_skills(jd_text)
    return jsonify({
        "extracted_skills": extracted
    })

@app.route("/api/rank", methods=["POST"])
def rank_candidates():
    """
    Ranks candidates based on TF-IDF cosine similarity and
    weighted skill match score.
    """
    data = request.json or {}
    jd_text = data.get("job_description", "")
    skills_config = data.get("skills_config", {})  # maps skill -> weight (e.g. 0.5, 1.0, 2.0)
    category = data.get("category", "ALL").upper()
    min_score = float(data.get("min_score", 0))
    limit = int(data.get("limit", 50))
    
    jd_weight = float(data.get("jd_weight", 0.4))
    skill_weight = float(data.get("skill_weight", 0.6))
    
    if len(candidates_df) == 0:
        return jsonify([])
        
    # 1. Filter candidates by category if selected
    if category != "ALL" and category in all_categories:
        filtered_df = candidates_df[candidates_df["Category"] == category].copy()
    else:
        filtered_df = candidates_df.copy()
        
    if len(filtered_df) == 0:
        return jsonify([])
        
    # 2. Compute Cosine Similarity
    jd_clean = clean_text(jd_text)
    
    # Vectorizer
    vectorizer = TfidfVectorizer()
    
    # Fit vectorizer on filtered resumes + JD
    corpus = [jd_clean] + filtered_df["Clean_Resume"].tolist()
    tfidf_matrix = vectorizer.fit_transform(corpus)
    
    jd_vec = tfidf_matrix[0]
    res_vecs = tfidf_matrix[1:]
    
    similarity_scores = cosine_similarity(jd_vec, res_vecs).flatten() * 100
    
    # 3. Compute Weighted Skill Match Score
    # skills_config matches skill name to its weight
    required_skills = list(skills_config.keys())
    max_possible_weight = sum(skills_config.values())
    
    skill_scores = []
    matched_skills_list = []
    missing_skills_list = []
    
    for idx, row in filtered_df.iterrows():
        cand_skills = row["Skills"]
        
        matched = [s for s in required_skills if s in cand_skills]
        missing = [s for s in required_skills if s not in cand_skills]
        
        if max_possible_weight > 0:
            obtained_weight = sum([skills_config[s] for s in matched])
            skill_score = (obtained_weight / max_possible_weight) * 100
        else:
            skill_score = 0.0
            
        skill_scores.append(skill_score)
        matched_skills_list.append(matched)
        missing_skills_list.append(missing)
        
    # Add columns to filtered dataframe
    filtered_df["Similarity_Score"] = similarity_scores
    filtered_df["Skill_Match_Score"] = skill_scores
    filtered_df["Matched_Skills"] = matched_skills_list
    filtered_df["Missing_Skills"] = missing_skills_list
    
    # Calculate final score
    filtered_df["Final_Score"] = (jd_weight * filtered_df["Similarity_Score"]) + (skill_weight * filtered_df["Skill_Match_Score"])
    
    # Filter by min score and sort
    results_df = filtered_df[filtered_df["Final_Score"] >= min_score]
    results_df = results_df.sort_values(by="Final_Score", ascending=False).head(limit)
    
    output = []
    for _, row in results_df.iterrows():
        output.append({
            "id": row["ID"],
            "category": row["Category"],
            "similarity_score": round(row["Similarity_Score"], 2),
            "skill_match_score": round(row["Skill_Match_Score"], 2),
            "final_score": round(row["Final_Score"], 2),
            "matched_skills": row["Matched_Skills"],
            "missing_skills": row["Missing_Skills"]
        })
        
    return jsonify(output)

@app.route("/api/candidate/<candidate_id>", methods=["GET"])
def get_candidate(candidate_id):
    """Retrieve detailed candidate text and info."""
    if candidates_df is None or len(candidates_df) == 0:
        return jsonify({"error": "No candidates loaded"}), 404
        
    match = candidates_df[candidates_df["ID"] == str(candidate_id)]
    if len(match) == 0:
        return jsonify({"error": "Candidate not found"}), 404
        
    row = match.iloc[0]
    return jsonify({
        "id": row["ID"],
        "category": row["Category"],
        "resume_text": row["Resume_str"]
    })

@app.route("/api/upload", methods=["POST"])
def upload_resume():
    """Accept and evaluate an uploaded resume file."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files["file"]
    jd_text = request.form.get("job_description", "")
    skills_config_str = request.form.get("skills_config", "{}")
    
    import json
    try:
        skills_config = json.loads(skills_config_str)
    except Exception:
        skills_config = {}
        
    jd_weight = float(request.form.get("jd_weight", 0.4))
    skill_weight = float(request.form.get("skill_weight", 0.6))
    
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
        
    filename = file.filename.lower()
    
    try:
        if filename.endswith(".pdf"):
            # Parse PDF using pdfplumber
            text = ""
            with pdfplumber.open(io.BytesIO(file.read())) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        elif filename.endswith(".txt"):
            text = file.read().decode("utf-8", errors="ignore")
        else:
            return jsonify({"error": "Unsupported file format. Please upload a PDF or TXT file."}), 400
            
        if not text.strip():
            return jsonify({"error": "No readable text found in the file."}), 400
            
        # Clean and preprocess
        cleaned = clean_text(text)
        cand_skills = extract_skills(text)
        
        # Calculate scores against JD
        jd_clean = clean_text(jd_text)
        
        # TF-IDF Similarity
        vectorizer = TfidfVectorizer()
        tfidf = vectorizer.fit_transform([jd_clean, cleaned])
        similarity_score = float(cosine_similarity(tfidf[0], tfidf[1]).flatten()[0]) * 100
        
        # Skill match score
        required_skills = list(skills_config.keys())
        max_possible_weight = sum(skills_config.values())
        
        matched = [s for s in required_skills if s in cand_skills]
        missing = [s for s in required_skills if s not in cand_skills]
        
        if max_possible_weight > 0:
            obtained_weight = sum([skills_config[s] for s in matched])
            skill_score = (obtained_weight / max_possible_weight) * 100
        else:
            skill_score = 0.0
            
        final_score = (jd_weight * similarity_score) + (skill_weight * skill_score)
        
        return jsonify({
            "id": f"Uploaded: {file.filename}",
            "category": "UPLOADED CANDIDATE",
            "similarity_score": round(similarity_score, 2),
            "skill_match_score": round(skill_score, 2),
            "final_score": round(final_score, 2),
            "matched_skills": matched,
            "missing_skills": missing,
            "resume_text": text
        })
        
    except Exception as e:
        return jsonify({"error": f"Failed to parse resume: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5001)
