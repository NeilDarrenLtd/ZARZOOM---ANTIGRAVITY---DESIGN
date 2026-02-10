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
                                setLoadProgress(Math.round((loaded / (frameCount + 1)) * 100));
                                resolve();
                            };
                            img.onerror = () => {
                                allImages[i] = img;
                                loaded++;
                                setLoadProgress(Math.round((loaded / (frameCount + 1)) * 100));
                                resolve();
                            };
                        })
                    );
                }

                await Promise.all(promises);
            }

            setImages(allImages);
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

        // Set canvas size (handled by CSS generally, but we need internal resolution)
        // We'll set it to match the image aspect ratio or window
        // For now, let's look at the first image dimensions once loaded
        // User requested trimming black lines (horizontal crop). 
        // Let's assume a standard letterbox/pillarbox removal is needed.
        // Adjust TRIM_FACTOR as needed (e.g., 0.1 = 10% from left and 10% from right)
        const TRIM_FACTOR = 0.12;

        if (images[0]) {
            const cropX = images[0].naturalWidth * TRIM_FACTOR;
            canvas.width = images[0].naturalWidth - (cropX * 2);
            canvas.height = images[0].naturalHeight;
        }

        const render = () => {
            const index = Math.min(
                frameCount,
                Math.max(0, Math.round(frameIndex.get()))
            );

            const img = images[index];
            if (img) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const cropX = img.naturalWidth * TRIM_FACTOR;
                const sourceWidth = img.naturalWidth - (cropX * 2);

                // Draw image with cropping
                ctx.drawImage(
                    img,
                    cropX, 0, sourceWidth, img.naturalHeight, // Source rectangle
                    0, 0, canvas.width, canvas.height         // Destination rectangle
                );
            }
        };

        // Subscribing to frameIndex changes
        const unsubscribe = frameIndex.on("change", render);

        // Initial render
        render();

        return () => unsubscribe();
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
                className="w-full h-full object-cover"
            />
        </div>
    );
}
