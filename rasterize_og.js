/**
 * @file rasterize.js
 * @author Henry Morris
 * 
 * 3D Frogger using WebGL.
 */

/* Assignment specific globals */
const WIN_Z = 0;  // Default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1; // Default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1; // Default top and bottom y coords in world space

/** WebGL object and canvases */
let gl = null; // WebGL object
let canvas; // WebGL canvas
let aspectRatio; // Canvas aspect ratio

/** Buffers and helper values. Sets represented as indices in the arrays */
const vertexBuffers = []; // Vertex coordinates
const normalBuffers = []; // Vertex normals
const ambientBuffers = []; // Vertex ambient colors
const diffuseBuffers = []; // Vertex diffuse colors
const specularBuffers = []; // Vertex specular colors
const reflectivityBuffers = []; // Vertex reflectivity
const alphaBuffers = []; // Vertex alpha
const textureBuffers = []; // Object textures
const uvBuffers = []; // Object uv coordinates
const triangleBuffers = []; // Triangle vertex indices
const triangleBufferSizes = []; // Triangle vertex counts
let modelSetCount = 0; // Number of sets loaded

/** Vertex attributes */
let vertexPositionAttrib; // Vertex position
let vertexNormalAttrib; // Vertex normal
let vertexAmbientAttrib; // Vertex ambient color
let vertexDiffuseAttrib; // Vertex diffuse color
let vertexSpecularAttrib; // Vertex specular color
let vertexUVAttrib; // Vertex uv

/** Matrices and helper values */
const modelCenters = []; // Array of model center points
const modelMatrices = []; // Array of model matrices for each set
let viewMatrix; // View matrix
let projectionMatrix; // Projection matrix
let normalMatrix; // Normal matrix
let eyePosition; // Eye position in space
let lightPosition; // Light position in space
let lookAtPoint; // Point in space being looked at
let lookUpVector; // Vector pointing up

/** Matrix and helper uniforms */
let modelMatrixUniform; // Model matrix
let viewMatrixUniform; // View matrix
let projectionMatrixUniform; // Projection matrix
let normalMatrixUniform; // Normal matrix
let eyePositionUniform; // Eye position
let lightPositionUniform; // Light position
let reflectivityUniform; // Model reflectivity
let alphaUniform; // Model alpha
let textureUniform; // Model texture

/** Transformation helpers */
const translate = mat4.create();
const rotate = mat4.create();
const scale = mat4.create();

/** Game state variables */
let loading = true; // Flag for the game loading
let timeout = false; // Timeout to prevent movement when resetting the player
let freeze = false; // Stops rendering new frames
let pause = false; // Game paused by user
let gameOver = false; // Game over flag
let win = false; // Win state flag
let lives = 3; // Number of lives
let invincible = false; // Flag for invincibility
let cursorHidden = false; // Flag for if the cursor is hidden, which happens whenever the user starts playing
let home; // Array of boolean flags to track which homes have been reached
let homeCount; // Number of homes reached
let laneCounts = [4, 7, 8, 10, 13, 15, 18, 20, 21, 24, 27, 30]; // Running total of obsticle in each lane
let lastThree = [0, 0, 0]; // Last three camera movement speeds to average
let floatCycle = 75; // Counter for cycling the floating and sinking of the turtles

/** Variables for interesting mode */
let interesting = false; // Boolean flag for interesting mode
let cooldown = 0; // Cooldown timer for using the explosion again
let explosionSound; // Explosion sound

/**
 * Sets up the WebGL environment.
 */
function setupWebGL() {
    // Create a canvas, set its width and heigh to fill the screen, and get the aspect ratio
    canvas = document.getElementById("myWebGLCanvas");
    canvas.width = 1.25 * window.innerWidth;
    canvas.height = 1.25 * window.innerHeight;
    aspectRatio = Math.max(4/3, canvas.width / Math.max(1, canvas.height)); // Smallest ratio allowed is 4:3

    // Get a WebGL object from the main canvas
    gl = canvas.getContext("webgl");

    try {
        if (gl == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // Flip textures to the bottom-to-top order that WebGL expects
            gl.enable(gl.BLEND); // Enable blending textures
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // Blend using alphas
            gl.viewport(0, 0, canvas.width, canvas.height); // Set the viewport to the canvas size
        }
    } catch(e) {
        console.log(e);
    }
}

/**
 * Loads car models into the game. Cars are placed in all five lanes with
 * appropriate scale, spacing, and rotation to account for their driving 
 * direction. Cars are also assigned a randomly colored texture for visual 
 * interest.
 */
