import pandas as pd
import matplotlib.pyplot as plt

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from src.preprocessing import clean_text
from src.skill_extractor import extract_skills

# =====================================
# LOAD DATASET
# =====================================

df = pd.read_csv("data/Resume.csv")

print(f"\nTotal Resumes in Dataset: {len(df)}")

# =====================================
# FILTER RELEVANT CATEGORIES
# =====================================

relevant_categories = [
    "DATA SCIENCE",
    "INFORMATION-TECHNOLOGY",
    "PYTHON DEVELOPER",
    "JAVA DEVELOPER"
]

filtered_df = df[
    df["Category"].str.upper().isin(relevant_categories)
].copy()

print(f"Relevant Resumes Found: {len(filtered_df)}")

# =====================================
# LOAD JOB DESCRIPTION
# =====================================

with open("data/job_description.txt", "r", encoding="utf-8") as f:
    job_description = f.read()

# =====================================
# EXTRACT REQUIRED SKILLS
# =====================================

required_skills = extract_skills(job_description)

print("\nRequired Skills:")
print(required_skills)

# =====================================
# CLEAN TEXT
# =====================================

job_description_clean = clean_text(job_description)

filtered_df["Clean_Resume"] = (
    filtered_df["Resume_str"]
    .fillna("")
    .apply(clean_text)
)

# =====================================
# TF-IDF SIMILARITY
# =====================================

documents = (
    [job_description_clean]
    +
    filtered_df["Clean_Resume"].tolist()
)

vectorizer = TfidfVectorizer()

tfidf_matrix = vectorizer.fit_transform(documents)

jd_vector = tfidf_matrix[0]

resume_vectors = tfidf_matrix[1:]

similarity_scores = cosine_similarity(
    jd_vector,
    resume_vectors
).flatten()

similarity_scores = similarity_scores * 100

# =====================================
# SKILL MATCH SCORING
# =====================================

skill_match_scores = []
matched_skill_counts = []
missing_skill_counts = []

for resume in filtered_df["Resume_str"]:

    candidate_skills = extract_skills(str(resume))

    matched_skills = list(
        set(candidate_skills)
        &
        set(required_skills)
    )

    missing_skills = list(
        set(required_skills)
        -
        set(candidate_skills)
    )

    matched_count = len(matched_skills)
    missing_count = len(missing_skills)

    if len(required_skills) > 0:
        skill_score = (
            matched_count /
            len(required_skills)
        ) * 100
    else:
        skill_score = 0

    skill_match_scores.append(skill_score)
    matched_skill_counts.append(matched_count)
    missing_skill_counts.append(missing_count)

# =====================================
# FINAL SCORE
# =====================================

final_scores = []

for sim, skill in zip(
        similarity_scores,
        skill_match_scores):

    final_score = (
        (0.4 * sim)
        +
        (0.6 * skill)
    )

    final_scores.append(final_score)

# =====================================
# RESULTS DATAFRAME
# =====================================

results = pd.DataFrame({
    "Candidate_ID": filtered_df["ID"].values,
    "Category": filtered_df["Category"].values,
    "Similarity_Score": similarity_scores,
    "Skill_Match_Score": skill_match_scores,
    "Matched_Skills": matched_skill_counts,
    "Missing_Skills": missing_skill_counts,
    "Final_Score": final_scores
})

# =====================================
# SORT RESULTS
# =====================================

results = results.sort_values(
    by="Final_Score",
    ascending=False
)

# =====================================
# DISPLAY TOP 10
# =====================================

print("\n==============================")
print("TOP 10 CANDIDATES")
print("==============================\n")

print(
    results[
        [
            "Candidate_ID",
            "Category",
            "Final_Score",
            "Matched_Skills"
        ]
    ].head(10)
)

# =====================================
# SAVE CSV
# =====================================

results.to_csv(
    "outputs/ranked_candidates.csv",
    index=False
)

print("\nCSV Saved: outputs/ranked_candidates.csv")

# =====================================
# TOP CANDIDATE ANALYSIS
# =====================================

top_candidate_id = results.iloc[0]["Candidate_ID"]

top_resume = filtered_df[
    filtered_df["ID"] == top_candidate_id
]["Resume_str"].iloc[0]

candidate_skills = extract_skills(
    str(top_resume)
)

matched_skills = list(
    set(candidate_skills)
    &
    set(required_skills)
)

missing_skills = list(
    set(required_skills)
    -
    set(candidate_skills)
)

print("\n==============================")
print("TOP CANDIDATE SKILL ANALYSIS")
print("==============================")

print("\nRequired Skills:")
print(required_skills)

print("\nCandidate Skills:")
print(candidate_skills)

print("\nMatched Skills:")
print(matched_skills)

print("\nMissing Skills:")
print(missing_skills)

# =====================================
# VISUALIZATION
# =====================================

top10 = results.head(10)

plt.figure(figsize=(10, 6))

plt.bar(
    range(len(top10)),
    top10["Final_Score"]
)

plt.xticks(
    range(len(top10)),
    top10["Category"],
    rotation=45
)

plt.title("Top 10 Ranked Candidates")
plt.ylabel("Final Score")

plt.tight_layout()

plt.savefig(
    "outputs/candidate_ranking.png"
)

print(
    "\nChart Saved: outputs/candidate_ranking.png"
)

plt.show()