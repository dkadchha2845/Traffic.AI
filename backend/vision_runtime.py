from camera_config import get_camera_configs
from vision import MultiCameraVisionManager

camera_configs = get_camera_configs()
vision_manager = MultiCameraVisionManager(camera_configs)