function loadCars() {
    // Loop for each car to load in all five lanes
    for (let i = 0; i < laneCounts[4]; i++) {
        // Load the car model
        loadModel("car.json");

        // Load a randomly colored texture in for the car
        let r = Math.random();
        if (r < 0.25)
            textureBuffers[i] = loadTexture("car_red.png");
        else if (r < 0.5)
            textureBuffers[i] = loadTexture("car_blue.png");
        else if (r < 0.75)
            textureBuffers[i] = loadTexture("car_green.png");
        else
            textureBuffers[i] = loadTexture("car_yellow.png");

        // Translate to center for uniform scaling/rotations
        modelCenters[i] = vec3.fromValues(0, 1.4, 0); // Manually set the center
        mat4.fromTranslation(translate, vec3.negate(vec3.create(), modelCenters[i]));
        mat4.multiply(modelMatrices[i], translate, modelMatrices[i]);
        vec3.transformMat4(modelCenters[i], modelCenters[i], translate);

        // Rotate cars in the first, third, and fifth lanes since they drive the other
        // direction
        if (i < laneCounts[0] || (i >= laneCounts[1] && i < laneCounts[2]) || i >= laneCounts[3]) {
            mat4.fromRotation(rotate, Math.PI, vec3.fromValues(0,1,0));
            mat4.multiply(modelMatrices[i], rotate, modelMatrices[i]);
        }

        // Scale to fit the lanes
        mat4.fromScaling(scale, vec3.fromValues(0.25, 0.25, 0.25));
        mat4.multiply(modelMatrices[i], scale, modelMatrices[i]);

        // Translate back to the "starting location"
        mat4.fromTranslation(translate, vec3.fromValues(13.5, 0.35, 1.5));
        mat4.multiply(modelMatrices[i], translate, modelMatrices[i]);
        vec3.transformMat4(modelCenters[i], modelCenters[i], translate);

        // Place the cars in each lane
        // Start by getting a translation vector based on the lane the car is in
        if (i < laneCounts[0])
            vec3.set(direction, i * -3.667, 0, 0); // Lane 1
        else if (i < laneCounts[1])
            vec3.set(direction, (i - laneCounts[0]) * -5, 0, 1); // Lane 2
        else if (i < laneCounts[2])
            vec3.set(direction, (i - laneCounts[1]) * -2, 0, 2); // Lane 3
        else if (i < laneCounts[3])
            vec3.set(direction, (i - laneCounts[2]) * -6.667, 0, 3); // Lane 4
        else
            vec3.set(direction, (i - laneCounts[3]) * -3, 0, 4); // Lane 5
        mat4.fromTranslation(translate, direction); // Get the appropriate translation matrix
        mat4.multiply(modelMatrices[i], translate, modelMatrices[i]); // Translate model matrix
        vec3.transformMat4(modelCenters[i], modelCenters[i], translate); // Translate center
    }
}

/**
 * Loads log models into the game. Logs are placed in all five lanes with
 * appropriate spacing.
 */
function loadLogs() {
    // Loop for each log being placed in the game
    for (let i = laneCounts[4]; i < laneCounts[9]; i++) {
        // Load the log model
        loadModel("log.json");

        // Place the logs in each lane
        // Start by getting a translation vector based on the lane the log is in
        if (i < laneCounts[5])
            vec3.set(direction, (i - laneCounts[4]) * 3, -0.1, 7.5); // Lane 1
        else if (i < laneCounts[6])
            vec3.set(direction, (i - laneCounts[5]) * 5, -0.1, 8.5); // Lane 2
        else if (i < laneCounts[7])
            vec3.set(direction, (i - laneCounts[6]) * 11, -0.1, 9.5); // Lane 3
        else if (i < laneCounts[8])
            vec3.set(direction, (i - laneCounts[7]) * 4, -0.1, 10.5); // Lane 4
        else
            vec3.set(direction, (i - laneCounts[8]) * 7, -0.1, 11.5); // Lane 5
        mat4.fromTranslation(translate, direction); // Get the appropriate translation matrix
        mat4.multiply(modelMatrices[i], translate, modelMatrices[i]); // Translate the model matrix
        vec3.transformMat4(modelCenters[i], modelCenters[i], translate); // Translate center
    }
}

/**
 * Loads turtle models into the game. Turtles are placed in the first
 * and fourth lanes in groups of three with appropriate spacing for
 * them to be bunched together.
 */
function loadTurtles() {
    // Loop for each turtle in the game
    for (let i = laneCounts[9]; i < laneCounts[11]; i++) {
        // Load the turtle model
        loadModel("turtle.json");

        // The model is centered by default, so it just needs to be
        // scaled before it's moved
        mat4.fromScaling(scale, vec3.fromValues(0.325, 0.25, 0.25));
        mat4.multiply(modelMatrices[i], scale, modelMatrices[i]);
        vec3.transformMat4(modelCenters[i], modelCenters[i], scale);

        // Place the turtles in each lane
        // Start by getting a translation vector based on the lane the turtle is in
        if (i < laneCounts[10])
            vec3.set(direction, i - laneCounts[9] + 8, -0.075, 7.5); // Lane 1
        else
            vec3.set(direction, i - laneCounts[9] + 4, -0.075, 10.5); // Lane 4
        mat4.fromTranslation(translate, direction); // Get the appropriate translation matrix
        mat4.multiply(modelMatrices[i], translate, modelMatrices[i]); // Translate the model matrix
        vec3.transformMat4(modelCenters[i], modelCenters[i], translate); // Translate center
    }
}

/**
 * Loads a total of 5 frog models. The first 4 are placed out of bounds and
 * are used to replace the user model in the homes when they are reached. 
 * The final frog is always controlled by the user.
 */
