import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Camera, Loader2, Video } from "lucide-react";
import { API_BASE_URL } from "@/lib/runtimeConfig";
import { useSystemCameras, type SystemCameraSnapshot } from "@/hooks/useSystemStatus";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

function LiveVisionPreview({ camera }: { camera: SystemCameraSnapshot }) {
  const [frameTs, setFrameTs] = useState(Date.now());
  const [frameError, setFrameError] = useState(false);
  const frameEndpoint = camera.frame_endpoint || "/api/vision/frame";

  useEffect(() => {
    setFrameError(false);
    if (!camera.stream_configured || camera.vision_state !== "active") {
      return;
    }

    const timer = setInterval(() => setFrameTs(Date.now()), 3000);
    return () => clearInterval(timer);
  }, [camera.stream_configured, camera.vision_state, frameEndpoint]);

  if (!camera.stream_configured) {
    return (
      <div className="aspect-video rounded-xl border border-primary/20 bg-gradient-to-br from-secondary/50 to-secondary/20 flex items-center justify-center text-center px-6">
        <div>
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
            <Camera className="w-6 h-6 text-primary" />
          </div>
          <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono border border-primary/20 mb-2">
            TELEMETRY MODE
          </span>
          <p className="text-sm text-foreground">No video stream configured for this location</p>
          <p className="text-xs text-muted-foreground mt-1">
            Vehicle counts and congestion data are updated live from TomTom traffic API.
          </p>
        </div>
      </div>
    );
  }

  if (camera.vision_state !== "active" || frameError) {
    return (
      <div className="aspect-video rounded-xl border border-border/20 bg-secondary/30 flex items-center justify-center text-center px-6">
        <div>
          <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-3" />
          <p className="text-sm text-foreground">Direct live vision stream unavailable</p>
          <p className="text-xs text-muted-foreground mt-1">
            Camera telemetry is still available from {camera.data_source.toLowerCase()}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video rounded-xl overflow-hidden border border-border/20 bg-black">
      <img
        src={`${API_BASE_URL}${frameEndpoint}?ts=${frameTs}`}
        alt={`${camera.name} live traffic vision stream`}
        className="w-full h-full object-cover"
        onError={() => setFrameError(true)}
      />
      <div className="absolute top-3 left-3 bg-black/80 rounded-lg px-3 py-2 font-mono text-xs space-y-1">
        <div className="text-white">REC · {new Date(frameTs).toLocaleTimeString()}</div>
        <div className="text-success">{camera.name.toUpperCase()} LIVE STREAM</div>
      </div>
    </div>
  );
}

export default function CameraFeed() {
  const [selected, setSelected] = useState(0);
  const { data, isLoading, isError, error } = useSystemCameras();
  const cameras = data?.cameras ?? [];

  useEffect(() => {
    if (selected >= cameras.length && cameras.length > 0) {
      setSelected(0);
    }
  }, [cameras.length, selected]);

  const selectedCam = cameras[selected] || null;
  const activeCameras = cameras.filter((camera) => camera.available);
  const totalVehicles = activeCameras.reduce((sum, camera) => sum + (camera.vehicle_count ?? 0), 0);
  const hardError =
    isError ? "Unable to fetch live camera telemetry." :
    cameras.length === 0 ? "No live camera locations are currently configured." :
    null;
  const degradedMessage = !hardError && activeCameras.length === 0
    ? "Camera locations are configured, but no live camera telemetry source is currently reporting data."
    : null;

  return (
    <div className="min-h-screen pt-20 pb-8 px-4">
      <div className="container mx-auto space-y-6">
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-wide">LIVE CAMERA TELEMETRY</h1>
            <p className="text-muted-foreground text-sm">
              Per-location vehicle counts and congestion pulled from live backend data sources
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-mono text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              {totalVehicles} live vehicles across {activeCameras.length} active locations
            </span>
          </div>
        </motion.div>

        {selectedCam && (
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-4 border border-border/20">
            <div className="flex items-start gap-3">
              <Video className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-mono text-muted-foreground mb-1">BACKEND STREAM STATUS</div>
                <div className="text-sm text-foreground">
                  {selectedCam.stream_configured
                    ? selectedCam.vision_state === "active"
                      ? "Per-camera backend vision tracker is active."
                      : "Per-camera backend vision tracker is unavailable."
                    : "This location is currently telemetry-only; no direct video stream is configured."}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Vision state: <span className="text-primary">{selectedCam.vision_state}</span>
                  {" · "}
                  Telemetry status: <span className="text-primary">{selectedCam.telemetry_status}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {degradedMessage && (
          <div className="glass rounded-xl p-4 border border-warning/20 text-warning text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {degradedMessage}
          </div>
        )}

        {isLoading ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading live camera telemetry...</p>
          </div>
        ) : hardError ? (
          <div className="glass rounded-2xl p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-3" />
            <p className="text-sm text-warning">{hardError}</p>
            {isError && error instanceof Error && (
              <p className="text-xs text-muted-foreground mt-2">{error.message}</p>
            )}
          </div>
        ) : selectedCam ? (
          <div className="grid lg:grid-cols-3 gap-6">
            <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-3">
              {cameras.map((camera, index) => (
                <button
                  key={camera.id}
                  onClick={() => setSelected(index)}
                  className={`w-full text-left glass rounded-xl overflow-hidden border transition-all ${selected === index ? "border-primary glow-primary" : "border-border/20 hover:border-primary/40"}`}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-sm font-semibold text-foreground">{camera.name}</div>
                        <div className="text-xs text-muted-foreground">{camera.area}</div>
                      </div>
                      <span className={`text-sm font-mono ${camera.available ? "text-primary" : "text-muted-foreground"}`}>
                        {camera.vehicle_count ?? "—"}
                      </span>
                    </div>
                    <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${camera.available ? "bg-primary" : "bg-muted"}`}
                        style={{ width: `${Math.max(0, Math.min(100, camera.congestion ?? 0))}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] font-mono text-muted-foreground">
                      <span>{camera.congestion != null ? `${camera.congestion.toFixed(1)}% congestion` : "Congestion unavailable"}</span>
                      <span>{camera.current_speed_kmph != null ? `${camera.current_speed_kmph.toFixed(1)} km/h` : "Speed unavailable"}</span>
                    </div>
                    <div className="mt-2 text-[10px] font-mono text-muted-foreground">
                      {camera.available ? camera.data_source : "No live source currently reporting for this camera"}
                    </div>
                  </div>
                </button>
              ))}
            </motion.div>

            <motion.div variants={fadeIn} initial="hidden" animate="visible" className="lg:col-span-2 glass rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading font-bold text-foreground">{selectedCam.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedCam.area}
                    {selectedCam.lat != null && selectedCam.lon != null ? ` · ${selectedCam.lat.toFixed(4)}, ${selectedCam.lon.toFixed(4)}` : ""}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-mono border flex items-center gap-1.5 ${
                  selectedCam.available
                    ? "bg-success/10 text-success border-success/20"
                    : "bg-warning/10 text-warning border-warning/20"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedCam.available ? "bg-success animate-pulse" : "bg-warning"}`} />
                  {selectedCam.data_source}
                </span>
              </div>

              <LiveVisionPreview camera={selectedCam} />

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Vehicles", value: selectedCam.vehicle_count != null ? selectedCam.vehicle_count.toString() : "—", tone: "text-primary" },
                  { label: "Congestion", value: selectedCam.congestion != null ? `${selectedCam.congestion.toFixed(1)}%` : "—", tone: "text-warning" },
                  { label: "Speed", value: selectedCam.current_speed_kmph != null ? `${selectedCam.current_speed_kmph.toFixed(1)} km/h` : "—", tone: "text-success" },
                  { label: "Signal Phase", value: selectedCam.signal_phase || "—", tone: "text-cyan" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-4 border border-border/20 bg-secondary/30">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{item.label}</div>
                    <div className={`text-lg font-heading font-bold mt-1 ${item.tone}`}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl p-4 border border-border/20 bg-secondary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Camera className="w-4 h-4 text-primary" />
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Live Source Metadata</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Zone ID</div>
                    <div className="font-mono text-foreground">{selectedCam.zone_id}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last Updated</div>
                    <div className="font-mono text-foreground">{new Date(selectedCam.updated_at).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Snapshot Time</div>
                    <div className="font-mono text-foreground">{selectedCam.snapshot_recorded_at ? new Date(selectedCam.snapshot_recorded_at).toLocaleString() : "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Mode</div>
                    <div className="font-mono text-foreground">{selectedCam.stream_configured ? "Direct live stream" : "Telemetry only"}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
