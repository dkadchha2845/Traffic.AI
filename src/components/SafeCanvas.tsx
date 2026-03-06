import React, { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import ErrorBoundary from "./ErrorBoundary";

interface SafeCanvasProps extends React.ComponentProps<typeof Canvas> {
    fallbackClassName?: string;
    componentName?: string;
}

const SafeCanvas: React.FC<SafeCanvasProps> = ({
    children,
    fallbackClassName = "bg-gradient-to-br from-background via-secondary/20 to-background",
    componentName = "3D Graphics",
    ...canvasProps
}) => {
    const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);

    useEffect(() => {
        try {
            const canvas = document.createElement("canvas");
            const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            setWebglAvailable(!!gl);
        } catch (e) {
            setWebglAvailable(false);
        }
    }, []);

    if (webglAvailable === false) {
        return (
            <div className={`w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3 ${fallbackClassName} border border-border/10 rounded-2xl`}>
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <span className="text-orange-500 text-lg">⚠️</span>
                </div>
                <div className="space-y-1">
                    <h4 className="font-heading font-medium text-xs tracking-wider opacity-60">HARDWARE ACCELERATION DISABLED</h4>
                    <p className="text-[10px] text-muted-foreground font-mono max-w-[200px]">
                        WebGL is unavailable in this environment. Interactive visualization is disabled.
                    </p>
                </div>
            </div>
        );
    }

    // Still checking
    if (webglAvailable === null) {
        return <div className={`w-full h-full ${fallbackClassName} animate-pulse`} />;
    }

    return (
        <ErrorBoundary name={componentName}>
            <Suspense fallback={<div className={`w-full h-full ${fallbackClassName} animate-pulse`} />}>
                <Canvas {...canvasProps}>
                    {children}
                </Canvas>
            </Suspense>
        </ErrorBoundary>
    );
};

export default SafeCanvas;
