from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .engine import SimulationEngine

app = FastAPI(title="Rice Yield Simulator Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = SimulationEngine()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"service": "rice-yield-simulator", "message": "Backend is running"}


@app.get("/snapshot")
def snapshot():
    return engine.get_snapshot()


@app.post("/control")
def control(payload: dict = Body(...)):
    action = payload.get("action")
    if action == "start":
        engine.start()
    elif action == "start_instant":
        engine.start_instant()
    elif action == "pause":
        engine.pause()
    elif action == "resume":
        engine.resume()
    elif action == "reset":
        engine.reset()
    else:
        raise HTTPException(status_code=400, detail="Unknown action")
    return {"status": "ok"}


@app.post("/speed")
def speed(payload: dict = Body(...)):
    if "multiplier" not in payload:
        raise HTTPException(status_code=400, detail="Missing multiplier")
    engine.set_speed(float(payload["multiplier"]))
    return {"status": "ok"}


@app.post("/params")
def params(payload: dict = Body(...)):
    engine.update_params(payload)
    return {"status": "ok"}