function loadFrogs() {
    // Load 4 extra frogs to go in the homes when they're reached
    for (let i = 0; i < 4; i++) {
        // Load the frog model
        loadModel("frog.json");
        
        // Center
        mat4.fromTranslation(translate, vec3.negate(vec3.create(), modelCenters[modelSetCount - 1]));
        mat4.multiply(modelMatrices[modelSetCount - 1], translate, modelMatrices[modelSetCount - 1]);
        vec3.transformMat4(modelCenters[modelSetCount - 1], modelCenters[modelSetCount - 1], translate);
        // // Scale
        mat4.fromScaling(scale, vec3.fromValues(0.055, 0.055, 0.055));
        mat4.multiply(modelMatrices[modelSetCount - 1], scale, modelMatrices[modelSetCount - 1]);
        // Send out of bounds for recall later
        vec3.set(direction, 6.5, 0, -10);
        mat4.fromTranslation(translate, direction);
        mat4.multiply(modelMatrices[modelSetCount - 1], translate, modelMatrices[modelSetCount - 1]);
        vec3.transformMat4(modelCenters[modelSetCount - 1], modelCenters[modelSetCount - 1], translate);
    }

    // Load the frog model that the user will control last
    // This way it can be easily referenced using modelSetCount-1 as its index
    loadModel("frog.json");

    // Center
    mat4.fromTranslation(translate, vec3.negate(vec3.create(), modelCenters[modelSetCount - 1]));
    mat4.multiply(modelMatrices[modelSetCount - 1], translate, modelMatrices[modelSetCount - 1]);
    vec3.transformMat4(modelCenters[modelSetCount - 1], modelCenters[modelSetCount - 1], translate);
    // // Scale
    mat4.fromScaling(scale, vec3.fromValues(0.055, 0.055, 0.055));
    mat4.multiply(modelMatrices[modelSetCount - 1], scale, modelMatrices[modelSetCount - 1]);
    // Place
    vec3.set(direction, 6.5, 0.25, 0.5);
    mat4.fromTranslation(translate, direction);
    mat4.multiply(modelMatrices[modelSetCount - 1], translate, modelMatrices[modelSetCount - 1]);
    vec3.transformMat4(modelCenters[modelSetCount - 1], modelCenters[modelSetCount - 1], translate);
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
        let fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        let vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  

        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  

        } else {
            // no compile errors
            let shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);

            } else {
                // Activate shader program (fragment and vertex)
                gl.useProgram(shaderProgram);

                // Get pointer to vertex shader inputs:
                // Position and normal vectors
                vertexPositionAttrib = gl.getAttribLocation(shaderProgram, "aVertexPosition"); 
                gl.enableVertexAttribArray(vertexPositionAttrib);
                vertexNormalAttrib = gl.getAttribLocation(shaderProgram, "aVertexNormal");
                gl.enableVertexAttribArray(vertexNormalAttrib);

                // Model, view, projection, and normal matrix uniforms
                modelMatrixUniform = gl.getUniformLocation(shaderProgram, "uModelMatrix");
                viewMatrixUniform = gl.getUniformLocation(shaderProgram, "uViewMatrix");
                projectionMatrixUniform = gl.getUniformLocation(shaderProgram, "uProjectionMatrix");
                normalMatrixUniform = gl.getUniformLocation(shaderProgram, "uNormalMatrix");

                // Eye and light position uniforms
                eyePositionUniform = gl.getUniformLocation(shaderProgram, "uEyePosition");
                lightPositionUniform = gl.getUniformLocation(shaderProgram, "uLightPosition");

                // uvs and texture
                vertexUVAttrib = gl.getAttribLocation(shaderProgram, "aVertexUV");
                gl.enableVertexAttribArray(vertexUVAttrib);
                textureUniform = gl.getUniformLocation(shaderProgram, "uTexture");

                // Vertex colors
                vertexAmbientAttrib = gl.getAttribLocation(shaderProgram, "aAmbientColor");
                gl.enableVertexAttribArray(vertexAmbientAttrib);
                vertexDiffuseAttrib = gl.getAttribLocation(shaderProgram, "aDiffuseColor");
                gl.enableVertexAttribArray(vertexDiffuseAttrib);
                vertexSpecularAttrib = gl.getAttribLocation(shaderProgram, "aSpecularColor");
                gl.enableVertexAttribArray(vertexSpecularAttrib);
                reflectivityUniform = gl.getUniformLocation(shaderProgram, "uReflectivity");
                alphaUniform = gl.getUniformLocation(shaderProgram, "uAlpha");
            }
        }
    } catch(e) {
        console.log(e);
    }
}

/**
 * Uses a sigmoid function to ease eye movement based on the user's  movement.
 * @returns The increment to move the eye and lookat point along the z-axis
 */
function getEyeSpeed() {
    // Get the distance from where the eye should be centered
    let dist = eyePosition[2] - modelCenters[user][2] + 2;
    if (dist == 0)
        return 0; // No need to calculate if we're already centered

    // Calculate 0.25 * e^x / (10+e^x)
    // Offset to ensure f(0) = 0
    let ex = Math.exp(Math.abs(dist));
    let speed = (ex / (10 + ex) - 0.09090909090909091) / 4;

    // Return with the correct sign
    return (dist < 0) ? speed : -speed;
}

/**
 * Checks if the frog has collided with one of the cars in its lane.
 * @return true if there is a collision, false otherwise
 */
function checkCarCollision() {
    // First find the lane the frog is in
    let lane;
    if (modelCenters[user][2] > 0.5 && modelCenters[user][2] < 6.5) {
        if (modelCenters[user][2] < 2.5)
            lane = 0;
        else if (modelCenters[user][2] < 3.5)
            lane = 1;
        else if (modelCenters[user][2] < 4.5)
            lane = 2;
        else if (modelCenters[user][2] < 5.5)
            lane = 3;
        else
            lane = 4;
    } else
        return false;

    // Get the bounds of the cars to check for collisions
    let start = (lane == 0) ? 0 : laneCounts[lane - 1];
    let end = (lane == 4) ? laneCounts[lane] : laneCounts[lane + 1];

    // Loop over each car in the bounds
    for (let i = start; i < end; i++) {
        // Check if the left edge or right edge are within the bounds current car
        if (modelCenters[user][0] - 0.25 < modelCenters[i][0] + 0.75 &&
            modelCenters[user][0] + 0.25 > modelCenters[i][0] - 0.75 &&
            modelCenters[user][2] - 0.25 < modelCenters[i][2] + 0.31773 &&
            modelCenters[user][2] + 0.25 > modelCenters[i][2] - 0.31773) {
            return true;
        }
    }
    return false;
}

/**
 * Checks if the frog is on top of a log.
 * @return true if there is a collision, false otherwise
 */
