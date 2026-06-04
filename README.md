# Candidate Matching & Resume Ranking System

An NLP-based recruitment automation system that ranks resumes against a job description. The system combines TF-IDF semantic similarity with direct skill-matching metrics to generate a comprehensive, weighted final score for each candidate.

---

## 🚀 Key Features

*   **Job Description Skill Extraction**: Automatically identifies required skills from the job description.
*   **Resume Text Preprocessing**: Cleans and normalizes resume text (lowercasing, punctuation removal, and stopword filtering) using `nltk`.
*   **TF-IDF Semantic Similarity**: Computes cosine similarity between the job description and candidate resumes using `scikit-learn`'s `TfidfVectorizer`.
*   **Skill Match Scoring**: Cross-references candidate resumes for the presence of required skills to calculate an exact matching ratio.
*   **Hybrid Evaluation Model**: Combines semantic similarity ($40\%$) and skill match score ($60\%$) to calculate the final ranking.
*   **Insights and Analytics**:
    *   Saves the complete ranked candidate list as a CSV.
    *   Generates a visualization chart of the top 10 candidates.
    *   Provides a detailed skill-gap analysis (matched vs. missing skills) for the top candidate.

---

## 📁 Project Structure

```text
FUTURE_ML_03/
│
├── data/
│   ├── Resume.csv               # Main resume dataset (CSV format)
│   └── job_description.txt     # Target job description text file
│
├── src/
│   ├── preprocessing.py         # Text cleaning and preprocessing functions
│   └── skill_extractor.py       # Rule-based skill extraction logic
│
├── outputs/
│   ├── ranked_candidates.csv    # Final ranked output list
│   └── candidate_ranking.png    # Bar chart of the top 10 candidates
│
├── app.py                       # Main application driver script
├── .gitignore                   # Excluded files list
└── README.md                    # Project documentation
```

---

## 🛠️ Setup & Installation

### Prerequisites

Make sure you have **Python 3.8+** installed on your system.

### 1. Clone the Repository
```bash
git clone https://github.com/MD-FAIZ0453/FUTURE_ML_03.git
cd FUTURE_ML_03
```

### 2. Set Up a Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
Make sure you have `pandas`, `scikit-learn`, `matplotlib`, and `nltk` installed:
```bash
pip install pandas scikit-learn matplotlib nltk
```

---

## 💻 How to Run

1. Place your main dataset in `data/Resume.csv`.
2. Update the target job description in `data/job_description.txt`.
3. Run the main driver script:
```bash
python app.py
```

---

## 📊 Evaluation Logic

The final candidate ranking is calculated using the following formula:

$$\text{Final Score} = (0.4 \times \text{Similarity Score}) + (0.6 \times \text{Skill Match Score})$$

Where:
*   **Similarity Score**: The cosine similarity percentage between the TF-IDF representation of the job description and the cleaned resume text.
*   **Skill Match Score**: The percentage of required skills found in the candidate's resume:
    $$\text{Skill Match Score} = \left( \frac{\text{Number of Matched Skills}}{\text{Total Required Skills}} \right) \times 100$$
