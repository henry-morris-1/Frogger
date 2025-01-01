/** Module imports */
import Car from "./modules/Car.js";
import Frog from "./modules/Frog.js";
import Globals from "./modules/Globals.js";
import Log from "./modules/Log.js";
import Surface from "./modules/Surface.js";
import Turtle from "./modules/Turtle.js";

/** Vertex attributes */
let vertexPositionAttrib; // Vertex position
let vertexNormalAttrib; // Vertex normal
let vertexAmbientAttrib; // Vertex ambient color
let vertexDiffuseAttrib; // Vertex diffuse color
let vertexSpecularAttrib; // Vertex specular color
let vertexUVAttrib; // Vertex uv

/** Matrix and helper uniforms */
let modelMatrixUniform; // Model matrix
let normalMatrixUniform; // Normal matrix
let reflectivityUniform; // Model reflectivity
let alphaUniform; // Model alpha
let textureUniform; // Model texture

/** Frame rate variables */
const frameRate = 60;
const frameDuration = 1000 / frameRate;
let prev, curr;

/** Game state variables */
let pause = false;
let cursorHidden = false;
let gameOver = false;
let win = false;


/**
 * Sets up the WebGL environment.
 */
function setupWebGL() {
    // Create a canvas, set its width and heigh to fill the screen, and get the aspect ratio
    Globals.canvas = document.getElementById("myWebGLCanvas");
    Globals.canvas.width = 1.25 * window.innerWidth;
    Globals.canvas.height = 1.25 * window.innerHeight;
    Globals.aspectRatio = Math.max(4/3, Globals.canvas.width / Math.max(1, Globals.canvas.height)); // Smallest ratio allowed is 4:3

    // Get a WebGL object from the main canvas
    Globals.gl = Globals.canvas.getContext("webgl");

    try {
        if (Globals.gl == null) {
            throw "unable to create Globals.gl context -- is your browser Globals.gl ready?";
        } else {
            Globals.gl.clearDepth(1.0); // use max when we clear the depth buffer
            Globals.gl.enable(Globals.gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
            Globals.gl.pixelStorei(Globals.gl.UNPACK_FLIP_Y_WEBGL, true); // Flip textures to the bottom-to-top order that WebGL expects
            Globals.gl.enable(Globals.gl.BLEND); // Enable blending textures
            Globals.gl.blendFunc(Globals.gl.SRC_ALPHA, Globals.gl.ONE_MINUS_SRC_ALPHA); // Blend using alphas
            Globals.gl.viewport(0, 0, Globals.canvas.width, Globals.canvas.height); // Set the viewport to the canvas size
        }
    } catch(e) {
        console.log(e);
    }
}

/**
 * Loads models and textures into buffers.
 */
function setupModels() {
    // Load game surface
    Globals.surface = new Surface();

    // Load cars
    for (let i = 1; i <= Globals.carCounts.length; i++) {
        for (let j = 1; j <= Globals.carCounts[i-1]; j++) {
            Globals.cars.push(new Car(i, j));
        }
    }

    // Load logs
    for (let i = 1; i <= Globals.logCounts.length; i++) {
        for (let j = 1; j <= Globals.logCounts[i-1]; j++) {
            Globals.logs.push(new Log(i, j));
        }
    }

    // Load turtles
    for (let i = 1; i <= Globals.turtleCounts.length; i++) {
        for (let j = 1; j <= Globals.turtleCounts[i-1]; j++) {
            Globals.turtles.push(new Turtle(i, j));
        }
    }

    // Load frogs
    for (let i = 0; i < 4; i++) Globals.dummyFrogs.push(new Frog("dummy"));
    Globals.frog = new Frog("hero");
}

/**
 * Sets up WebGL shaders.
 */
function setupShaders() {
    // Define fragment shader in essl using es6 template strings
    let fShaderCode = `
        varying lowp vec3 vVertexPosition, vEyePosition, vLightPosition;
        varying lowp vec3 vNormal;
        varying lowp vec3 vAmbientColor, vDiffuseColor, vSpecularColor;
        varying lowp vec2 vUV;

        uniform lowp float uReflectivity;
        uniform lowp float uAlpha;
        uniform sampler2D uTexture;

        lowp vec3 normalVector, lightVector, viewVector, halfVector;
        lowp float diffuseWeight, specularWeight;
        lowp vec4 shadedColor, textureColor;
        lowp vec4 one, multiply, screen, overlay;
        lowp float gray, threshold;

        void main(void) {
            normalVector = normalize(vNormal);
            lightVector = normalize(vLightPosition - vVertexPosition);
            viewVector = normalize(vEyePosition - vVertexPosition);
            halfVector = normalize(lightVector + viewVector);

            diffuseWeight = max(dot(normalVector, lightVector), 0.0);
            specularWeight = pow(max(dot(normalVector, halfVector), 0.0), uReflectivity);

            shadedColor = vec4(vAmbientColor + (vDiffuseColor * diffuseWeight) + (vSpecularColor * specularWeight), uAlpha);
            textureColor = texture2D(uTexture, vUV);

            if (textureColor.a < 0.001)
                discard;

            gl_FragColor = textureColor * shadedColor;
        }
    `;
    
    // Define vertex shader in essl using es6 template strings
    let vShaderCode = `
        attribute vec3 aVertexPosition;
        attribute vec3 aVertexNormal;
        attribute vec3 aAmbientColor;
        attribute vec3 aDiffuseColor;
        attribute vec3 aSpecularColor;
        attribute vec2 aVertexUV;

        uniform mat4 uModelMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uProjectionMatrix;
        uniform mat3 uNormalMatrix;
        uniform vec3 uEyePosition;
        uniform vec3 uLightPosition;

        varying lowp vec3 vVertexPosition, vEyePosition, vLightPosition;
        varying lowp vec3 vNormal;
        varying lowp vec3 vAmbientColor, vDiffuseColor, vSpecularColor;
        varying vec2 vUV;

        lowp vec4 vertexTransformed, eyeTransformed, lightTransformed;

        void main(void) {
            vertexTransformed = uViewMatrix * uModelMatrix * vec4(aVertexPosition, 1.0);
            eyeTransformed = uViewMatrix * vec4(uEyePosition, 1.0);
            lightTransformed = uViewMatrix * vec4(uLightPosition, 1.0);

            gl_Position = uProjectionMatrix * vertexTransformed;
            
            vVertexPosition = vertexTransformed.xyz / vertexTransformed.w;
            vEyePosition = eyeTransformed.xyz / eyeTransformed.w;
            vLightPosition = lightTransformed.xyz / lightTransformed.w;
            vNormal = uNormalMatrix * normalize(aVertexNormal);

            vAmbientColor = aAmbientColor;
            vDiffuseColor = aDiffuseColor;
            vSpecularColor = aSpecularColor;

            vUV = aVertexUV;
        }
    `;
    
    try {
        let fShader = Globals.gl.createShader(Globals.gl.FRAGMENT_SHADER); // create frag shader
        Globals.gl.shaderSource(fShader,fShaderCode); // attach code to shader
        Globals.gl.compileShader(fShader); // compile the code for gpu execution

        let vShader = Globals.gl.createShader(Globals.gl.VERTEX_SHADER); // create vertex shader
        Globals.gl.shaderSource(vShader,vShaderCode); // attach code to shader
        Globals.gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!Globals.gl.getShaderParameter(fShader, Globals.gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + Globals.gl.getShaderInfoLog(fShader);  

        } else if (!Globals.gl.getShaderParameter(vShader, Globals.gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + Globals.gl.getShaderInfoLog(vShader);  

        } else {
            // no compile errors
            let shaderProgram = Globals.gl.createProgram(); // create the single shader program
            Globals.gl.attachShader(shaderProgram, fShader); // put frag shader in program
            Globals.gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            Globals.gl.linkProgram(shaderProgram); // link program into Globals.gl context

            if (!Globals.gl.getProgramParameter(shaderProgram, Globals.gl.LINK_STATUS)) {
                // bad program link
                throw "error during shader program linking: " + Globals.gl.getProgramInfoLog(shaderProgram);

            } else {
                // Activate shader program (fragment and vertex)
                Globals.gl.useProgram(shaderProgram);

                // Get pointer to vertex shader inputs:
                // Position and normal vectors
                vertexPositionAttrib = Globals.gl.getAttribLocation(shaderProgram, "aVertexPosition"); 
                Globals.gl.enableVertexAttribArray(vertexPositionAttrib);
                vertexNormalAttrib = Globals.gl.getAttribLocation(shaderProgram, "aVertexNormal");
                Globals.gl.enableVertexAttribArray(vertexNormalAttrib);

                // Model, view, projection, and normal matrix uniforms
                modelMatrixUniform = Globals.gl.getUniformLocation(shaderProgram, "uModelMatrix");
                Globals.viewMatrixUniform = Globals.gl.getUniformLocation(shaderProgram, "uViewMatrix");
                Globals.projectionMatrixUniform = Globals.gl.getUniformLocation(shaderProgram, "uProjectionMatrix");
                normalMatrixUniform = Globals.gl.getUniformLocation(shaderProgram, "uNormalMatrix");

                // Eye and light position uniforms
                Globals.eyePositionUniform = Globals.gl.getUniformLocation(shaderProgram, "uEyePosition");
                Globals.lightPositionUniform = Globals.gl.getUniformLocation(shaderProgram, "uLightPosition");

                // uvs and texture
                vertexUVAttrib = Globals.gl.getAttribLocation(shaderProgram, "aVertexUV");
                Globals.gl.enableVertexAttribArray(vertexUVAttrib);
                textureUniform = Globals.gl.getUniformLocation(shaderProgram, "uTexture");

                // Vertex colors
                vertexAmbientAttrib = Globals.gl.getAttribLocation(shaderProgram, "aAmbientColor");
                Globals.gl.enableVertexAttribArray(vertexAmbientAttrib);
                vertexDiffuseAttrib = Globals.gl.getAttribLocation(shaderProgram, "aDiffuseColor");
                Globals.gl.enableVertexAttribArray(vertexDiffuseAttrib);
                vertexSpecularAttrib = Globals.gl.getAttribLocation(shaderProgram, "aSpecularColor");
                Globals.gl.enableVertexAttribArray(vertexSpecularAttrib);
                reflectivityUniform = Globals.gl.getUniformLocation(shaderProgram, "uReflectivity");
                alphaUniform = Globals.gl.getUniformLocation(shaderProgram, "uAlpha");
            }
        }
    } catch(e) {
        console.log(e);
    }
}

/**
 * Adds event listeners for player controls.
 */
function setupListeners() {
    /**
     * Function to call whenever the game is being reset
     */
    function resetEvent() {
        // Freeze the game, wait 100 milliseconds, then reset it to ensure everything loads in sync
        document.getElementById("pauseScreen").style.display = "none";
        document.getElementById("endScreen").style.display = "none";
        document.getElementById("loadingScreen").style.display = "block"; // Display the loading dialogue
        Globals.freeze = true; // Freeze the game
        setTimeout(() => {
            Globals.loading = true;
            resetGame();
        }, 10); // Wait and reset
    }

    /**
     * Function to call whenever pause is toggled
     */
    function pauseEvent() {
        if (!gameOver) {
            if (pause) {
                // Begin the game again
                document.getElementById("pauseScreen").style.display = "none";
                requestAnimationFrame(renderModels);
                pause = false;
            } else {
                // Put up the pause screen
                document.getElementById("pauseScreen").style.display = "block";
                pause = true;
            }
        }
    }

    window.addEventListener("keydown", (k) => {
        switch (k.code) {
            case "KeyW":
            case "ArrowUp":
                document.body.style.cursor = "none"; // Hide the cursor
                cursorHidden = true;
                Globals.timeout || Globals.frog.moveForward(); // Move forward if there is no timeout
                break;

            case "KeyA":
            case "ArrowLeft":
                document.body.style.cursor = "none";
                cursorHidden = true;
                Globals.timeout || Globals.frog.moveLeft();
                break;

            case "KeyS":
            case "ArrowDown":
                document.body.style.cursor = "none";
                cursorHidden = true;
                Globals.timeout || Globals.frog.moveDown();
                break;

            case "KeyD":
            case "ArrowRight":
                document.body.style.cursor = "none";
                cursorHidden = true;
                Globals.timeout || Globals.frog.moveRight();
                break;

            case "Escape":
                // Only pause if the game is active
                pauseEvent();
                break;
            
            case "KeyR":
                resetEvent();
                break;
        }
    });

    // Listen for clicks on reset buttons
    document.querySelectorAll(".reset").forEach(button => { button.addEventListener("click", resetEvent) });

    // Listen for mouse movements to reveal the cursor if it was hidden
    window.addEventListener("mousemove", () => {
        if (cursorHidden) {
            document.body.style.cursor = "default";
            cursorHidden = false;
        }
    });
}

/**
 * Reloads models and resets the game state.
 */
function resetGame() {
    // Delete buffers and textures
    for (let i = 0; i < Globals.modelSetCount; i++) {
        Globals.gl.deleteBuffer(Globals.vertexBuffers[i]);
        Globals.gl.deleteBuffer(Globals.triangleBuffers[i]);
        Globals.gl.deleteBuffer(Globals.normalBuffers[i]);
        Globals.gl.deleteBuffer(Globals.ambientBuffers[i]);
        Globals.gl.deleteBuffer(Globals.specularBuffers[i]);
        Globals.gl.deleteBuffer(Globals.uvBuffers[i]);
        Globals.gl.deleteTexture(Globals.textureBuffers[i]);
    }

    // Reset buffers and model variables to empty arrays / zero
    Globals.vertexBuffers = [], Globals.normalBuffers = [], Globals.ambientBuffers = [], Globals.diffuseBuffers = [], 
    Globals.specularBuffers = [], Globals.reflectivityBuffers = [], Globals.alphaBuffers = [], Globals.textureBuffers = [], 
    Globals.uvBuffers = [], Globals.triangleBuffers = [], Globals.triangleBufferSizes = [];
    Globals.modelSetCount = 0;

    // Delete model arrays
    Globals.surface = undefined, Globals.frog = undefined;
    Globals.dummyFrogs = [], Globals.logs = [], Globals.cars = [], Globals.turtles = [];

    // Load models and textures into the WebGL buffers
    setupModels();

    // Request the next frame to start the game again
    requestAnimationFrame(renderModels);

    // Reset the game state
    Globals.timeout = false, Globals.freeze = false, pause = false, gameOver = false, win = false;
    Globals.lives = 3;
    Globals.home = [false, false, false, false, false];
    Globals.homeCount = 0;
    Globals.floatCycle = 75;
    Globals.eye.resetPosition();
    Globals.frog.resetPosition();

    // Reset the score panel
    document.getElementById("score").innerHTML = "Lily Pads: " + Globals.homeCount;
    document.getElementById("lives").innerHTML = "Lives: " + Globals.lives;
}

/**
 * Handles the user win state.
 */
function userWin() {
    // Reveal the "you win" message
    document.getElementById("message").innerHTML = "YOU WIN!";
    document.getElementById("endScreen").style.display = "block";
}

/**
 * Handles the user lose state.
 */
function userLose() {
    // Freeze after losing
    Globals.freeze = true;

    // Reveal the "game over" message
    document.getElementById("message").innerHTML = "GAME OVER";
    document.getElementById("endScreen").style.display = "block";
}

/**
 * Renders the loaded model and adjusts the world for each frame.
 */
function renderModels(timestamp) {
    // Get the current timestamp
    prev = prev || timestamp;
    curr = timestamp;
    let deltaTime = curr - prev || 0;

    // Update for the current frame
    Globals.eye.updatePosition(); // Eye
    Globals.cars.forEach(car => { car.updatePosition(deltaTime) }); // Cars
    Globals.logs.forEach(log => { log.updatePosition(deltaTime) }); // Logs
    Globals.turtles.forEach(turtle => { turtle.updatePosition(deltaTime) }); // Turtles
    Globals.floatCycle = (Globals.floatCycle + (0.06 * deltaTime)) % 250; // Increment float cycle (250 steps = 1 cycle)
    Globals.frog.updatePosition(deltaTime); // Player model

    // Set prev to curr
    prev = curr;

    if (!Globals.freeze) {
        Globals.frog.checkScore(); // Check for scoring

        // Check collisions for losing a life
        if (Globals.frog.checkCollision()) {
            Globals.lives--; // Decrement lives
            Globals.frog.deathReset(); // Reset player
            window.setTimeout(() => { requestAnimationFrame(renderModels) }, 1000); // Set timeout to restart the animation
            document.getElementById("lives").innerHTML = `Lives: ${Globals.lives}`; // Update scoreboard
        }
    }

    // Clear frame/depth buffers
    Globals.gl.clear(Globals.gl.COLOR_BUFFER_BIT | Globals.gl.DEPTH_BUFFER_BIT);

    // Render each model
    for (let i = 0; i < Globals.modelSetCount; i++) {
        // Set up the model and normal matrices
        // These are unique to each triangle set
        Globals.gl.uniformMatrix4fv(modelMatrixUniform, false, Globals.modelMatrices[i]);
        mat3.normalFromMat4(Globals.normalMatrix, mat4.multiply(mat4.create(), Globals.viewMatrix, Globals.modelMatrices[i]));
        Globals.gl.uniformMatrix3fv(normalMatrixUniform, false, Globals.normalMatrix);

        // Vertex position buffer
        Globals.gl.bindBuffer(Globals.gl.ARRAY_BUFFER, Globals.vertexBuffers[i]);
        Globals.gl.vertexAttribPointer(vertexPositionAttrib, 3, Globals.gl.FLOAT, false, 0, 0);

        // Vertex normal buffer
        Globals.gl.bindBuffer(Globals.gl.ARRAY_BUFFER, Globals.normalBuffers[i]);
        Globals.gl.vertexAttribPointer(vertexNormalAttrib, 3, Globals.gl.FLOAT, false, 0, 0);

        // Color buffers
        // Ambient
        Globals.gl.bindBuffer(Globals.gl.ARRAY_BUFFER, Globals.ambientBuffers[i]);
        Globals.gl.vertexAttribPointer(vertexAmbientAttrib, 3, Globals.gl.FLOAT, false, 0, 0);
        // Diffuse
        Globals.gl.bindBuffer(Globals.gl.ARRAY_BUFFER, Globals.diffuseBuffers[i]);
        Globals.gl.vertexAttribPointer(vertexDiffuseAttrib, 3, Globals.gl.FLOAT, false, 0, 0);
        // Specular
        Globals.gl.bindBuffer(Globals.gl.ARRAY_BUFFER, Globals.specularBuffers[i]);
        Globals.gl.vertexAttribPointer(vertexSpecularAttrib, 3, Globals.gl.FLOAT, false, 0, 0);
        // Reflectivity
        Globals.gl.uniform1f(reflectivityUniform, Globals.reflectivityBuffers[i]);
        // Alpha
        Globals.gl.uniform1f(alphaUniform, Globals.alphaBuffers[i]);

        // Textures
        // uvs
        Globals.gl.bindBuffer(Globals.gl.ARRAY_BUFFER, Globals.uvBuffers[i]);
        Globals.gl.vertexAttribPointer(vertexUVAttrib, 2, Globals.gl.FLOAT, false, 0, 0);
        // Texture objects
        Globals.gl.bindTexture(Globals.gl.TEXTURE_2D, Globals.textureBuffers[i]);
        Globals.gl.uniform1i(textureUniform, 0);

        // Triangle buffer
        Globals.gl.bindBuffer(Globals.gl.ELEMENT_ARRAY_BUFFER, Globals.triangleBuffers[i]);
        Globals.gl.drawElements(Globals.gl.TRIANGLES, Globals.triangleBufferSizes[i], Globals.gl.UNSIGNED_SHORT, 0);
    }

    // If the program was loading, we can now hide the screen and set the flag to false
    if (Globals.loading) {
        // Rudimentary function to check if each value is true
        const checker = arr => arr.every(Boolean);

        // If each texture has loaded, set loading to false and hide the loading screen
        if (checker(Globals.loadingArray)) {
            Globals.loading = false;
            document.getElementById("loadingScreen").style.display = "none";
        }
    }

    // Check if the game is over and if the user won
    gameOver = (Globals.homeCount === 5 || Globals.lives === 0) ? true : false;
    win = (Globals.homeCount === 5) ? true : false;

    // Request the next frame unless paused/gameover
    if (gameOver) {
        // If the game is over, let the user know if they won or lost
        win ? userWin() : userLose();

    } else if (!pause && !Globals.freeze) {
        // If the game is paused, don't request the next frame
        requestAnimationFrame(renderModels);
    }
}

/**
 * Call setup functions in order to load the game.
 */
setupWebGL(); // Set up the WebGL environment
setupModels(); // Load models and textures into the WebGL buffers
setupShaders(); // Set up the WebGL shaders
setupListeners(); // Set up event listeners for player control
renderModels(); // Draw the models using WebGL