function checkLogCollision() {
    // First find the lane the frog is in
    let lane;
    if (modelCenters[user][2] < 8)
        lane = 5;
    else if (modelCenters[user][2] < 9)
        lane = 6;
    else if (modelCenters[user][2] < 10)
        lane = 7;
    else if (modelCenters[user][2] < 11)
        lane = 8;
    else
        lane = 9;

    // Loop over each log in the bounds
    for (let i = laneCounts[lane - 1]; i < laneCounts[lane]; i++) {
        // Check to see if the frog's center is on the log and within the bounds of the world
        if (modelCenters[user][0] < modelCenters[i][0] + 2 &&
            modelCenters[user][0] > modelCenters[i][0] - 2 &&
            modelCenters[user][2] < modelCenters[i][2] + 0.5 &&
            modelCenters[user][2] > modelCenters[i][2] - 0.5 &&
            modelCenters[user][0] > 0.25 &&
            modelCenters[user][0] < 12.75) {
            // Move the frog along with the log
            if (lane % 2 == 0)
                vec3.set(direction, -0.035, 0, 0);
            else
                vec3.set(direction, 0.035, 0, 0);
            mat4.fromTranslation(translate, direction);
            vec3.transformMat4(target, target, translate);
            return true;
        }
    }

    return false;
}

/**
 * Checks if the frog is on top of a turtle and the turtle is
 * above the water.
 * @return true if the frog is on top of a turtle
 */
function checkTurtleCollision() {
    // Check if the frog is in one of the lanes with turtles
    if (modelCenters[user][2] > 7 && modelCenters[user][2] < 8) {
        // Loop over each turtle in this lane
        for (let i = laneCounts[9]; i < laneCounts[10]; i++) {
            // Check to see if the frog's center is on the turtle, that the turtle 
            // is above water, and that the frog is within the bounds of the world
            if (modelCenters[user][0] < modelCenters[i][0] + 0.65 &&
                modelCenters[user][0] > modelCenters[i][0] - 0.65 &&
                modelCenters[user][2] < modelCenters[i][2] + 0.5 &&
                modelCenters[user][2] > modelCenters[i][2] - 0.5 &&
                modelCenters[i][1] > -0.1 &&
                modelCenters[user][0] > 0.25 &&
                modelCenters[user][0] < 12.75) {
                // Move the frog along with the turtle
                vec3.set(direction, 0.02845, 0, 0);
                mat4.fromTranslation(translate, direction);
                vec3.transformMat4(target, target, translate);
                return true;
            }
        }
    } else if (modelCenters[user][2] > 9 && modelCenters[user][2] < 11) {
        // Loop over each turtle in this lane
        for (let i = laneCounts[10]; i < laneCounts[11]; i++) {
            // Check to see if the frog's center is on the turtle, that the turtle 
            // is above water, and that the frog is within the bounds of the world
            if (modelCenters[user][0] < modelCenters[i][0] + 0.65 &&
                modelCenters[user][0] > modelCenters[i][0] - 0.65 &&
                modelCenters[user][2] < modelCenters[i][2] + 0.5 &&
                modelCenters[user][2] > modelCenters[i][2] - 0.5 &&
                modelCenters[i][1] > -0.1 &&
                modelCenters[user][0] > 0.25 &&
                modelCenters[user][0] < 12.75) {
                // Move the frog along with the turtle
                vec3.set(direction, -0.02845, 0, 0);
                mat4.fromTranslation(translate, direction);
                vec3.transformMat4(target, target, translate);
                return true;
            }
        }
    }
    return false;
}

/**
 * Sets freeze back to false, puts the player back
 * at the start, and begins rendering again.
 */
function unfreeze() {
    // Move the user back to the start
    vec3.set(direction, 6.5 - modelCenters[user][0], 0, 0.5 - modelCenters[user][2]);
    mat4.fromTranslation(translate, direction);
    mat4.multiply(modelMatrices[user], translate, modelMatrices[user]);
    vec3.set(modelCenters[user], 6.5, 0.25, 0.5);
    vec3.set(target, 6.5, 0.25, 0.5);
    vec3.set(velocity, 0, 0, 0);

    // Re-orient the user to face forward
    if (facing != "up") {
        // Center
        mat4.fromTranslation(translate, vec3.negate(vec3.create(), modelCenters[user]));
        mat4.multiply(modelMatrices[user], translate, modelMatrices[user]);

        // Rotate
        if (!timeout && facing == "down")
            mat4.fromRotation(rotate, Math.PI, vec3.fromValues(0, 1, 0));
        else if (facing == "left")
            mat4.fromRotation(rotate, -Math.PI / 2, vec3.fromValues(0, 1, 0));
        else if (facing == "right")
            mat4.fromRotation(rotate, Math.PI / 2, vec3.fromValues(0, 1, 0));
        mat4.multiply(modelMatrices[user], rotate, modelMatrices[user]);

        // Move back
        mat4.fromTranslation(translate, modelCenters[user]);
        mat4.multiply(modelMatrices[user], translate, modelMatrices[user]);

        facing = "up"; // Set the facing
    }

    freeze = false; // Reset the flag
    requestAnimationFrame(renderModels); // Begin rendering again
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
    // Reveal the "game over" message
    document.getElementById("message").innerHTML = "GAME OVER";
    document.getElementById("endScreen").style.display = "block";
}

/**
 * Resets the game to the original state by deleting WebGL buffers, reloading
 * models, and setting game state variables to their original values.
 */
