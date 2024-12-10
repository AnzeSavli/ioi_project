import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import Replicate from "replicate";
import { Buffer } from "buffer"; // Node.js Buffer for handling binary data
import fetch from "node-fetch";
import { writeFile } from "fs/promises";

// Load environment variables from .env file
dotenv.config();

// Initialize Replicate
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
    userAgent: "your-app-name", // Replace with your app's name or URL
});

// Define the Stable Diffusion Model
const model = "stability-ai/stable-diffusion-img2img:15a3689ee13b0d2616e98820eca31d4c3abcd36672df6afce5cb6feb1d66087d";

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" })); // Increase limit if necessary

// Route to handle image generation
app.post("/generate", async (req, res) => {
    const { prompt, image } = req.body;

    if (!prompt || !image) {
        return res.status(400).json({ error: "Prompt and image are required." });
    }

    try {
        // Extract Base64 data from Data URL
        const matches = image.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ error: "Invalid image format." });
        }

        const imageBuffer = Buffer.from(matches[2], "base64");

        // **Optional:** If you need to process the image before sending to Replicate, do it here.
        // For example, save the image locally or perform any transformations.

        // **Note:** The Replicate API typically expects a publicly accessible image URL.
        // Since you're sending the image as Base64, you might need to host it temporarily.
        // However, for demonstration purposes, we'll assume Replicate can accept the image as a buffer.

        // Prepare inputs for Replicate API
        const inputs = {
            prompt: prompt,
            image: image, // Passing the data URL directly
            width: 512,
            height: 512,
            scheduler: "DPMSolverMultistep",
            num_outputs: 1,
            guidance_scale: 7.5,
            prompt_strength: 0.65,
            num_inference_steps: 25,
        };

        console.log("Calling Replicate API with inputs:", inputs);

        // Call the Replicate API
        const outputs = await replicate.run(model, { input: inputs });

        const generatedImageUrl = outputs[0];

        console.log("Generated Image URL:", generatedImageUrl);

        // **Handle the Replicate API Response:**
        // Assuming Replicate returns an image URL, fetch the image data.
        const responseImage = await fetch(generatedImageUrl);
        const arrayBuffer = await responseImage.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await writeFile("./output.png", buffer); // Save the image locally
        // Convert buffer to Base64
        const base64Image = buffer.toString("base64");

        res.json({ generatedImage: base64Image });
    } catch (error) {
        console.error("Error generating image:", error);
        res.status(500).json({ error: "Failed to generate image." });
    }
});

// Start the Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
