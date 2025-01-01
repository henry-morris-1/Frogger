import Globals from "./Globals.js";

export default class Model {
    /**
     * Constructs a new Model from the given model url and puts it in the WebGL buffers.
     * @param {String} modelUrl Model url for which to load.
     * @param {String} textureUrl Texture to load for the model.
     */
    constructor(modelUrl, textureUrl) {
        this.loadModel(modelUrl, textureUrl);
    }

    /**
     * Gets a JSON file from a URL.
     * @param {string} url File url
     * @param {string} descr File description
     * @returns Specified JSON file as an array.
     */
    getJSONFile(url, descr) {
        try {
            if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
                throw "getJSONFile: parameter not a string";
            else {
                let httpReq = new XMLHttpRequest(); // a new http request
                httpReq.open("GET",url,false); // init the request
                httpReq.send(null); // send the request
                let startTime = Date.now();
                while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                    if ((Date.now()-startTime) > 3000)
                        break;
                } // until its loaded or we time out after three seconds
                if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                    throw `Unable to open ${descr} file!`;
                else
                    return JSON.parse(httpReq.response); 
            } 
        } catch(e) {
            console.log(e);
            return(String.null);
        }
    }

    /**
     * Reads models in from the input JSON files and puts them in WebGL buffers.
     * @param {string} modelUrl URL of the model to load.
     * @param {string} textureUrl URL of the texture to load.
     */
    loadModel(modelUrl, textureUrl) {
        // Get the triangles from the JSON file
        let inputModel = this.getJSONFile(modelUrl, "model");
    
        // Ensure the file contained data to parse
        if (inputModel !== String.null) {
            let set; // Index of the current set in the file
            let vertex; // Index of vertex in current triangle set
            let triangle; // Index of triangle in current triangle set
            let vertexArray; // 1D array of vertex coordinates
            let ambientArray; // 1D array of ambient colors
            let diffuseArray; // 1D array of diffuse colors
            let specularArray; // 1D array of specular colors
            let triangleArray; // 1D array of vertex indicies
            let normalArray; // 1D array of triangle normals
            let uvArray; // 1D array of uv values
            let sumX, sumY, sumZ; // Helpers for calculating model centers
            
            // Loop over each triangle set in the input file.
            // A set contains vertices and triangles comprised of those vertices.
            for (set = 0; set < inputModel.length; set++) {
                // Reset values for each set
                vertexArray = [];
                ambientArray = [];
                diffuseArray = [];
                specularArray = [];
                triangleArray = [];
                normalArray = [];
                uvArray = [];
                sumX = 0;
                sumY = 0;
                sumZ = 0;
    
                // Loop over each vertex in the set
                for (vertex = 0; vertex < inputModel[set].vertices.length; vertex++) {
                    // Append the vertex to vertexArray
                    vertexArray = vertexArray.concat(inputModel[set].vertices[vertex]);
    
                    // Add the vertex's color
                    ambientArray = ambientArray.concat(inputModel[set].material.ambient);
                    diffuseArray = diffuseArray.concat(inputModel[set].material.diffuse);
                    specularArray = specularArray.concat(inputModel[set].material.specular);
    
                    // Append the vertex normals
                    normalArray = normalArray.concat(inputModel[set].normals[vertex]);
    
                    // Append the uv coordinates
                    uvArray = uvArray.concat(inputModel[set].uvs[vertex]);
    
                    sumX += inputModel[set].vertices[vertex][0];
                    sumY += inputModel[set].vertices[vertex][1];
                    sumZ += inputModel[set].vertices[vertex][2];
                }
    
                // Add the set's reflectivity and alpha
                Globals.reflectivityBuffers[Globals.modelSetCount + set] = inputModel[set].material.n;
                Globals.alphaBuffers[Globals.modelSetCount + set] = inputModel[set].material.alpha;
    
                // Calculate the center of the set of vertices by averaging their coordinates
                Globals.modelCenters[Globals.modelSetCount + set] = vec3.fromValues(sumX, sumY, sumZ);
                vec3.scale(Globals.modelCenters[Globals.modelSetCount + set], Globals.modelCenters[Globals.modelSetCount + set], 1/inputModel[set].vertices.length);
    
                // Loop over each triangle defined in the set
                // A triangle's points are defined by their index in the set's vertex list
                for (triangle = 0; triangle < inputModel[set].triangles.length; triangle++) {
                    // Add the indices to the array
                    triangleArray = triangleArray.concat(inputModel[set].triangles[triangle]);
                }
    
                // Save the size of the triangle buffer
                Globals.triangleBufferSizes[Globals.modelSetCount + set] = triangleArray.length;
    
                // Create a modeling matrix for each set
                Globals.modelMatrices[Globals.modelSetCount + set] = mat4.create();
    
                // Load the set's texture
                Globals.textureBuffers[Globals.modelSetCount + set] = this.loadTexture(textureUrl);
    
                // Create buffers for the current set
                // Vertex coordinates
                Globals.vertexBuffers[Globals.modelSetCount + set] = Globals.gl.createBuffer();
                Globals.gl.bindBuffer(Globals.gl.ARRAY_BUFFER, Globals.vertexBuffers[Globals.modelSetCount + set]);
                Globals.gl.bufferData(Globals.gl.ARRAY_BUFFER, new Float32Array(vertexArray), Globals.gl.STATIC_DRAW);
                // Vertex normals
                Globals.normalBuffers[Globals.modelSetCount + set] = Globals.gl.createBuffer();
                Globals.gl.bindBuffer(Globals.gl.ARRAY_BUFFER, Globals.normalBuffers[Globals.modelSetCount + set]);
                Globals.gl.bufferData(Globals.gl.ARRAY_BUFFER, new Float32Array(normalArray), Globals.gl.STATIC_DRAW);
                // Vertex uvs
                Globals.uvBuffers[Globals.modelSetCount + set] = Globals.gl.createBuffer();
                Globals.gl.bindBuffer(Globals.gl.ARRAY_BUFFER, Globals.uvBuffers[Globals.modelSetCount + set]);
                Globals.gl.bufferData(Globals.gl.ARRAY_BUFFER, new Float32Array(uvArray), Globals.gl.STATIC_DRAW);
                // Ambient
                Globals.ambientBuffers[Globals.modelSetCount + set] = Globals.gl.createBuffer();
                Globals.gl.bindBuffer(Globals.gl.ARRAY_BUFFER, Globals.ambientBuffers[Globals.modelSetCount + set]);
                Globals.gl.bufferData(Globals.gl.ARRAY_BUFFER, new Float32Array(ambientArray), Globals.gl.STATIC_DRAW);
                // Diffuse
                Globals.diffuseBuffers[Globals.modelSetCount + set] = Globals.gl.createBuffer();
                Globals.gl.bindBuffer(Globals.gl.ARRAY_BUFFER, Globals.diffuseBuffers[Globals.modelSetCount + set]);
                Globals.gl.bufferData(Globals.gl.ARRAY_BUFFER, new Float32Array(diffuseArray), Globals.gl.STATIC_DRAW);
                // Specular
                Globals.specularBuffers[Globals.modelSetCount + set] = Globals.gl.createBuffer();
                Globals.gl.bindBuffer(Globals.gl.ARRAY_BUFFER, Globals.specularBuffers[Globals.modelSetCount + set]);
                Globals.gl.bufferData(Globals.gl.ARRAY_BUFFER, new Float32Array(specularArray), Globals.gl.STATIC_DRAW);
                // Triangle indices
                Globals.triangleBuffers[Globals.modelSetCount + set] = Globals.gl.createBuffer();
                Globals.gl.bindBuffer(Globals.gl.ELEMENT_ARRAY_BUFFER, Globals.triangleBuffers[Globals.modelSetCount + set]);
                Globals.gl.bufferData(Globals.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(triangleArray), Globals.gl.STATIC_DRAW);
            }
        }
        
        // Get the number of sets in the input file
        Globals.modelSetCount += inputModel.length;
    }

    /**
     * Loads an image at a given URL as a WebGL texture and returns it.
     * @param {string} url Image to load as a texture
     * @return Image as a texture
     */
    loadTexture(url) {
        // Create a new texture in WebGL
        let texture = Globals.gl.createTexture();
        Globals.gl.bindTexture(Globals.gl.TEXTURE_2D, texture);
    
        // Place a single blue pixel in the texture image temporarily
        Globals.gl.texImage2D(Globals.gl.TEXTURE_2D, 0, Globals.gl.RGBA, 1, 1, 0, Globals.gl.RGBA, Globals.gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
    
        // Clamp to edge for texture wrapping
        Globals.gl.texParameteri(Globals.gl.TEXTURE_2D, Globals.gl.TEXTURE_WRAP_S, Globals.gl.CLAMP_TO_EDGE);
        Globals.gl.texParameteri(Globals.gl.TEXTURE_2D, Globals.gl.TEXTURE_WRAP_T, Globals.gl.CLAMP_TO_EDGE);
    
        // Use linear interpolation for magnification and mipmapping for minification
        Globals.gl.texParameteri(Globals.gl.TEXTURE_2D, Globals.gl.TEXTURE_MAG_FILTER, Globals.gl.LINEAR);
        Globals.gl.texParameteri(Globals.gl.TEXTURE_2D, Globals.gl.TEXTURE_MIN_FILTER, Globals.gl.NEAREST_MIPMAP_LINEAR);
    
        // Create a new image and load it into texture
        let image = new Image();
        Globals.loadingArray.push(false); // Push a value into the loading array
        let loadingIndex = Globals.loadingArray.length - 1; // Keep the index for later
        image.onload = () => {
            Globals.gl.bindTexture(Globals.gl.TEXTURE_2D, texture);
            Globals.gl.texImage2D(Globals.gl.TEXTURE_2D, 0, Globals.gl.RGBA, Globals.gl.RGBA, Globals.gl.UNSIGNED_BYTE, image);
            Globals.gl.generateMipmap(Globals.gl.TEXTURE_2D);

            // Once loaded, set to true
            Globals.loadingArray[loadingIndex] = true;
        };
    
        // Set up cross-origin access
        image.crossOrigin = "";
        image.src = url;
    
        return texture;
    }
}