function resetGame() {
    // Delete buffers and textures
    for (let i = 0; i < modelSetCount; i++) {
        gl.deleteBuffer(vertexBuffers[i]);
        gl.deleteBuffer(triangleBuffers[i]);
        gl.deleteBuffer(normalBuffers[i]);
        gl.deleteBuffer(ambientBuffers[i]);
        gl.deleteBuffer(specularBuffers[i]);
        gl.deleteBuffer(uvBuffers[i]);
        gl.deleteTexture(textureBuffers[i]);
    }

    // Reset buffers and model variables to empty arrays / zero
    vertexBuffers, normalBuffers, ambientBuffers, diffuseBuffers, specularBuffers, reflectivityBuffers, 
    alphaBuffers, textureBuffers, uvBuffers, triangleBuffers, triangleBufferSizes = [];
    modelSetCount = 0;

    // Load models back in
    loadCars();
    loadLogs();
    loadTurtles();
    loadModel("surface.json");
    loadFrogs();
    user = modelSetCount - 1;

    // Request the next frame to start the game again
    requestAnimationFrame(renderModels);

    // Reset the game state
    timeout = false, freeze = false, pause = false, gameOver = false, win = false;
    lives = 3;
    home = [false, false, false, false, false];
    homeCount = 0;
    cooldown = 0;
    document.getElementById("progress").style.width = "0%";
    floatCycle = 75;
    lastThree = [0,0,0];
    facing = "up";
    vec3.set(velocity, 0, 0, 0);
    vec3.set(target, 6.5, 0.25, 0.5);
    vec3.set(eyePosition, 6.5, 7.5, -1.5);
    vec3.set(lookAtPoint, 6.5, 0, 1.5);

    // Reset the score panel
    document.getElementById("score").innerHTML = "Lily Pads: " + homeCount;
    document.getElementById("lives").innerHTML = "Lives: " + lives;
}

/**
 * Renders the loaded model and adjusts the world for each frame.
 */
