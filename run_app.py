import os
import uvicorn
import webbrowser
from threading import Timer

def open_browser():
    webbrowser.open("http://127.0.0.1:8000")

if __name__ == "__main__":
    print("--------------------------------------------------")
    print("NammaFlow: Event-Driven Congestion Mitigation Platform")
    print("Bengaluru Traffic Control Room Simulator")
    print("--------------------------------------------------")
    print("Starting FastAPI app server...")
    
    # Open browser automatically after 1.5 seconds
    Timer(1.5, open_browser).start()
    
    # Run server
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
