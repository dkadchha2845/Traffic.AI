import cv2
import math
import numpy as np
from ultralytics import YOLO
import threading
import time
import os

class TrafficVisionTracker:
    def __init__(self, model_path="yolov8n.pt", source=0):
        """
        Initializes the YOLOv8 model for traffic tracking.
        source: can be an integer (webcam), a video file path, or RTMP/HTTP stream URL.
        """
        # Load the pre-trained YOLOv8 nano model (fastest)
        # It will automatically download 'yolov8n.pt' if not present
        self.source = source
        self.running = False
        
        self.custom_model_path = "yolov8n_custom.pt"
        self.base_model_path = model_path
        
        if os.path.exists(self.custom_model_path):
            self.current_model_path = self.custom_model_path
        else:
            self.current_model_path = self.base_model_path
            
        self.model = YOLO(self.current_model_path)
        self.last_modified = os.path.getmtime(self.current_model_path) if os.path.exists(self.current_model_path) else 0
        
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

            # Hot-reload weights dynamically if new fine-tuned models are deployed
            try:
                if self.current_model_path == self.base_model_path and os.path.exists(self.custom_model_path):
                    print("VisionTracker: New custom weights found! Hot-reloading...")
                    self.current_model_path = self.custom_model_path
                    self.model = YOLO(self.current_model_path)
                    self.last_modified = os.path.getmtime(self.current_model_path)
                elif os.path.exists(self.current_model_path):
                    current_modified = os.path.getmtime(self.current_model_path)
                    if current_modified > self.last_modified:
                        print(f"VisionTracker: Detected updated weights for {self.current_model_path}. Hot-reloading...")
                        self.model = YOLO(self.current_model_path)
                        self.last_modified = current_modified
            except Exception:
                pass

            # Run YOLO inference
            # conf=0.3 to filter out weak detections
            # classes=self.vehicle_classes to only detect vehicles
            results = self.model(frame, classes=self.vehicle_classes, conf=0.3, verbose=False)
            
            # Count vehicles and annotate frame
            vehicle_count = 0
            emergency_detected = False
            lanes_count = {"north": 0, "south": 0, "east": 0, "west": 0}
            
            if len(results) > 0:
                vehicle_count = len(results[0].boxes)
                # Parse the bounding boxes for physical queues
                H, W = frame.shape[:2]
                cx, cy = W / 2, H / 2
                
                for box in results[0].boxes:
                    cls_id = int(box.cls[0].cpu().numpy())
                    if cls_id == 7:
                        emergency_detected = True
                    
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    bcx = (x1 + x2) / 2
                    bcy = (y1 + y2) / 2
                    
                    dx = bcx - cx
                    dy = bcy - cy
                    if abs(dx) > abs(dy):
                        if dx > 0:
                            lanes_count["east"] += 1
                        else:
                            lanes_count["west"] += 1
                    else:
                        if dy > 0:
                            lanes_count["south"] += 1
                        else:
                            lanes_count["north"] += 1
                            
                # Plot bounding boxes on the frame
                annotated_frame = results[0].plot()
            else:
                annotated_frame = frame

            self.latest_vehicle_count = vehicle_count
            self.latest_lanes = lanes_count
            self.latest_density = self._calculate_density(vehicle_count)
            self.latest_emergency_detected = emergency_detected
            
            # Encode frame to JPEG for MJPEG streaming
            # Resize a bit to save bandwidth
            small_frame = cv2.resize(annotated_frame, (640, 360))
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 70]
            ret, buffer = cv2.imencode('.jpg', small_frame, encode_param)
            if ret:
                self.latest_frame = buffer.tobytes()
            
            # Throttle processing to ~15 FPS to save CPU
            time.sleep(0.06)
            
        cap.release()
        print("Stopped YOLOv8 tracking.")

    def get_latest_metrics(self):
        """Returns the most recent metrics calculated by the vision model."""
        lanes = getattr(self, "latest_lanes", {"north": 0, "south": 0, "east": 0, "west": 0})
        return {
            "vehicle_count": self.latest_vehicle_count,
            "density_percentage": self.latest_density,
            "lanes": lanes,
            "emergency_detected": getattr(self, "latest_emergency_detected", False)
        }

    def get_latest_frame(self):
        """Returns the latest annotated JPEG frame buffer."""
        return getattr(self, "latest_frame", None)

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
