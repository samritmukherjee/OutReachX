from fastapi import FastAPI

app = FastAPI(
    title="OutreachX Backend",
    description="AI-powered outreach & WhatsApp simulator backend",
    version="0.1.0"
)

@app.get("/")
def root():
    return {"status": "OutreachX backend is running 🚀"}
