import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

function Canvas({ setGeneratedImage }) {
    const canvasRef = useRef(null);
    const videoRef = useRef(null);

    // State to track input mode: 'mouse' or 'hand'
    const [inputMode, setInputMode] = useState("mouse"); // 'mouse' or 'hand'

    // Ref to track inputMode without causing re-renders
    const inputModeRef = useRef(inputMode);

    // Separate states for mouse drawing
    const [mouseIsDrawing, setMouseIsDrawing] = useState(false);
    const [mouseLastPosition, setMouseLastPosition] = useState(null);

    // Refs for hand drawing
    const handIsDrawingRef = useRef(false);
    const handLastPositionRef = useRef(null);

    const [brushSize, setBrushSize] = useState(5);
    const [color, setColor] = useState("#000000");
    const [isEraser, setIsEraser] = useState(false);

    // State to track number of hands detected
    const [numHandsDetected, setNumHandsDetected] = useState(0);

    // State for the prompt input
    const [prompt, setPrompt] = useState("");

    // State for submission status
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Update inputModeRef whenever inputMode changes
    useEffect(() => {
        inputModeRef.current = inputMode;
    }, [inputMode]);

    useEffect(() => {
        if (typeof window === "undefined") return; // Ensure code runs only on client

        const loadHands = async () => {
            if (!videoRef.current) {
                console.error("Video element not found.");
                return;
            }

            const hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
            });

            hands.setOptions({
                maxNumHands: 2, // Detect up to 2 hands
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });

            hands.onResults(onResults);

            try {
                const camera = new Camera(videoRef.current, {
                    onFrame: async () => {
                        if (videoRef.current) {
                            await hands.send({ image: videoRef.current });
                        }
                    },
                    width: 640,
                    height: 480,
                });

                await camera.start();
                console.log("Camera started successfully.");
            } catch (error) {
                console.error("Failed to start camera:", error);
            }
        };

        loadHands();
    }, []);

    const onResults = (results) => {
        if (!results.multiHandLandmarks) {
            // No hands detected
            if (inputModeRef.current === "hand") {
                console.log("No hands detected. Switching to mouse mode.");
                setInputMode("mouse");
                inputModeRef.current = "mouse"; // Update ref to prevent immediate re-switching
                handIsDrawingRef.current = false;
                handLastPositionRef.current = null;
            }
            setNumHandsDetected(0);
            return;
        }

        const handsDetected = results.multiHandLandmarks.length;
        setNumHandsDetected(handsDetected);

        if (handsDetected === 2) {
            // Two hands detected, enable hand drawing
            if (inputModeRef.current !== "hand") {
                console.log("Two hands detected. Switching to hand mode.");
                setInputMode("hand");
                inputModeRef.current = "hand"; // Update ref to prevent immediate re-switching
            }

            // **Use the first hand for drawing**
            const firstHandLandmarks = results.multiHandLandmarks[0];
            const indexFingerTip = firstHandLandmarks[8];
            drawWithHand(indexFingerTip);
        } else {
            // Less than two hands detected, switch to mouse mode if currently in hand mode
            if (inputModeRef.current === "hand") {
                console.log("Less than two hands detected. Switching to mouse mode.");
                setInputMode("mouse");
                inputModeRef.current = "mouse"; // Update ref to prevent immediate re-switching
                handIsDrawingRef.current = false;
                handLastPositionRef.current = null;
            }
        }
    };

    const drawWithHand = (fingerTip) => {
        const canvas = canvasRef.current;
        if (!canvas) {
            console.error("Canvas element not found.");
            return;
        }
        const ctx = canvas.getContext("2d");

        // **Do not invert the x-coordinate in hand mode**
        const x = fingerTip.x * canvas.width;
        const y = fingerTip.y * canvas.height;

        // Debugging logs
        console.log(`Hand Position: x=${x.toFixed(2)}, y=${y.toFixed(2)}`);

        if (!handIsDrawingRef.current) {
            // Start drawing with hand
            handIsDrawingRef.current = true;
            handLastPositionRef.current = { x, y };
            console.log("Hand drawing started.");
            return; // Do not draw on the first detection to avoid jumping
        }

        if (handIsDrawingRef.current && handLastPositionRef.current) {
            ctx.lineWidth = brushSize;
            ctx.lineCap = "round";
            ctx.strokeStyle = isEraser ? "#ffffff" : color;

            ctx.beginPath();
            ctx.moveTo(handLastPositionRef.current.x, handLastPositionRef.current.y);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.closePath();

            console.log(
                `Hand Drawn Line: From (${handLastPositionRef.current.x.toFixed(2)}, ${handLastPositionRef.current.y.toFixed(
                    2
                )}) to (${x.toFixed(2)}, ${y.toFixed(2)})`
            );

            // Update the last position
            handLastPositionRef.current = { x, y };
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
            console.error("Canvas element not found.");
            return;
        }
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        console.log("Canvas cleared.");
    };

    // Mouse event handlers for drawing with the mouse
    const handleMouseDown = (e) => {
        if (inputModeRef.current !== "mouse") return; // Only allow mouse drawing in 'mouse' mode
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        setMouseIsDrawing(true);
        setMouseLastPosition({
            // Invert the x-coordinate
            x: canvas.width - (e.clientX - rect.left),
            y: e.clientY - rect.top,
        });
        console.log("Mouse Down:", { x: canvas.width - (e.clientX - rect.left), y: e.clientY - rect.top });
    };

    const handleMouseMove = (e) => {
        if (inputModeRef.current !== "mouse" || !mouseIsDrawing) return; // Only allow mouse drawing in 'mouse' mode
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = canvas.width - (e.clientX - rect.left);
        const y = e.clientY - rect.top;

        const ctx = canvas.getContext("2d");
        ctx.lineWidth = brushSize;
        ctx.lineCap = "round";
        ctx.strokeStyle = isEraser ? "#ffffff" : color;

        ctx.beginPath();
        ctx.moveTo(mouseLastPosition.x, mouseLastPosition.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.closePath();

        setMouseLastPosition({ x, y });
        console.log("Mouse Move:", { x, y });
    };

    const handleMouseUp = () => {
        if (inputModeRef.current !== "mouse") return; // Only allow mouse drawing in 'mouse' mode
        setMouseIsDrawing(false);
        setMouseLastPosition(null);
        console.log("Mouse Up");
    };

    // Handler to submit prompt and canvas image
    const handleSubmit = async () => {
        if (!prompt.trim()) {
            alert("Please enter a prompt.");
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) {
            alert("Canvas not available.");
            return;
        }

        // Convert canvas to data URL
        const imageDataUrl = canvas.toDataURL("image/png");

        setIsSubmitting(true);

        try {
            const response = await fetch("http://localhost:5000/generate", {
                // Ensure this URL matches your backend
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt: prompt,
                    image: imageDataUrl,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Unknown error occurred.");
            }

            const data = await response.json();

            // Assuming the API returns the image as a Base64 string in data.generatedImage
            setGeneratedImage(`data:image/png;base64,${data.generatedImage}`);

            console.log("Image generated successfully.");
            alert("Image generated successfully!");
        } catch (error) {
            console.error("Failed to generate image:", error);
            alert(`Failed to generate image: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            {/* Existing Drawing Controls */}
            <div style={{ marginBottom: "10px" }}>
                <label>
                    Brush Size:
                    <input
                        type="number"
                        value={brushSize}
                        min="1"
                        max="50"
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        style={{ marginLeft: "5px" }}
                    />
                </label>
                <div
                    style={{
                        display: "inline-block",
                        textAlign: "center",
                        marginLeft: "5px",
                        position: "relative",
                        verticalAlign: "middle",
                    }}
                >
                    <span
                        style={{
                            display: "inline-block",
                            width: "30px",
                            height: "30px",
                            backgroundColor: color,
                            border: "1px solid #ccc",
                            cursor: "pointer",
                            position: "relative",
                        }}
                    >
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            style={{
                                opacity: 0,
                                position: "absolute",
                                left: 0,
                                top: 0,
                                width: "100%",
                                height: "100%",
                                cursor: "pointer",
                                border: "none",
                                padding: 0,
                                margin: 0,
                            }}
                        />
                    </span>
                    <div>Color</div>
                </div>
                <button onClick={clearCanvas} style={{ marginLeft: "10px" }}>
                    Clear
                </button>
                <button onClick={() => setIsEraser(!isEraser)} style={{ marginLeft: "10px" }}>
                    {isEraser ? "Eraser On" : "Eraser Off"}
                </button>
                {/* Toggle Input Mode */}
                <button
                    onClick={() => setInputMode(inputMode === "mouse" ? "hand" : "mouse")}
                    style={{ marginLeft: "10px" }}
                >
                    Switch to {inputMode === "mouse" ? "Hand" : "Mouse"} Drawing
                </button>
            </div>

            {/* Video Preview */}
            <video
                ref={videoRef}
                style={{
                    display: "block",
                    margin: "0 auto 10px",
                    width: "640px",
                    height: "480px",
                    border: "1px solid red", // Added border for visibility
                    transform: "scaleX(-1)",
                }}
                autoPlay
                muted
            ></video>

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                width={640}
                height={480}
                style={{
                    border: inputMode === "hand" ? "3px solid blue" : "1px solid #000", // Change border color based on mode
                    cursor: "crosshair",
                    backgroundColor: "#ffffff",
                    transform: "scaleX(-1)", // Conditionally flip the canvas
                    display: "block",
                    margin: "0 auto 10px",
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            />

            {/* Status Display */}
            <div>
                Current Mode: {inputMode === "mouse" ? "Mouse" : "Hand"} Drawing
                {inputMode === "hand" && ` | Hands Detected: ${numHandsDetected}`}
            </div>

            {/* Prompt Input and Submit Button */}
            <div style={{ marginTop: "20px", textAlign: "left" }}>
                <label htmlFor="prompt" style={{ display: "block", marginBottom: "5px" }}>
                    Enter Prompt:
                </label>
                <input
                    type="text"
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Type your prompt here..."
                    style={{
                        width: "100%",
                        padding: "8px",
                        boxSizing: "border-box",
                        marginBottom: "10px",
                    }}
                />
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    style={{
                        padding: "10px 20px",
                        backgroundColor: "#4CAF50",
                        color: "white",
                        border: "none",
                        cursor: "pointer",
                    }}
                >
                    {isSubmitting ? "Submitting..." : "Generate Image"}
                </button>
            </div>
        </div>
    );
}

export default Canvas;
