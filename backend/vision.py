import math
import threading
import time
import os
from typing import Any

# Optional heavy deps — backend starts without them (YOLO is a bonus feature)
try:
    import cv2
    import numpy as np
    from ultralytics import YOLO
    _VISION_AVAILABLE = True
except ImportError as _e:
    print(f"[vision] OpenCV/Ultralytics not available: {_e}. YOLO features disabled.")
    cv2 = None  # type: ignore
    np = None   # type: ignore
    YOLO = None  # type: ignore
    _VISION_AVAILABLE = False

class TrafficVisionTracker:
    def __init__(self, model_path="yolov8n.pt", source=None, camera_id: str = "primary"):
        """
        Initializes the YOLOv8 model for traffic tracking.
        source: can be an integer (webcam), a video file path, or RTMP/HTTP stream URL.
        """
        # Load the pre-trained YOLOv8 nano model (fastest)
        # It will automatically download 'yolov8n.pt' if not present
        self.camera_id = camera_id
        self.source = source
        self.running = False
        self.model = None
        self.latest_lanes = {"north": 0, "south": 0, "east": 0, "west": 0}
        self.latest_emergency_detected = False
        self.latest_frame = None
        self.latest_updated_at = None
        self.latest_vehicle_count = 0
        self.latest_density = 0.0
        self.vehicle_classes = [2, 3, 5, 7]  # 2: car, 3: motorcycle, 5: bus, 7: truck
        self.roi = None
        self.thread = None
        self._status = "not_installed"
        self._last_error = None

        if not _VISION_AVAILABLE:
            print("[vision] YOLO unavailable — install ultralytics + opencv-python to enable.")
            self._last_error = "OpenCV/Ultralytics not installed"
            return

        if source in (None, ""):
            self._status = "disconnected"
            self._last_error = "No camera source configured"
            return

        self.custom_model_path = "yolov8n_custom.pt"
        self.base_model_path = model_path

        if os.path.exists(self.custom_model_path):
            self.current_model_path = self.custom_model_path
        else:
            self.current_model_path = self.base_model_path

        self.model = YOLO(self.current_model_path)
        self.last_modified = os.path.getmtime(self.current_model_path) if os.path.exists(self.current_model_path) else 0
        
        self._status = "active" if _VISION_AVAILABLE else "not_installed"

    def _calculate_density(self, count, max_capacity=50):
        """Calculate traffic density as a percentage of max capacity."""
        density = (count / max_capacity) * 100
        return min(max(density, 0.0), 100.0)
    def start_tracking(self):
        """Starts the tracking loop in a background thread."""
        if self.running:
            return
        if self.source in (None, ""):
            self._status = "disconnected"
            self._last_error = "No camera source configured"
            return
        if not _VISION_AVAILABLE or self.model is None:
            self._status = "not_installed"
            return
        self.running = True
        self._status = "starting"
        self.thread = threading.Thread(target=self._tracking_loop, daemon=True)
        self.thread.start()

    def stop_tracking(self):
        """Stops the tracking background thread."""
        self.running = False
        if self.thread:
            self.thread.join()
        if _VISION_AVAILABLE:
            self._status = "disconnected"

    def _tracking_loop(self):
        if not _VISION_AVAILABLE:
            print("[vision] _tracking_loop: YOLO disabled, skipping.")
            self.running = False
            self._status = "not_installed"
            return
        # Open video capture
        cap = cv2.VideoCapture(self.source)

        if not cap.isOpened():
            print(f"Error: Could not open video source {self.source}")
            self.running = False
            self._status = "disconnected"
            self._last_error = f"Could not open video source {self.source}"
            return

        print(f"Started YOLOv8 tracking on source: {self.source}")
        self._status = "active"

        while self.running:
            ret, frame = cap.read()
            if not ret:
                # If stream ends, loop it if it's a file, or break
                print("End of video stream or error reading frame.")
                self._status = "degraded"
                self._last_error = "Video source produced no frame"
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
            self.latest_updated_at = time.time()
            self._status = "active"
            self._last_error = None
            
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
        if self._status == "active":
            self._status = "disconnected"
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

    def get_status(self):
        return {
            "status": self._status,
            "last_error": self._last_error,
            "running": self.running,
            "source_configured": self.source not in (None, ""),
            "last_updated_at": self.latest_updated_at,
        }

    def get_snapshot(self):
        metrics = self.get_latest_metrics()
        status = self.get_status()
        return {
            "camera_id": self.camera_id,
            "vehicle_count": metrics["vehicle_count"],
            "density_percentage": metrics["density_percentage"],
            "lanes": metrics["lanes"],
            "emergency_detected": metrics["emergency_detected"],
            "frame_available": self.get_latest_frame() is not None,
            "last_updated_at": status.get("last_updated_at"),
            "status": status.get("status"),
            "last_error": status.get("last_error"),
            "source_configured": status.get("source_configured"),
        }


