"use client";

import { useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface RocketCanvasProps {
    className?: string; // Additional classes
}

export default function RocketCanvas({ className }: RocketCanvasProps) {
    const { t } = useI18n();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [images, setImages] = useState<HTMLImageElement[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);

    // Scroll Progress
    const { scrollYProgress } = useScroll();

    // Smooth the scroll progress
    const smoothScroll = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    const frameCount = 191; // Detected 191 frames, adjusting from 120 to use full sequence

    // Transform scroll (0-1) to frame index (0-frameCount)
    // We use a MotionValue to track frame index
    const frameIndex = useTransform(smoothScroll, [0, 1], [0, frameCount]);

    useEffect(() => {
        // Preload images in parallel batches for fast loading
        const loadImages = async () => {
            const BATCH_SIZE = 20;
            const allImages: HTMLImageElement[] = new Array(frameCount + 1);
            let loaded = 0;
            let successCount = 0;

            for (let batch = 0; batch <= frameCount; batch += BATCH_SIZE) {
                const batchEnd = Math.min(batch + BATCH_SIZE - 1, frameCount);
                const promises = [];

                for (let i = batch; i <= batchEnd; i++) {
                    const img = new window.Image();
                    img.crossOrigin = "anonymous";
                    img.src = `/sequence/${i.toString().padStart(3, "0")}.jpg`;
                    promises.push(
                        new Promise<void>((resolve) => {
                            img.onload = () => {
                                allImages[i] = img;
                                loaded++;
                                successCount++;
                                setLoadProgress(Math.round((loaded / (frameCount + 1)) * 100));
                                resolve();
                            };
                            img.onerror = () => {
                                // Don't store failed images
                                loaded++;
                                setLoadProgress(Math.round((loaded / (frameCount + 1)) * 100));
                                resolve();
                            };
                        })
                    );
                }

                await Promise.all(promises);
            }

            // Only set images if at least some loaded successfully
            if (successCount > 0) {
                setImages(allImages);
            }
            setIsLoaded(true);
        };

        loadImages().catch((err) => {
            console.warn("Failed to load image sequence:", err);
            setIsLoaded(true);
        });
    }, []);

    useEffect(() => {
        if (!canvasRef.current || images.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        const TRIM_FACTOR = 0.12;

        // Find the first valid image to get source dimensions
        const firstValidImage = images.find((img) => img && img.naturalWidth > 0);
        if (!firstValidImage) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            return;
        }

        // Size the canvas to fill the viewport
        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);

        const render = () => {
            const index = Math.min(
                frameCount,
                Math.max(0, Math.round(frameIndex.get()))
            );

            const img = images[index];
            if (img && img.naturalWidth > 0) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Source crop: trim sides by TRIM_FACTOR to keep the focus area
                const cropX = img.naturalWidth * TRIM_FACTOR;
                const srcX = cropX;
                const srcW = img.naturalWidth - cropX * 2;
                const srcH = img.naturalHeight;

                // Destination: cover the full canvas while keeping the center
                const srcAspect = srcW / srcH;
                const canvasAspect = canvas.width / canvas.height;

                let dstW: number, dstH: number, dstX: number, dstY: number;

                if (canvasAspect > srcAspect) {
                    // Canvas is wider than source - fit to width, crop top/bottom
                    dstW = canvas.width;
                    dstH = canvas.width / srcAspect;
                    dstX = 0;
                    dstY = (canvas.height - dstH) / 2;
                } else {
                    // Canvas is taller than source - fit to height, crop sides
                    dstH = canvas.height;
                    dstW = canvas.height * srcAspect;
                    dstX = (canvas.width - dstW) / 2;
                    dstY = 0;
                }

                ctx.drawImage(
                    img,
                    srcX, 0, srcW, srcH,
                    dstX, dstY, dstW, dstH
                );
            }
        };

        const unsubscribe = frameIndex.on("change", render);
        render();

        // Also re-render on resize so it stays full-bleed
        const onResize = () => {
            resizeCanvas();
            render();
        };
        window.addEventListener("resize", onResize);

        return () => {
            unsubscribe();
            window.removeEventListener("resize", resizeCanvas);
            window.removeEventListener("resize", onResize);
        };
    }, [images, frameIndex]);

    return (
        <div className={cn("fixed top-0 left-0 w-full h-screen z-0 bg-white flex items-center justify-center", className)}>
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-white z-50">
                    <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-600 transition-all duration-100 ease-out"
                            style={{ width: `${loadProgress}%` }}
                        />
                    </div>
                    <p className="absolute mt-8 text-sm text-gray-500 font-medium">{t("loading.text")}</p>
                </div>
            )}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
            />
        </div>
    );
}
