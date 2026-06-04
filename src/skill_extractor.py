skills = [
    "python",
    "sql",
    "machine learning",
    "deep learning",
    "nlp",
    "data science",
    "tensorflow",
    "pytorch",
    "excel",
    "power bi",
    "tableau",
    "aws",
    "docker",
    "git",
    "java",
    "javascript",
    "html",
    "css",
    "react"
]


def extract_skills(text):

    text = str(text).lower()

    found = []

    for skill in skills:

        if skill.lower() in text:
            found.append(skill)

    return list(set(found))