function renderModels() {
    // Clear frame/depth buffers
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Move the eye and lookat point with the player
    // Get the difference between the last frame's position and the expected position in the
    // next frame and move the view scalar amount in that direction
    lastThree[2] = lastThree[1];
    lastThree[1] = lastThree[0];
    lastThree[0] = getEyeSpeed(); // Update the buffer of the last 3 speeds and average them
    vec3.set(direction, 0, 0, (lastThree[0] + lastThree[1] + lastThree[2]) / 3);
    mat4.fromTranslation(translate, direction);
    vec3.transformMat4(eyePosition, eyePosition, translate);
    vec3.transformMat4(lookAtPoint, lookAtPoint, translate);

    // Set up the view and perspective matrices
    // These will be the same for each triangle set
    // The lookAt matrix will follow the frog
    mat4.lookAt(viewMatrix, eyePosition, lookAtPoint, lookUpVector);
    mat4.perspective(projectionMatrix, Math.PI/3, aspectRatio, 1, 50);
    gl.uniformMatrix4fv(viewMatrixUniform, false, viewMatrix);
    gl.uniformMatrix4fv(projectionMatrixUniform, false, projectionMatrix);

    // Eye and light positions
    gl.uniform3fv(eyePositionUniform, eyePosition);
    gl.uniform3fv(lightPositionUniform, lightPosition);

    for (let i = 0; i < modelSetCount; i++) {
        // Set up the model and normal matrices
        // These are unique to each triangle set
        gl.uniformMatrix4fv(modelMatrixUniform, false, modelMatrices[i]);
        mat3.normalFromMat4(normalMatrix, mat4.multiply(mat4.create(), viewMatrix, modelMatrices[i]));
        gl.uniformMatrix3fv(normalMatrixUniform, false, normalMatrix);

        // Vertex position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[i]);
        gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);

        // Vertex normal buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[i]);
        gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0);

        // Color buffers
        // Ambient
        gl.bindBuffer(gl.ARRAY_BUFFER, ambientBuffers[i]);
        gl.vertexAttribPointer(vertexAmbientAttrib, 3, gl.FLOAT, false, 0, 0);
        // Diffuse
        gl.bindBuffer(gl.ARRAY_BUFFER, diffuseBuffers[i]);
        gl.vertexAttribPointer(vertexDiffuseAttrib, 3, gl.FLOAT, false, 0, 0);
        // Specular
        gl.bindBuffer(gl.ARRAY_BUFFER, specularBuffers[i]);
        gl.vertexAttribPointer(vertexSpecularAttrib, 3, gl.FLOAT, false, 0, 0);
        // Reflectivity
        gl.uniform1f(reflectivityUniform, reflectivityBuffers[i]);
        // Alpha
        gl.uniform1f(alphaUniform, alphaBuffers[i]);

        // Textures
        // uvs
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffers[i]);
        gl.vertexAttribPointer(vertexUVAttrib, 2, gl.FLOAT, false, 0, 0);
        // Texture objects
        gl.bindTexture(gl.TEXTURE_2D, textureBuffers[i]);
        gl.uniform1i(textureUniform, 0);

        // Triangle buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[i]);
        gl.drawElements(gl.TRIANGLES, triangleBufferSizes[i], gl.UNSIGNED_SHORT, 0);

        // Move the obsticles
        if (i < laneCounts[4]) {
            // Move the cars in their lanes
            // Calculate the direction to translate based on the lane and x-position
            if (i < laneCounts[0])
                if (modelCenters[i][0] < -0.5)
                    vec3.set(direction, 14, 0, 0);
                else
                    vec3.set(direction, -0.025, 0, 0);
            else if (i < laneCounts[1])
                if (modelCenters[i][0] > 13.5)
                    vec3.set(direction, -14, 0, 0);
                else
                    vec3.set(direction, 0.05, 0, 0);
            else if (i < laneCounts[2])
                if (modelCenters[i][0] < -0.5)
                    vec3.set(direction, 14, 0, 0);
                else
                    vec3.set(direction, -0.15, 0, 0);
            else if (i < laneCounts[3])
                if (modelCenters[i][0] > 13.5)
                    vec3.set(direction, -14, 0, 0);
                else
                    vec3.set(direction, 0.075, 0, 0);
            else
                if (modelCenters[i][0] < -0.5)
                    vec3.set(direction, 14, 0, 0);
                else
                    vec3.set(direction, -0.025, 0, 0);
            mat4.fromTranslation(translate, direction); // Get the appropriate translation matrix
            mat4.multiply(modelMatrices[i], translate, modelMatrices[i]); // Translate model matrix
            vec3.transformMat4(modelCenters[i], modelCenters[i], translate); // Translate center
        } else if (i < laneCounts[9]) {
            // Move the logs in their lanes
            // Calculate the direction to translate based on the lane and x-position
            if (i < laneCounts[5])
                if (modelCenters[i][0] > 15)
                    vec3.set(direction, -17, 0, 0);
                else
                    vec3.set(direction, 0.035, 0, 0);
            else if (i < laneCounts[6])
                if (modelCenters[i][0] < -2)
                    vec3.set(direction, 17, 0, 0);
                else
                    vec3.set(direction, -0.035, 0, 0);
            else if (i < laneCounts[7])
                if (modelCenters[i][0] > 15)
                    vec3.set(direction, -17, 0, 0);
                else
                    vec3.set(direction, 0.035, 0, 0);
            else if (i < laneCounts[8])
                if (modelCenters[i][0] < -2)
                    vec3.set(direction, 17, 0, 0);
                else
                    vec3.set(direction, -0.035, 0, 0);
            else
                if (modelCenters[i][0] > 15)
                    vec3.set(direction, -17, 0, 0);
                else
                    vec3.set(direction, 0.035, 0, 0);
            mat4.fromTranslation(translate, direction); // Get the appropriate translation matrix
            mat4.multiply(modelMatrices[i], translate, modelMatrices[i]); // Translate model matrix
            vec3.transformMat4(modelCenters[i], modelCenters[i], translate); // Translate center
        } else if (i < laneCounts[11]) {
            // Calculate the movement for floating using a cosine wave
            // Only move half the time
            //// Down -> up -> wait, repeat
            let f = (floatCycle > 31 && floatCycle < 156) ? 0 : 0.00625 * Math.cos(4 * Math.PI * floatCycle / 250);

            // Move the frogs and float them up and down
            if (i < laneCounts[10])
                if (modelCenters[i][0] > 13.15)
                    vec3.set(direction, -13.8, f, 0);
                else
                    vec3.set(direction, 0.02845, f, 0);
            else
                if (modelCenters[i][0] < -0.65)
                    vec3.set(direction, 13.8, f, 0);
                else
                    vec3.set(direction, -0.02845, f, 0);
            mat4.fromTranslation(translate, direction); // Get the appropriate translation matrix
            mat4.multiply(modelMatrices[i], translate, modelMatrices[i]); // Translate model matrix
            vec3.transformMat4(modelCenters[i], modelCenters[i], translate); // Translate center
        }
    }

    // Increment the turtle float counter, cap it at 250
    // 250 is the number of frames it will take to complete one float cycle
    floatCycle = (floatCycle + 1) % 250;

    // Decrement the explosion cooldown if it hasn't reached zero yet and update the 
    // progress bar to reflect this
    if (cooldown > 0) {
        cooldown--;
        document.getElementById("progress").style.width = (cooldown / 5) + "%";
    }

    // Get the movement direction for the player for this frame
    mat4.fromTranslation(translate, getPlayerSpeedAndDirection());
    mat4.multiply(modelMatrices[user], translate, modelMatrices[user]);
    vec3.transformMat4(modelCenters[user], modelCenters[user], translate);

    // Check for either
    // 1) A collision between the frog and a car
    // 2) The frog touching the water instead of a log/turtle
    // Lose a life if either happen
    if ((checkCarCollision() || (modelCenters[user][2] > 7 && modelCenters[user][2] < 12 && 
            !checkLogCollision() && !checkTurtleCollision())) && !freeze && !invincible) {
        // If there is no collision and the player in over the water, they lose a life
        lives--;

        // Play the death sound
        deathSound.play();

        // Take a timeout to freeze the program on the frame where the user died
        // The user will be translated back to the start point in this function so
        // they remain in place while frozen
        if (lives > 0) {
            freeze = true;
            setTimeout(unfreeze, 1000);

            // Take a timeout to prevent unwanted movement
            timeout = true;
            setTimeout(() => {timeout = false;}, 1500);
        }

        // Update the display for number of lives remaining
        document.getElementById("lives").innerHTML = "Lives: " + lives;
    }

    // Check for the user scoring
    if (modelCenters[user][2] > 12.499 && !freeze) {
        // If the user made it to a lily pad, update the score
        homeCount++;
        document.getElementById("score").innerHTML = "Lily Pads: " + homeCount;

        // Play the score sound
        scoreSound.play();

        // If this wasn't the last lilypad, reset the user to the start
        if (homeCount < 5) {
            // Move a spare frog into the home
            mat4.copy(modelMatrices[modelSetCount - (homeCount + 1)], modelMatrices[user]);
            vec3.copy(modelCenters[modelSetCount - (homeCount + 1)], modelCenters[user]);

            // Take a timeout to prevent unwanted movement
            timeout = true;
            setTimeout(() => {timeout = false;}, 1500);

            // Move the user back to the start
            vec3.set(direction, 6.5 - modelCenters[user][0], 0, 0.5 - modelCenters[user][2]);
            mat4.fromTranslation(translate, direction);
            mat4.multiply(modelMatrices[user], translate, modelMatrices[user]);
            vec3.set(modelCenters[user], 6.5, 0.25, 0.5);
            vec3.set(target, 6.5, 0.25, 0.5);
            vec3.set(velocity, 0, 0, 0);

            // Re-orient the user to face forward
            if (facing != "up") {
                // Center
                mat4.fromTranslation(translate, vec3.negate(vec3.create(), modelCenters[user]));
                mat4.multiply(modelMatrices[user], translate, modelMatrices[user]);

                // Rotate
                if (!timeout && facing == "down")
                    mat4.fromRotation(rotate, Math.PI, vec3.fromValues(0, 1, 0));
                else if (facing == "left")
                    mat4.fromRotation(rotate, -Math.PI / 2, vec3.fromValues(0, 1, 0));
                else if (facing == "right")
                    mat4.fromRotation(rotate, Math.PI / 2, vec3.fromValues(0, 1, 0));
                mat4.multiply(modelMatrices[user], rotate, modelMatrices[user]);

                // Move back
                mat4.fromTranslation(translate, modelCenters[user]);
                mat4.multiply(modelMatrices[user], translate, modelMatrices[user]);

                facing = "up"; // Set the facing
            }
        }
    }

    // Check if the game is over
    if (homeCount == 5)
        gameOver = true, win = true;
    else if (lives == 0)
        gameOver = true;

    // Request the next frame unless paused/gameover
    if (gameOver) {
        // If the game is over, let the user know if they won or lost
        if (win)
            userWin();
        else
            userLose();
    } else if (!pause && !freeze) {
        // If the game is paused, just don't request the next frame
        requestAnimationFrame(renderModels);
    }

    // If the program was loading, we can now hide the screen and set the flag to false
    if (loading) {
        document.getElementById("loadingScreen").style.display = "none";
        loading = false;
        music.play();
    }
}

