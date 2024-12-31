import Eye from "./Eye.js";

const Globals = {
    /* Assignment specific globals */
    WIN_Z: 0,                   // Default graphics window z coord in world space
    WIN_LEFT: 0, WIN_RIGHT: 1,  // Default left and right x coords in world space
    WIN_BOTTOM: 0, WIN_TOP: 1,  // Default top and bottom y coords in world space

    /** WebGL object and canvases */
    gl: null,                   // WebGL object
    canvas: undefined,          // WebGL canvas
    aspectRatio: undefined,     // Canvas aspect ratio

    /** Buffers and helper values. Sets represented as indices in the arrays */
    vertexBuffers: [],          // Vertex coordinates
    normalBuffers: [],          // Vertex normals
    ambientBuffers: [],         // Vertex ambient colors
    diffuseBuffers: [],         // Vertex diffuse colors
    specularBuffers: [],        // Vertex specular colors
    reflectivityBuffers: [],    // Vertex reflectivity
    alphaBuffers: [],           // Vertex alpha
    textureBuffers: [],         // Object textures
    uvBuffers: [],              // Object uv coordinates
    triangleBuffers: [],        // Triangle vertex indices
    triangleBufferSizes: [],    // Triangle vertex counts
    modelSetCount: 0,           // Number of sets loaded

    /** Uniforms */
    viewMatrixUniform: undefined,           // View matrix
    projectionMatrixUniform: undefined,     // Projection matrix
    eyePositionUniform: undefined,          // Eye position
    lightPositionUniform: undefined,        // Light position

    /** Matrices and helper values */
    modelCenters: [],                   // Array of model center points
    modelMatrices: [],                  // Array of model matrices for each set
    viewMatrix: mat4.create(),          // View matrix
    projectionMatrix: mat4.create(),    // Projection matrix
    normalMatrix: mat3.create(),        // Normal matrix

    /** Transformation helpers */
    translate: mat4.create(),       // Translation matrix
    rotate: mat4.create(),          // Rotation matrix
    scale: mat4.create(),           // Scaling matrix

    /** Eye and light */
    eye: new Eye(),                 // Eye (also contains light position)

    /** Models */
    surface: undefined,             // Playing surface
    carCounts: [4, 3, 1, 2, 3],     // Car counts for each lane
    cars: [],                       // Car models
    logCounts: [2, 3, 2, 1, 2],     // Log counts for each lane
    logs: [],                       // Log models
    turtleCounts: [3, 3],           // Turtle counts for each lane
    turtles: [],                    // Turtle models
    floatCycle: 75,                 // Turtle float cycle
    dummyFrogs: [],                 // Dummy frog models
    frog: undefined,                // Player model

    /** Game state */
    home: [false, false, false, false, false],  // Boolean flags for each home
    homeCount: 0,                               // How many homes have been reached
    lives: 3,                                   // Number of lives remaining
    timeout: false,                             // Timeout to prevent movement after a score or life lost
    freeze: false,                              // Freeze the game after a death
}
export default Globals;