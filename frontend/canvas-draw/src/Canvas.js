import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

function Canvas({ setGeneratedImage }) {
    const canvasRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const videoRef = useRef(null);

    // State to track input mode: 'mouse' or 'hand'
    const [inputMode, setInputMode] = useState("mouse"); // 'mouse' or 'hand'

    // Ref to track inputMode without causing re-renders
    const inputModeRef = useRef(inputMode);

    // Separate states for mouse drawing
    const [mouseIsDrawing, setMouseIsDrawing] = useState(false);
    const [mouseLastPosition, setMouseLastPosition] = useState(null);
    let selectingColor = false;

    // Refs for hand drawing
    const handIsDrawingRef = useRef(false);
    const handLastPositionRef = useRef(null);

    const [brushSize, setBrushSize] = useState(5);
    const brushSizeRef = useRef(brushSize);
    useEffect(() => {
        brushSizeRef.current = brushSize;
    }, [brushSize]);

    const [color, setColor] = useState("#000000");

    const colorRef = useRef(color);
    useEffect(() => {
        colorRef.current = color;
    }, [color]);

    const [displayColor, setDisplayColor] = useState("#000000");

    // Color Palette
    const colorPalette = [
        "#000000", // Black
        "#FF0000", // Red
        "#00FF00", // Green
        "#0000FF", // Blue
        "#FFFF00", // Yellow
        "#FF00FF", // Magenta
        "#00FFFF", // Cyan
        "#FFFFFF", // White
    ];
    const [currentColorIndex, setCurrentColorIndex] = useState(0);

    // Current color based on palette
    useEffect(() => {
        setColor(colorPalette[currentColorIndex]);
        setDisplayColor(colorPalette[currentColorIndex]);
    }, [currentColorIndex]);

    const [isEraser, setIsEraser] = useState(false);

    // State to track number of hands detected
    const [numHandsDetected, setNumHandsDetected] = useState(0);

    // State for the prompt input
    const [prompt, setPrompt] = useState("");
    const [isListening, setIsListening] = useState(false);
    const recognition =
        typeof window !== "undefined" && "webkitSpeechRecognition" in window ? new window.webkitSpeechRecognition() : null;

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

    const isHandOpen = (handLandmarks) => {
        // For index, middle, ring, and pinky fingers:
        // Check if the tip is above the PIP joint (y-coordinate is smaller)
        const indexOpen = handLandmarks[8].y < handLandmarks[6].y;
        const middleOpen = handLandmarks[12].y < handLandmarks[10].y;
        const ringOpen = handLandmarks[16].y < handLandmarks[14].y;
        const pinkyOpen = handLandmarks[20].y < handLandmarks[18].y;

        // For the thumb:
        // Determine if the thumb is extended outwards.
        // This can vary based on hand orientation, but a basic check can be:
        // If the thumb tip is to the left of the IP joint for the left hand
        // or to the right for the right hand. Adjust based on your canvas mirroring.

        // Assume you have handedness information; if not, you might need to infer it.
        // For simplicity, let's assume all hands are facing the same direction.
        const thumbOpen = Math.abs(handLandmarks[4].x - handLandmarks[3].x) > 0.02; // Adjust threshold as needed

        return indexOpen && middleOpen && ringOpen && pinkyOpen && thumbOpen;
    };

    const isThumbsUp = (handLandmarks) => {
        // Ensure there are enough landmarks
        if (!handLandmarks || handLandmarks.length < 21) return false;

        // Thumb: Check if the thumb tip is above the IP joint (indicating it's extended upwards)
        const thumbTipY = handLandmarks[4].y;
        const thumbIPY = handLandmarks[3].y;
        const thumbUp = thumbTipY < thumbIPY;

        // Index Finger: Folded (tip below PIP joint)
        const indexTipY = handLandmarks[8].y;
        const indexPIPY = handLandmarks[6].y;
        const indexFolded = indexTipY > indexPIPY;

        // Middle Finger: Folded
        const middleTipY = handLandmarks[12].y;
        const middlePIPY = handLandmarks[10].y;
        const middleFolded = middleTipY > middlePIPY;

        // Ring Finger: Folded
        const ringTipY = handLandmarks[16].y;
        const ringPIPY = handLandmarks[14].y;
        const ringFolded = ringTipY > ringPIPY;

        // Pinky Finger: Folded
        const pinkyTipY = handLandmarks[20].y;
        const pinkyPIPY = handLandmarks[18].y;
        const pinkyFolded = pinkyTipY > pinkyPIPY;

        // Determine if it's a thumbs up
        const thumbsUp = thumbUp && indexFolded && middleFolded && ringFolded && pinkyFolded;

        return thumbsUp;
    };

    function drawHandCursor(fingerTip) {
        const overlayCanvas = overlayCanvasRef.current;
        if (!overlayCanvas) return;
        const ctx = overlayCanvas.getContext("2d");
        // Clear the overlay each frame
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        const x = fingerTip.x * overlayCanvas.width;
        const y = fingerTip.y * overlayCanvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(0, 0, 255, 0.5)";
        ctx.fill();
    }

    const startListening = () => {
        if (!recognition) {
            alert("Speech recognition is not supported in this browser.");
            return;
        }

        recognition.lang = "en-US"; // Set the language
        recognition.interimResults = false; // Only final results
        recognition.continuous = false; // Stop after one result

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setPrompt((prev) => `${prev} ${transcript}`);
        };

        recognition.start();
    };

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

        if (handsDetected >= 1) {
            const firstHandLandmarks = results.multiHandLandmarks[0];
            const indexFingerTip = firstHandLandmarks[8];
            const thumbTip = firstHandLandmarks[4];
            const dx = indexFingerTip.x - thumbTip.x;
            const dy = indexFingerTip.y - thumbTip.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const pinchThreshold = 0.03;

            if (handsDetected >= 2) {
                const secondHandLandmarks = results.multiHandLandmarks[1];
                if (isHandOpen(secondHandLandmarks)) {
                    if (distance < pinchThreshold) {
                        setBrushSize((prev) => prev + 1);
                    }
                    if (isThumbsUp(firstHandLandmarks)) {
                        if (!selectingColor) {
                            selectingColor = true;
                            setTimeout(() => {
                                selectingColor = false;
                                setCurrentColorIndex((prev) => (prev + 1) % colorPalette.length);
                            }, 500);
                        }
                    }
                } else {
                    if (distance < pinchThreshold) {
                        setBrushSize((prev) => prev - 1);
                    }
                }
            } else {
                if (inputModeRef.current !== "hand") {
                    console.log("Two hands detected. Switching to hand mode.");
                    setInputMode("hand");
                    inputModeRef.current = "hand"; // Update ref to prevent immediate re-switching
                }

                // **Use the first hand for drawing**

                // Choose a pinch threshold

                drawHandCursor(indexFingerTip);

                if (distance < pinchThreshold) {
                    // Pinched: draw
                    drawWithHand(indexFingerTip);
                } else {
                    // Not pinched: stop drawing
                    handIsDrawingRef.current = false;
                    handLastPositionRef.current = null;
                }
            }
            // Two hands detected, enable hand drawing
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

    function drawWithHand(fingerTip) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        // Apply brush size and color
        ctx.lineWidth = brushSizeRef.current; // <- Make sure brushSize is from state
        ctx.strokeStyle = colorRef.current; // <- Make sure brushColor is from state
        ctx.lineCap = "round";

        if (!handIsDrawingRef.current) {
            handIsDrawingRef.current = true;
            handLastPositionRef.current = { x: fingerTip.x, y: fingerTip.y };
        } else {
            const lastPos = handLastPositionRef.current;
            ctx.beginPath();
            ctx.moveTo(lastPos.x * canvas.width, lastPos.y * canvas.height);
            ctx.lineTo(fingerTip.x * canvas.width, fingerTip.y * canvas.height);
            ctx.stroke();
            handLastPositionRef.current = { x: fingerTip.x, y: fingerTip.y };
        }
    }

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
        console.log(brushSize);
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
                    position: "relative",
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
            <div style={{ position: "relative", height: "480px" }}>
                <canvas
                    ref={canvasRef}
                    width={640}
                    height={480}
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
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
                <canvas
                    ref={overlayCanvasRef}
                    // cursor overlay canvas
                    width={640}
                    height={480}
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        pointerEvents: "none",
                        transform: "scaleX(-1)",
                        margin: "0 auto 10px",
                    }}
                />
            </div>

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
                <div style={{ display: "flex", alignItems: "flex-start" }}>
                    <button
                        type="button"
                        onClick={startListening}
                        style={{
                            padding: "4px 12px",
                            backgroundColor: isListening ? "#f0ad4e" : "#007bff",
                            color: "white",
                            border: "none",
                            cursor: "pointer",
                        }}
                    >
                        {isListening ? "Listening..." : "Start Listening"}
                    </button>
                    <input
                        type="text"
                        id="prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Type your prompt here..."
                        style={{
                            width: "100%",
                            padding: "10px",
                            boxSizing: "border-box",
                            marginBottom: "10px",
                            marginRight: "10px",
                        }}
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        style={{
                            padding: "5px 20px",
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
        </div>
    );
}

export default Canvas;
