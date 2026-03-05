import cv2
import math
import numpy as np
from ultralytics import YOLO
import threading
import time

class TrafficVisionTracker:
    def __init__(self, model_path="yolov8n.pt", source=0):
        """
        Initializes the YOLOv8 model for traffic tracking.
        source: can be an integer (webcam), a video file path, or RTMP/HTTP stream URL.
        """
        # Load the pre-trained YOLOv8 nano model (fastest)
        # It will automatically download 'yolov8n.pt' if not present
        self.model = YOLO(model_path)
        self.source = source
        self.running = False
        
        # COCO class IDs for vehicles
        self.vehicle_classes = [2, 3, 5, 7] # 2: car, 3: motorcycle, 5: bus, 7: truck
        
        # State to store the latest count
        self.latest_vehicle_count = 0
        self.latest_density = 0.0 # 0.0 to 100.0%
        
        # Define region of interest (ROI) if needed (mock for now, assume whole frame)
        self.roi = None 
        
        self.thread = None

    def _calculate_density(self, count, max_capacity=50):
        """Calculate traffic density as a percentage of max capacity."""
        density = (count / max_capacity) * 100
        return min(max(density, 0.0), 100.0)

    def start_tracking(self):
        """Starts the tracking loop in a background thread."""
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._tracking_loop, daemon=True)
        self.thread.start()

    def stop_tracking(self):
        """Stops the tracking background thread."""
        self.running = False
        if self.thread:
            self.thread.join()

    def _tracking_loop(self):
        # Open video capture
        cap = cv2.VideoCapture(self.source)
        
        if not cap.isOpened():
            print(f"Error: Could not open video source {self.source}")
            self.running = False
            return
            
        print(f"Started YOLOv8 tracking on source: {self.source}")

        while self.running:
            ret, frame = cap.read()
            if not ret:
                # If stream ends, loop it if it's a file, or break
                print("End of video stream or error reading frame.")
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0) # loop video
                time.sleep(1) # wait a bit before trying again
                continue

            # Run YOLO inference
            # conf=0.3 to filter out weak detections
            # classes=self.vehicle_classes to only detect vehicles
            results = self.model(frame, classes=self.vehicle_classes, conf=0.3, verbose=False)
            
            # Count vehicles
            vehicle_count = 0
            if len(results) > 0:
                # results[0].boxes contains the bounding boxes
                vehicle_count = len(results[0].boxes)

            self.latest_vehicle_count = vehicle_count
            self.latest_density = self._calculate_density(vehicle_count)
            
            # Throttle processing to ~10 FPS to save CPU
            time.sleep(0.1)
            
        cap.release()
        print("Stopped YOLOv8 tracking.")

    def get_latest_metrics(self):
        """Returns the most recent metrics calculated by the vision model."""
        return {
            "vehicle_count": self.latest_vehicle_count,
            "density_percentage": self.latest_density
        }

if __name__ == "__main__":
    # Simple test script
    # Use 0 for webcam, or path to a sample traffic video like 'sample.mp4'
    tracker = TrafficVisionTracker(source=0) 
    tracker.start_tracking()
    
    try:
        for _ in range(10):
            time.sleep(1)
            metrics = tracker.get_latest_metrics()
            print(f"Vision Metrics: {metrics['vehicle_count']} vehicles, {metrics['density_percentage']:.1f}% density")
    finally:
        tracker.stop_tracking()