/**
 * Where execution begins after window load.
 */
function main() {
    // Eye and light positions as points in space
    eyePosition = vec3.fromValues(6.5, 7.5, -1.5);
    lightPosition = vec3.fromValues(6.5, 15, 4.5);

    // View points/vectors
    lookAtPoint = vec3.fromValues(6.5, 0, 1.5); // Point being looked at
    lookUpVector = vec3.fromValues(0.0, 0.0, 1.0); // Up vector

    // Create blank matrices for later
    viewMatrix = mat4.create();
    projectionMatrix = mat4.create();
    normalMatrix = mat3.create();

    // Keep track of which homes have been found
    home = [false, false, false, false, false];
    homeCount = 0;

    setupWebGL(); // Set up the WebGL environment
    loadCars(); // Load car obsticles
    loadLogs(); // Load log obsticles
    loadTurtles(); // Load turtle obsticles
    loadModel("surface.json"); // Load the playing surface
    loadFrogs(); // Load the frogs (4 dummies, 1 to control) last
    user = modelSetCount - 1; // Get the index to reference for the user-controlled frog model
    setupShaders(); // Setup the WebGL shaders
    renderModels(); // Draw the models using WebGL

    // Controls for player movement
    // When the player begins moving, the cursor is hidden until it is moved
    addEventListener("keydown", (k) => {
        switch (k.code) {
            case "KeyW":
            case "ArrowUp":
                // Hide the cursor
                document.body.style.cursor = "none";
                cursorHidden = true;

                // Determine whether to move forward
                if (!timeout && target[2] < 11.5) {
                    // Always forward if the frog isn't trying to go into a home/the last row
                    vec3.set(target, target[0], 0.25, target[2] + 1);

                } else if (!timeout && target[2] == 11.5) {
                    // Only move into the homes if they're empty
                    // Players don't have to be exactly lined up, but make sure they get put in the
                    // middle of the lily pad
                    if (modelCenters[user][0] > 2.25 && modelCenters[user][0] < 2.75 && !home[0]) {
                        home[0] = true;
                        vec3.set(target, 2.5, 0.25, 12.5);
                    } else if (modelCenters[user][0] > 4.25 && modelCenters[user][0] < 4.75 && !home[1]) {
                        home[1] = true;
                        vec3.set(target, 4.5, 0.25, 12.5);
                    } else if (modelCenters[user][0] > 6.25 && modelCenters[user][0] < 6.75 && !home[2]) {
                        home[2] = true;
                        vec3.set(target, 6.5, 0.25, 12.5);
                    } else if (modelCenters[user][0] > 8.25 && modelCenters[user][0] < 8.75 && !home[3]) {
                        home[3] = true;
                        vec3.set(target, 8.5, 0.25, 12.5);
                    } else if (modelCenters[user][0] > 10.25 && modelCenters[user][0] < 10.75 && !home[4]) {
                        home[4] = true;
                        vec3.set(target, 10.5, 0.25, 12.5);
                    }
                }

                // Orient the frog to match the input
                if (!timeout && facing != "up") {
                    // Center
                    mat4.fromTranslation(translate, vec3.negate(vec3.create(), modelCenters[user]));
                    mat4.multiply(modelMatrices[user], translate, modelMatrices[user]);

                    // Rotate
                    if (!timeout && facing == "down")
                        mat4.fromRotation(rotate, Math.PI, vec3.fromValues(0, 1, 0));
                    else if (facing == "left")
                        mat4.fromRotation(rotate, -Math.PI / 2, vec3.fromValues(0, 1, 0));
                    else if (facing == "right")
                        mat4.fromRotation(rotate, Math.PI / 2, vec3.fromValues(0, 1, 0));
                    mat4.multiply(modelMatrices[user], rotate, modelMatrices[user]);

                    // Move back
                    mat4.fromTranslation(translate, modelCenters[user]);
                    mat4.multiply(modelMatrices[user], translate, modelMatrices[user]);

                    facing = "up"; // Set the facing
                }

                stepSound.play();
                break;
            case "KeyA":
            case "ArrowLeft":
                document.body.style.cursor = "none";
                cursorHidden = true;

                if (!timeout && target[0] < 12.5 && target[2] < 12.5) 
                    vec3.set(target, target[0] + 1, 0.25, target[2]);

                // Orient the frog to match the input
                if (!timeout && facing != "left") {
                    // Center
                    mat4.fromTranslation(translate, vec3.negate(vec3.create(), modelCenters[user]));
                    mat4.multiply(modelMatrices[user], translate, modelMatrices[user]);

                    // Rotate
                    if (facing == "up")
                        mat4.fromRotation(rotate, Math.PI / 2, vec3.fromValues(0, 1, 0));
                    else if (facing == "down")
                        mat4.fromRotation(rotate, -Math.PI / 2, vec3.fromValues(0, 1, 0));
                    else if (facing == "right")
                        mat4.fromRotation(rotate, Math.PI, vec3.fromValues(0, 1, 0));
                    mat4.multiply(modelMatrices[user], rotate, modelMatrices[user]);

                    // Move back
                    mat4.fromTranslation(translate, modelCenters[user]);
                    mat4.multiply(modelMatrices[user], translate, modelMatrices[user]);

                    facing = "left"; // Set the facing
                }

                stepSound.play();
                break;
            case "KeyS":
            case "ArrowDown":
                document.body.style.cursor = "none";
                cursorHidden = true;

                if (!timeout && target[2] > 0.5 && target[2] < 12.5)
                    vec3.set(target, target[0], 0.25, target[2] - 1);

                // Orient the frog to match the input
                if (!timeout && facing != "down") {
                    // Center
                    mat4.fromTranslation(translate, vec3.negate(vec3.create(), modelCenters[user]));
                    mat4.multiply(modelMatrices[user], translate, modelMatrices[user]);

                    // Rotate
                    if (facing == "up")
                        mat4.fromRotation(rotate, Math.PI, vec3.fromValues(0, 1, 0));
                    else if (facing == "left")
                        mat4.fromRotation(rotate, Math.PI / 2, vec3.fromValues(0, 1, 0));
                    else if (facing == "right")
                        mat4.fromRotation(rotate, -Math.PI / 2, vec3.fromValues(0, 1, 0));
                    mat4.multiply(modelMatrices[user], rotate, modelMatrices[user]);

                    // Move back
                    mat4.fromTranslation(translate, modelCenters[user]);
                    mat4.multiply(modelMatrices[user], translate, modelMatrices[user]);

                    facing = "down"; // Set the facing
                }

                stepSound.play();
                break;
            case "KeyD":
            case "ArrowRight":
                document.body.style.cursor = "none";
                cursorHidden = true;

                if (!timeout && target[0] > 0.5 && target[2] < 12.5)
                    vec3.set(target, target[0] - 1, 0.25, target[2]);

                // Orient the frog to match the input
                if (!timeout && facing != "right") {
                    // Center
                    mat4.fromTranslation(translate, vec3.negate(vec3.create(), modelCenters[user]));
                    mat4.multiply(modelMatrices[user], translate, modelMatrices[user]);

                    // Rotate
                    if (facing == "up")
                        mat4.fromRotation(rotate, -Math.PI / 2, vec3.fromValues(0, 1, 0));
                    else if (facing == "down")
                        mat4.fromRotation(rotate, Math.PI / 2, vec3.fromValues(0, 1, 0));
                    else if (facing == "left")
                        mat4.fromRotation(rotate, Math.PI, vec3.fromValues(0, 1, 0));
                    mat4.multiply(modelMatrices[user], rotate, modelMatrices[user]);

                    // Move back
                    mat4.fromTranslation(translate, modelCenters[user]);
                    mat4.multiply(modelMatrices[user], translate, modelMatrices[user]);

                    facing = "right"; // Set the facing
                }

                stepSound.play();
                break;
            case "Escape":
                // Only pause if the game is active
                if (!gameOver) {
                    if (pause) {
                        // Begin the game again
                        if (!musicPaused)
                            music.play(); // Start the music again if the user didn't pause it
                        document.getElementById("pauseScreen").style.display = "none";
                        requestAnimationFrame(renderModels);
                        pause = false;
                    } else {
                        // Pause the music and put up the pause screen
                        music.pause();
                        document.getElementById("pauseScreen").style.display = "block";
                        pause = true;
                    }
                }
                break;
            
            case "KeyR":
                // Freeze the game, wait 100 milliseconds, then reset it to ensure everything loads in sync
                document.getElementById("pauseScreen").style.display = "none";
                document.getElementById("endScreen").style.display = "none";
                document.getElementById("loadingScreen").style.display = "block"; // Display the loading dialogue
                freeze = true; // Freeze the game
                setTimeout(resetGame, 100); // Wait and reset
                break;

            case "Space":
                // Only act if we're in interesting mode and the cooldown has reached
                // zero
                if (interesting && cooldown == 0 && !timeout) {
                    // Play the explosion sound
                    explosionSound.play();

                    // Reset the cooldown
                    cooldown = 500;

                    // Loop over all cars to check their distances
                    for (let i = 0; i < laneCounts[4]; i++) {
                        // Get the vector between the current car and the player model
                        vec3.set(direction, modelCenters[i][0] - modelCenters[user][0], 0, modelCenters[i][2] - modelCenters[user][2]);

                        // If the car is within 2 units of the player, make it disappear
                        if (vec3.length(direction) < 3)
                            // Animate the explosion
                            explode(i, vec3.fromValues(direction[0], 1, direction[2]), 0, 15);
                    }
                }
                break;
        }

        // Finally, handle switching to interesting mode separately
        if (k.key == "!") {
            // Flip the interesting flag
            interesting = !interesting;

            // Reveal/hide the explosion cooldown timer
            if (interesting)
                document.getElementById("explosionPanel").style.display = "block";
            else
                document.getElementById("explosionPanel").style.display = "none";
        }
    });

    // Listen for mouse movements to reveal the cursor if it was hidden
    addEventListener("mousemove", () => {
        if (cursorHidden) {
            document.body.style.cursor = "default";
            cursorHidden = false;
        }
    });
}