class MultiCameraVisionManager:
    def __init__(self, camera_configs: list[dict[str, Any]], model_path: str = "yolov8n.pt"):
        self.camera_configs = {camera["id"]: dict(camera) for camera in camera_configs}
        self.trackers: dict[str, TrafficVisionTracker] = {}
        for camera in camera_configs:
            self.trackers[camera["id"]] = TrafficVisionTracker(
                model_path=model_path,
                source=camera.get("source"),
                camera_id=camera["id"],
            )

    def start_all(self):
        for tracker in self.trackers.values():
            tracker.start_tracking()

    def stop_all(self):
        for tracker in self.trackers.values():
            tracker.stop_tracking()

    def get_camera_ids(self):
        return list(self.trackers.keys())

    def get_tracker(self, camera_id: str) -> TrafficVisionTracker | None:
        return self.trackers.get(camera_id)

    def get_status(self, camera_id: str):
        tracker = self.get_tracker(camera_id)
        if not tracker:
            return {"status": "unknown", "last_error": "Camera not found", "running": False, "source_configured": False, "last_updated_at": None}
        return tracker.get_status()

    def get_latest_metrics(self, camera_id: str):
        tracker = self.get_tracker(camera_id)
        if not tracker:
            return {"vehicle_count": 0, "density_percentage": 0.0, "lanes": {"north": 0, "south": 0, "east": 0, "west": 0}, "emergency_detected": False}
        return tracker.get_latest_metrics()

    def get_latest_frame(self, camera_id: str):
        tracker = self.get_tracker(camera_id)
        if not tracker:
            return None
        return tracker.get_latest_frame()

    def get_snapshot(self, camera_id: str):
        tracker = self.get_tracker(camera_id)
        if not tracker:
            return None
        camera_config = self.camera_configs.get(camera_id, {})
        return {
            **camera_config,
            **tracker.get_snapshot(),
        }

    def get_all_snapshots(self):
        return [self.get_snapshot(camera_id) for camera_id in self.get_camera_ids()]

    def get_primary_camera_id(self):
        for camera in self.camera_configs.values():
            if camera.get("primary_stream"):
                return camera["id"]
        camera_ids = self.get_camera_ids()
        return camera_ids[0] if camera_ids else None

    def get_preferred_camera_id(self):
        primary_id = self.get_primary_camera_id()
        primary_status = self.get_status(primary_id) if primary_id else {"status": "unknown"}
        if primary_id and primary_status.get("status") == "active":
            return primary_id

        for camera_id in self.get_camera_ids():
            if self.get_status(camera_id).get("status") == "active":
                return camera_id

        return primary_id

    def get_aggregate_status(self):
        statuses = [self.get_status(camera_id) for camera_id in self.get_camera_ids()]
        active_count = sum(1 for status in statuses if status.get("status") == "active")
        configured_count = sum(1 for status in statuses if status.get("source_configured"))

        if active_count > 0:
            status = "active"
            error = None
        elif configured_count > 0:
            status = "degraded"
            error = "Configured cameras are not currently producing frames"
        elif _VISION_AVAILABLE:
            status = "disconnected"
            error = "No camera sources configured"
        else:
            status = "not_installed"
            error = "OpenCV/Ultralytics not installed"

        return {
            "status": status,
            "active_count": active_count,
            "configured_count": configured_count,
            "camera_count": len(statuses),
            "last_error": error,
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
