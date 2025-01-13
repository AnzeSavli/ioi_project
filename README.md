# Requirements:

-   Node.js
-   npm
-   Replicate account (https://replicate.com/)

# Installation:

-   Go to replicate and get [API token](https://replicate.com/account/api-tokens).

-   Move to my-replicate-app:

```console
cd ./my-replicate-app
```

-   Create .env file and paste this line:

```console
REPLICATE_API_TOKEN=YOUR_TOKEN_GOES_HERE
```

-   Start backend server:

```console
npm i
npm start
```

-   In a seperate terminal move to frontend -> canvas-draw:

```console
cd ./frontend/canvas-draw
```

-   Start frontend server:

```console
npm i
npm start
```

-   Local server should startup and open in your browser if it doesn't go to (http://localhost:3000).

# How to use:

-   To start drawing you need to allow camera and microphone access.
-   You should see your camera image and canvas under it. When the camera detects one hand a cursor will appear on the canvas. By pinching your index finger and thumb you start drawing.
-   To change brush size you need to have two hands on camera. If your first hand is open by pinching your second hand index finger and thumb the brush gets larger. If your first hand is closed into a fist, by pinching your second hand index finger and thumb the brush gets smaller.
-   To change color you also need to have two hands on camera. If your first hand is open you can change circle predefined colors by showing thumbs up on the second hand.
-   To enter prompt by voice click start listening button and start talking your prompt.
-   When you are happy with your inputs click "Generate image" button and wait. The generated image will display on the right side.
